"use client";

import { createContext, useContext } from "react";
import useSWR from "swr";
import { getApiClient, useRenderUser } from "../deps";

// ── Types ────────────────────────────────────────────────────────

export interface FeatureFlags {
	package_versioning: boolean;
	service_versioning: boolean;
	staging_enabled: boolean;
	multi_mi_instance: boolean;
	[feature: string]: boolean;
}

export const DEFAULT_FEATURES: FeatureFlags = {
	package_versioning: false,
	service_versioning: false,
	staging_enabled: false,
	multi_mi_instance: false,
};

// ── Viewed-tenant scope ─────────────────────────────────────────
// Provided by ComponentRenderer when the render tree is bound to a
// specific tenant via route params (e.g. the super-admin tenant
// console at /tenants/:tenantId). Feature-gated UI then resolves the
// VIEWED tenant's flags instead of the viewer's own context (which for
// a super admin outside any workspace is the all-true platform bypass).
export const ViewTenantContext = createContext<string | undefined>(undefined);

// ── Fetcher ──────────────────────────────────────────────────────

async function fetchFeatures(tenantId?: string): Promise<FeatureFlags> {
	const baseUrl = process.env.NEXT_PUBLIC_ENDPOINT ?? "";
	const qs =
		tenantId && tenantId !== "personal"
			? `?tenantId=${encodeURIComponent(tenantId)}`
			: "";
	const res = await getApiClient().get<{ data: FeatureFlags }>(
		`${baseUrl}/api/v1/tenant-features/resolved${qs}`,
	);
	return res.data?.data ?? DEFAULT_FEATURES;
}

// ── Hook ─────────────────────────────────────────────────────────

/**
 * Resolved feature flags for the current context.
 * Defaults to everything OFF while loading or on error, so gated UI
 * stays hidden until the server confirms a feature is enabled.
 *
 * Resolution order:
 *  1. The VIEWED tenant (ViewTenantContext — set when rendering a
 *     tenant-bound screen like the super-admin tenant console).
 *  2. The current user's tenant.
 *  3. No tenant at all ("personal") — the platform context (super
 *     admin) resolves every feature true.
 *
 * The cache key is scoped to the resolved tenant: features resolve per
 * tenant, so switching accounts or tenants must re-fetch instead of
 * reusing stale flags.
 */
export function useFeatures(): {
	features: FeatureFlags;
	isLoading: boolean;
} {
	const { data: user } = useRenderUser();
	const viewedTenantId = useContext(ViewTenantContext);
	const tenantId = viewedTenantId ?? user?.tenant?.id ?? "personal";

	const { data, isLoading } = useSWR<FeatureFlags>(
		`tenant-features-resolved:${tenantId}`,
		() => fetchFeatures(tenantId),
		{ shouldRetryOnError: false, revalidateOnFocus: false },
	);

	return {
		features: data ?? DEFAULT_FEATURES,
		isLoading,
	};
}
