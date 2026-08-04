"use client";

import { DateObject } from "react-multi-date-picker";
import type { QuickSelectValue, TTimeUnit } from "./config";
import {
	AbsoluteDateValue,
	CustomQuickValue,
	DefaultQuickSelect,
	Past1Hour,
	Past1Year,
	Past3Days,
	Past7Days,
	Past24Hours,
	Past30Days,
	Past30Minutes,
	Past60Days,
	Past90Days,
	Today,
	Yesterday,
} from "./config";

const quickSelectMap: Record<string, new () => QuickSelectValue> = {
	default: DefaultQuickSelect,
	past1Hour: Past1Hour,
	past24Hours: Past24Hours,
	past30Minutes: Past30Minutes,
	past3Days: Past3Days,
	past7Days: Past7Days,
	past30Days: Past30Days,
	past60Days: Past60Days,
	past90Days: Past90Days,
	past1Year: Past1Year,
	today: Today,
	yesterday: Yesterday,
};

/** Create an AbsoluteDateValue from epoch timestamps. */
export function createAbsoluteValue(
	from: number,
	to: number,
): AbsoluteDateValue {
	return new AbsoluteDateValue(
		new DateObject(from),
		new DateObject(to),
		"00:00",
		"23:59",
	);
}

/** Create a CustomQuickValue from a number and unit. */
export function createCustomQuickValue(
	number: number,
	unit: TTimeUnit,
): CustomQuickValue {
	return new CustomQuickValue(number, unit);
}
