"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { requireDeps, useRenderUser } from "../deps";

/**
 * Resolves the tenant for `{tenantId}` endpoint templates.
 *
 * Order:
 *   1. a route param — the super-admin tenant console at /tenants/:tenantId
 *   2. `?tenantId=` — an explicit tenant from the screen
 *   3. the signed-in user's workspace tenant
 *   4. the `tenantId` claim in the signed-in JWT — the token is the authority
 *      for tenant users; /users/me can be stale or not carry the tenant yet
 *
 * Super admins have no workspace tenant, so the query parameter lets a
 * standalone screen choose the tenant it manages. `useSearchParams` makes the
 * resolution reactive: choosing a tenant refreshes every table/form that uses
 * `{tenantId}`.
 */
export function useResolvedParams(
	pathParams?: Record<string, string>,
): Record<string, string> {
	const { data: user } = useRenderUser();
	const tenantId = (user as { tenant?: { id?: string } } | null | undefined)
		?.tenant?.id;
	const searchParams = useSearchParams();
	const queryTenantId = searchParams.get("tenantId") ?? undefined;
	const jwtTenantId = requireDeps().getTenantId?.();

	return useMemo(() => {
		const base = pathParams ?? {};
		// A route-provided tenantId (viewed tenant) is authoritative.
		if (base.tenantId) return base;
		if (queryTenantId) return { ...base, tenantId: queryTenantId };
		const resolved = tenantId ?? jwtTenantId;
		if (!resolved) return base;
		return { ...base, tenantId: resolved };
	}, [pathParams, tenantId, queryTenantId, jwtTenantId]);
}
