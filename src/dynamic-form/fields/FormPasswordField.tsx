// ═══════════════════════════════════════════════════════════════
// FormPasswordField – Renders a password input with visibility
// toggle (eye icon).
// ═══════════════════════════════════════════════════════════════
"use client";

import { Stack, Typography } from "@mui/material";
import { useField } from "formik";
import type { ReactElement } from "react";
import { PasswordTextField } from "../../components/form/formFields";
import type { PasswordField } from "../types";

export function FormPasswordField({
	field,
}: {
	field: PasswordField;
}): ReactElement {
	const [, meta] = useField(field.name);
	const hasValue = meta.value !== undefined && meta.value !== "";

	return (
		<Stack spacing={0.2}>
			<PasswordTextField
				name={field.name}
				label={field.label}
				placeholder={field.uiOverrides.behavior?.placeholder}
				autoComplete={field.uiOverrides.behavior?.autoComplete}
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
