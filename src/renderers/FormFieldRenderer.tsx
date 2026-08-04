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
import {
	FormAutocompleteField,
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
	FormSwitchField,
	FormTextareaField,
	FormTextField,
} from "../dynamic-form/fields";
import type { RenderField } from "../dynamic-form/types";
import type { RenderedElement } from "../types";

// ─────────────────────────────────────────────────────────────
// UI Type Map
// ─────────────────────────────────────────────────────────────

/** Maps UI component CUIDs to their DynamicField type name */
export const UI_TYPE_MAP: Record<string, string> = {
	ehyogseqi0finqr3nxvrloz9: "text",
	ntei44cohh13u9ucn39vcyk6: "textarea",
	yre76a811cgd0gah7slikx7n: "number",
	ljim0jdtwehy2u4bmizcl5l1: "email",
	tocuq2ddmh63873sozdtsxzv: "password",
	ulrl8i5mvw8xdtx1mvy8nweh: "select",
	n1a36mr1qezahbe933cvyfob: "multiselect",
	xeygn35o9r4wwqffgkfnrk7v: "radio",
	ug6fakpjm1i4lmuovsnt0avo: "checkbox",
	doz363xcy9jvlqsfrhznhtzq: "switch",
	e18e47v29py88decf28m2b8v: "autocomplete",
	drjllunrc3zl0bt1dztjcmp6: "reference",
	s07ljezsn03enysedxu5g9r7: "richtext",
	iohrvkm1dpkg2yg5d6wuv7z8: "json",
};

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
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

function FormFieldRendererInner({
	element,
}: FormFieldRendererProps): ReactElement | null {
	const { values } = useFormikContext<Record<string, unknown>>();
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const field = adaptField(element) as any as RenderField;

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
				.with({ type: "radio" }, unimplemented)
				.with({ type: "checkbox" }, unimplemented)
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
