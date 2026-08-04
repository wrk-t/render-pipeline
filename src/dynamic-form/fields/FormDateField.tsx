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

export function FormDateField({ field }: { field: DateField }): ReactElement {
	const [, meta, helpers] = useField(field.name);
	const { setFieldValue } = useFormikContext<Record<string, unknown>>();

	const handleChange = (date: Date | null) => {
		if (date) {
			const iso = date.toISOString();
			void setFieldValue(field.name, iso);
			void helpers.setValue(iso);
		} else {
			void setFieldValue(field.name, null);
			void helpers.setValue(null);
		}
	};

	const value = meta.value ? new Date(meta.value as string) : null;

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
							size: "small",
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
