// ──────────────────────────────────────────────────────────────────
// Locale resolution for the shared formatters.
//
// The pipeline renders inside the host app, which stores its active
// locale under `ccd-locale` ("en" | "fa"). Intl needs a BCP-47 tag, so
// this module is the single place the app locale is widened to one.
// Every money / number / date / relative formatter goes through here —
// a table cell and a detail block can never disagree about the locale.
// ──────────────────────────────────────────────────────────────────

"use client";

/** localStorage key the host app's LocaleThemeProvider writes. */
export const LOCALE_STORAGE_KEY = "ccd-locale";

/** The app's short locale, or `null` on the server / when unset. */
export function getAppLocale(): string | null {
	if (typeof window === "undefined") return null;
	try {
		const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
		if (stored) return stored;
	} catch {
		// Private mode / disabled storage — fall through to the cookie.
	}
	// The same fallback the API client uses: next-intl writes NEXT_LOCALE
	// before LocaleThemeProvider has persisted `ccd-locale`.
	if (typeof document !== "undefined") {
		const match = document.cookie
			.split("; ")
			.find((row) => row.startsWith("NEXT_LOCALE="));
		const fromCookie = match?.split("=")[1];
		if (fromCookie) return decodeURIComponent(fromCookie);
	}
	return null;
}

/**
 * Widen an app locale ("en", "fa") to the BCP-47 tag Intl expects.
 * Unknown locales pass through unchanged so a future locale works
 * without a code change.
 */
export function appLocaleToIntl(locale: string | null | undefined): string {
	const value = (locale ?? "").trim();
	if (!value) return "en-US";
	const lower = value.toLowerCase();
	if (lower === "fa" || lower.startsWith("fa-")) return "fa-IR";
	if (lower === "en" || lower.startsWith("en-")) return "en-US";
	if (lower === "ar" || lower.startsWith("ar-")) return "ar";
	return value;
}

/** The Intl locale for a caller-supplied locale, else the app's. */
export function getIntlLocale(locale?: string | null): string {
	return appLocaleToIntl(locale ?? getAppLocale());
}

/** True when the resolved Intl locale is Persian. */
export function isFarsiLocale(locale?: string | null): boolean {
	return getIntlLocale(locale).toLowerCase().startsWith("fa");
}
