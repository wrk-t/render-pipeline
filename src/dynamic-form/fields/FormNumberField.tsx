// ═══════════════════════════════════════════════════════════════
// FormNumberField – Renders a number input field with min/max/step.
// ═══════════════════════════════════════════════════════════════
"use client";

import { Stack, Typography } from "@mui/material";
import { FastTextField } from "@smartpath/typed-formik-mui";
import { useField } from "formik";
import type { ClipboardEvent, FormEvent, ReactElement } from "react";
import type { NumberField } from "../types";

// ─────────────────────────────────────────────────────────────
// Localized digits and separators
// ─────────────────────────────────────────────────────────────

/**
 * Persian/Arabic-Indic digits → Latin. A pasted localized number
 * (`۴۲`, `٤٢`) must land as a number the API accepts, not be dropped.
 */
const DIGIT_MAP: Record<string, string> = Object.fromEntries([
	...Array.from("۰۱۲۳۴۵۶۷۸۹", (digit, index) => [digit, String(index)]),
	...Array.from("٠١٢٣٤٥٦٧٨٩", (digit, index) => [digit, String(index)]),
]);

const THOUSANDS_SEPARATOR = /[٬,]/g;
const PERSIAN_DECIMAL_MARK = /٫/g;
const NON_NUMERIC = /[^0-9.]/g;
const HAS_DIGIT = /[0-9]/;

/**
 * Turn arbitrary pasted text into the numeric part only.
 *
 * A native `type="number"` input can keep invalid pasted text in a
 * "bad input" state: the browser paints the text, but `input.value` is
 * `""` — so Formik never sees it, the floating label does not shrink, and
 * the required error appears with no visible value to explain it. Handle
 * the paste ourselves instead: accept a number the browser can parse
 * (`1e3`, `0012`) as its canonical value, otherwise keep digits (plus one
 * leading minus and one decimal point) and drop everything else. Return
 * `""` when there is no number in the text.
 */
export function normalizeNumberText(text: string): string {
	let normalized = "";
	for (const char of text) normalized += DIGIT_MAP[char] ?? char;

	// `,` and `٬` are thousands separators; `٫` is the Persian decimal mark.
	normalized = normalized
		.replace(THOUSANDS_SEPARATOR, "")
		.replace(PERSIAN_DECIMAL_MARK, ".")
		.trim();

	if (normalized !== "") {
		const parsed = Number(normalized);
		if (Number.isFinite(parsed)) return String(parsed);
	}

	const negative = normalized.startsWith("-");
	const digits = normalized.replace(NON_NUMERIC, "");
	if (!HAS_DIGIT.test(digits)) return "";

	const [whole, ...fraction] = digits.split(".");
	const integer = whole || "0";
	const decimal = fraction.length > 0 ? `.${fraction.join("")}` : "";
	return `${negative ? "-" : ""}${integer}${decimal}`;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function FormNumberField({
	field,
}: {
	field: NumberField;
}): ReactElement {
	const [, meta, helpers] = useField(field.name);
	const hasValue = meta.value !== undefined && meta.value !== "";

	/**
	 * Browsers that still allow invalid characters in a number input put it
	 * in `badInput`; clear the painted text and keep Formik in sync so the
	 * label/error state matches what the user sees.
	 */
	const discardBadInput = (input: HTMLInputElement): void => {
		if (!input.validity.badInput) return;
		input.value = "";
		helpers.setValue("", false);
		helpers.setTouched(true, false);
	};

	const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
		event.preventDefault();
		const cleaned = normalizeNumberText(
			event.clipboardData?.getData("text") ?? "",
		);
		helpers.setTouched(true, false);
		helpers.setValue(cleaned, false);
	};

	const handleInput = (event: FormEvent<HTMLInputElement>) => {
		discardBadInput(event.currentTarget);
	};

	return (
		<Stack spacing={0.2}>
			<FastTextField
				name={field.name}
				label={field.label}
				type="number"
				placeholder={field.uiOverrides.behavior?.placeholder}
				required={field.isRequired}
				disabled={field.isReadOnly}
				slotProps={{
					htmlInput: {
						min: field.uiOverrides.behavior?.min,
						max: field.uiOverrides.behavior?.max,
						step: field.uiOverrides.behavior?.step,
						onPaste: handlePaste,
						onInput: handleInput,
					},
					inputLabel: {
						shrink: hasValue || undefined,
					},
				}}
			/>
			{field.fieldOverrides?.description ? (
				<Typography variant="caption" color="text.secondary" className="pl-3">
					{field.fieldOverrides.description}
				</Typography>
			) : null}
		</Stack>
	);
}
