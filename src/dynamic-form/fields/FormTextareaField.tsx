// ═══════════════════════════════════════════════════════════════
// FormTextareaField – Renders a multi-line text input field.
// ═══════════════════════════════════════════════════════════════
"use client";

import { Stack, Typography } from "@mui/material";
import { FastTextField } from "@smartpath/typed-formik-mui";
import { useField } from "formik";
import type { ReactElement } from "react";
import type { TextareaField } from "../types";
import { AudienceRuleAssistantField } from "./AudienceRuleAssistantField";
import { VariableSuggestField } from "./VariableSuggestField";

export function FormTextareaField({
	field,
}: {
	field: TextareaField;
}): ReactElement {
	const [, meta] = useField(field.name);
	const hasValue = meta.value !== undefined && meta.value !== "";

	// A group's rule is authored by the AI assistant, not typed as raw JSON.
	if ((field.fieldOverrides as any)?.ruleAssistant) {
		return <AudienceRuleAssistantField field={field} />;
	}

	// The body editor suggests `{{namespace.key}}` tokens as the admin types.
	if ((field.fieldOverrides as any)?.variableAutocomplete) {
		return <VariableSuggestField field={field} multiline />;
	}

	return (
		<Stack spacing={0.2}>
			<FastTextField
				name={field.name}
				label={field.label}
				multiline
				rows={field.uiOverrides.behavior?.rows ?? 3}
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
