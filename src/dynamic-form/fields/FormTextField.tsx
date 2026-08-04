// ═══════════════════════════════════════════════════════════════
// FormTextField – Renders a text input field.
// ═══════════════════════════════════════════════════════════════
"use client";

import { Stack, Typography } from "@mui/material";
import { FastTextField } from "@smartpath/typed-formik-mui";
import { useField } from "formik";
import type { ReactElement } from "react";
import type { TextField as TextFieldType } from "../types";

export function FormTextField({
	field,
}: {
	field: TextFieldType;
}): ReactElement {
	const [, meta] = useField(field.name);
	const hasValue = meta.value !== undefined && meta.value !== "";

	return (
		<Stack spacing={0.2}>
			<FastTextField
				name={field.name}
				label={field.label}
				placeholder={field.uiOverrides.behavior?.placeholder}
				required={field.isRequired}
				disabled={field.isReadOnly}
				slotProps={{
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
