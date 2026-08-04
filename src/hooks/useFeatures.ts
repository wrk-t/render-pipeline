"use client";

import useSWR from "swr";
import { getApiClient } from "../deps";

// ── Types ────────────────────────────────────────────────────────

export interface FeatureFlags {
	package_versioning: boolean;
	staging_enabled: boolean;
	[feature: string]: boolean;
}

export const DEFAULT_FEATURES: FeatureFlags = {
	package_versioning: false,
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
 */
export function useFeatures(): {
	features: FeatureFlags;
	isLoading: boolean;
} {
	const { data, isLoading } = useSWR<FeatureFlags>(
		"tenant-features-resolved",
		fetchFeatures,
		{ shouldRetryOnError: false, revalidateOnFocus: false },
	);

	return {
		features: data ?? DEFAULT_FEATURES,
		isLoading,
	};
}
