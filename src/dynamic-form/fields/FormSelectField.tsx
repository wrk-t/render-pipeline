// ═══════════════════════════════════════════════════════════════
// FormSelectField – Renders a select dropdown field.
//
// Supports both static options and service datasources (including
// resolved entity datasources). When a service datasource is
// present, options are fetched once on mount via SWR.
//
// CONTROLLED value: uses `useField` and always passes `value ?? ""`
// to the native <select>. A select must stay controlled from the
// first render (an uncontrolled→controlled switch warns and
// misbehaves), and an empty string maps to the placeholder option.
// ═══════════════════════════════════════════════════════════════
"use client";

import { useField } from "formik";
import type { ReactElement } from "react";
import useSWR from "swr";
import { checkComponentPermission } from "../../ability/checkComponentPermission";
import { getApiClient, useRenderUser } from "../../deps";
import { fieldAccessibleName } from "../fieldHelpers";
import type {
	EntityMeta,
	FieldDatasource,
	SelectField,
	SelectOption,
} from "../types";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function toSelectOption(item: unknown, entityMeta?: EntityMeta): SelectOption {
	if (item === null || item === undefined) return { label: "", value: "" };
	const obj = item as Record<string, unknown>;
	if ("label" in obj && "value" in obj) {
		return { label: String(obj.label ?? ""), value: obj.value };
	}
	const displayField = entityMeta?.displayField;
	const valueField = entityMeta?.valueField ?? "id";
	return {
		label: String(
			obj[displayField ?? "displayName"] ??
				obj.displayName ??
				obj.name ??
				obj.label ??
				"",
		),
		value: obj[valueField] ?? obj.id ?? obj.value,
	};
}

/** Native select skin shared across the metadata-driven fields. */
const SELECT_CLASS =
	"w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60";

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function FormSelectField({
	field,
}: {
	field: SelectField;
}): ReactElement {
	const { data: user } = useRenderUser();
	const userPermissions: Array<{ resource: string; scope?: string }> =
		user?.permissions?.data ?? [];

	// ── Resolve datasource ─────────────────────────────────────
	const ds = field.fieldOverrides?.datasource as FieldDatasource | undefined;
	const isService = ds?.type === "service";
	const isStatic = ds?.type === "static";

	const serviceDs = isService
		? (ds as Extract<FieldDatasource, { type: "service" }>)
		: null;

	const staticOptions: SelectOption[] =
		isStatic && "options" in ds
			? (ds.options as SelectOption[])
			: (field.options ?? []);

	const entityMeta = serviceDs?.entityMeta;

	// ── Fetch service data once on mount ───────────────────────
	const { data: serviceData } = useSWR(
		serviceDs ? [serviceDs.endpoint, "selectOptions"] : null,
		async () => {
			if (!serviceDs) return [];
			const baseUrl = process.env.NEXT_PUBLIC_ENDPOINT ?? "";

			const params = new URLSearchParams();
			// Request a larger page size for select dropdowns (all options)
			params.set("limit", "1000");

			if (entityMeta?.filter) {
				// Filter params are passed directly (e.g. ?status=active),
				// matching the backend's filterableFields per entity.
				params.set(entityMeta.filter.field, String(entityMeta.filter.value));
			}
			if (entityMeta?.orderBy) {
				params.set("sortBy", entityMeta.orderBy.field);
				params.set("sortOrder", entityMeta.orderBy.direction);
			}

			const qs = params.toString();
			const url = `${baseUrl}${serviceDs.endpoint}${qs ? `?${qs}` : ""}`;

			const res = await getApiClient().request({
				url,
				method: serviceDs.method ?? "GET",
			});
			const body = res.data?.data;
			if (Array.isArray(body)) return body;
			if (body && Array.isArray(body.data)) return body.data;
			return [];
		},
	);

	// ── Build final options ────────────────────────────────────
	const options: SelectOption[] = serviceDs
		? Array.isArray(serviceData)
			? serviceData.map((item: unknown) => toSelectOption(item, entityMeta))
			: []
		: staticOptions;

	// Filter out options gated by visibleToPermissions (e.g. the scope
	// "all" option is only offered to users whose own create ceiling
	// is "all").
	const visibleOptions = options.filter(
		(opt) =>
			!opt.visibleToPermissions ||
			opt.visibleToPermissions.length === 0 ||
			checkComponentPermission(userPermissions, opt.visibleToPermissions),
	);

	// ── Controlled value (never undefined — see header comment) ──
	const [{ value }, meta, { setValue, setTouched }] = useField<string>(
		field.name,
	);
	const isError = Boolean(meta.touched && meta.error);
	// A select with no resolvable label was announced by its id (a CUID) —
	// bind the label (and a fallback name) explicitly so every screen is named.
	const inputId = `field-select-${field.name}`;
	const accessibleName = fieldAccessibleName(field);
	const placeholder = field.uiOverrides?.behavior?.placeholder ?? "Select…";

	return (
		<div className="flex flex-col gap-1">
			<label htmlFor={inputId} className="text-sm font-medium text-foreground">
				{field.label}
				{field.isRequired ? (
					<span className="text-destructive" aria-hidden="true">
						{" "}
						*
					</span>
				) : null}
			</label>
			<select
				id={inputId}
				name={field.name}
				aria-label={accessibleName}
				aria-invalid={isError || undefined}
				aria-required={field.isRequired || undefined}
				value={value ?? ""}
				disabled={field.isReadOnly}
				onChange={(event) => {
					setValue(event.target.value as string);
					setTouched(true);
				}}
				onBlur={() => setTouched(true)}
				className={[
					SELECT_CLASS,
					isError
						? "border-destructive focus:border-destructive focus:ring-destructive/20"
						: "focus:border-ring",
				].join(" ")}
			>
				{/* The old MUI select had no empty item, so a chosen value could
				    not be cleared; keep the placeholder non-selectable. */}
				<option value="" disabled className="text-muted-foreground">
					{placeholder}
				</option>
				{visibleOptions.map((opt) => (
					<option
						key={String(opt.value)}
						value={String(opt.value ?? "")}
						disabled={opt.disabled}
					>
						{opt.label}
					</option>
				))}
			</select>
			{isError && <p className="text-xs text-destructive">{meta.error}</p>}
			{field.fieldOverrides?.description ? (
				<p className="ps-1 text-xs text-muted-foreground">
					{field.fieldOverrides.description}
				</p>
			) : null}
		</div>
	);
}
