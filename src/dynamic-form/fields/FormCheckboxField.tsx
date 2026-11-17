// ═══════════════════════════════════════════════════════════════
// FormCheckboxField – Renders a simple checkbox with plain boolean
// value in Formik (checked → true).
// ═══════════════════════════════════════════════════════════════
"use client";

import { useField, useFormikContext } from "formik";
import { type ReactElement, useId } from "react";
import { Unicon } from "../../components/common/icon/Unicon";
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
		<div className="flex flex-col gap-2">
			<label className="flex items-center gap-2 text-start text-sm font-medium leading-none text-foreground">
				<span className="relative inline-flex size-4 shrink-0 items-center justify-center">
					<input
						type="checkbox"
						name={field.name}
						checked={checked}
						onChange={(event) =>
							setFieldValue(field.name, event.target.checked)
						}
						disabled={field.isReadOnly}
						aria-label={accessibleName}
						aria-invalid={isError || undefined}
						aria-describedby={isError ? errorId : undefined}
						className="peer size-4 shrink-0 cursor-pointer appearance-none rounded-sm border border-input bg-transparent shadow-sm transition-colors checked:border-primary checked:bg-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
					/>
					<span
						aria-hidden="true"
						className="pointer-events-none absolute inset-0 hidden items-center justify-center text-primary-foreground peer-checked:flex peer-disabled:opacity-50"
					>
						<Unicon name="Done" size={12} />
					</span>
				</span>
				{field.label}
			</label>
			{isError ? (
				<p id={errorId} className="text-sm text-destructive">
					{meta.error}
				</p>
			) : null}
			{description ? (
				<p className="text-sm text-muted-foreground">{description}</p>
			) : null}
		</div>
	);
}
