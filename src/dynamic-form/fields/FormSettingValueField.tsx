// ═══════════════════════════════════════════════════════════════
// FormSettingValueField – Typed tenant-setting value input.
//
// The tenant-settings API returns each setting decorated with its
// catalog contract (`type`, `format`, `options`). This field reads
// those from the current form values and renders the matching input:
//   - number  → numeric input
//   - boolean → switch
//   - select  → dropdown (options from the record)
//   - text    → text input (+ regex validation from `format.pattern`)
//
// Falls back to a plain text input when no type info is available
// (e.g. the super-admin "create custom setting" form).
// ═══════════════════════════════════════════════════════════════
"use client";

import { Stack, Typography } from "@mui/material";
import { useField, useFormikContext } from "formik";
import { type ReactElement, useEffect } from "react";
import type { RenderField } from "../types";
import { FormNumberField } from "./FormNumberField";
import { FormSelectField } from "./FormSelectField";
import { FormSwitchField } from "./FormSwitchField";
import { FormTextField } from "./FormTextField";

interface SettingRecord {
	type?: string;
	format?:
		| { kind: "regex"; pattern: string; example?: string }
		| { kind: "select"; example?: string }
		| null;
	options?: Array<{ label: string; value: string }> | null;
}

export function FormSettingValueField({
	field,
}: {
	field: RenderField;
}): ReactElement {
	const { values, setFieldError } = useFormikContext<Record<string, unknown>>();
	const [, meta] = useField(field.name);

	const record = values as SettingRecord;
	const settingType = record.type ?? "text";
	const format = record.format;
	const pattern = format?.kind === "regex" ? format.pattern : undefined;
	const example = format?.kind === "regex" ? format.example : undefined;

	// Regex enforcement for text settings — the record's format.pattern is
	// only known at runtime, so it can't live in the static schema. Runs on
	// every value change; setFieldError with undefined clears the error.
	useEffect(() => {
		if (!pattern) return;
		try {
			const ok = new RegExp(pattern).test(String(meta.value ?? ""));
			setFieldError(field.name, ok ? undefined : "Invalid format");
		} catch {
			// Malformed pattern — skip client-side enforcement.
		}
	}, [pattern, meta.value, setFieldError, field.name]);

	const base = {
		...field,
		isReadOnly: field.isReadOnly,
		isRequired: field.isRequired,
	} as any;

	switch (settingType) {
		case "number":
			return <FormNumberField field={base} />;
		case "boolean":
			return <FormSwitchField field={base} />;
		case "select":
			return (
				<FormSelectField
					field={{
						...base,
						options: record.options ?? [],
					}}
				/>
			);
		default:
			return (
				<Stack spacing={0.2}>
					<FormTextField field={base} />
					{pattern && example ? (
						<Typography variant="caption" color="text.secondary" className="pl-3">
							Example: {example}
						</Typography>
					) : null}
				</Stack>
			);
	}
}
