// ──────────────────────────────────────────────────────────────────
// Money formatting — the single place amounts become human money.
//
// `money` is a DSL column/field format (`format: { type: "money" }`)
// and the same helpers are used by the order-items form field and the
// record detail block, so a table cell and a detail row always read the
// same way.
//
// Rules (decided once, here):
//   - the stored value is never mutated; only the display is formatted
//   - the amount is formatted with `Intl.NumberFormat(locale, …)` so it
//     gets the locale's grouping and digits (Latin or Persian)
//   - fraction digits come from the currency itself (IRR/IRT = 0,
//     USD/EUR/GBP = 2, JPY = 0, unknown = 2)
//   - IRR/IRT are the only special case: both are zero-decimal; IRT
//     (Toman) has no CLDR symbol, so fa renders it as "تومان"
//   - an unknown/invalid code falls back to grouped decimal + code —
//     never a bare number, never a crash
//   - zero is money (`$0.00`, `۰ ریال`); only a missing value is "—"
// ──────────────────────────────────────────────────────────────────

import { getIntlLocale, isFarsiLocale } from "./locale";

/** The tenant-currency fallback when nothing better is known (backend default). */
export const DEFAULT_CURRENCY = "IRR";

/** Currencies with no minor unit, decided once for IRR and its Toman alias. */
const ZERO_DECIMAL_CURRENCIES = new Set(["IRR", "IRT"]);

export interface MoneyFormatOptions {
	/** Explicit ISO-4217 code (wins over everything). */
	currency?: string | null;
	/** Row field the amount is denominated in (default "currency"). */
	currencyField?: string | null;
	/** Override the locale ("en" | "fa" | any BCP-47 tag). */
	locale?: string | null;
	minimumFractionDigits?: number;
	maximumFractionDigits?: number;
	currencyDisplay?: "symbol" | "narrowSymbol" | "code" | "name";
}

/** Uppercase + trim a currency code, or `null` when it is not usable. */
export function normalizeCurrency(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const code = value.trim().toUpperCase();
	return /^[A-Z]{3,4}$/.test(code) ? code : null;
}

/**
 * Decimal places the currency is displayed in. IRR/IRT are fixed to 0;
 * every other code asks Intl (so JPY → 0, KWD → 3, USD → 2). An
 * unrecognised code assumes 2, matching the backend's `currencyExponent`.
 */
export function currencyFractionDigits(
	currency: string | null | undefined,
	locale?: string | null,
): number {
	const code = normalizeCurrency(currency) ?? DEFAULT_CURRENCY;
	if (ZERO_DECIMAL_CURRENCIES.has(code)) return 0;
	try {
		const resolved = new Intl.NumberFormat(getIntlLocale(locale), {
			style: "currency",
			currency: code,
		}).resolvedOptions();
		return resolved.maximumFractionDigits ?? 2;
	} catch {
		return 2;
	}
}

/**
 * The currency a money cell should use, in priority order:
 *   1. `format.props.currency` (an explicit per-column code)
 *   2. the row's `currencyField` (default `currency`) / `currencyCode`
 *   3. the tenant currency supplied by the host (payment account)
 *   4. the platform default (IRR)
 */
export function resolveMoneyCurrency(
	props: MoneyFormatOptions | null | undefined,
	row: Record<string, unknown> | null | undefined,
	tenantCurrency?: string | null,
): string {
	const explicit = normalizeCurrency(props?.currency);
	if (explicit) return explicit;

	const field =
		typeof props?.currencyField === "string" && props.currencyField.trim()
			? props.currencyField.trim()
			: "currency";

	const fromRow =
		normalizeCurrency(row?.[field]) ??
		normalizeCurrency(row?.currency) ??
		normalizeCurrency(row?.currencyCode) ??
		normalizeCurrency((row?.meta as Record<string, unknown> | undefined)?.currency);
	if (fromRow) return fromRow;

	return normalizeCurrency(tenantCurrency) ?? DEFAULT_CURRENCY;
}

/** Parse a stored numeric string/number without losing digits or the sign. */
function toAmount(value: unknown): number | null {
	if (value === null || value === undefined || value === "") return null;
	let parsed: number;
	if (typeof value === "number") {
		parsed = value;
	} else if (typeof value === "string") {
		const normalized = value
			.trim()
			.replace(/[,٬\s]/g, "")
			.replace(/٫/g, ".");
		if (!normalized) return null;
		parsed = Number(normalized);
	} else {
		return null;
	}
	if (!Number.isFinite(parsed)) return null;
	return Object.is(parsed, -0) ? 0 : parsed;
}

/** IRT has no CLDR symbol; fa readers know it as Toman. */
function localizeCurrency(formatted: string, currency: string, locale: string) {
	if (currency !== "IRT" || !isFarsiLocale(locale)) return formatted;
	return formatted.replace(/\bIRT\b/g, "تومان");
}

/**
 * Format an amount as money. Returns `""` for a missing/invalid value so
 * the cell can render its empty placeholder; zero formats as zero money.
 */
export function formatMoney(
	value: unknown,
	options: MoneyFormatOptions = {},
): string {
	const amount = toAmount(value);
	if (amount === null) return "";

	const locale = getIntlLocale(options.locale);
	const currency = normalizeCurrency(options.currency) ?? DEFAULT_CURRENCY;
	const maximum =
		options.maximumFractionDigits ??
		currencyFractionDigits(currency, locale);
	const minimum = options.minimumFractionDigits ?? maximum;

	try {
		const formatted = new Intl.NumberFormat(locale, {
			style: "currency",
			currency,
			currencyDisplay: options.currencyDisplay ?? "symbol",
			minimumFractionDigits: minimum,
			maximumFractionDigits: maximum,
		}).format(amount);
		return localizeCurrency(formatted, currency, locale);
	} catch {
		// Intl rejects non-ISO codes (e.g. a custom token). Group the amount
		// anyway and append the code — the amount is never left bare.
		const numeric = new Intl.NumberFormat(locale, {
			minimumFractionDigits: minimum,
			maximumFractionDigits: maximum,
		}).format(amount);
		const suffix = currency === "IRT" && isFarsiLocale(locale) ? "تومان" : currency;
		return `${numeric} ${suffix}`;
	}
}

export interface NumberFormatOptions {
	locale?: string | null;
	minimumFractionDigits?: number;
	maximumFractionDigits?: number;
	/** Thousands grouping (default true). Off for years/order numbers. */
	useGrouping?: boolean;
}

/**
 * Format a non-money numeric value (counts, quantities, sizes) with the
 * locale's grouping — the `number` column type. Decimals beyond two
 * places are only float noise in these columns.
 */
export function formatNumber(
	value: unknown,
	options: NumberFormatOptions = {},
): string {
	const amount = toAmount(value);
	if (amount === null) return "";
	const locale = getIntlLocale(options.locale);
	try {
		return new Intl.NumberFormat(locale, {
			minimumFractionDigits: options.minimumFractionDigits ?? 0,
			maximumFractionDigits: options.maximumFractionDigits ?? 2,
			useGrouping: options.useGrouping ?? true,
		}).format(amount);
	} catch {
		return String(amount);
	}
}
