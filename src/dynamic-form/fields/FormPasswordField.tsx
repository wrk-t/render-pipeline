// ═══════════════════════════════════════════════════════════════
// FormPasswordField – Renders a password input with visibility
// toggle (eye icon).
// ═══════════════════════════════════════════════════════════════
"use client";

import { useField } from "formik";
import { type ReactElement, useId, useState } from "react";
import { Unicon } from "../../components/common/icon/Unicon";
import type { PasswordField } from "../types";
import { FieldLabel } from "./FieldLabel";

export function FormPasswordField({
	field,
}: {
	field: PasswordField;
}): ReactElement {
	const [formikField, meta] = useField(field.name);
	const [show, setShow] = useState(false);
	const inputId = useId();
	const errorId = `${inputId}-error`;
	const descriptionId = `${inputId}-description`;
	const isError = Boolean(meta.touched && meta.error);
	const description = field.fieldOverrides?.description;
	const describedBy =
		[isError ? errorId : undefined, description ? descriptionId : undefined]
			.filter(Boolean)
			.join(" ") || undefined;

	// Toggle once per click; the mousedown preventDefault keeps focus (and the
	// caret) in the input instead of moving it to the button.
	const toggleVisibility = () => setShow((previous) => !previous);

	return (
		<div className="flex flex-col gap-2">
			<FieldLabel
				htmlFor={inputId}
				label={field.label}
				required={field.isRequired}
				isError={isError}
				description={description}
			/>
			<div className="relative">
				<input
					{...formikField}
					value={formikField.value ?? ""}
					id={inputId}
					type={show ? "text" : "password"}
					placeholder={field.uiOverrides.behavior?.placeholder}
					autoComplete={field.uiOverrides.behavior?.autoComplete}
					required={field.isRequired}
					disabled={field.isReadOnly}
					aria-invalid={isError || undefined}
					aria-describedby={describedBy}
					className={`flex h-9 w-full rounded-md border bg-transparent ps-3 pe-10 py-1 text-sm text-start shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
						isError
							? "border-destructive focus-visible:ring-destructive/20"
							: "border-input"
					}`}
				/>
				<button
					type="button"
					onClick={toggleVisibility}
					onMouseDown={(event) => event.preventDefault()}
					aria-label={show ? "Hide password" : "Show password"}
					className="absolute end-1 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					<Unicon name={show ? "Visibility" : "VisibilityOff"} size={18} />
				</button>
			</div>
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
