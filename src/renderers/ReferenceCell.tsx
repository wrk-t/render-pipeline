"use client";

import type { ReactElement } from "react";

interface Props {
	cell: any;
	columnDef: any;
}

/**
 * Renders a reference value (object with displayField) inside a table cell.
 * Format config: { type: "reference", displayField: "displayName" }
 */
export function ReferenceCell({ cell }: Props): ReactElement {
	const value = cell.getValue();
	if (!value) return null as any;

	const fmt = cell?.column?.columnDef?.columnFormat ?? {};
	const displayField = (fmt as any).displayField ?? "displayName";
	const resolved =
		typeof value === "object" && value !== null
			? (value as Record<string, unknown>)[displayField]
			: String(value);

	return <span>{String(resolved ?? "")}</span>;
}
