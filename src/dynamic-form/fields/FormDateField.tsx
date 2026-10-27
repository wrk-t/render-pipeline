// ═══════════════════════════════════════════════════════════════
// FormDateField – Renders a Material UI date picker field.
// ═══════════════════════════════════════════════════════════════
"use client";

import { Stack, Typography } from "@mui/material";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import type { PickersTextFieldProps } from "@mui/x-date-pickers/PickersTextField";
import { useField, useFormikContext } from "formik";
import type { ReactElement } from "react";
import type { DateField } from "../types";

// A `date` field is a calendar date, not an instant: the API stores
// `YYYY-MM-DD` (`isDateOnly` in the backend) and combines it with a separate
// `time` field + timezone where it needs an instant (CRM-16 — a one-off
// campaign's `sendDate`). Serializing `toISOString()` here sent a UTC instant
// whose date can differ from the day the user picked, and the one-off save
// failed with `errors.message_schedule_send_date`.
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})/;

const pad2 = (value: number) => String(value).padStart(2, "0");

/** The calendar date the user sees, in their own timezone. */
const toDateOnly = (date: Date): string =>
	`${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

/**
 * Parse a stored value back to the date the picker shows. A `YYYY-MM-DD` string
 * is read as local midnight (not UTC) so it renders as the same calendar day in
 * every timezone; anything else (`null`, a legacy ISO instant) falls back to the
 * runtime parse.
 */
const fromStoredDate = (value: unknown): Date | null => {
	if (typeof value !== "string" || !value) return null;
	const match = DATE_ONLY.exec(value);
	if (match) {
		return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
	}
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export function FormDateField({ field }: { field: DateField }): ReactElement {
	const [, meta, helpers] = useField(field.name);
	const { setFieldValue } = useFormikContext<Record<string, unknown>>();

	const handleChange = (date: Date | null) => {
		const next = date ? toDateOnly(date) : null;
		void setFieldValue(field.name, next);
		void helpers.setValue(next);
	};

	const value = fromStoredDate(meta.value);

	return (
		<LocalizationProvider dateAdapter={AdapterDateFns}>
			<Stack spacing={0.2}>
				<DatePicker
					label={field.label}
					value={value}
					onChange={handleChange}
					minDate={
						field.uiOverrides.behavior?.min
							? new Date(field.uiOverrides.behavior.min)
							: undefined
					}
					maxDate={
						field.uiOverrides.behavior?.max
							? new Date(field.uiOverrides.behavior.max)
							: undefined
					}
					disabled={field.isReadOnly}
					slotProps={{
						textField: {
							required: field.isRequired,
							fullWidth: true,
							// X v9 dropped `placeholder` from the textField slot —
							// keep it for older majors.
							placeholder: field.uiOverrides.behavior?.placeholder,
						} as unknown as PickersTextFieldProps,
					}}
				/>
				{field.fieldOverrides?.description ? (
					<Typography variant="caption" color="text.secondary" className="pl-3">
						{field.fieldOverrides.description}
					</Typography>
				) : null}
			</Stack>
		</LocalizationProvider>
	);
}
