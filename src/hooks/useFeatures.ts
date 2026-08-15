"use client";

import useSWR from "swr";
import { getApiClient, useRenderUser } from "../deps";

// ── Types ────────────────────────────────────────────────────────

export interface FeatureFlags {
	package_versioning: boolean;
	service_versioning: boolean;
	staging_enabled: boolean;
	[feature: string]: boolean;
}

export const DEFAULT_FEATURES: FeatureFlags = {
	package_versioning: false,
	service_versioning: false,
	staging_enabled: false,
};

// ── Fetcher ──────────────────────────────────────────────────────

async function fetchFeatures(): Promise<FeatureFlags> {
	const baseUrl = process.env.NEXT_PUBLIC_ENDPOINT ?? "";
	const res = await getApiClient().get<{ data: FeatureFlags }>(
		`${baseUrl}/api/v1/tenant-features/resolved`,
	);
	return res.data?.data ?? DEFAULT_FEATURES;
}

// ── Hook ─────────────────────────────────────────────────────────

/**
 * Resolved feature flags for the current user context.
 * Defaults to everything OFF while loading or on error, so gated UI
 * stays hidden until the server confirms a feature is enabled.
 *
 * The cache key is scoped to the current tenant: features resolve per
 * tenant, so switching accounts must re-fetch instead of reusing stale
 * flags from a previous tenant.
 */
export function useFeatures(): {
	features: FeatureFlags;
	isLoading: boolean;
} {
	const { data: user } = useRenderUser();
	const tenantId = user?.tenant?.id ?? "personal";

	const { data, isLoading } = useSWR<FeatureFlags>(
		`tenant-features-resolved:${tenantId}`,
		fetchFeatures,
		{ shouldRetryOnError: false, revalidateOnFocus: false },
	);

	return {
		features: data ?? DEFAULT_FEATURES,
		isLoading,
	};
}
