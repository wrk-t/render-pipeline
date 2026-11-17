// ──────────────────────────────────────────────────────────────────
// Date / relative-time formatting — shared by table cells, detail
// blocks and the audit history so every surface agrees.
//
//   - absolute: the app locale (en → en-US, fa → fa-IR, which also
//     gives the Persian calendar), optional tenant timezone/calendar
//     (PLAT-19 will pass those through `format.props`)
//   - relative: `Intl.RelativeTimeFormat` — "in 3 hours", "2 days ago"
//
// A date-only string ("2026-11-13") is parsed as local midnight, not
// UTC, so a table never shows the previous day for a date field.
// ──────────────────────────────────────────────────────────────────

import { getIntlLocale } from "./locale";

export interface DateFormatOptions {
	locale?: string | null;
	/** IANA zone (PLAT-19); omitted → the browser/tenant host zone. */
	timeZone?: string | null;
	/** e.g. "persian" — PLAT-19; `fa-IR` already defaults to it. */
	calendar?: string | null;
	dateStyle?: "full" | "long" | "medium" | "short";
	timeStyle?: "full" | "long" | "medium" | "short";
	/** Include the time part (a timestamp), not just the calendar day. */
	showTime?: boolean;
}

export interface RelativeTimeFormatOptions {
	locale?: string | null;
	style?: "long" | "short" | "narrow";
	numeric?: "always" | "auto";
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const HAS_TIME = /\d{1,2}:\d{2}/;

/** Parse a value into a valid Date, or `null`. */
export function toDate(value: unknown): Date | null {
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? null : value;
	}
	if (typeof value === "number") {
		if (!Number.isFinite(value)) return null;
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? null : date;
	}
	if (typeof value !== "string") return null;

	const text = value.trim();
	if (!text) return null;

	// A calendar day has no timezone; UTC parsing would shift it a day in
	// negative offsets, so build it at local midnight.
	const dateOnly = DATE_ONLY.exec(text);
	if (dateOnly) {
		const [, year, month, day] = dateOnly;
		const date = new Date(Number(year), Number(month) - 1, Number(day));
		return Number.isNaN(date.getTime()) ? null : date;
	}

	const date = new Date(text);
	return Number.isNaN(date.getTime()) ? null : date;
}

/** True when the value carries a clock time (not just a calendar day). */
export function hasTimePart(value: unknown): boolean {
	if (value instanceof Date) return true;
	if (typeof value !== "string") return false;
	return HAS_TIME.test(value);
}

function intlOptions(options: DateFormatOptions): Intl.DateTimeFormatOptions {
	const resolved: Intl.DateTimeFormatOptions = {
		dateStyle: options.dateStyle ?? "medium",
	};
	if (options.showTime) resolved.timeStyle = options.timeStyle ?? "short";
	if (options.timeZone) resolved.timeZone = options.timeZone;
	if (options.calendar) resolved.calendar = options.calendar;
	return resolved;
}

/**
 * Absolute date (and time, when asked) in the app locale. Returns `""`
 * for an empty/invalid value so the caller can show its own placeholder.
 */
export function formatDate(
	value: unknown,
	options: DateFormatOptions = {},
): string {
	const date = toDate(value);
	if (!date) return "";
	const locale = getIntlLocale(options.locale);

	try {
		return new Intl.DateTimeFormat(locale, intlOptions(options)).format(date);
	} catch {
		// An unsupported timeZone/calendar must not hide the value entirely.
		try {
			const fallback = intlOptions({ ...options, timeZone: null, calendar: null });
			return new Intl.DateTimeFormat(locale, fallback).format(date);
		} catch {
			return date.toISOString();
		}
	}
}

interface RelativePart {
	amount: number;
	unit: Intl.RelativeTimeFormatUnit;
}

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

/**
 * Pick the largest unit that still reads naturally: "3 hours" rather than
 * "180 minutes", "2 days" rather than "48 hours".
 */
function relativePart(diffMs: number): RelativePart {
	const abs = Math.abs(diffMs);
	if (abs < 45 * SECOND) {
		return { amount: Math.round(diffMs / SECOND), unit: "second" };
	}
	if (abs < 45 * MINUTE) {
		return { amount: Math.round(diffMs / MINUTE), unit: "minute" };
	}
	if (abs < 22 * HOUR) {
		return { amount: Math.round(diffMs / HOUR), unit: "hour" };
	}
	if (abs < 26 * DAY) {
		return { amount: Math.round(diffMs / DAY), unit: "day" };
	}
	if (abs < 11 * MONTH) {
		return { amount: Math.round(diffMs / MONTH), unit: "month" };
	}
	return { amount: Math.round(diffMs / YEAR), unit: "year" };
}

/**
 * Relative time, e.g. "in 3 hours" / "2 days ago" (localized). Falls back
 * to the absolute date when `Intl.RelativeTimeFormat` is unavailable.
 */
export function formatRelativeTime(
	value: unknown,
	options: RelativeTimeFormatOptions = {},
): string {
	const date = toDate(value);
	if (!date) return "";

	const part = relativePart(date.getTime() - Date.now());
	const locale = getIntlLocale(options.locale);

	try {
		return new Intl.RelativeTimeFormat(locale, {
			numeric: options.numeric ?? "auto",
			style: options.style ?? "long",
		}).format(part.amount, part.unit);
	} catch {
		return formatDate(date, { locale: options.locale, showTime: true });
	}
}
