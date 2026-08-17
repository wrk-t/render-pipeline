"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useField, useFormikContext } from "formik";
import type { ReactElement } from "react";
import { Unicon } from "../../components/common/icon/Unicon";

// ════════════════════════════════════════════════════════════════
// VariantEditorField — inline repeater for item variants
// (e.g. Small / Medium / Large with price deltas).
//
// Formik value: Array<{ label: string; priceDelta: number; isDefault: boolean }>
// ════════════════════════════════════════════════════════════════

export interface VariantRow {
	label: string;
	priceDelta: number;
	isDefault: boolean;
}

export function VariantEditorField({
	field,
}: {
	field: {
		name: string;
		label?: string;
		isRequired?: boolean;
		isReadOnly?: boolean;
	};
}): ReactElement {
	const [{ value }, , { setValue }] = useField<VariantRow[]>(field.name);
	const { isSubmitting } = useFormikContext();

	const rows: VariantRow[] = Array.isArray(value) ? value : [];

	const updateRow = (index: number, patch: Partial<VariantRow>) => {
		const next = rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
		setValue(next);
	};

	const removeRow = (index: number) => {
		setValue(rows.filter((_, i) => i !== index));
	};

	const addRow = () => {
		setValue([...rows, { label: "", priceDelta: 0, isDefault: false }]);
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
					No variants — the item's base price is used.
				</Typography>
			)}

			{rows.map((row, i) => (
				<Stack
					key={i}
					direction="row"
					spacing={1}
					className="items-center"
				>
					<TextField
						size="small"
						label="Label"
						value={row.label}
						disabled={disabled}
						onChange={(e) => updateRow(i, { label: e.target.value })}
						className="flex-1"
					/>
					<TextField
						size="small"
						label="Price +"
						type="number"
						value={row.priceDelta}
						disabled={disabled}
						onChange={(e) =>
							updateRow(i, { priceDelta: Number(e.target.value) || 0 })
						}
						className="w-24"
					/>
					<FormControlLabel
						control={
							<Checkbox
								size="small"
								checked={row.isDefault}
								disabled={disabled}
								onChange={(e) =>
									updateRow(i, { isDefault: e.target.checked })
								}
							/>
						}
						label="Default"
					/>
					<IconButton
						size="small"
						color="error"
						disabled={disabled}
						onClick={() => removeRow(i)}
						aria-label="Remove variant"
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
					Add variant
				</Button>
			</Box>
		</Stack>
	);
}
