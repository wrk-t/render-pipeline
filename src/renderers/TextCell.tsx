"use client";

import Tooltip from "@mui/material/Tooltip";
import type { ReactElement } from "react";

interface Props {
	cell: any;
	columnDef: any;
}

/**
 * Text cell renderer with a hover popover that reveals the complete
 * value — especially useful for fixed-width columns where long values
 * (URLs, request bodies, summaries) are truncated with an ellipsis.
 *
 * Objects are stringified as compact JSON before display.
 *
 * `format.props.labelMap` maps a stored enum onto its display label
 * (`{ order_count: "$trl_…" }`). The labels live in the column config, so their
 * `$trl_` keys are resolved server-side with the rest of the metadata — a list
 * never shows a raw enum such as `order_count` (CRM-19).
 */
export function TextCell({ cell }: Props): ReactElement {
	const value = cell.getValue();
	if (value === null || value === undefined) {
		return <span />;
	}

	const fmt = cell?.column?.columnDef?.columnFormat ?? {};
	const labelMap = (fmt?.props as Record<string, unknown> | undefined)
		?.labelMap as Record<string, string> | undefined;
	const mapped = labelMap?.[String(value)];

	const str = mapped ?? (typeof value === "string" ? value : JSON.stringify(value));

	return (
		<Tooltip title={str} arrow placement="top" enterDelay={400}>
			<span className="block max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
				{str}
			</span>
		</Tooltip>
	);
}
