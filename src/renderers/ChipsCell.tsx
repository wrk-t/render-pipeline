"use client";

// ──────────────────────────────────────────────────────────────────
// ChipsCell — renders a list value as small chips inside a table cell.
//
// The list reads that feed it return `{ id, name }` arrays (menu item
// categories / tags / allergens), so the table shows the names at a
// glance instead of the raw ids the edit form uses.
//
// Format config:
//   { type: "chips" }
//   { type: "chips", props: { labelField: "name", max: 2 } }
//
// Values may be strings or objects (`labelField`, default "name").
// Beyond `max` (default 3) the rest collapse into a `+N` chip whose
// tooltip lists them, so a wide column never blows up the row height.
// An empty list renders the em dash every empty cell uses.
// ──────────────────────────────────────────────────────────────────

import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import type { ReactElement } from "react";

interface ChipsCellProps {
	cell: any;
	columnDef?: any;
}

interface ChipsFormatProps {
	/** Object field holding the chip label (default "name"). */
	labelField?: string;
	/** Visible chips before collapsing into `+N` (default 3). */
	max?: number;
}

function toLabels(value: unknown, labelField: string): string[] {
	if (!Array.isArray(value)) return [];
	return value
		.map((entry) => {
			if (typeof entry === "string") return entry;
			if (entry !== null && typeof entry === "object") {
				const label = (entry as Record<string, unknown>)[labelField];
				return label === null || label === undefined ? "" : String(label);
			}
			return entry === null || entry === undefined ? "" : String(entry);
		})
		.map((label) => label.trim())
		.filter(Boolean);
}

export function ChipsCell({ cell }: ChipsCellProps): ReactElement {
	const fmt = cell?.column?.columnDef?.columnFormat ?? {};
	const props = (fmt?.props ?? {}) as ChipsFormatProps;
	const labels = toLabels(cell.getValue(), props.labelField ?? "name");
	const max = typeof props.max === "number" && props.max > 0 ? props.max : 3;

	if (labels.length === 0) {
		return (
			<span className="text-gray-400" aria-label="—">
				—
			</span>
		);
	}

	const shown = labels.slice(0, max);
	const hidden = labels.slice(max);

	return (
		<Stack
			direction="row"
			spacing={0.5}
			useFlexGap
			sx={{ flexWrap: "wrap", alignItems: "center", py: 0.25 }}
		>
			{shown.map((label) => (
				<Chip
					key={label}
					label={label}
					size="small"
					variant="outlined"
					sx={{ maxWidth: 140 }}
				/>
			))}
			{hidden.length > 0 ? (
				<Tooltip title={hidden.join(", ")}>
					<Chip label={`+${hidden.length}`} size="small" />
				</Tooltip>
			) : null}
		</Stack>
	);
}
