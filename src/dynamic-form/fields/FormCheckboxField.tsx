// ═══════════════════════════════════════════════════════════════
// FormCheckboxField – Renders a simple checkbox with plain boolean
// value in Formik (checked → true).
// ═══════════════════════════════════════════════════════════════
"use client";

import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useFormikContext } from "formik";
import type { ReactElement } from "react";
import type { CheckboxField } from "../types";

export function FormCheckboxField({
	field,
}: {
	field: CheckboxField;
}): ReactElement {
	const { values, setFieldValue } = useFormikContext<Record<string, unknown>>();
	const checked = Boolean(values[field.name]);

	return (
		<Stack spacing={0.2}>
			<FormControlLabel
				control={
					<Checkbox
						name={field.name}
						checked={checked}
						onChange={(_, c) => setFieldValue(field.name, c)}
						disabled={field.isReadOnly}
					/>
				}
				label={field.label}
				className="ml-0!"
			/>
			{field.fieldOverrides?.description ? (
				<Typography variant="caption" color="text.secondary" className="pl-3">
					{field.fieldOverrides.description}
				</Typography>
			) : null}
		</Stack>
	);
}
