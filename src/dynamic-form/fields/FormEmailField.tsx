// ═══════════════════════════════════════════════════════════════
// FormEmailField – Renders an email input field with email type
// validation and optional autoComplete.
// ═══════════════════════════════════════════════════════════════
"use client";

import { useField } from "formik";
import { type ReactElement, useId } from "react";
import type { EmailField } from "../types";
import { FieldLabel } from "./FieldLabel";

export function FormEmailField({ field }: { field: EmailField }): ReactElement {
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

	return (
		<div className="flex flex-col gap-2">
			<FieldLabel
				htmlFor={inputId}
				label={field.label}
				required={field.isRequired}
				isError={isError}
				description={description}
			/>
			<input
				{...formikField}
				value={formikField.value ?? ""}
				id={inputId}
				type="email"
				placeholder={field.uiOverrides.behavior?.placeholder}
				autoComplete={field.uiOverrides.behavior?.autoComplete}
				required={field.isRequired}
				disabled={field.isReadOnly}
				aria-invalid={isError || undefined}
				aria-describedby={describedBy}
				className={`flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm text-start shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
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
				<p id={descriptionId} className="sr-only">
					{description}
				</p>
			) : null}
		</div>
	);
}
