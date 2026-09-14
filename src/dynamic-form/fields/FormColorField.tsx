// ═══════════════════════════════════════════════════════════════
// ColorPickerInput + FormColorField – color picker (popover swatch +
// hex text input).
//
// `ColorPickerInput` is the CONTROLLED UI: the start-adornment button
// shows the current color; clicking it opens a Popover with the
// @uiw/react-color-colorful picker. The alpha channel is disabled so
// the stored value stays a `#rrggbb` hex string (the field's contract
// — validated by HEX_RE).
//
// `FormColorField` binds it to Formik via `useField` (the dynamic-form
// renderer). Standalone screens that keep their own state — e.g. the
// QR style dialog — use `ColorPickerInput` directly.
// ═══════════════════════════════════════════════════════════════
"use client";

import {
	Button,
	InputAdornment,
	Popover,
	Stack,
	TextField,
	Typography,
} from "@mui/material";
import Colorful from "@uiw/react-color-colorful";
import { useField } from "formik";
import { type ReactElement, useState } from "react";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** Controlled color input: swatch button → popover Colorful picker + hex field. */
export function ColorPickerInput({
	label,
	value,
	onChange,
	isRequired,
	isReadOnly,
	error,
	helperText,
}: {
	label?: string;
	value: string;
	onChange: (value: string) => void;
	isRequired?: boolean;
	isReadOnly?: boolean;
	error?: boolean;
	helperText?: string;
}): ReactElement {
	const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

	const rawValue = typeof value === "string" ? value : "";
	// The picker + swatch only accept valid hex — fall back for display.
	const swatchValue = HEX_RE.test(rawValue) ? rawValue : "#000000";

	return (
		<Stack spacing={0.5}>
			{/*{label && (
				<Typography variant="body2" className="mb-0.5">
					{label}
					{isRequired && (
						<Typography component="span" color="error">
							{" "}
							*
						</Typography>
					)}
				</Typography>
			)}*/}
			<TextField
				size="small"
				label={label}
				value={rawValue}
				disabled={isReadOnly}
				onChange={(e) => onChange(e.target.value)}
				placeholder="#4F46E5"
				error={error}
				helperText={helperText}
				slotProps={{
					inputLabel: { shrink: true },
					input: {
						startAdornment: (
							<InputAdornment position="start">
								<Button
									size="small"
									disabled={isReadOnly}
									aria-label={label ?? "color"}
									title={label ?? "color"}
									onClick={(e) => setAnchorEl(e.currentTarget)}
									sx={{
										minWidth: 24,
										width: 24,
										height: 24,
										p: 0,
										borderRadius: "6px",
										border: "1px solid",
										borderColor: "divider",
										bgcolor: swatchValue,
										"&:hover": { opacity: 0.85 },
									}}
								/>
							</InputAdornment>
						),
					},
				}}
			/>
			<Popover
				open={Boolean(anchorEl)}
				anchorEl={anchorEl}
				onClose={() => setAnchorEl(null)}
				anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
				transformOrigin={{ vertical: "top", horizontal: "left" }}
				slotProps={{
					paper: { sx: { p: 1, borderRadius: 2 } },
				}}
			>
				<Colorful
					color={swatchValue}
					disableAlpha
					onChange={(color) => onChange(color.hex)}
				/>
			</Popover>
		</Stack>
	);
}

/** Formik-bound color field — used by the dynamic-form renderer. */
export function FormColorField({
	field,
}: {
	field: {
		name: string;
		label?: string;
		isRequired?: boolean;
		isReadOnly?: boolean;
	};
}): ReactElement {
	const [formikField, meta, helpers] = useField(field.name);
	const rawValue =
		typeof formikField.value === "string" ? formikField.value : "";

	return (
		<ColorPickerInput
			label={field.label}
			isRequired={field.isRequired}
			isReadOnly={field.isReadOnly}
			value={rawValue}
			onChange={(v) => helpers.setValue(v)}
			error={meta.touched && !!meta.error}
			helperText={meta.touched ? meta.error : undefined}
		/>
	);
}
