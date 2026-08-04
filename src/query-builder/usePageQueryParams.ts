// ═══════════════════════════════════════════════════════════════
// usePageQueryParams — reads route params + search params and
// builds a stable QueryParams object for DynamicTable / Dialogs.
//
// Usage:
//   const { params } = usePageQueryParams(["tenantId"]);
//   // params → { pathParams: { tenantId: "xxx" }, queryParams: { tenantId: "xxx" } }
// ═══════════════════════════════════════════════════════════════
"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import type { PageQueryParams, QueryParams } from "./types";

/**
 * Build a QueryParams object from Next.js route params.
 *
 * @param pathParamKeys  — List of param keys that should be read from the
 *                         route and injected into both pathParams and queryParams.
 *                         e.g. ["tenantId"] → reads `params.tenantId`
 *                         e.g. ["tenantId", "id"] → reads both
 * @param extra          — Optional static params to always include.
 *
 * The returned `params` object is stable (same reference) unless the route
 * params actually change.
 */
export function usePageQueryParams(
	pathParamKeys: string[] = [],
	extra?: QueryParams,
): PageQueryParams {
	const rawRouteParams = useParams<Record<string, string>>();
	const rawSearchParams = useSearchParams();

	// ── Derive pathParams from the route ────────────────────────
	const routeParams = useMemo<Record<string, string>>(() => {
		const result: Record<string, string> = {};
		for (const key of pathParamKeys) {
			const value = rawRouteParams[key];
			if (value && typeof value === "string") {
				result[key] = value;
			}
		}
		return result;
		// rawRouteParams is a stable reference per route, but its
		// values change when the URL changes — that's intentional.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [pathParamKeys, JSON.stringify(rawRouteParams)]);

	// ── Build the final QueryParams object ──────────────────────
	const params = useMemo<QueryParams>(() => {
		const merged: QueryParams = {};

		// Route params → pathParams, queryParams, and bodyParams by default
		if (Object.keys(routeParams).length > 0) {
			merged.pathParams = { ...routeParams };
			merged.queryParams = { ...routeParams };
			merged.bodyParams = { ...routeParams };
		}

		// Extra static params (if caller provides any)
		if (extra) {
			merged.pathParams = { ...merged.pathParams, ...extra.pathParams };
			merged.queryParams = { ...merged.queryParams, ...extra.queryParams };
			merged.bodyParams = { ...extra.bodyParams };
		}

		return merged;
	}, [routeParams, extra]);

	// ── Stable search params snapshot ───────────────────────────
	const searchParams = useMemo(() => rawSearchParams, [rawSearchParams]);

	// ── Merge helper ────────────────────────────────────────────
	const merge = useMemo(
		() =>
			(additional: QueryParams): QueryParams => ({
				pathParams: { ...params.pathParams, ...additional.pathParams },
				queryParams: { ...params.queryParams, ...additional.queryParams },
				bodyParams: { ...params.bodyParams, ...additional.bodyParams },
			}),
		[params],
	);

	return { params, routeParams, searchParams, merge };
}

/**
 * Low-level utility to resolve a params object into query string.
 * Used when you need to manually append params to a URL.
 *
 * @example
 *   paramsToQueryString({ tenantId: "abc", status: "active" })
 *   → "tenantId=abc&status=active"
 */
export function paramsToQueryString(params?: Record<string, string>): string {
	if (!params || Object.keys(params).length === 0) return "";
	return new URLSearchParams(params).toString();
}
