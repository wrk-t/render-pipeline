"use client";

// ──────────────────────────────────────────────────────────────────
// The tenant's display currency.
//
// Money is denominated in the tenant's payment-account currency
// (`payment_accounts.currency`, default IRR). Rows that carry their own
// `currency` (orders, invoices, POs) win over this; a row that does not
// (a menu-item price, a customer's lifetime spend) uses the tenant
// currency. The request is SWR-cached per tenant, so a page of money
// cells makes one call, and a role without the wallet scope silently
// falls back to the platform default instead of blocking the table.
// ──────────────────────────────────────────────────────────────────

import useSWR from "swr";
import { getApiClient, useRenderUser } from "../deps";
import { DEFAULT_CURRENCY, normalizeCurrency } from "../formatting/money";

/** SWR key prefix — shared by every money formatter on the page. */
export const TENANT_CURRENCY_KEY = "render-pipeline:tenant-currency";

export interface TenantCurrencyState {
	/** The resolved currency, or the platform default while unknown. */
	currency: string;
	/** True only while a lookup this surface needs is in flight. */
	isLoading: boolean;
}

/**
 * The tenant's display currency, plus whether the lookup is still in
 * flight. A money cell that must wait for it can show a placeholder
 * instead of briefly labelling a USD amount as IRR.
 */
export function useTenantCurrencyState(enabled = true): TenantCurrencyState {
	const { data: user } = useRenderUser();
	const tenantId = user?.tenant?.id ?? null;
	// A host that already knows the tenant currency can put it on the user —
	// no request at all. Otherwise the payment account is the source.
	const fromUser = normalizeCurrency(user?.tenant?.currency);

	const { data, isLoading } = useSWR(
		enabled && tenantId && !fromUser
			? `${TENANT_CURRENCY_KEY}:${tenantId}`
			: null,
		async () => {
			try {
				const res = await getApiClient().request({
					url: `/api/v1/tenant/${encodeURIComponent(tenantId ?? "")}/payment-account`,
					method: "GET",
				});
				const body = res.data?.data ?? res.data;
				return normalizeCurrency(body?.currency) ?? null;
			} catch {
				// No wallet scope / monetization disabled — use the default.
				return null;
			}
		},
		{
			revalidateOnFocus: false,
			shouldRetryOnError: false,
			dedupingInterval: 60_000,
		},
	);

	const resolved = fromUser ?? normalizeCurrency(data);
	return {
		currency: resolved ?? DEFAULT_CURRENCY,
		isLoading: Boolean(
			enabled && tenantId && !fromUser && !resolved && isLoading,
		),
	};
}

/**
 * The tenant's display currency. `enabled` lets a surface that may not
 * show money skip the lookup (a detail block with no money field); the
 * hook must still be called unconditionally.
 */
export function useTenantCurrency(enabled = true): string {
	return useTenantCurrencyState(enabled).currency;
}
