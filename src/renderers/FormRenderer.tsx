"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { AxiosError } from "axios";
import {
	Form,
	Formik,
	type FormikHelpers,
	getIn,
	setIn,
	useFormikContext,
	yupToFormErrors,
} from "formik";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type ReactElement, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { checkComponentPermission } from "../ability/checkComponentPermission";
import { ComponentRenderer } from "../ComponentRenderer";
import { ConfirmPrompt } from "../components/common/CopyableTitle";
import { BaseDialog } from "../components/dialog/BaseDialog";
import { getApiClient, useRenderUser } from "../deps";
import { buildFormSchema } from "../dynamic-form/buildValidationSchema";
import {
	allConditionsMatch,
	anyConditionMatches,
} from "../dynamic-form/fieldHelpers";
import type { FormAction } from "../dynamic-form/types";
import { useFeatures } from "../hooks/useFeatures";
import { useResolvedParams } from "../hooks/useResolvedParams";
import { useSnack } from "../hooks/useSnack";
import type { RenderedComponent, RenderedElement } from "../types";
import { adaptField, UI_TYPE_MAP } from "./FormFieldRenderer";
import { useStateContext } from "./StateContextRenderer";

// ──────────────────────────────────────────────────────────────────
// Field adapter imported from FormFieldRenderer (shared location)
// ──────────────────────────────────────────────────────────────────

/**
 * Type-appropriate Formik initial value, used when a field element
 * declares no explicit `defaultValue` override. Untouched fields are
 * submitted as-is, so array/boolean fields must not default to `""`
 * (the backend DTOs validate them as arrays/booleans).
 */
function defaultInitialValue(el: RenderedElement): unknown {
	const resolvedType = el.uiComponentId
		? (UI_TYPE_MAP[el.uiComponentId] ?? el.type ?? "text")
		: (el.type ?? "text");
	switch (resolvedType) {
		case "variants":
		case "multiselect":
		case "order-items":
			return [];
		case "switch":
			return false;
		default:
			return "";
	}
}

// ──────────────────────────────────────────────────────────────────
// Dotted-name helpers — template extras live in the `data` jsonb, so
// form fields are named "data.winePairing" etc. These set/read the
// NESTED values Formik produces/consumes for such names.
// ──────────────────────────────────────────────────────────────────

function setDottedValue(
	values: Record<string, unknown>,
	dottedName: string,
	value: unknown,
): void {
	const parts = dottedName.split(".");
	if (parts.length === 1) {
		values[parts[0]] = value;
		return;
	}
	let node = values;
	for (const part of parts.slice(0, -1)) {
		if (
			node[part] === null ||
			typeof node[part] !== "object" ||
			Array.isArray(node[part])
		) {
			node[part] = {};
		}
		node = node[part] as Record<string, unknown>;
	}
	node[parts[parts.length - 1]] = value;
}

function getDottedValue(
	obj: Record<string, unknown>,
	dottedName: string,
): unknown {
	let node: unknown = obj;
	for (const part of dottedName.split(".")) {
		if (node === null || typeof node !== "object") return undefined;
		node = (node as Record<string, unknown>)[part];
	}
	return node;
}

/** Copy plain values so payload cleanup never mutates Formik's `values`. */
function cloneFormValues<T>(value: T): T {
	if (Array.isArray(value)) {
		return value.map(cloneFormValues) as T;
	}
	if (
		value !== null &&
		typeof value === "object" &&
		Object.getPrototypeOf(value) === Object.prototype
	) {
		return Object.fromEntries(
			Object.entries(value).map(([key, child]) => [
				key,
				cloneFormValues(child),
			]),
		) as T;
	}
	return value;
}

function deleteDottedValue(
	obj: Record<string, unknown>,
	dottedName: string,
): void {
	const parts = dottedName.split(".");
	let node = obj;
	for (const part of parts.slice(0, -1)) {
		const child = node[part];
		if (child === null || typeof child !== "object" || Array.isArray(child)) {
			return;
		}
		node = child as Record<string, unknown>;
	}
	delete node[parts[parts.length - 1]];
}

/**
 * The form types whose untouched value is `""` but whose API contract is a
 * number or date. A blank one must be omitted, not sent: the DTO validates
 * `displayOrder` as a number and rejected `""` with a 400 after the client
 * schema had already accepted the form.
 */
const EMPTY_OMITTED_TYPES = new Set(["number", "date", "datetime", "map"]);

function isValueOmittedWhenBlank(field: RenderedElement): boolean {
	const type = field.uiComponentId
		? (UI_TYPE_MAP[field.uiComponentId] ?? field.type ?? "text")
		: (field.type ?? "text");
	return EMPTY_OMITTED_TYPES.has(type);
}

/** A value that satisfies no `Required` rule: absent, blank or an empty list. */
function isBlankValue(value: unknown): boolean {
	if (value === undefined || value === null) return true;
	if (typeof value === "string") return value.trim() === "";
	if (Array.isArray(value)) return value.length === 0;
	return false;
}

/**
 * Labels of the required fields that still have no value, in form order.
 *
 * Used by the submit hint so a submit that cannot succeed says *what* is
 * missing instead of silently doing nothing (the audit's "Save stays disabled
 * and no reason is shown"). The same list can be shown as a tooltip on a
 * disabled primary button.
 */
function missingRequiredLabels(
	fields: RenderedElement[],
	values: Record<string, unknown>,
): string[] {
	const labels: string[] = [];
	for (const field of fields) {
		const name = field.name;
		if (!name) continue;
		const adapted = adaptField(field) as {
			label?: string;
			isRequired?: boolean;
		};
		const requiredNow =
			Boolean(adapted.isRequired) ||
			anyConditionMatches((field.overrides as any)?.requiredWhen, values);
		if (!requiredNow) continue;
		if (!isBlankValue(getDottedValue(values, name))) continue;
		const label = String(adapted.label || name);
		if (!labels.includes(label)) labels.push(label);
	}
	return labels;
}

/**
 * Scroll the first invalid field into view and focus it.
 *
 * Validation used to paint the field red somewhere off-screen (dialog bodies
 * scroll); the user saw nothing happen. The lookup is deliberately generic:
 * by input `name`, then by id, then by MUI's label association, so it works
 * for text inputs, selects and pickers without each field component opting in.
 */
function focusInvalidField(
	root: ParentNode,
	name: string,
	label: string,
): void {
	const escaped = name.replace(/"/g, '\\"');
	const byName = root.querySelector<HTMLElement>(`[name="${escaped}"]`);
	const byId = root.querySelector<HTMLElement>(`[id="${escaped}"]`);
	const byLabel = root.querySelector<HTMLElement>(
		`[aria-labelledby~="field-select-${escaped}"]`,
	);
	const labelEl = Array.from(root.querySelectorAll("label")).find((element) =>
		(element.textContent ?? "").trim().startsWith(label),
	);
	const control =
		byName?.closest<HTMLElement>(".MuiFormControl-root") ??
		byId?.closest<HTMLElement>(".MuiFormControl-root") ??
		byLabel?.closest<HTMLElement>(".MuiFormControl-root") ??
		labelEl?.closest<HTMLElement>(".MuiFormControl-root");
	const focusable =
		control?.querySelector<HTMLElement>(
			"[role=combobox], input:not([aria-hidden=true]), textarea, select, button",
		) ??
		byName ??
		byId ??
		byLabel;
	(control ?? focusable)?.scrollIntoView({
		behavior: "smooth",
		block: "center",
	});
	focusable?.focus({ preventScroll: true });
}

// ──────────────────────────────────────────────────────────────────
// Action shape — the metadata has used three spellings over time:
//   { action: "submit" }            the current authoring Button
//   { type: "submit" }              the legacy form-action tuple
//   { action: "apiCall", method }   the renderer's internal FormAction
// All three are submits when deciding context, visibility and the footer.
// ──────────────────────────────────────────────────────────────────

interface ActionLike {
	action?: string;
	type?: string;
	method?: string;
	context?: string;
}

function isSubmitAction(action: ActionLike | null | undefined): boolean {
	if (!action) return false;
	return (
		action.action === "apiCall" ||
		action.action === "submit" ||
		action.type === "submit"
	);
}

/** A submit that writes (excludes the legacy `GET` record-fetch action). */
function isFormSubmit(action: ActionLike | null | undefined): boolean {
	return (
		isSubmitAction(action) &&
		String(action?.method ?? "POST").toUpperCase() !== "GET"
	);
}

// ──────────────────────────────────────────────────────────────────
// FormSideEffects — metadata-declared field resets.
//
// A field may declare `clearFieldsOnChange: ["a", "b"]`; whenever its value
// changes (from the second render on, so an edit-form prefill does not wipe the
// loaded record), the listed fields return to their initial values. The message
// form uses it to clear the template/subject/body when the channel changes.
// ──────────────────────────────────────────────────────────────────

function FormSideEffects({
	specs,
}: {
	specs: Array<{ watch: string; clear: string[] }>;
}): null {
	const { values, initialValues, setFieldValue } =
		useFormikContext<Record<string, unknown>>();
	const previous = useRef<Record<string, unknown>>({});
	const firstRun = useRef(true);

	useEffect(() => {
		if (firstRun.current) {
			firstRun.current = false;
			for (const spec of specs) {
				previous.current[spec.watch] = getDottedValue(values, spec.watch);
			}
			return;
		}

		for (const spec of specs) {
			const current = getDottedValue(values, spec.watch);
			if (current === previous.current[spec.watch]) continue;
			previous.current[spec.watch] = current;
			for (const name of spec.clear) {
				const fallback = getDottedValue(initialValues, name);
				setFieldValue(
					name,
					Array.isArray(fallback) ? [] : (fallback ?? ""),
					false,
				);
			}
		}
	}, [values, initialValues, setFieldValue, specs]);

	return null;
}

// ──────────────────────────────────────────────────────────────────
// MarkTouchedOnSubmit — reveal field errors after a submit attempt.
//
// The Formik MUI fields only render `helperText` when `touched[name]` is
// true. Formik does not mark fields touched on submit, so submitting an
// untouched empty form validated (and blocked the POST) but showed no
// message at all. Once the first submit is attempted, mark every field
// touched; the validation errors then become visible.
// ──────────────────────────────────────────────────────────────────

function MarkTouchedOnSubmit({ names }: { names: string[] }): null {
	const { submitCount, setTouched } =
		useFormikContext<Record<string, unknown>>();
	const handledSubmit = useRef(0);

	useEffect(() => {
		if (submitCount <= handledSubmit.current) return;
		handledSubmit.current = submitCount;
		const touched: Record<string, unknown> = {};
		// Nested (dotted) names must be set with `setIn`: Formik reads
		// `touched.data.name`, so a literal `"data.name"` key never matched and
		// template fields showed no message after a failed submit.
		for (const name of names) setIn(touched, name, true);
		setTouched(touched as Record<string, boolean>, false);
	}, [names, setTouched, submitCount]);

	return null;
}

// ──────────────────────────────────────────────────────────────────
// FocusFirstError — put the user on the field that blocked the submit.
//
// Field errors are rendered under the field, but in a long form (or a
// scrolling dialog body) the first one can be far from the submit button.
// After a failed submit, scroll it into view and focus it, so "nothing
// happened" is never the whole answer.
// ──────────────────────────────────────────────────────────────────

function FocusFirstError({ fields }: { fields: RenderedElement[] }): null {
	const { submitCount, errors } = useFormikContext<Record<string, unknown>>();
	const handledSubmit = useRef(0);

	useEffect(() => {
		// Do not consume the attempt until the error list exists: Formik
		// dispatches SUBMIT_ATTEMPT first and SET_ERRORS after the async
		// validation, so the first effect run still sees an empty `errors`.
		if (submitCount === 0 || submitCount === handledSubmit.current) return;
		const firstInvalid = fields.find((field) =>
			Boolean(field.name && getIn(errors, field.name)),
		);
		if (!firstInvalid?.name) return;
		handledSubmit.current = submitCount;
		const label = String(
			(adaptField(firstInvalid) as { label?: string }).label ??
				firstInvalid.name,
		);

		// Let Formik paint the touched/error state before scrolling to it.
		const timer = setTimeout(() => {
			focusInvalidField(
				document.querySelector("[data-dynamic-form]") ?? document.body,
				firstInvalid.name as string,
				label,
			);
		}, 0);
		return () => clearTimeout(timer);
	}, [errors, fields, submitCount]);

	return null;
}

/**
 * The helper next to the submit that names the fields still missing.
 *
 * Shown only after a submit attempt (not while the user is still filling the
 * form), and only when there is something to list.
 */
function MissingFieldsHint({
	fields,
}: {
	fields: RenderedElement[];
}): ReactElement | null {
	const { values, submitCount } = useFormikContext<Record<string, unknown>>();
	const t = useTranslations();

	if (submitCount === 0) return null;
	const missing = missingRequiredLabels(fields, values);
	if (missing.length === 0) return null;

	const list = missing.join(", ");
	const message = t.has("menuBuilder.missing")
		? t("menuBuilder.missing", { fields: list })
		: `Still needed: ${list}`;

	return (
		<Typography variant="caption" color="text.secondary">
			{message}
		</Typography>
	);
}

// ──────────────────────────────────────────────────────────────────
// FormRenderer
// ──────────────────────────────────────────────────────────────────

export function FormRenderer({
	component,
	onSuccess,
	onError,
	context,
	onClose,
	recordId,
	onFormReady,
	pathParams,
}: {
	component: RenderedComponent;
	onSuccess?: (res: any) => void;
	onError?: (err: unknown) => void;
	context?: string;
	onClose?: () => void;
	recordId?: string;
	onFormReady?: (api: {
		submitForm: () => Promise<void>;
		submitLabel: string;
		closeLabel: string;
		/** A `sendNow` submit: save the record, then confirm and send it. */
		submitNow?: { label: string; onClick: () => Promise<void> };
	}) => void;
	pathParams?: Record<string, string>;
}): ReactElement {
	const snack = useSnack();
	// Fallbacks for messages Yup generates itself (required/type). The host may
	// not ship a `validation` namespace, in which case `t("required")` would
	// render the literal key under the field — a missing translation is worse
	// than the English default, so check before asking.
	const t = useTranslations();
	const validationMessage = (
		key: "required" | "number" | "date",
		fallback: string,
	): string => {
		const path = `validation.${key}`;
		return t.has(path) ? t(path) : fallback;
	};
	// Dialog-footer fallbacks. A form without a metadata `close` action used to
	// fall back to the English "Close" here, which then overrode the translated
	// default in BaseDialogActions.
	const tc = useTranslations("common");
	const router = useRouter();
	const pathname = usePathname();
	const { data: user } = useRenderUser();
	const { features } = useFeatures();
	const userPermissions: Array<{ resource: string; scope?: string }> =
		(user as any)?.permissions?.data ?? [];
	// Route params + the current user's tenant (for {tenantId} templates).
	const resolvedPathParams = useResolvedParams(pathParams);

	// ── Check visibleToPermissions on a referenced component ──
	const isComponentVisible = (
		ref: RenderedComponent | null | undefined,
	): boolean => {
		if (!ref) return true;
		return checkComponentPermission(
			userPermissions,
			ref.visibleToPermissions?.length
				? (ref.visibleToPermissions as any)
				: null,
		);
	};

	// ── Check visibleWhen condition ──
	const isVisible = (el: RenderedElement): boolean => {
		if (!el.isActive) return false;
		const vw = (el.overrides as any)?.visibleWhen;
		if (vw?.context && Array.isArray(vw.context)) {
			if (!(context && vw.context.includes(context))) return false;
		}
		// Additional context gate for fields that ALSO carry value conditions
		// (visibleWhen cannot express both shapes at once).
		const vic = (el.overrides as any)?.visibleInContexts;
		if (
			Array.isArray(vic) &&
			vic.length > 0 &&
			!(context && vic.includes(context))
		) {
			return false;
		}
		// Permission-gated fields (e.g. tenant owner/status — only for
		// users with the all-scope permission). Hidden fields must also
		// stay out of validation/initialValues so they don't block submit.
		const vp = (el.overrides as any)?.visibleToPermissions;
		if (vp?.length && !checkComponentPermission(userPermissions, vp)) {
			return false;
		}
		// Feature-gated fields: `requiresFeature` shows only when the flag is
		// ON; `hiddenWhenFeature` hides when the flag is ON (e.g. version-level
		// fields on the package form, which belong to the versions screen).
		const rf = (el.overrides as any)?.requiresFeature;
		if (rf && !features[rf]) {
			return false;
		}
		const hwf = (el.overrides as any)?.hiddenWhenFeature;
		if (hwf && features[hwf]) {
			return false;
		}
		return true;
	};

	// ── Check readOnlyWhen condition ──
	const isFieldReadOnly = (el: RenderedElement): boolean => {
		const rw = (el.overrides as any)?.readOnlyWhen;
		if (!rw) return (el.overrides as any)?.isReadOnly ?? false;
		if (rw.context && Array.isArray(rw.context)) {
			if (context && rw.context.includes(context)) return true;
		}
		return (el.overrides as any)?.isReadOnly ?? false;
	};

	const contentElements = useMemo(
		() => (component.slotsFilled["content"] ?? []).filter((e) => e.isActive),
		[component.slotsFilled],
	);

	const allFields = useMemo(() => {
		const fields: RenderedElement[] = [];

		const walkElements = (els: RenderedElement[]) => {
			for (const el of els) {
				if (!isVisible(el)) continue;

				// ── Check referenced component's visibleToPermissions ──
				if (
					el.elementType === "component_ref" &&
					el.referencedComponent &&
					!isComponentVisible(el.referencedComponent)
				) {
					continue;
				}

				if (el.elementType === "field") {
					fields.push(el);
				} else if (
					el.elementType === "component_ref" &&
					el.referencedComponent
				) {
					// Recurse into any component (Stack/Grid/Box/…) — fields
					// are collected generically, no section special-case.
					walkElements(
						Object.values(el.referencedComponent.slotsFilled).flat(),
					);
				}
			}
		};

		walkElements(Object.values(component.slotsFilled).flat());
		return fields;
	}, [component, context, userPermissions]);

	// Names of the currently visible fields — a failed submit marks them all
	// touched so their validation messages appear (see MarkTouchedOnSubmit).
	const fieldNames = useMemo(
		() =>
			allFields
				.map((field) => field.name)
				.filter((name): name is string => Boolean(name)),
		[allFields],
	);

	/**
	 * Field-to-field side effects declared by the metadata: a controlling field
	 * (`channel`) lists the fields it invalidates (`clearFieldsOnChange`). When
	 * its value changes, those fields reset to their own defaults — a channel
	 * switch must not keep an SMS template/body on an email message.
	 */
	const resetSpecs = useMemo(
		() =>
			allFields.flatMap((el) => {
				const clear = (el.overrides as any)?.clearFieldsOnChange;
				if (!Array.isArray(clear) || clear.length === 0 || !el.name) return [];
				return [{ watch: el.name, clear: clear.map(String) }];
			}),
		[allFields],
	);

	// Submission config lives on the FORM (config.submit) — the submit
	// button is just a Button with action: "submit". Legacy seeds that
	// carried it on the button still work via the cfg.* fallbacks.
	const submitCfg = (component.config as any)?.submit as
		| {
				endpoint?: string;
				method?: string;
				context?: "create" | "edit";
				successMessage?: string;
				successRedirect?: string;
				stateContext?: string;
				fieldMap?: Record<string, string>;
		  }
		| undefined;

	// Actions live in the "actions" slot as Button/Link components — map
	// them back to the FormAction shape the footer + handleSubmit consume.
	const actions = useMemo<FormAction[]>(() => {
		const out: FormAction[] = [];
		for (const el of component.slotsFilled["actions"] ?? []) {
			const ref =
				el.elementType === "component_ref" ? el.referencedComponent : null;
			if (!ref) continue;
			const cfg = (ref.config ?? {}) as {
				label?: string;
				action?: string;
				/** Legacy submit spelling (form-action tuple). */
				type?: string;
				path?: string;
				endpoint?: string;
				method?: "POST" | "PUT" | "PATCH";
				context?: "create" | "edit";
				successMessage?: string;
				successRedirect?: string;
				stateContext?: string;
				fieldMap?: Record<string, string>;
				/** Save then send (message builder's "Send now"). */
				sendNow?: boolean;
				confirm?: { title?: string; message?: string };
			};
			const label = cfg.label ?? ref.displayName;
			if (ref.blueprintName === "link") {
				out.push({ action: "link", label, path: cfg.path ?? "/" });
			} else if (ref.blueprintName === "button") {
				if (cfg.action === "submit" || cfg.type === "submit") {
					out.push({
						action: "apiCall",
						label,
						endpoint: submitCfg?.endpoint ?? cfg.endpoint ?? "",
						method: (submitCfg?.method ?? cfg.method ?? "POST") as any,
						context: submitCfg?.context ?? cfg.context,
						successMessage: submitCfg?.successMessage ?? cfg.successMessage,
						successRedirect: submitCfg?.successRedirect ?? cfg.successRedirect,
						...(cfg.sendNow ? { sendNow: true } : {}),
						...(cfg.confirm ? { confirm: cfg.confirm } : {}),
						...(submitCfg?.stateContext || cfg.stateContext
							? { stateContext: submitCfg?.stateContext ?? cfg.stateContext }
							: {}),
						...(submitCfg?.fieldMap || cfg.fieldMap
							? { fieldMap: submitCfg?.fieldMap ?? cfg.fieldMap }
							: {}),
					} as any);
				} else if (cfg.action === "close") {
					out.push({ action: "cancel", label });
				}
			}
		}
		return out;
	}, [component.slotsFilled, submitCfg]);

	/**
	 * The actions slot is the normal home of the submit button, but a form may
	 * declare its submission on the FORM (`config.submit`) while the slot holds
	 * no submit at all — older seeds did exactly that, and the screen rendered
	 * with no Save (the UX-8 audit). Synthesize the API action from the form's
	 * own submit config so the renderer always owes the user a visible submit.
	 */
	const formActions = useMemo<FormAction[]>(() => {
		const hasApiSubmit = actions.some((action) =>
			isFormSubmit(action as ActionLike),
		);
		if (hasApiSubmit || !submitCfg?.endpoint) return actions;
		return [
			...actions,
			{
				action: "apiCall",
				label: tc("submit"),
				endpoint: submitCfg.endpoint,
				method: submitCfg.method ?? "POST",
				context: submitCfg.context,
				successMessage: submitCfg.successMessage,
				successRedirect: submitCfg.successRedirect,
				...(submitCfg.stateContext
					? { stateContext: submitCfg.stateContext }
					: {}),
				...(submitCfg.fieldMap ? { fieldMap: submitCfg.fieldMap } : {}),
			} as any,
		];
	}, [actions, submitCfg, tc]);

	// ── Fetch record data for edit mode ──
	const editEndpoint = useMemo(() => {
		const editAction = formActions.find(
			(action) =>
				action.context === "edit" && isFormSubmit(action as ActionLike),
		) as any;
		// A form mounted by an id-less screen (Settings → Messaging) has no
		// `edit` context, but still edits one record: its GET action is the
		// record fetch even without the context marker.
		const fetchAction =
			editAction ??
			(formActions.find(
				(action) =>
					isSubmitAction(action as ActionLike) &&
					String((action as ActionLike).method).toUpperCase() === "GET",
			) as any);
		return fetchAction?.endpoint ?? null;
	}, [formActions]);
	const needsRecordId = editEndpoint ? /\{id\}/.test(editEndpoint) : false;

	// Derive effective context from the form's own submit actions.
	//
	// A detail screen passes `context="edit"` only when its path pattern carries
	// `:id`; a screen that uses another param (`:menuId`) or none at all
	// (Settings → Currency) passes `"create"`. A form whose only submit is an
	// `edit` action is still an edit form — otherwise the action was filtered
	// out and the screen rendered no Save at all (UX-8, Menu Information and
	// Settings → Currency). The screen's context wins only when the form really
	// has an action for it (so a create+edit dialog still picks the right one).
	const effectiveContext = useMemo(() => {
		const submitContexts = Array.from(
			new Set(
				formActions
					.filter((action) => isFormSubmit(action as ActionLike))
					.map((action: any) => action.context)
					.filter((value): value is string => Boolean(value)),
			),
		);
		if (
			context &&
			(submitContexts.length === 0 || submitContexts.includes(context))
		) {
			return context;
		}
		if (submitContexts.length === 1) return submitContexts[0];
		if (submitContexts.includes("edit")) return "edit";
		if (submitContexts.includes("create")) return "create";
		return context ?? "create";
	}, [context, formActions]);

	const { data: recordData } = useSWR(
		editEndpoint &&
			(!needsRecordId ||
				!!recordId ||
				!!(
					resolvedPathParams &&
					"id" in (resolvedPathParams as Record<string, unknown>)
				))
			? editEndpoint.replace(/\{(\w+)\}/g, (_: string, key: string) => {
					if (key === "id" && recordId) return recordId;
					if (resolvedPathParams && key in resolvedPathParams)
						return String(resolvedPathParams[key] ?? "");
					return `{${key}}`;
				})
			: null,
		async (url: string) => {
			try {
				const r = await getApiClient().get(url);
				return r.data?.data ?? r.data ?? null;
			} catch {
				return null;
			}
		},
	);

	const initialValues = useMemo(() => {
		const values: Record<string, unknown> = {};
		// First, apply default values from overrides. An untouched switch must be
		// a BOOLEAN, not the `""` scalar fallback: a SwitchField with no configured
		// default submitted `isActive: ""`, which the API rejects as a 400 (CRM-29 —
		// creating a customer group failed exactly this way).
		for (const field of allFields) {
			const name = field.name ?? "";
			if (name) {
				const configured = (field.overrides as any)?.defaultValue;
				setDottedValue(
					values,
					name,
					configured !== undefined && configured !== null
						? configured
						: defaultInitialValue(field),
				);
			}
		}
		// Then, overlay pathParams for matching field names. A **dotted** key
		// (`audienceParams.groupId`) prefills a nested value, which is how a row
		// action opens the campaign form with its audience already chosen (CRM-27).
		if (pathParams) {
			for (const [key, value] of Object.entries(pathParams)) {
				if (key.includes(".")) setDottedValue(values, key, value);
				else if (key in values) values[key] = value;
			}
		}
		// Then, overlay record data for edit mode (dotted names resolve
		// nested values, e.g. "data.winePairing" ← record.data.winePairing).
		// The fetch only runs when there is an edit/GET action to read, so a form
		// mounted on an id-less screen (Settings → Messaging) also opens prefilled.
		if (recordData) {
			const src = recordData as Record<string, unknown>;
			for (const field of allFields) {
				const name = field.name ?? "";
				if (!name) continue;
				const v = getDottedValue(src, name);
				if (v !== undefined && v !== null) setDottedValue(values, name, v);
			}
		}
		return values;
	}, [allFields, recordData, effectiveContext, pathParams]);

	// Validation is built per submit from the fields that are actually visible
	// for the current values — a conditional field that is hidden must not
	// block the form with its `Required` rule (`audienceParams.groupId` is
	// required only for a group audience, `schedule.weekdays` only weekly…).
	//
	// `sendNow` skips the schedule fields entirely: "send it right now" has no
	// date or time, so those required rules must not stop the confirmation.
	const validateForm = (values: Record<string, unknown>, sendNow = false) => {
		const fields = allFields
			.filter((field) => {
				if (sendNow && (field.name ?? "").startsWith("schedule.")) {
					return false;
				}
				const conditions = (field.overrides as any)?.visibleWhen;
				if (!Array.isArray(conditions) || conditions.length === 0) return true;
				return allConditionsMatch(conditions, values);
			})
			.map((field) => {
				const adapted = adaptField(field, isFieldReadOnly(field)) as any;
				const requiredWhen = (field.overrides as any)?.requiredWhen;
				const requiredNow =
					adapted.isRequired ||
					(Array.isArray(requiredWhen) &&
						anyConditionMatches(requiredWhen, values));
				return { ...adapted, isRequired: requiredNow };
			});

		if (fields.length === 0) return {};
		const schema = buildFormSchema(
			{
				sections: [],
				ungroupedFields: fields,
			} as any,
			{
				required: validationMessage("required", "This field is required"),
				number: validationMessage("number", "Enter a number"),
				date: validationMessage("date", "Enter a valid date"),
			},
		);
		try {
			schema.validateSync(values, { abortEarly: false });
			return {};
		} catch (error) {
			if ((error as { name?: string })?.name === "ValidationError") {
				return yupToFormErrors(error);
			}
			throw error;
		}
	};

	// Filter actions by context if provided (exclude GET-only "fetch" actions from submit buttons)
	const visibleApiActions = useMemo(
		() =>
			formActions.filter(
				(action: any) =>
					isFormSubmit(action as ActionLike) &&
					(!(effectiveContext && action.context) ||
						action.context === effectiveContext),
			),
		[formActions, effectiveContext],
	);

	/**
	 * The dialog's primary submit is "Save draft"; a `sendNow` submit is the
	 * secondary footer action. Keeping them apart means the footer never POSTs
	 * a send when the admin only wanted to save.
	 */
	const primaryApiActions = useMemo(
		() => visibleApiActions.filter((a: any) => !a.sendNow),
		[visibleApiActions],
	);
	const sendNowAction = useMemo(
		() => visibleApiActions.find((a: any) => a.sendNow) as any,
		[visibleApiActions],
	);

	/**
	 * Does an action-button belong to the form's current context?
	 *
	 * A shared create+edit form declares one submit per context. The submit path
	 * already picked the right one, but the **buttons** were rendered unfiltered —
	 * so a detail page showed CREATE *and* UPDATE, and clicking the first one
	 * POSTed instead of saving the edit (CRM-28: the Active switch "did not
	 * persist" because the click never reached the PATCH). A button with no
	 * `context` is always shown.
	 */
	const actionInContext = (button: RenderedComponent | null | undefined) => {
		const actionContext = (button?.config as { context?: string } | null)
			?.context;
		if (!(actionContext && effectiveContext)) return true;
		return actionContext === effectiveContext;
	};

	/**
	 * A **record fetch** is a submit-shaped action with `GET`: the form reads the
	 * row it is editing from it and must not render it as a button. The submit
	 * path already ignores GET actions; the actions row leaked them until now
	 * (CRM-25: the edit form opened blank because it had no fetch action).
	 */
	const isRecordFetch = (button: RenderedComponent | null | undefined) => {
		const config = button?.config as ActionLike | null | undefined;
		return (
			isSubmitAction(config) &&
			String(config?.method ?? "").toUpperCase() === "GET"
		);
	};

	const stateCtx = useStateContext();

	/**
	 * A form mounted by a **detail page** (not a dialog) renders its own action
	 * row, including the metadata's `close` button. That button had no handler
	 * there — `onClose` is only provided by dialogs — so "Close" did nothing on
	 * the page. Fall back to the parent route (the list the detail page was
	 * opened from), which is where a close should land.
	 */
	const closeTarget = useMemo(() => {
		if (!pathname) return null;
		const parent = pathname.replace(/\/[^/]+\/?$/, "");
		return parent && parent !== pathname ? parent : null;
	}, [pathname]);

	const handleClose = onClose
		? onClose
		: () => {
				if (closeTarget) router.push(closeTarget);
				else router.back();
			};

	// ── "Save then send" (the message builder's Send now) ─────────
	// The submitted action picks its own mode through this ref: Formik's
	// submitForm is the only entry point the dialog footer has, so the secondary
	// button sets the mode and then submits.
	const submitModeRef = useRef<"submit" | "sendNow">("submit");
	const [pendingSend, setPendingSend] = useState<null | {
		endpoint: string;
		title: string;
		dialogTitle: string;
		message: string;
	}>(null);
	const [sendTyped, setSendTyped] = useState("");
	const [sending, setSending] = useState(false);

	const handleSubmit = async (
		values: Record<string, unknown>,
		helpers: FormikHelpers<Record<string, unknown>>,
	) => {
		const mode = submitModeRef.current;
		submitModeRef.current = "submit";
		const submitAction = (
			mode === "sendNow" ? sendNowAction : primaryApiActions[0]
		) as any;
		if (!submitAction) {
			console.warn(
				"[FormRenderer] submit pressed but no submit action found — actions slot:",
				component.slotsFilled["actions"] ?? [],
			);
			return;
		}
		try {
			const endpoint = submitAction.endpoint.replace(
				/\{(\w+)\}/g,
				(_: string, key: string) => {
					if (key === "id" && recordId) return recordId;
					if (resolvedPathParams && key in resolvedPathParams)
						return String(resolvedPathParams[key] ?? "");
					return `{${key}}`;
				},
			);

			// If the action references a state context, use the context values as payload
			const contextName = (submitAction as any).stateContext;
			let payload =
				contextName && stateCtx
					? {
							operationIds:
								(stateCtx.getValue("selectedIds") as string[]) ?? [],
						}
					: cloneFormValues(values);

			// A blank number/date input is `""` in Formik but an invalid value
			// for the API (`displayOrder` failed its number DTO). Omit it so the
			// column default — or, on PATCH, the stored value — applies.
			if (!(contextName && stateCtx)) {
				for (const field of allFields) {
					const name = field.name;
					if (!name || !isValueOmittedWhenBlank(field)) continue;
					if (getDottedValue(payload, name) === "") {
						deleteDottedValue(payload, name);
					}
				}
			}

			// Apply fieldMap: rename payload keys (e.g. tenantId → ownerTenantId)
			const fieldMap = (submitAction as any).fieldMap as
				| Record<string, string>
				| undefined;
			if (fieldMap && typeof payload === "object" && payload !== null) {
				const mapped: Record<string, unknown> = {
					...(payload as Record<string, unknown>),
				};
				for (const [from, to] of Object.entries(fieldMap)) {
					if (from in mapped) {
						mapped[to] = mapped[from];
						delete mapped[from];
					}
				}
				payload = mapped;
			}

			// "Send now" is not a schedule: the draft is created without a run
			// time, so an empty (never filled) schedule must not go to the API —
			// it would fail its own "pick a date and time" validation.
			if (mode === "sendNow" && payload && typeof payload === "object") {
				const { schedule: _schedule, ...rest } = payload as Record<
					string,
					unknown
				>;
				payload = rest;
			}

			const res = await getApiClient().request({
				url: endpoint,
				method: (submitAction.method ?? "POST").toLowerCase(),
				data: payload,
			});

			// "Send now": the POST saved a draft, so the send is one confirmation
			// away — with the title retyped, exactly like the list's row action.
			if (mode === "sendNow") {
				const createdId = res.data?.data?.id ?? res.data?.id;
				if (createdId) {
					setSendTyped("");
					setPendingSend({
						endpoint: `${String(endpoint).replace(/\/+$/, "")}/${createdId}/send`,
						title: String(
							(values as Record<string, unknown>).title ?? "",
						).trim(),
						dialogTitle: submitAction.confirm?.title ?? "Send now",
						message: submitAction.confirm?.message ?? "",
					});
					return;
				}
			}

			if (onSuccess) onSuccess(res.data);
			if (submitAction.successMessage)
				snack.success(submitAction.successMessage);
			if (submitAction.successRedirect)
				router.push(
					submitAction.successRedirect.replace(
						/\{(\w+)\}/g,
						(_: string, key: string) => {
							if (key === "id" && recordId) return recordId;
							if (resolvedPathParams && key in resolvedPathParams)
								return String(resolvedPathParams[key] ?? "");
							return `{${key}}`;
						},
					),
				);
		} catch (err) {
			console.log({ err });
			if (onError) onError(err);
			snack.error(err);
		} finally {
			helpers.setSubmitting(false);
		}
	};

	// Close actions (non-submit buttons)
	const closeActions = formActions.filter(
		(a: any) => a.action === "close" || a.action === "cancel",
	);

	// Resolve action labels for the dialog footer
	const submitLabel = (primaryApiActions[0] as any)?.label ?? tc("submit");
	const closeLabel = (closeActions[0] as any)?.label ?? tc("close");

	// Ref to hold Formik's submitForm for the parent dialog
	const submitFormRef = useRef<(() => Promise<void>) | null>(null);

	/** Confirm the draft that was just saved and send it now. */
	const confirmSendNow = async () => {
		if (!pendingSend) return;
		setSending(true);
		try {
			const res = await getApiClient().request({
				url: pendingSend.endpoint,
				method: "post",
				data: { confirmTitle: sendTyped.trim() },
			});
			const message: string =
				res.data?.data?.message ??
				res.data?.message ??
				"Message is being prepared";
			await snack.success(message);
			setPendingSend(null);
			if (onSuccess) onSuccess(res.data);
		} catch (error) {
			await snack.error(error, "Send failed");
		} finally {
			setSending(false);
		}
	};

	// Notify parent dialog when form is ready (only if there are submit actions)
	useEffect(() => {
		if (onFormReady && submitFormRef.current && primaryApiActions.length > 0) {
			onFormReady({
				submitForm: () => submitFormRef.current!(),
				submitLabel,
				closeLabel,
				...(sendNowAction
					? {
							submitNow: {
								label: sendNowAction.label ?? "Send now",
								onClick: async () => {
									submitModeRef.current = "sendNow";
									await submitFormRef.current!();
								},
							},
						}
					: {}),
			});
		}
	}, [
		onFormReady,
		submitLabel,
		closeLabel,
		primaryApiActions.length,
		sendNowAction,
	]);

	// ── No form fields — render content directly (e.g. table inside form dialog) ──
	const hasNoFields = allFields.length === 0;

	if (hasNoFields) {
		return (
			<Box>
				{!onFormReady && component.displayName && (
					// `sx` for the same reason as the header above: Tailwind
					// classes in this package never reach the stylesheet.
					<Typography variant="h5" sx={{ mb: 2, fontWeight: 700 }}>
						{component.displayName}
					</Typography>
				)}
				{/* Render non-field content (tables, state-context, etc.) */}
				{contentElements
					.filter(
						(el) =>
							el.elementType === "component_ref" && el.referencedComponent,
					)
					.sort((a, b) => a.displayOrder - b.displayOrder)
					.map((el) => (
						<Box key={el.id}>
							<ComponentRenderer
								component={el.referencedComponent!}
								pathParams={pathParams}
								paramBindings={el.paramBindings}
								context={context}
							/>
						</Box>
					))}
			</Box>
		);
	}

	return (
		<Formik
			initialValues={initialValues}
			validate={(values) =>
				// The mode is set by the footer button immediately before the
				// submit, so validation knows whether "send now" is in play.
				validateForm(values, submitModeRef.current === "sendNow")
			}
			onSubmit={handleSubmit}
			enableReinitialize
		>
			{({ submitForm, isSubmitting }) => {
				submitFormRef.current = submitForm as unknown as () => Promise<void>;
				// Only the current context's buttons: a create+edit form must not
				// offer both (CRM-28). `sendNow` is a footer action, not part of
				// the in-form action row.
				const actionButtons = (component.slotsFilled["actions"] ?? [])
					.filter(
						(el) =>
							el.isActive &&
							el.elementType === "component_ref" &&
							el.referencedComponent &&
							!(el.referencedComponent.config as any)?.sendNow &&
							actionInContext(el.referencedComponent) &&
							!isRecordFetch(el.referencedComponent),
					)
					.sort((a, b) => a.displayOrder - b.displayOrder);
				const hasSubmitButton = actionButtons.some((el) => {
					const config = el.referencedComponent?.config as
						| ActionLike
						| null
						| undefined;
					return config?.action === "submit" || config?.type === "submit";
				});
				// An edit form always shows a submit: if the metadata only slots
				// a Close (or no action at all) but the form/submit action exists,
				// render the primary button ourselves.
				const showFallbackSubmit =
					!onFormReady && primaryApiActions.length > 0 && !hasSubmitButton;
				return (
					<>
						<Form data-dynamic-form>
							<FormSideEffects specs={resetSpecs} />
							<MarkTouchedOnSubmit names={fieldNames} />
							<FocusFirstError fields={allFields} />
							{!onFormReady && component.displayName && (
								// Spacing is `sx`, not Tailwind: this package is built to
								// `dist/` and imported from node_modules, which Tailwind
								// does not scan — `className="mb-6"` here compiles to
								// nothing, which left the description sitting on the
								// first field's floating label.
								<Box sx={{ mb: 3 }}>
									<Typography variant="h5" sx={{ fontWeight: 700 }}>
										{component.displayName}
									</Typography>
									{component.description && (
										<Typography
											variant="body2"
											color="text.secondary"
											sx={{ mt: 0.5 }}
										>
											{component.description}
										</Typography>
									)}
								</Box>
							)}

							{/* Render all content elements through ComponentRenderer.
							    They are the form's sections, so the stack is what keeps
							    one section's title from sitting on the previous field —
							    the gap belongs to the form, not to each section. It is
							    wider than a section's inner spacing (3) so a title reads
							    as a new group, not as another field. */}
							<Stack spacing={4}>
								{contentElements
									.filter(
										(el) =>
											el.elementType === "component_ref" &&
											el.referencedComponent &&
											isVisible(el) &&
											isComponentVisible(el.referencedComponent),
									)
									.sort((a, b) => a.displayOrder - b.displayOrder)
									.map((el) => (
										<Box key={el.id}>
											<ComponentRenderer
												component={el.referencedComponent!}
												pathParams={pathParams}
												paramBindings={el.paramBindings}
												context={context}
											/>
										</Box>
									))}
							</Stack>

							{/* Actions slot — rendered from the metadata tree
	                (Button/Link components via their own renderers). Only the
	                current context's buttons: a create+edit form must not offer
	                both (CRM-28). */}
							{!onFormReady &&
								(actionButtons.length > 0 || showFallbackSubmit) && (
									<Stack
										direction="row"
										spacing={2}
										sx={{ mt: 3, alignItems: "center", flexWrap: "wrap" }}
									>
										{actionButtons.map((el) => (
											<ComponentRenderer
												key={el.id}
												component={el.referencedComponent!}
												pathParams={pathParams}
												paramBindings={el.paramBindings}
												onClose={handleClose}
											/>
										))}
										{showFallbackSubmit && (
											<Button
												type="submit"
												variant="contained"
												disabled={isSubmitting}
											>
												{isSubmitting ? (
													<CircularProgress size={20} color="inherit" />
												) : (
													submitLabel
												)}
											</Button>
										)}
									</Stack>
								)}
							<MissingFieldsHint fields={allFields} />
						</Form>
						{pendingSend && (
							<BaseDialog
								isOpen
								title={pendingSend.dialogTitle}
								onClose={() => setPendingSend(null)}
								isPending={sending}
								onSubmit={() => void confirmSendNow()}
								slotProps={{
									submitButton: {
										props: {
											children: "Send now",
											disabled: sendTyped.trim() !== pendingSend.title,
										},
										// A disabled primary explains itself: the
										// confirmation is one typed title away.
										tooltip:
											sendTyped.trim() !== pendingSend.title
												? tc("confirmTypeTitle", { title: pendingSend.title })
												: null,
									},
								}}
							>
								<Typography component="div" className="leading-7">
									<ConfirmPrompt
										message={pendingSend.message}
										title={pendingSend.title}
									/>
								</Typography>
								<TextField
									fullWidth
									autoFocus
									className="mt-4"
									label="Type the title to confirm"
									value={sendTyped}
									onChange={(event) => setSendTyped(event.target.value)}
									error={
										sendTyped.length > 0 &&
										sendTyped.trim() !== pendingSend.title
									}
								/>
							</BaseDialog>
						)}
					</>
				);
			}}
		</Formik>
	);
}
