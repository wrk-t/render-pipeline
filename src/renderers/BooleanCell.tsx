"use client";

import type { FC } from "react";
import { Unicon } from "../components/common/icon/Unicon";

interface BooleanCellProps {
	cell: any;
	columnDef: any;
}

/**
 * Renders a boolean value as a check / cross icon inside a table cell.
 * Format config: { type: "boolean" }
 *
 * Language-neutral: the raw value is exposed via the title attribute,
 * and the icon color encodes true (green check) vs false (red cross).
 */
export const BooleanCell: FC<BooleanCellProps> = ({ cell }) => {
	const value = cell.getValue();
	const truthy =
		value === true || value === 1 || value === "true" || value === "1";

	return (
		<span
			title={String(value ?? "")}
			className={`flex w-full items-center justify-center ${truthy ? "text-green-600" : "text-red-500"}`}
		>
			<Unicon name={truthy ? "CheckCircle" : "Cancel"} size={18} />
		</span>
	);
};
