"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useField, useFormikContext } from "formik";
import type { ReactElement } from "react";
import { Unicon } from "../../components/common/icon/Unicon";

// ════════════════════════════════════════════════════════════════
// FormAvailabilityWindowsField — inline repeater for item
// time-window availability (feature `item-availability`).
//
// Formik value: Array<{ dayOfWeek: number; openTime: string | null;
// closeTime: string | null }> — dayOfWeek 0=Saturday … 6=Friday
// (availability_windows convention). The backend persists these rows
// (targetType "item") and the public render hides items outside their
// windows.
// ════════════════════════════════════════════════════════════════

export interface AvailabilityWindowRow {
	dayOfWeek: number;
	openTime: string | null;
	closeTime: string | null;
}

const DAY_OPTIONS = [
	{ value: 0, label: "Saturday" },
	{ value: 1, label: "Sunday" },
	{ value: 2, label: "Monday" },
	{ value: 3, label: "Tuesday" },
	{ value: 4, label: "Wednesday" },
	{ value: 5, label: "Thursday" },
	{ value: 6, label: "Friday" },
];

export function FormAvailabilityWindowsField({
	field,
}: {
	field: {
		name: string;
		label?: string;
		isRequired?: boolean;
		isReadOnly?: boolean;
	};
}): ReactElement {
	const [{ value }, , { setValue }] = useField<AvailabilityWindowRow[]>(
		field.name,
	);
	const { isSubmitting } = useFormikContext();

	const rows: AvailabilityWindowRow[] = Array.isArray(value) ? value : [];

	const updateRow = (index: number, patch: Partial<AvailabilityWindowRow>) => {
		const next = rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
		setValue(next);
	};

	const removeRow = (index: number) => {
		setValue(rows.filter((_, i) => i !== index));
	};

	const addRow = () => {
		setValue([...rows, { dayOfWeek: 0, openTime: "", closeTime: "" }]);
	};

	const disabled = isSubmitting || field.isReadOnly;

	return (
		<Stack spacing={1}>
			<Typography variant="body2">
				{field.label}
				{field.isRequired && (
					<Typography component="span" color="error">
						{" "}
						*
					</Typography>
				)}
			</Typography>

			{rows.length === 0 && (
				<Typography variant="caption" color="textSecondary">
					No windows — the item is always available.
				</Typography>
			)}

			{rows.map((row, i) => (
				<Stack
					key={i}
					direction="row"
					spacing={1}
					className="items-center"
					sx={{ flexWrap: "wrap" }}
				>
					<FormControl size="small" sx={{ minWidth: 130 }}>
						<InputLabel>Day</InputLabel>
						<Select
							label="Day"
							value={row.dayOfWeek}
							disabled={disabled}
							onChange={(e) =>
								updateRow(i, { dayOfWeek: Number(e.target.value) })
							}
						>
							{DAY_OPTIONS.map((d) => (
								<MenuItem key={d.value} value={d.value}>
									{d.label}
								</MenuItem>
							))}
						</Select>
					</FormControl>
					<TextField
						size="small"
						label="Open"
						type="time"
						value={row.openTime ?? ""}
						disabled={disabled}
						onChange={(e) => updateRow(i, { openTime: e.target.value })}
						slotProps={{ inputLabel: { shrink: true } }}
						className="w-28"
					/>
					<TextField
						size="small"
						label="Close"
						type="time"
						value={row.closeTime ?? ""}
						disabled={disabled}
						onChange={(e) => updateRow(i, { closeTime: e.target.value })}
						slotProps={{ inputLabel: { shrink: true } }}
						className="w-28"
					/>
					<IconButton
						size="small"
						color="error"
						disabled={disabled}
						onClick={() => removeRow(i)}
						aria-label="Remove window"
					>
						<Unicon name="Close" size={18} />
					</IconButton>
				</Stack>
			))}

			<Box>
				<Button
					startIcon={<Unicon name="Add" size={18} />}
					onClick={addRow}
					disabled={disabled}
					size="small"
				>
					Add window
				</Button>
			</Box>
		</Stack>
	);
}
