// ═══════════════════════════════════════════════════════════════
// FormTimeField – a time-of-day input (`HH:mm`, 24-hour).
//
// The recurrence calculator parses `HH:mm` and nothing else
// (`parseSendTime` in the backend), so the value must never be
// reformatted locally: a native `type="time"` input already emits
// 24-hour `HH:mm` — or `""` when cleared — and the form's schema (the
// field's `Pattern` rule, whose message is translated server-side)
// rejects anything that did not come from the picker.
//
// Native rather than a picker component on purpose: it is the platform
// control (keyboard on mobile), needs no extra dependency, and keeps
// the stored value in the one shape the scheduler accepts. A locale
// that shows 12-hour with AM/PM still submits `HH:mm`.
// ═══════════════════════════════════════════════════════════════
"use client";

import { Stack, Typography } from "@mui/material";
import { FastTextField } from "@smartpath/typed-formik-mui";
import type { ReactElement } from "react";
import type { TimeField } from "../types";

export function FormTimeField({
	field,
}: {
	field: TimeField;
}): ReactElement {
	return (
		<Stack spacing={0.2}>
			<FastTextField
				name={field.name}
				type="time"
				label={field.label}
				placeholder={field.uiOverrides.behavior?.placeholder}
				required={field.isRequired}
				disabled={field.isReadOnly}
				slotProps={{
					inputLabel: {
						// A time input always shows its `--:--` placeholder, so the
						// label must shrink or it overlaps the value.
						shrink: true,
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
