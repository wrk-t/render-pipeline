// ═══════════════════════════════════════════════════════════════
// FormTimeField – a time-of-day input (`HH:mm`, 24-hour).
//
// The recurrence calculator parses `HH:mm` and nothing else
// (`parseSendTime` in the backend), so the value must never be
// reformatted locally: a native `type="time"` input already emits
// 24-hour `HH:mm` — or `""` when cleared — and the form's schema (the
// field's `Pattern` rule, whose message is translated server-side)
// rejects anything that did not come from the picker.
//
// Native rather than a picker component on purpose: it is the platform
// control (keyboard on mobile), needs no extra dependency, and keeps
// the stored value in the one shape the scheduler accepts. A locale
// that shows 12-hour with AM/PM still submits `HH:mm`.
// ═══════════════════════════════════════════════════════════════
"use client";

import { useField } from "formik";
import { type ReactElement, useId } from "react";
import type { TimeField } from "../types";

export function FormTimeField({ field }: { field: TimeField }): ReactElement {
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
		<div className="flex flex-col gap-0.5">
			<label htmlFor={inputId} className="text-sm font-medium text-foreground">
				{field.label}
				{field.isRequired ? (
					<span aria-hidden="true" className="ms-0.5 text-destructive">
						*
					</span>
				) : null}
			</label>
			<input
				{...formikField}
				value={formikField.value ?? ""}
				id={inputId}
				type="time"
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
