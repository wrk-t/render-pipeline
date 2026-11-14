"use client";

import type { ReactElement } from "react";
import {
	formatMoney,
	type MoneyFormatOptions,
	normalizeCurrency,
	resolveMoneyCurrency,
} from "../formatting/money";
import { useTenantCurrencyState } from "../hooks/useTenantCurrency";

interface Props {
	cell: any;
	columnDef: any;
}

/**
 * Renders money inside a table cell.
 *
 * Format config:
 *   { type: "money" }
 *   { type: "money", props: { currencyField: "currency" } }
 *   { type: "money", props: { currency: "USD" } }
 *
 * The currency comes from the row's own currency column when it has one
 * (an order, invoice or purchase order is denominated in its own code),
 * otherwise from the tenant's payment-account currency, otherwise the
 * platform default. The stored amount is only read — never rewritten.
 */
export function MoneyCell({ cell }: Props): ReactElement {
	const value = cell.getValue();
	const fmt = cell?.column?.columnDef?.columnFormat ?? {};
	const props = (fmt?.props ?? {}) as MoneyFormatOptions & {
		locale?: string;
	};
	const row = (cell?.row?.original ?? null) as Record<string, unknown> | null;
	// A row that carries its own currency (an order, invoice or purchase
	// order) needs no tenant lookup at all.
	const currencyField =
		typeof props.currencyField === "string" && props.currencyField.trim()
			? props.currencyField.trim()
			: "currency";
	const rowCurrency =
		normalizeCurrency(row?.[currencyField]) ??
		normalizeCurrency(row?.currency) ??
		normalizeCurrency(row?.currencyCode);
	const needsTenantCurrency = !normalizeCurrency(props.currency) && !rowCurrency;
	const { currency: tenantCurrency, isLoading } = useTenantCurrencyState(
		needsTenantCurrency,
	);

	// The amount is never labelled with the wrong currency: wait for the
	// tenant lookup instead of flashing the IRR default on a USD tenant.
	if (needsTenantCurrency && isLoading) {
		return (
			<span className="text-gray-400" aria-label="…">
				…
			</span>
		);
	}

	const currency = resolveMoneyCurrency(props, row, tenantCurrency);
	const text = formatMoney(value, { ...props, currency });

	if (!text) {
		return (
			<span className="text-gray-400" aria-label="—">
				—
			</span>
		);
	}

	return (
		<span
			dir="auto"
			title={text}
			data-currency={currency}
			className="tabular-nums whitespace-nowrap"
		>
			{text}
		</span>
	);
}
