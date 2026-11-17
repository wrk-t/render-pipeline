// ═══════════════════════════════════════════════════════════════
// FormSwitchField – Renders a switch/toggle with plain boolean.
// ═══════════════════════════════════════════════════════════════
"use client";

import { useField, useFormikContext } from "formik";
import { type ReactElement, useId } from "react";
import { fieldAccessibleName } from "../fieldHelpers";
import type { SwitchField } from "../types";

export function FormSwitchField({
	field,
}: {
	field: SwitchField;
}): ReactElement {
	const { values, setFieldValue } = useFormikContext<Record<string, unknown>>();
	const [, meta] = useField(field.name);
	const errorId = useId();
	const checked = Boolean(values[field.name]);
	const isError = Boolean(meta.touched && meta.error);
	// A switch announced as just "on" is unusable: name it explicitly (UX-9).
	const accessibleName = fieldAccessibleName(field);
	const description = field.fieldOverrides?.description;

	return (
		<div className="flex flex-col gap-2">
			<label className="flex items-center gap-2 text-start text-sm font-medium leading-none text-foreground">
				<span className="relative inline-flex h-5 w-9 shrink-0">
					<input
						type="checkbox"
						role="switch"
						name={field.name}
						checked={checked}
						aria-checked={checked}
						onChange={(event) =>
							setFieldValue(field.name, event.target.checked)
						}
						disabled={field.isReadOnly}
						aria-label={accessibleName}
						aria-invalid={isError || undefined}
						aria-describedby={isError ? errorId : undefined}
						className="peer h-5 w-9 cursor-pointer appearance-none rounded-full border border-transparent bg-input transition-colors checked:bg-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
					/>
					<span
						aria-hidden="true"
						className="pointer-events-none absolute start-0.5 top-0.5 size-4 rounded-full bg-background shadow-sm transition-all duration-200 peer-checked:start-[18px] peer-disabled:opacity-50"
					/>
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
