// ═══════════════════════════════════════════════════════════════
// Screen Preloader — prefetch screen resolution data
// so navigation to a screen is instant after hover.
//
// Uses a simple Map-based cache that's shared via module-level
// singleton. No SWR dependency — avoids provider scoping issues.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useCallback, useEffect, useState } from "react";
import { resolveScreen } from "./resolveScreen";
import type { ResolvedScreen } from "./types";

// ── Module-level cache (shared across all instances) ───────────

const screenCache = new Map<string, ResolvedScreen>();

export function screenKey(module: string, segments: string[]): string {
	return `screen-resolve:${module}/${segments.join("/")}`;
}

// ── Preloader: call on hover to seed the cache ────────────────

export function useScreenPreloader() {
	const prefetch = useCallback((module: string, segments: string[]) => {
		const key = screenKey(module, segments);
		if (screenCache.has(key)) return;

		// Fire-and-forget: populate the module-level cache
		resolveScreen(module, segments).then((data) => {
			screenCache.set(key, data);
		});
	}, []);

	return { prefetch };
}

// ── Hook: use on the screen page to read data (instant if cached) ──

export function useScreen(module: string, segments: string[]) {
	const [resolved, setResolved] = useState<ResolvedScreen | null>(() => {
		// Synchronously check the cache on first render
		if (module && segments) {
			const cached = screenCache.get(screenKey(module, segments));
			if (cached) return cached;
		}
		return null;
	});
	const [loading, setLoading] = useState(!resolved);

	useEffect(() => {
		if (!module) return;

		const key = screenKey(module, segments);

		// Check cache again (might have been populated since render)
		const cached = screenCache.get(key);
		if (cached) {
			setResolved(cached);
			setLoading(false);
			return;
		}

		// Fetch
		setLoading(true);
		resolveScreen(module, segments)
			.then((data) => {
				screenCache.set(key, data);
				setResolved(data);
			})
			.finally(() => setLoading(false));
	}, [module, segments.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

	return { resolved, loading };
}
