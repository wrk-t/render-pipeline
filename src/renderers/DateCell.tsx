"use client";

import type { FC } from "react";

interface DateCellProps {
	cell: any;
	columnDef: any;
}

/**
 * Renders a date value inside a table cell.
 * Format config: { type: "date" }
 */
export const DateCell: FC<DateCellProps> = ({ cell }) => {
	const value = cell.getValue();
	if (!value) return null as any;

	const date = new Date(value as string);
	const dateFmt =
		localStorage.getItem("ccd-locale") === "fa" ? "fa-IR" : "en-US";
	const formatted = date.toLocaleString(dateFmt, {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	});

	return <span dir="ltr">{formatted}</span>;
};
