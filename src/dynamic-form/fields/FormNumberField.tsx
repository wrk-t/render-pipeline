// ═══════════════════════════════════════════════════════════════
// FormNumberField – Renders a number input field with min/max/step.
// ═══════════════════════════════════════════════════════════════
"use client";

import type { ReactElement } from "react";
import { FastTextField } from "@smartpath/typed-formik-mui";
import { useField } from "formik";
import { Stack, Typography } from "@mui/material";
import type { NumberField } from "../types";

export function FormNumberField({
	field,
}: {
	field: NumberField;
}): ReactElement {
	const [, meta] = useField(field.name);
	const hasValue = meta.value !== undefined && meta.value !== "";

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
