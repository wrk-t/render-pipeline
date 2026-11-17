// ════════════════════════════════════════════════════════════════
// Dialog title derivation (UX-7).
//
// A dialog title names the ACTION that opened it, never the table it was
// opened from. The old fallback built "Create {table title}", so the Receive
// action became "Create Purchase orders" — plural, and wrong about what the
// click does.
//
// Priority:
//   1. the action's own `dialog.title` — a `$trl_` key resolved by the
//      metadata layer, or a literal; `{rowField}` placeholders resolve from
//      the row values the table passed with the dialog (`Receive PO-{number}`);
//   2. the action's translated `label` ("Receive", "Edit", "Create menu item");
//   3. the caller's context fallback.
// ════════════════════════════════════════════════════════════════

/** `{field}` / `{nested.field}` / `{list[0].field}` tokens. */
const TITLE_PLACEHOLDER = /\{([\w.[\]]+)\}/g;
/** Path separators: a dot or an `[index]` segment. */
const PATH_SEGMENT = /(\.|\[\d+\])/;
const ARRAY_INDEX = /^\[(\d+)\]$/;
/** A key the metadata layer should already have resolved. */
const TRL_PREFIX = /^\$trl_/;

/** Resolve `{field}`, `{nested.field}` and `{list[0].field}` placeholders. */
export function resolveDialogTitle(
	template: string,
	params?: Record<string, unknown> | null,
): string {
	if (!params) return template;
	return template.replace(TITLE_PLACEHOLDER, (whole: string, path: string) => {
		const value = path.split(PATH_SEGMENT).reduce<unknown>((current, part) => {
			if (part === "." || part === "") return current;
			const index = part.match(ARRAY_INDEX);
			if (index) {
				return Array.isArray(current) ? current[Number(index[1])] : undefined;
			}
			if (current === null || current === undefined) return undefined;
			return (current as Record<string, unknown>)[part];
		}, params);
		return value === null || value === undefined ? whole : String(value);
	});
}

/**
 * The title a dialog opened by `action` should show, or `null` when the
 * action carries neither a title nor a label (the caller then uses its own
 * context fallback).
 */
export function deriveDialogTitle({
	title,
	label,
	params,
}: {
	title?: unknown;
	label?: unknown;
	params?: Record<string, unknown> | null;
}): string | null {
	const source =
		typeof title === "string" && title.trim() !== ""
			? title
			: typeof label === "string" && label.trim() !== ""
				? label
				: null;
	if (!source) return null;
	// The metadata layer resolves `$trl_` keys; strip a leftover prefix (an
	// unknown key/tenant override) rather than showing the raw key.
	return resolveDialogTitle(source.replace(TRL_PREFIX, ""), params);
}
