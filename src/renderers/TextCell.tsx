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
 */
export function TextCell({ cell }: Props): ReactElement {
	const value = cell.getValue();
	if (value === null || value === undefined) {
		return <span />;
	}

	const str = typeof value === "string" ? value : JSON.stringify(value);

	return (
		<Tooltip title={str} arrow placement="top" enterDelay={400}>
			<span className="block max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
				{str}
			</span>
		</Tooltip>
	);
}
