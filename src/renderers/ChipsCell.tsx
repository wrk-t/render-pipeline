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
		<div className="flex flex-wrap items-center gap-1 py-0.5">
			{shown.map((label) => (
				<span
					key={label}
					title={label}
					className="inline-flex max-w-[140px] items-center rounded-full border border-border px-2 py-0.5 text-xs font-medium text-foreground"
				>
					<span className="truncate">{label}</span>
				</span>
			))}
			{hidden.length > 0 ? (
				<span
					title={hidden.join(", ")}
					className="inline-flex items-center rounded-full border border-transparent bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
				>
					+{hidden.length}
				</span>
			) : null}
		</div>
	);
}
