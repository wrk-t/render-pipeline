"use client";

import type { ReactElement } from "react";
import { formatNumber } from "../formatting/money";

interface Props {
	cell: any;
	columnDef: any;
}

/**
 * Renders a plain numeric value (counts, quantities, sizes) with the
 * locale's thousands grouping — the `number` column type. Money is a
 * separate type; this one never adds a currency.
 *
 * Format config: { type: "number", props: { prefix, suffix, maximumFractionDigits } }
 */
export function NumberCell({ cell }: Props): ReactElement {
	const value = cell.getValue();
	const fmt = cell?.column?.columnDef?.columnFormat ?? {};
	const props = (fmt?.props ?? {}) as {
		locale?: string;
		prefix?: string;
		suffix?: string;
		minimumFractionDigits?: number;
		maximumFractionDigits?: number;
		useGrouping?: boolean;
	};

	const text = formatNumber(value, {
		locale: props.locale,
		minimumFractionDigits: props.minimumFractionDigits,
		maximumFractionDigits: props.maximumFractionDigits,
		useGrouping: props.useGrouping,
	});

	if (!text) {
		return (
			<span className="text-gray-400" aria-label="—">
				—
			</span>
		);
	}

	return (
		<span dir="auto" title={text} className="tabular-nums whitespace-nowrap">
			{props.prefix ?? ""}
			{text}
			{props.suffix ?? ""}
		</span>
	);
}
