// ═══════════════════════════════════════════════════════════════
// FormFieldRenderer – Adapts a RenderedElement into a
// RenderField descriptor, then renders the appropriate form
// field component via exhaustive ts-pattern matching.
//
// This operates WITHIN a Formik context — the parent
// (FormRenderer or Formik provider) must supply it.
// ═══════════════════════════════════════════════════════════════
"use client";

import { useFormikContext } from "formik";
import { memo, type ReactElement, useMemo } from "react";
import { match } from "ts-pattern";
import { evaluateFieldConditions } from "../dynamic-form/fieldHelpers";
import { useFeatures, type FeatureFlags } from "../hooks/useFeatures";
import {
	FormAutocompleteField,
	FormCheckboxField,
	FormColorField,
	FormDateField,
	FormEmailField,
	FormImageField,
	FormJsonField,
	FormMultiSelectField,
	FormNumberField,
	FormPasswordField,
	FormReferenceField,
	FormSelectField,
	FormSettingValueField,
	FormSwitchField,
	FormTextareaField,
	FormTextField,
	IconPickerField,
	VariantEditorField,
} from "../dynamic-form/fields";
import type { RenderField } from "../dynamic-form/types";
import type { RenderedElement } from "../types";
import { UI_COMPONENTS_SEED } from "../ui-components";

// ─────────────────────────────────────────────────────────────
// UI Type Map
// ─────────────────────────────────────────────────────────────

/**
 * Maps UI component id → dynamic-field type name.
 *
 * Derived from the canonical UI_COMPONENTS_SEED (the same source the
 * backend `ui_components` table is seeded from) so the two can never
 * drift. Keys are stringified numeric ids.
 */
export const UI_TYPE_MAP: Record<string, string> = Object.fromEntries(
	UI_COMPONENTS_SEED.map((c) => [String(c.id), c.componentType]),
);

// ─────────────────────────────────────────────────────────────
// Field Adapter
// ─────────────────────────────────────────────────────────────

/**
 * Converts a RenderedElement (from the arch component tree) into
 * a field descriptor object compatible with the dynamic-form
 * field components.
 */
export function adaptField(
	el: RenderedElement,
	readOnlyOverride?: boolean,
): Record<string, unknown> {
	const ov = el.overrides ?? {};
	const resolvedType = el.uiComponentId
		? (UI_TYPE_MAP[el.uiComponentId] ?? el.type ?? "text")
		: (el.type ?? "text");
	return {
		id: el.id,
		name: el.name ?? el.fieldDefinitionId ?? el.id,
		label: (ov as any)?.displayName ?? el.label ?? "",
		type: resolvedType,
		isRequired: (ov as any)?.isRequired ?? false,
		isReadOnly: readOnlyOverride ?? (ov as any)?.isReadOnly ?? false,
		order: el.displayOrder,
		formId: "",
		validations: (ov as any)?.validations ?? [],
		fieldOverrides: ov,
		datasource: (ov as any)?.datasource ?? null,
		creatable: (ov as any)?.creatable ?? false,
		uiOverrides: {
			behavior: { placeholder: (ov as any)?.placeholder, autoFocus: false },
			layout: {},
		},
		fieldDefinitionId: el.fieldDefinitionId,
		uiComponentId: el.uiComponentId,
		uiComponent: el.uiComponentId
			? {
					name: "",
					displayName: null,
					componentType: el.uiComponentId,
					configProps: null,
				}
			: null,
		tenantId: null,
		isActive: true,
		colSpan: (ov as any)?.colSpan ?? null,
		visibleWhen: (ov as any)?.visibleWhen ?? null,
		disabledWhen: (ov as any)?.disabledWhen ?? null,
		requiredWhen: (ov as any)?.requiredWhen ?? null,
	};
}

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

export interface FormFieldRendererProps {
	element: RenderedElement;
	/** Dialog context ("create" | "edit") — drives visibleWhen/readOnlyWhen. */
	context?: string;
}

// ─────────────────────────────────────────────────────────────
// Feature gating
// ─────────────────────────────────────────────────────────────

/**
 * Feature gating for a field element's overrides:
 * - `requiresFeature`   — the field renders only when the flag is ON
 * - `hiddenWhenFeature` — the field hides when the flag is ON
 *
 * Shared by FormFieldRenderer (Formik path) and LayoutChildren's
 * read-only fallback so feature-gated fields never render anywhere.
 */
export function isFieldFeatureVisible(
	overrides: Record<string, unknown> | null | undefined,
	features: FeatureFlags,
): boolean {
	const rf = (overrides as any)?.requiresFeature as string | undefined;
	if (rf && !features[rf]) return false;
	const hwf = (overrides as any)?.hiddenWhenFeature as string | undefined;
	if (hwf && features[hwf]) return false;
	return true;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

function FormFieldRendererInner({
	element,
	context,
}: FormFieldRendererProps): ReactElement | null {
	const { values } = useFormikContext<Record<string, unknown>>();
	const { features } = useFeatures();
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const field = adaptField(element) as any as RenderField;
	const ov = element.overrides as Record<string, unknown> | null;

	// Feature-gated fields — `requiresFeature` shows only when the flag is
	// ON, `hiddenWhenFeature` hides when the flag is ON (e.g. the MI
	// instance selector on the service form behind `multi_mi_instance`).
	if (!isFieldFeatureVisible(ov, features)) return null;

	// Context-based visibility — e.g. visibleWhen: {context: ["create"]}
	// (the field only exists while creating; hidden in edit dialogs).
	const vw = (ov as any)?.visibleWhen as { context?: string[] } | undefined;
	if (vw?.context?.length && !(context && vw.context.includes(context))) {
		return null;
	}

	// Context-based readonly — e.g. readOnlyWhen: {context: ["edit"]}
	// (the value is assigned at creation and immutable afterwards).
	const rw = (ov as any)?.readOnlyWhen as { context?: string[] } | undefined;
	const contextReadOnly = rw?.context?.length
		? Boolean(context && rw.context.includes(context))
		: false;
	if (contextReadOnly) field.isReadOnly = true;

	// Hidden fields carry values into the submit payload (prefilled via
	// pathParams/defaults) but render nothing — e.g. the plan's
	// packageVersionId on the subscription create form.
	if ((field.fieldOverrides as any)?.hidden === true) return null;

	const conditions = useMemo(
		() => evaluateFieldConditions(field, values),
		[field, values],
	);

	if (!conditions.isVisible) return null;

	return (
		<>
			{match(field)
				.with({ type: "text" }, (f) => (
					<FormTextField
						field={
							{
								...f,
								isRequired: conditions.isRequired,
								isReadOnly: conditions.isDisabled,
							} as any
						}
					/>
				))
				.with({ type: "color" }, (f) => (
					<FormColorField
						field={
							{
								...f,
								isRequired: conditions.isRequired,
								isReadOnly: conditions.isDisabled,
							} as any
						}
					/>
				))
				.with({ type: "textarea" }, (f) => (
					<FormTextareaField
						field={
							{
								...f,
								isRequired: conditions.isRequired,
								isReadOnly: conditions.isDisabled,
							} as any
						}
					/>
				))
				.with({ type: "select" }, (f) => (
					<FormSelectField
						field={
							{
								...f,
								isRequired: conditions.isRequired,
								isReadOnly: conditions.isDisabled,
							} as any
						}
					/>
				))
				.with({ type: "switch" }, (f) => (
					<FormSwitchField
						field={
							{
								...f,
								isRequired: conditions.isRequired,
								isReadOnly: conditions.isDisabled,
							} as any
						}
					/>
				))
				.with({ type: "checkbox" }, (f) => (
					<FormCheckboxField
						field={
							{
								...f,
								isRequired: conditions.isRequired,
								isReadOnly: conditions.isDisabled,
							} as any
						}
					/>
				))
				.with({ type: "settingValue" }, (f) => (
					<FormSettingValueField
						field={
							{
								...f,
								isRequired: conditions.isRequired,
								isReadOnly: conditions.isDisabled,
							} as any
						}
					/>
				))
				.with({ type: "number" }, (f) => (
					<FormNumberField
						field={
							{
								...f,
								isRequired: conditions.isRequired,
								isReadOnly: conditions.isDisabled,
							} as any
						}
					/>
				))
				.with({ type: "password" }, (f) => (
					<FormPasswordField
						field={
							{
								...f,
								isRequired: conditions.isRequired,
								isReadOnly: conditions.isDisabled,
							} as any
						}
					/>
				))
				.with({ type: "reference" }, (f) => (
					<FormReferenceField
						field={
							{
								...f,
								isRequired: conditions.isRequired,
								isReadOnly: conditions.isDisabled,
							} as any
						}
					/>
				))
				.with({ type: "email" }, (f) => (
					<FormEmailField
						field={
							{
								...f,
								isRequired: conditions.isRequired,
								isReadOnly: conditions.isDisabled,
							} as any
						}
					/>
				))
				.with({ type: "image" }, (f) => (
					<FormImageField
						field={
							{
								...f,
								isRequired: conditions.isRequired,
								isReadOnly: conditions.isDisabled,
							} as any
						}
					/>
				))
				.with({ type: "autocomplete" }, (f) => (
					<FormAutocompleteField
						field={
							{
								...f,
								isRequired: conditions.isRequired,
								isReadOnly: conditions.isDisabled,
							} as any
						}
					/>
				))
				.with({ type: "json" }, (f) => (
					<FormJsonField
						field={
							{
								...f,
								isRequired: conditions.isRequired,
								isReadOnly: conditions.isDisabled,
								// Custom Monaco options/height from the element overrides
								// (e.g. minimal read-only viewer for audit logs).
								editorOptions: (f as any).fieldOverrides?.editorOptions,
								height: (f as any).fieldOverrides?.height,
								bordered: (f as any).fieldOverrides?.bordered ?? true,
							} as any
						}
					/>
				))
				.with({ type: "date" }, (f) => (
					<FormDateField
						field={
							{
								...f,
								isRequired: conditions.isRequired,
								isReadOnly: conditions.isDisabled,
							} as any
						}
					/>
				))
				.with({ type: "multiselect" }, (f) => (
					<FormMultiSelectField
						field={
							{
								...f,
								isRequired: conditions.isRequired,
								isReadOnly: conditions.isDisabled,
							} as any
						}
					/>
				))
				.with({ type: "variants" }, (f) => (
					<VariantEditorField
						field={
							{
								...f,
								isRequired: conditions.isRequired,
								isReadOnly: conditions.isDisabled,
							} as any
						}
					/>
				))
				.with({ type: "icon" }, (f) => (
					<IconPickerField
						field={
							{
								...f,
								isRequired: conditions.isRequired,
								isReadOnly: conditions.isDisabled,
							} as any
						}
					/>
				))
				.with({ type: "radio" }, unimplemented)
				.with({ type: "datetime" }, unimplemented)
				.with({ type: "time" }, unimplemented)
				.with({ type: "file" }, unimplemented)
				.with({ type: "richtext" }, unimplemented)
				.exhaustive()}
		</>
	);
}

export const FormFieldRenderer = memo(FormFieldRendererInner);
FormFieldRenderer.displayName = "FormFieldRenderer";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function unimplemented(field: RenderField): null {
	console.warn(
		`[FormFieldRenderer] Field type "${field.type}" is not yet implemented. Field name: "${field.name}".`,
	);
	return null;
}
