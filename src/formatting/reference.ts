// ──────────────────────────────────────────────────────────────────
// Reference formatting — a relation renders as its human label, never
// the stored id.
//
// The `reference` column type receives one of:
//   - an expanded object (`{ id, displayName, … }`) — the backend joined it
//   - a bare id — resolved from static options, the row's sibling fields
//     (`customerName`, `customer.displayName`) or the field's datasource
//
// The id is kept (returned) so an action can still use it; the cell
// exposes it as `data-reference-id` and never prints it.
// ──────────────────────────────────────────────────────────────────

import type { ReferenceOption } from "./types";

export type { ReferenceOption };

/** Shape of the datasource the authoring seed / backend attaches. */
export interface ReferenceDatasource {
	type?: string;
	endpoint?: string;
	method?: string;
	params?: Record<string, unknown>;
	options?: ReferenceOption[] | null;
	entityMeta?: {
		displayField?: string;
		valueField?: string;
		labelTemplate?: string;
	} | null;
}

export interface ReferenceFormatOptions {
	/** Object field holding the label (e.g. "displayName"). */
	displayField?: string;
	/** Alias of `displayField`. */
	labelField?: string;
	/** Field holding the id (default "id"). */
	valueField?: string;
	/** Template with `{field}` tokens, e.g. "{firstName} {lastName}". */
	labelTemplate?: string;
	/** Static options (`{ label, value }`) for a bare id. */
	options?: ReferenceOption[] | null;
	/** Field datasource from the seed (static, service or entity). */
	datasource?: ReferenceDatasource | null;
	/** Convenience service endpoint when no datasource is attached. */
	endpoint?: string;
	method?: string;
	params?: Record<string, unknown>;
	entityMeta?: ReferenceDatasource["entityMeta"];
	/** Row field holding a label when the value is only an id. */
	labelRowField?: string;
	/** Placeholder for a missing reference (default "—"). */
	emptyLabel?: string;
	/** Optional link template with `{id}` (e.g. "/dashboard/customers/{id}"). */
	href?: string;
}

export interface ResolvedReference {
	id: string | null;
	label: string | null;
}

/**
 * 24-char CUIDs and UUIDs. A label is never allowed to be one of these —
 * that would put an id back in the cell.
 */
const ID_LIKE = /^[a-z0-9]{24}$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Fields that commonly hold a human label, in fallback order. */
const LABEL_FIELDS = [
	"displayName",
	"name",
	"title",
	"number",
	"label",
	"email",
	"slug",
];

/** True when a string is an opaque id and must not be shown as a label. */
export function looksLikeId(value: unknown): boolean {
	return typeof value === "string" && ID_LIKE.test(value.trim());
}

/** True when the value can be a human label. */
function isLabel(value: unknown): value is string | number {
	if (typeof value === "number") return Number.isFinite(value);
	if (typeof value !== "string") return false;
	const text = value.trim();
	return text.length > 0 && !ID_LIKE.test(text);
}

/** Read a dotted path ("party.name") from a row. */
function getPath(
	source: Record<string, unknown> | null | undefined,
	path: string,
): unknown {
	if (!source) return undefined;
	return path
		.split(".")
		.reduce<unknown>(
			(current, key) =>
				current && typeof current === "object"
					? (current as Record<string, unknown>)[key]
					: undefined,
			source,
		);
}

/** Fill a "{field} token" template from a row. */
function renderTemplate(
	template: string,
	row: Record<string, unknown> | null | undefined,
): string | null {
	if (!row) return null;
	const text = template.replace(/\{(\w+(?:\.\w+)*)\}/g, (_match, key: string) => {
		const value = getPath(row, key);
		return isLabel(value) ? String(value) : "";
	});
	return isLabel(text) ? text.trim() : null;
}

/** The label of an expanded relation object. */
export function labelFromObject(
	value: Record<string, unknown> | null | undefined,
	props?: ReferenceFormatOptions | null,
): string | null {
	if (!value) return null;

	const displayField =
		props?.displayField ??
		props?.labelField ??
		props?.datasource?.entityMeta?.displayField ??
		props?.entityMeta?.displayField;
	if (displayField) {
		const label = getPath(value, displayField);
		if (isLabel(label)) return String(label).trim();
	}

	const template =
		props?.labelTemplate ??
		props?.datasource?.entityMeta?.labelTemplate ??
		props?.entityMeta?.labelTemplate;
	if (template) {
		const label = renderTemplate(template, value);
		if (label) return label;
	}

	for (const field of LABEL_FIELDS) {
		const label = getPath(value, field);
		if (isLabel(label)) return String(label).trim();
	}
	return null;
}

function staticOptions(
	props?: ReferenceFormatOptions | null,
): ReferenceOption[] {
	return props?.options ?? props?.datasource?.options ?? [];
}

function valueField(props?: ReferenceFormatOptions | null): string {
	return (
		props?.valueField ??
		props?.datasource?.entityMeta?.valueField ??
		props?.entityMeta?.valueField ??
		"id"
	);
}

/** Match an id against a static option list, returning its label. */
export function referenceLabelForId(
	id: string | null | undefined,
	props?: ReferenceFormatOptions | null,
): string | null {
	if (id === null || id === undefined || id === "") return null;
	const field = valueField(props);
	const match = staticOptions(props).find((option) => {
		const value = getPath(option as unknown as Record<string, unknown>, field);
		return String(value ?? option.value) === String(id);
	});
	return match && isLabel(match.label) ? String(match.label).trim() : null;
}

/** The stored id behind a reference value (object or bare id). */
export function referenceId(
	value: unknown,
	props?: ReferenceFormatOptions | null,
): string | null {
	if (value === null || value === undefined || value === "") return null;
	if (typeof value === "object") {
		const id = getPath(value as Record<string, unknown>, valueField(props));
		return id === null || id === undefined || id === "" ? null : String(id);
	}
	if (typeof value === "string" || typeof value === "number") {
		return String(value);
	}
	return null;
}

/**
 * A label when the value itself carries one (expanded object, static
 * option, or a plain string that is not an id). `null` means the caller
 * must resolve the bare id (datasource/row).
 */
export function referenceLabelFromValue(
	value: unknown,
	props?: ReferenceFormatOptions | null,
): string | null {
	if (value === null || value === undefined || value === "") return null;
	if (typeof value === "object") {
		return labelFromObject(value as Record<string, unknown>, props);
	}
	if (typeof value === "string") {
		const option = referenceLabelForId(value, props);
		if (option) return option;
		// A plain, non-id string is already a human label (some endpoints
		// return `customerName` in the reference column).
		return isLabel(value) ? value.trim() : null;
	}
	if (typeof value === "number") {
		return referenceLabelForId(String(value), props);
	}
	return null;
}

/** The label of the related row carried alongside the id, if any. */
export function rowReferenceLabel(
	row: Record<string, unknown> | null | undefined,
	fieldName: string | null | undefined,
	props?: ReferenceFormatOptions | null,
): string | null {
	if (!row) return null;

	if (props?.labelRowField) {
		const label = getPath(row, props.labelRowField);
		if (isLabel(label)) return String(label).trim();
	}

	const base = (fieldName ?? "").replace(/(Ids?|_ids?)$/i, "");
	if (base) {
		// `actorUserId` relates to `row.actor`; `customerId` to `row.customer`.
		const bases = [base, base.replace(/User$/i, "")].filter(
			(candidate, index, all) =>
				candidate.length > 0 && all.indexOf(candidate) === index,
		);
		for (const candidate of bases) {
			const related = getPath(row, candidate);
			if (related && typeof related === "object") {
				const label = labelFromObject(
					related as Record<string, unknown>,
					props,
				);
				if (label) return label;
			}
			for (const suffix of ["Name", "DisplayName", "Label", "Title"]) {
				const label = getPath(row, `${candidate}${suffix}`);
				if (isLabel(label)) return String(label).trim();
			}
		}
	}

	// The id itself is never echoed here; the datasource/cell resolves it.
	return null;
}

export interface ResolveReferenceContext {
	row?: Record<string, unknown> | null;
	fieldName?: string | null;
}

/** Resolve everything a reference cell needs in one call. */
export function resolveReference(
	value: unknown,
	props?: ReferenceFormatOptions | null,
	context?: ResolveReferenceContext,
): ResolvedReference {
	const id = referenceId(value, props);
	const label =
		referenceLabelFromValue(value, props) ??
		referenceLabelForId(id, props) ??
		rowReferenceLabel(context?.row, context?.fieldName, props);
	return { id, label };
}

/** A link template for the reference (`/dashboard/customers/{id}`), if any. */
export function referenceHref(
	props: ReferenceFormatOptions | null | undefined,
	id: string | null,
): string | null {
	const template = props?.href;
	if (!template || !id) return null;
	return template.replace(/\{id\}/g, encodeURIComponent(id));
}
