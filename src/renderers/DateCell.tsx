"use client";

import type { ReactElement } from "react";
import {
	type DateFormatOptions,
	formatDate,
	formatRelativeTime,
	hasTimePart,
	type RelativeTimeFormatOptions,
} from "../formatting/date";

interface DateCellProps {
	cell: any;
	columnDef: any;
}

type DateCellConfig = DateFormatOptions &
	RelativeTimeFormatOptions & {
		/**
		 * Also show how long ago/from now under the absolute date —
		 * "Nov 13, 2026 · 2 days ago". Off by default: an operational
		 * timestamp is usually read exactly.
		 */
		relative?: boolean;
		/** Use the `relative` style for the secondary line. */
		relativeStyle?: "long" | "short" | "narrow";
	};

/**
 * Renders a date / timestamp inside a table cell in the app locale
 * (en-US or fa-IR — the latter also selects the Persian calendar).
 *
 * Format config:
 *   { type: "date" }                         — date, plus time when present
 *   { type: "date", props: { relative: true } }
 *   { type: "datetime", props: { timeZone: "Asia/Tehran" } }
 *
 * A date-only value ("2026-11-13") never shifts a day: it is parsed as
 * local midnight. `timeZone`/`calendar` are pass-throughs for PLAT-19's
 * tenant calendar setting.
 */
export function DateCell({ cell, columnDef }: DateCellProps): ReactElement {
	const value = cell.getValue();
	// An absent date (e.g. `deletedAt` on an active row) stays blank rather
	// than painting a placeholder across the whole column.
	if (value === null || value === undefined || value === "") {
		return <span />;
	}

	const fmt = (columnDef as any)?.columnFormat ??
		cell?.column?.columnDef?.columnFormat ?? {};
	const props = (fmt?.props ?? {}) as DateCellConfig;

	const absolute = formatDate(value, {
		locale: props.locale,
		timeZone: props.timeZone,
		calendar: props.calendar,
		dateStyle: props.dateStyle,
		timeStyle: props.timeStyle,
		showTime: props.showTime ?? (fmt?.type === "datetime" || hasTimePart(value)),
	});

	if (!absolute) {
		return (
			<span className="text-gray-400" aria-label="—">
				—
			</span>
		);
	}

	const relative = props.relative
		? formatRelativeTime(value, {
				locale: props.locale,
				style: props.relativeStyle ?? props.style,
				numeric: props.numeric,
			})
		: null;

	return (
		<span
			dir="auto"
			className="inline-flex flex-col leading-tight"
			title={relative ?? absolute}
		>
			<span>{absolute}</span>
			{relative ? (
				<span dir="auto" className="text-[11px] opacity-60">
					{relative}
				</span>
			) : null}
		</span>
	);
}
