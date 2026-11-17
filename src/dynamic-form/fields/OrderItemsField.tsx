"use client";

import { useField, useFormikContext } from "formik";
import { useTranslations } from "next-intl";
import { type ReactElement, useEffect, useId, useMemo } from "react";
import useSWR from "swr";
import { Unicon } from "../../components/common/icon/Unicon";
import { getApiClient } from "../../deps";
import { formatMoney } from "../../formatting/money";
import { useTenantCurrency } from "../../hooks/useTenantCurrency";

// ════════════════════════════════════════════════════════════════
// OrderItemsField — repeatable menu-item picker for order creation.
//
// Formik value: Array<{ menuItemId: string; quantity: number; notes?: string }>
//
// Only ids, quantities and line notes are stored in the form value —
// prices, names and options belong to the server and are rendered as an
// informational projection (unit price, line total, order total).
//
// The tenant's menu items come from the authenticated menu-items list;
// the picker itself is tenant-scoped by the request token, so there is
// no tenant selector here.
// ════════════════════════════════════════════════════════════════

export interface OrderItemRow {
	menuItemId: string;
	quantity: number;
	notes?: string;
}

interface MenuItemOption {
	id: string;
	name: string;
	price: number;
	/** The list could not resolve a price (monetization is down) — show "—". */
	priceUnavailable: boolean;
	isAvailable: boolean;
	isOrderable: boolean;
}

/** Same list endpoint the menu-items screens use (tenant-scoped by auth). */
const MENU_ITEMS_ENDPOINT = "/api/v1/menu-items?limit=200";

const MIN_QUANTITY = 1;
const MAX_QUANTITY = 99;

const INPUT_CLASS =
	"flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm text-start shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const LABEL_CLASS = "text-sm font-medium leading-none text-foreground";

const GHOST_BUTTON_CLASS =
	"inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

const REMOVE_BUTTON_CLASS =
	"inline-flex size-9 shrink-0 items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

interface Translator {
	(key: string): string;
	has(key: string): boolean;
}

/**
 * Resolve the field's UI labels from the host app's translation provider.
 * Keys that are not translated yet fall back to the neutral defaults below
 * so the field never renders a raw `$trl_`-style key.
 */
function useOrderItemsLabels() {
	const t = useTranslations("common") as unknown as Translator;
	const resolve = (key: string, fallback: string) =>
		t.has(key) ? t(key) : fallback;

	return {
		menuItem: resolve("menuItem", "Menu item"),
		quantity: resolve("quantity", "Quantity"),
		notes: resolve("notes", "Notes"),
		addItem: resolve("addItem", "Add item"),
		removeItem: resolve("removeItem", "Remove item"),
		loading: resolve("menuItemsLoading", "Loading menu items…"),
		empty: resolve("menuItemsEmpty", "No menu items are available."),
		error: resolve("menuItemsLoadFailed", "Could not load the menu items."),
		total: resolve("total", "Total"),
	};
}

function toMenuItemOption(raw: unknown): MenuItemOption | null {
	if (raw === null || typeof raw !== "object") return null;
	const item = raw as Record<string, unknown>;
	if (typeof item.id !== "string" || typeof item.name !== "string") {
		return null;
	}
	const price = Number(item.price);
	const priceUnavailable =
		item.priceUnavailable === true ||
		item.pricePending === true ||
		item.price === null ||
		item.price === undefined ||
		!Number.isFinite(price);
	return {
		id: item.id,
		name: item.name,
		price: priceUnavailable ? 0 : price,
		priceUnavailable,
		isAvailable: item.isAvailable !== false,
		isOrderable: item.isOrderable !== false,
	};
}

/**
 * Fetch the tenant's items and unwrap the paginated envelope
 * (`{ data: { data: [...], total, … } }`).
 */
async function fetchMenuItems(url: string): Promise<MenuItemOption[]> {
	const res = await getApiClient().request({ url, method: "GET" });
	const body = res.data?.data;
	const rows: unknown[] = Array.isArray(body)
		? body
		: Array.isArray(body?.data)
			? body.data
			: [];
	return rows
		.map(toMenuItemOption)
		.filter((item): item is MenuItemOption => item !== null);
}

function clampQuantity(raw: string): number {
	const parsed = Number.parseInt(raw, 10);
	if (!Number.isFinite(parsed)) return MIN_QUANTITY;
	return Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, parsed));
}

/**
 * Money label for the picker. The menu-items list may carry no currency
 * (prices live in monetization), so the tenant's display currency is used.
 * An unresolved price reads "—", never a misleading `0` (E5-07).
 */
function moneyLabel(
	amount: number,
	currency: string,
	unavailable = false,
): string {
	if (unavailable) return "—";
	const rounded = Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0;
	return formatMoney(rounded, { currency });
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function OrderItemsField({
	field,
}: {
	field: {
		name: string;
		label?: string;
		isRequired?: boolean;
		isReadOnly?: boolean;
	};
}): ReactElement {
	const [{ value }, meta, { setValue, setTouched }] = useField<OrderItemRow[]>(
		field.name,
	);
	const { isSubmitting, submitCount } = useFormikContext();
	const labels = useOrderItemsLabels();
	const currency = useTenantCurrency();
	const baseId = useId();

	const baseUrl = process.env.NEXT_PUBLIC_ENDPOINT ?? "";
	const { data, error, isLoading } = useSWR(
		`${baseUrl}${MENU_ITEMS_ENDPOINT}`,
		fetchMenuItems,
	);

	const items = useMemo(() => data ?? [], [data]);
	const itemsById = useMemo(
		() => new Map(items.map((item) => [item.id, item])),
		[items],
	);
	const options = useMemo(
		() => items.filter((item) => item.isAvailable && item.isOrderable),
		[items],
	);

	const rows: OrderItemRow[] = Array.isArray(value) ? value : [];
	const disabled = isSubmitting || Boolean(field.isReadOnly);
	const available = !(isLoading || error) && options.length > 0;

	// FormRenderer initializes unspecified fields with "" — normalize the
	// repeater so the submitted payload is always an array.
	useEffect(() => {
		if (!Array.isArray(value)) setValue([]);
	}, [value, setValue]);

	const updateRow = (index: number, patch: Partial<OrderItemRow>) => {
		setValue(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
	};

	const addRow = () => {
		setValue([...rows, { menuItemId: "", quantity: MIN_QUANTITY }]);
	};

	const removeRow = (index: number) => {
		setValue(rows.filter((_, i) => i !== index));
	};

	const orderTotal = rows.reduce((sum, row) => {
		const item = itemsById.get(row.menuItemId);
		return item ? sum + item.price * row.quantity : sum;
	}, 0);

	// One unknown price makes the whole total unknown — showing a partial
	// sum would under-report what the order costs.
	const orderPriceUnavailable = rows.some(
		(row) => itemsById.get(row.menuItemId)?.priceUnavailable === true,
	);

	/**
	 * Quantity 2 of one item is TWO items, not one line. The counter used to
	 * count rows, so one line of two read like a single item.
	 */
	const totalQuantity = rows.reduce(
		(sum, row) => (row.menuItemId ? sum + (Number(row.quantity) || 0) : sum),
		0,
	);

	return (
		<div className="flex flex-col gap-2">
			<span className="text-sm font-medium leading-none text-foreground">
				{field.label}
				{field.isRequired && (
					<span className="ms-0.5 text-destructive" aria-hidden="true">
						*
					</span>
				)}
			</span>

			{isLoading && (
				<p className="text-sm text-muted-foreground">{labels.loading}</p>
			)}
			{error && <p className="text-sm text-destructive">{labels.error}</p>}
			{!(isLoading || error) && options.length === 0 && (
				<p className="text-sm text-muted-foreground">{labels.empty}</p>
			)}

			{rows.map((row, index) => {
				const item = itemsById.get(row.menuItemId) ?? null;
				const selectedItem: MenuItemOption | null = item ?? {
					id: row.menuItemId,
					// The item is not in the fetched options yet (loading) or was
					// removed. Never surface its id as the label.
					name: "—",
					price: 0,
					priceUnavailable: true,
					isAvailable: true,
					isOrderable: true,
				};
				const lineTotal = item ? item.price * row.quantity : 0;
				// The selected id may not be in `options` (still loading, or the
				// item became unavailable). Keep it selectable so the value the
				// form already holds is never silently dropped.
				const selectedNotListed =
					!!row.menuItemId &&
					!options.some((option) => option.id === row.menuItemId);

				return (
					<div
						// Rows are positional — the submitted payload carries no row
						// id, so an index key keeps React state aligned with the order.
						// biome-ignore lint/suspicious/noArrayIndexKey: positional order rows
						key={index}
						className="flex flex-wrap items-end gap-2"
					>
						<div className="flex min-w-48 flex-1 flex-col gap-2">
							<label
								htmlFor={`${baseId}-item-${index}`}
								className={LABEL_CLASS}
							>
								{labels.menuItem}
							</label>
							<select
								id={`${baseId}-item-${index}`}
								value={row.menuItemId}
								onChange={(event) =>
									updateRow(index, { menuItemId: event.target.value })
								}
								onBlur={() => setTouched(true)}
								disabled={disabled}
								className={INPUT_CLASS}
							>
								<option value="">{labels.menuItem}</option>
								{selectedNotListed && (
									<option value={row.menuItemId}>{selectedItem.name}</option>
								)}
								{options.map((option) => (
									<option key={option.id} value={option.id}>
										{option.name} —{" "}
										{moneyLabel(
											option.price,
											currency,
											option.priceUnavailable,
										)}
									</option>
								))}
							</select>
							{item && (
								<p className="text-sm text-muted-foreground">
									{moneyLabel(item.price, currency, item.priceUnavailable)} ×{" "}
									{row.quantity} ={" "}
									{moneyLabel(lineTotal, currency, item.priceUnavailable)}
								</p>
							)}
						</div>

						<div className="flex w-24 flex-col gap-2">
							<label
								htmlFor={`${baseId}-quantity-${index}`}
								className={LABEL_CLASS}
							>
								{labels.quantity}
							</label>
							<input
								id={`${baseId}-quantity-${index}`}
								type="number"
								value={row.quantity}
								min={MIN_QUANTITY}
								max={MAX_QUANTITY}
								step={1}
								disabled={disabled}
								onChange={(event) =>
									updateRow(index, {
										quantity: clampQuantity(event.target.value),
									})
								}
								onBlur={() => setTouched(true)}
								className={INPUT_CLASS}
							/>
						</div>

						<div className="flex min-w-40 flex-1 flex-col gap-2">
							<label
								htmlFor={`${baseId}-notes-${index}`}
								className={LABEL_CLASS}
							>
								{labels.notes}
							</label>
							<input
								id={`${baseId}-notes-${index}`}
								type="text"
								value={row.notes ?? ""}
								disabled={disabled}
								onChange={(event) =>
									updateRow(index, { notes: event.target.value || undefined })
								}
								onBlur={() => setTouched(true)}
								className={INPUT_CLASS}
							/>
						</div>

						<button
							type="button"
							disabled={disabled}
							onClick={() => removeRow(index)}
							aria-label={labels.removeItem}
							className={REMOVE_BUTTON_CLASS}
						>
							<Unicon name="Close" size={18} />
						</button>
					</div>
				);
			})}

			<div className="flex flex-wrap items-center justify-between gap-4">
				<button
					type="button"
					onClick={addRow}
					disabled={disabled || !available}
					className={GHOST_BUTTON_CLASS}
				>
					<Unicon name="Add" size={18} />
					{labels.addItem}
				</button>
				{rows.length > 0 && (
					<p className="text-sm font-medium text-foreground">
						{labels.quantity}: {totalQuantity} · {labels.total}:{" "}
						{orderPriceUnavailable ? "—" : moneyLabel(orderTotal, currency)}
					</p>
				)}
			</div>

			{meta.error && (meta.touched || submitCount > 0) && (
				<p className="text-sm text-destructive">{meta.error}</p>
			)}
		</div>
	);
}
