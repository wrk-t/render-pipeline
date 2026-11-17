"use client";

import type { ReactElement } from "react";
import {
	type DateFormatOptions,
	formatDate,
	formatRelativeTime,
	type RelativeTimeFormatOptions,
} from "../formatting/date";

interface Props {
	cell: any;
	columnDef: any;
}

type RelativeCellConfig = RelativeTimeFormatOptions &
	DateFormatOptions & {
		/** Show the absolute date next to the relative one. */
		showAbsolute?: boolean;
		/** Include the clock time in the absolute fallback/title. */
		showTime?: boolean;
	};

/**
 * Renders a timestamp as relative time — "in 3 hours", "2 days ago" —
 * for columns where *how long ago* matters more than the exact clock
 * time (a campaign's next run, a live queue). `Intl.RelativeTimeFormat`
 * localizes both the text and the number.
 *
 * Format config: { type: "relative", props: { showAbsolute: true } }
 */
export function RelativeCell({ cell }: Props): ReactElement {
	const value = cell.getValue();
	const fmt = cell?.column?.columnDef?.columnFormat ?? {};
	const props = (fmt?.props ?? {}) as RelativeCellConfig;

	const relative = formatRelativeTime(value, {
		locale: props.locale,
		style: props.style,
		numeric: props.numeric,
	});
	const absolute = formatDate(value, {
		locale: props.locale,
		timeZone: props.timeZone,
		calendar: props.calendar,
		dateStyle: props.dateStyle,
		timeStyle: props.timeStyle,
		showTime: props.showTime ?? true,
	});

	if (!relative) {
		return (
			<span className="text-gray-400" aria-label="—">
				—
			</span>
		);
	}

	return (
		<span dir="auto" className="whitespace-nowrap" title={absolute || undefined}>
			{relative}
			{props.showAbsolute && absolute ? (
				<span className="ms-1 text-[11px] opacity-60">({absolute})</span>
			) : null}
		</span>
	);
}
