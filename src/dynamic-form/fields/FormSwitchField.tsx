// ═══════════════════════════════════════════════════════════════
// FormSwitchField – Renders a switch/toggle with plain boolean.
// ═══════════════════════════════════════════════════════════════
"use client";

import FormControlLabel from "@mui/material/FormControlLabel";
import FormHelperText from "@mui/material/FormHelperText";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { useField, useFormikContext } from "formik";
import type { ReactElement } from "react";
import type { SwitchField } from "../types";

export function FormSwitchField({
	field,
}: {
	field: SwitchField;
}): ReactElement {
	const { values, setFieldValue } = useFormikContext<Record<string, unknown>>();
	const [, meta] = useField(field.name);
	const checked = Boolean(values[field.name]);
	const isError = Boolean(meta.touched && meta.error);

	return (
		<Stack spacing={0.2}>
			<FormControlLabel
				control={
					<Switch
						name={field.name}
						checked={checked}
						onChange={(_, c) => setFieldValue(field.name, c)}
						disabled={field.isReadOnly}
					/>
				}
				label={field.label}
				className="ml-0!"
			/>
			{isError && <FormHelperText error>{meta.error}</FormHelperText>}
			{field.fieldOverrides?.description ? (
				<Typography variant="caption" color="text.secondary" className="pl-3">
					{field.fieldOverrides.description}
				</Typography>
			) : null}
		</Stack>
	);
}
