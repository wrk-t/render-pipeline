"use client";

import { useMemo } from "react";
import { useRenderUser } from "../deps";

/**
 * Merges the current user's workspace tenant into path params so that
 * `{tenantId}` endpoint templates resolve on screens whose route doesn't
 * carry the tenant (e.g. /settings/branding → /api/v1/tenant/{tenantId}/...).
 *
 * The user's current tenant comes from the identity endpoint (JWT /
 * x-workspace context). Super admins have no tenant, so nothing is injected.
 *
 * The user's tenant is a FALLBACK only — a tenantId already present in the
 * route params (e.g. the super-admin tenant console at /tenants/:tenantId)
 * always wins, otherwise every tenant's screens would resolve the flags,
 * tables and forms of the current user's own workspace instead of the
 * viewed tenant.
 */
export function useResolvedParams(
	pathParams?: Record<string, string>,
): Record<string, string> {
	const { data: user } = useRenderUser();
	const tenantId = (user as any)?.tenant?.id as string | undefined;

	return useMemo(() => {
		const base = pathParams ?? {};
		if (!tenantId) return base;
		// A route-provided tenantId (viewed tenant) is authoritative.
		if (base.tenantId) return base;
		return { ...base, tenantId };
	}, [pathParams, tenantId]);
}
