"use client";

import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormHelperText from "@mui/material/FormHelperText";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useField, useFormikContext } from "formik";
import { useTranslations } from "next-intl";
import { type ReactElement, useEffect, useMemo } from "react";
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
		<Stack spacing={1}>
			<Typography variant="body2">
				{field.label}
				{field.isRequired && (
					<Typography component="span" color="error">
						{" "}
						*
					</Typography>
				)}
			</Typography>

			{isLoading && (
				<Typography variant="caption" color="text.secondary">
					{labels.loading}
				</Typography>
			)}
			{error && (
				<Typography variant="caption" color="error">
					{labels.error}
				</Typography>
			)}
			{!(isLoading || error) && options.length === 0 && (
				<Typography variant="caption" color="text.secondary">
					{labels.empty}
				</Typography>
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

				return (
					<Stack
						// Rows are positional — the submitted payload carries no row
						// id, so an index key keeps React state aligned with the order.
						// biome-ignore lint/suspicious/noArrayIndexKey: positional order rows
						key={index}
						direction="row"
						spacing={1}
						className="items-start"
					>
						<Stack spacing={0.2} className="flex-1">
							<Autocomplete<MenuItemOption, false, false, false>
								size="small"
								value={row.menuItemId ? selectedItem : null}
								onChange={(_event, option) =>
									updateRow(index, { menuItemId: option?.id ?? "" })
								}
								onBlur={() => setTouched(true)}
								options={options}
								getOptionLabel={(option) => option.name}
								isOptionEqualToValue={(option, selected) =>
									option.id === selected.id
								}
								loading={isLoading}
								loadingText={labels.loading}
								noOptionsText={labels.empty}
								disabled={disabled}
								renderOption={(props, option) => (
									<li {...props}>
										<div className="flex w-full justify-between gap-2">
											<span>{option.name}</span>
											<span className="text-sm opacity-60">
												{moneyLabel(option.price, currency, option.priceUnavailable)}
											</span>
										</div>
									</li>
								)}
								renderInput={(params) => (
									<TextField {...params} size="small" label={labels.menuItem} />
								)}
							/>
							{item && (
								<Typography variant="caption" color="text.secondary">
									{moneyLabel(item.price, currency, item.priceUnavailable)} ×{" "}
									{row.quantity} ={" "}
									{moneyLabel(lineTotal, currency, item.priceUnavailable)}
								</Typography>
							)}
						</Stack>

						<TextField
							size="small"
							type="number"
							label={labels.quantity}
							value={row.quantity}
							disabled={disabled}
							onChange={(event) =>
								updateRow(index, {
									quantity: clampQuantity(event.target.value),
								})
							}
							onBlur={() => setTouched(true)}
							slotProps={{
								htmlInput: {
									min: MIN_QUANTITY,
									max: MAX_QUANTITY,
									step: 1,
								},
							}}
							className="w-24"
						/>

						<TextField
							size="small"
							label={labels.notes}
							value={row.notes ?? ""}
							disabled={disabled}
							onChange={(event) =>
								updateRow(index, { notes: event.target.value || undefined })
							}
							onBlur={() => setTouched(true)}
							className="flex-1"
						/>

						<IconButton
							size="small"
							color="error"
							disabled={disabled}
							onClick={() => removeRow(index)}
							aria-label={labels.removeItem}
						>
							<Unicon name="Close" size={18} />
						</IconButton>
					</Stack>
				);
			})}

			<Stack
				direction="row"
				spacing={2}
				className="items-center justify-between"
			>
				<Box>
					<Button
						startIcon={<Unicon name="Add" size={18} />}
						onClick={addRow}
						disabled={disabled || !available}
						size="small"
					>
						{labels.addItem}
					</Button>
				</Box>
				{rows.length > 0 && (
					<Typography variant="body2" className="font-medium">
						{labels.quantity}: {totalQuantity} · {labels.total}:{" "}
						{orderPriceUnavailable ? "—" : moneyLabel(orderTotal, currency)}
					</Typography>
				)}
			</Stack>

			{meta.error && (meta.touched || submitCount > 0) && (
				<FormHelperText error>{meta.error}</FormHelperText>
			)}
		</Stack>
	);
}
