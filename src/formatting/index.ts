// ──────────────────────────────────────────────────────────────────
// Shared formatting — money, numbers, dates, relative time and
// references. Renderers and form fields import from here so the same
// value reads the same way on every surface.
// ──────────────────────────────────────────────────────────────────

export type {
	DateFormatOptions,
	RelativeTimeFormatOptions,
} from "./date";
export {
	formatDate,
	formatRelativeTime,
	hasTimePart,
	toDate,
} from "./date";
export { appLocaleToIntl, getAppLocale, getIntlLocale } from "./locale";
export type { MoneyFormatOptions, NumberFormatOptions } from "./money";
export {
	currencyFractionDigits,
	DEFAULT_CURRENCY,
	formatMoney,
	formatNumber,
	normalizeCurrency,
	resolveMoneyCurrency,
} from "./money";
export type {
	ReferenceDatasource,
	ReferenceFormatOptions,
	ResolvedReference,
	ResolveReferenceContext,
} from "./reference";
export {
	labelFromObject,
	looksLikeId,
	referenceHref,
	referenceId,
	referenceLabelForId,
	referenceLabelFromValue,
	resolveReference,
	rowReferenceLabel,
} from "./reference";
export type { ReferenceOption } from "./types";
