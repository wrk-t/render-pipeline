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
 */
export function useResolvedParams(
	pathParams?: Record<string, string>,
): Record<string, string> {
	const { data: user } = useRenderUser();
	const tenantId = (user as any)?.tenant?.id as string | undefined;

	return useMemo(() => {
		const base = pathParams ?? {};
		if (!tenantId) return base;
		return { ...base, tenantId };
	}, [pathParams, tenantId]);
}
