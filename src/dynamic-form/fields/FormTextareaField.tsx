// ═══════════════════════════════════════════════════════════════
// FormTextareaField – Renders a multi-line text input field.
// ═══════════════════════════════════════════════════════════════
"use client";

import { useField } from "formik";
import { type ReactElement, useId } from "react";
import type { TextareaField } from "../types";
import { AudienceRuleAssistantField } from "./AudienceRuleAssistantField";
import { VariableSuggestField } from "./VariableSuggestField";

export function FormTextareaField({
	field,
}: {
	field: TextareaField;
}): ReactElement {
	const [formikField, meta] = useField(field.name);
	const inputId = useId();
	const errorId = `${inputId}-error`;
	const descriptionId = `${inputId}-description`;
	const isError = Boolean(meta.touched && meta.error);
	const description = field.fieldOverrides?.description;
	const describedBy =
		[isError ? errorId : undefined, description ? descriptionId : undefined]
			.filter(Boolean)
			.join(" ") || undefined;

	// A group's rule is authored by the AI assistant, not typed as raw JSON.
	if ((field.fieldOverrides as any)?.ruleAssistant) {
		return <AudienceRuleAssistantField field={field} />;
	}

	// The body editor suggests `{{namespace.key}}` tokens as the admin types.
	if ((field.fieldOverrides as any)?.variableAutocomplete) {
		return <VariableSuggestField field={field} multiline />;
	}

	return (
		<div className="flex flex-col gap-0.5">
			<label htmlFor={inputId} className="text-sm font-medium text-foreground">
				{field.label}
				{field.isRequired ? (
					<span aria-hidden="true" className="ms-0.5 text-destructive">
						*
					</span>
				) : null}
			</label>
			<textarea
				{...formikField}
				value={formikField.value ?? ""}
				id={inputId}
				rows={field.uiOverrides.behavior?.rows ?? 3}
				placeholder={field.uiOverrides.behavior?.placeholder}
				required={field.isRequired}
				disabled={field.isReadOnly}
				aria-invalid={isError || undefined}
				aria-describedby={describedBy}
				className={`w-full rounded-lg border bg-background px-3 py-2 text-start text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${
					isError
						? "border-destructive focus:border-destructive focus:ring-destructive/20"
						: "border-border focus:border-ring focus:ring-ring/20"
				}`}
			/>
			{isError ? (
				<p id={errorId} className="text-xs text-destructive">
					{meta.error}
				</p>
			) : null}
			{description ? (
				<p id={descriptionId} className="ps-3 text-xs text-muted-foreground">
					{description}
				</p>
			) : null}
		</div>
	);
}
