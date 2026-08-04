// ──────────────────────────────────────────────────────────────────
// Dependency seam — the host app provides the two app-owned pieces
// the pipeline needs:
//   - `client`:        the axios instance (auth/refresh wiring lives
//                      in the app, not here)
//   - `useGetUser`:    a hook returning the current user (Redux-SWR
//                      query in the app)
//   - `getUserSnapshot`: sync user snapshot for non-hook code paths
//                      (screen resolution)
//
// Call `configureRenderPipeline(...)` once at app startup, before any
// renderer mounts.
// ──────────────────────────────────────────────────────────────────

"use client";

import type { AxiosInstance } from "axios";

export interface RenderUser {
	id?: string;
	tenant?: { id?: string } | null;
	role?: string;
	roleName?: string;
	permissions?: {
		data?: Array<{ resource: string; scope?: string }>;
	} | null;
}

export interface RenderPipelineDeps {
	client: AxiosInstance;
	useGetUser: () => { data?: RenderUser | null };
	getUserSnapshot: () => RenderUser | null;
}

let configured: RenderPipelineDeps | null = null;

export function configureRenderPipeline(deps: RenderPipelineDeps): void {
	configured = deps;
}

function requireDeps(): RenderPipelineDeps {
	if (!configured) {
		throw new Error(
			"@wrk-t/render-pipeline: configureRenderPipeline() must be called before rendering (e.g. in the app's client wrapper)",
		);
	}
	return configured;
}

export function getApiClient(): AxiosInstance {
	return requireDeps().client;
}

/** Hook — returns the current user from the app's user query. */
export function useRenderUser(): { data?: RenderUser | null } {
	return requireDeps().useGetUser();
}

/** Non-hook snapshot for async code paths (e.g. screen resolution). */
export function getUserSnapshot(): RenderUser | null {
	return requireDeps().getUserSnapshot();
}
