// ═══════════════════════════════════════════════════════════════
// FormEmailField – Renders an email input field with email type
// validation and optional autoComplete.
// ═══════════════════════════════════════════════════════════════
"use client";

import type { ReactElement } from "react";
import { FastTextField } from "@smartpath/typed-formik-mui";
import { useField } from "formik";
import { Stack, Typography } from "@mui/material";
import type { EmailField } from "../types";

export function FormEmailField({ field }: { field: EmailField }): ReactElement {
	const [, meta] = useField(field.name);
	const hasValue = meta.value !== undefined && meta.value !== "";

	return (
		<Stack spacing={0.2}>
			<FastTextField
				name={field.name}
				label={field.label}
				type="email"
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
