// ═══════════════════════════════════════════════════════════════
// FormCheckboxField – Renders a simple checkbox with plain boolean
// value in Formik (checked → true).
// ═══════════════════════════════════════════════════════════════
"use client";

import { useField, useFormikContext } from "formik";
import { type ReactElement, useId } from "react";
import { fieldAccessibleName } from "../fieldHelpers";
import type { CheckboxField } from "../types";

export function FormCheckboxField({
	field,
}: {
	field: CheckboxField;
}): ReactElement {
	const { values, setFieldValue } = useFormikContext<Record<string, unknown>>();
	const [, meta] = useField(field.name);
	const errorId = useId();
	const checked = Boolean(values[field.name]);
	const isError = Boolean(meta.touched && meta.error);
	// Same as FormSwitchField: an unnamed checkbox announces only its state.
	const accessibleName = fieldAccessibleName(field);
	const description = field.fieldOverrides?.description;

	return (
		<div className="flex flex-col gap-0.5">
			<label className="flex items-center gap-2 text-start text-sm text-foreground">
				<input
					type="checkbox"
					name={field.name}
					checked={checked}
					onChange={(event) => setFieldValue(field.name, event.target.checked)}
					disabled={field.isReadOnly}
					aria-label={accessibleName}
					aria-invalid={isError || undefined}
					aria-describedby={isError ? errorId : undefined}
					className="size-4 shrink-0 cursor-pointer accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
				/>
				{field.label}
			</label>
			{isError ? (
				<p id={errorId} className="text-xs text-destructive">
					{meta.error}
				</p>
			) : null}
			{description ? (
				<p className="ps-3 text-xs text-muted-foreground">{description}</p>
			) : null}
		</div>
	);
}
