// ──────────────────────────────────────────────────────────────────
// useComponentRender — Stage 1 of the pipeline: fetch a component's
// fully-resolved render tree from the metadata service.
// ──────────────────────────────────────────────────────────────────

"use client";

import useSWR from "swr";
import { getApiClient } from "./deps";
import type { RenderedComponent } from "./types";

async function fetchComponent(url: string): Promise<RenderedComponent | null> {
	const r = await getApiClient().get(url);
	const body = r.data as any;
	return body?.data?.component ?? body?.component ?? null;
}

export function useComponentRender(componentId: string | null): {
	data: RenderedComponent | null | undefined;
	isLoading: boolean;
	error: unknown;
} {
	return useSWR<RenderedComponent | null>(
		componentId ? `/api/v1/components/${componentId}?include=render` : null,
		fetchComponent,
	);
}
