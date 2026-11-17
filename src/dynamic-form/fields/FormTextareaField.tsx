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
		<div className="flex flex-col gap-2">
			<label
				htmlFor={inputId}
				className={`text-sm font-medium leading-none ${
					isError ? "text-destructive" : "text-foreground"
				}`}
			>
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
				className={`flex min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-sm text-start shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
					isError
						? "border-destructive focus-visible:ring-destructive/20"
						: "border-input"
				}`}
			/>
			{isError ? (
				<p id={errorId} className="text-sm text-destructive">
					{meta.error}
				</p>
			) : null}
			{description ? (
				<p id={descriptionId} className="text-sm text-muted-foreground">
					{description}
				</p>
			) : null}
		</div>
	);
}
