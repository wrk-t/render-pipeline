"use client";

import {
	type KeyboardEvent,
	type ReactElement,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import useSWR from "swr";
import { ComponentRenderer } from "../ComponentRenderer";
import { getApiClient } from "../deps";
import type { RenderedComponent } from "../types";
import { useVersion, type VersionInfo } from "./VersionContext";

/**
 * Stage pill treatments, mapped to shadcn badge variants: a neutral outline
 * for drafts, the solid primary fill for published versions and the
 * destructive fill for deprecated ones (the same mapping `BadgeCell` uses).
 */
const STAGE_CLASSES: Record<string, string> = {
	draft: "border-border text-muted-foreground",
	published: "border-transparent bg-primary text-primary-foreground",
	deprecated: "border-transparent bg-destructive text-white",
};

/**
 * A stable, locale-independent URL slug for a tab.
 *
 * An explicit `name` on the tab descriptor wins: the backend resolves
 * `$trl_` labels before they reach the client, so the visible label changes
 * with the locale and must never be the URL identity. The fallback keeps
 * every existing Tabs working unchanged (a slug of the resolved label).
 */
function tabSlug(tab: { label?: string; name?: string }, index: number): string {
	const explicit = tab.name?.trim();
	if (explicit) return explicit;
	const slug = String(tab.label ?? "")
		.replace(/^\$trl_/, "")
		.replace(/[^a-zA-Z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.toLowerCase();
	return slug || `tab-${index}`;
}

export function TabsRenderer({
	component,
	pathParams,
	context,
}: {
	component: RenderedComponent;
	pathParams?: Record<string, string>;
	/** Dialog/screen context — flows into the active tab's form so
	 * `visibleWhen`/`readOnlyWhen` context rules still apply there. */
	context?: string;
}): ReactElement {
	// A stable reference: the URL-sync effect keys off the tabs, and the tabs
	// config is the same object on every render of a given component.
	const staticTabs: Array<{ label: string; name?: string; icon?: string }> =
		useMemo(
			() =>
				((component.config as { tabs?: Array<{ label: string; name?: string; icon?: string }> })
					?.tabs ?? []),
			[component.config],
		);
	// A vertical rail is the settings-style variant: sections on the left,
	// the active panel on the right.
	const vertical =
		(component.meta as { orientation?: string } | null)?.orientation ===
			"vertical" ||
		(component.config as { orientation?: string })?.orientation === "vertical";
	const datasource = (component.config as any)?.datasource;

	const { setSelected, setVersions } = useVersion();

	// ── Fetch dynamic tabs from datasource (e.g. version list) ──
	const endpoint = useMemo(() => {
		if (!datasource?.endpoint) return null;
		return datasource.endpoint.replace(
			/\{(\w+)\}/g,
			(_: string, key: string) =>
				pathParams && key in pathParams ? String(pathParams[key]) : `{${key}}`,
		);
	}, [datasource?.endpoint, pathParams]);

	const { data: dynamicData } = useSWR(
		endpoint ? [endpoint] : null,
		async ([url]: [string]) => {
			const res = await getApiClient().get(url);
			return res.data?.data ?? res.data ?? null;
		},
	);

	// Build tab configs: static first, then dynamic
	const dynamicTabs: Array<{ label: string; key: string; stage?: string }> =
		useMemo(() => {
			if (!dynamicData) return [];
			const list = Array.isArray(dynamicData)
				? dynamicData
				: ((dynamicData as any)?.data ?? []);
			return list.map((v: any) => ({
				label: v.version ?? v.name ?? "",
				key: v.id,
				stage: v.stage,
			}));
		}, [dynamicData]);

	// Sync versions to context
	useEffect(() => {
		if (dynamicTabs.length > 0) {
			setVersions(
				dynamicTabs.map((t) => ({
					id: t.key,
					version: t.label,
					stage: (t.stage as VersionInfo["stage"]) ?? "published",
				})),
			);
			// Auto-select first version if none selected
			if (!dynamicTabs[0]?.key) return;
			// Use setTimeout to avoid setState during render
			const timer = setTimeout(() => {
				setSelected({
					id: dynamicTabs[0].key,
					version: dynamicTabs[0].label,
					stage: (dynamicTabs[0].stage as VersionInfo["stage"]) ?? "published",
				});
			}, 0);
			return () => clearTimeout(timer);
		}
	}, [dynamicTabs, setSelected, setVersions]);

	const allTabs = staticTabs.length > 0 ? staticTabs : dynamicTabs;

	// ── URL-addressable tabs (opt-in) ─────────────────────────────
	// A Tabs node can carry `meta: { urlParam: "tab" }`; the active tab is
	// then mirrored into `?tab=<slug>` so a deep link opens that tab and
	// Playwright can assert the URL. The slug is explicit per tab (`name`)
	// because the label is already translated when it reaches the client.
	// Opt-in on purpose: dialog tab sets share the page URL and must not
	// hijack it.
	const urlParam =
		typeof (component.meta as { urlParam?: unknown } | null)?.urlParam ===
		"string"
			? ((component.meta as { urlParam: string }).urlParam)
			: null;

	const slugs = useMemo(() => {
		const key = allTabs
			.map((tab: any, index: number) => tabSlug(tab, index))
			.join("|");
		return key ? key.split("|") : [];
	}, [allTabs]);

	const [activeIndex, setActiveIndex] = useState(0);

	const applyUrl = useCallback(
		(index: number) => {
			if (!urlParam || typeof window === "undefined") return;
			const url = new URL(window.location.href);
			url.searchParams.set(urlParam, slugs[index] ?? `tab-${index}`);
			// `replaceState` keeps tab clicks out of the back history; Next
			// picks the change up so a later `useSearchParams` read is current.
			window.history.replaceState(window.history.state, "", url.toString());
		},
		[slugs, urlParam],
	);

	// Deep link → initial tab, and browser back/forward → keep the tab in
	// sync. Runs after mount so SSR and the first client render agree (a
	// state initializer reading `window` would hydrate a different tab).
	useEffect(() => {
		if (!urlParam) return;
		const select = () => {
			const requested = new URLSearchParams(window.location.search).get(
				urlParam,
			);
			if (!requested) return;
			const index = slugs.indexOf(requested);
			if (index >= 0) setActiveIndex(index);
		};
		select();
		window.addEventListener("popstate", select);
		return () => window.removeEventListener("popstate", select);
	}, [slugs, urlParam]);

	const handleTabChange = useCallback(
		(newIndex: number) => {
			setActiveIndex(newIndex);
			applyUrl(newIndex);
			// Update version context when switching dynamic tabs
			if (dynamicTabs[newIndex]) {
				setSelected({
					id: dynamicTabs[newIndex].key,
					version: dynamicTabs[newIndex].label,
					stage:
						(dynamicTabs[newIndex].stage as VersionInfo["stage"]) ??
						"published",
				});
			}
		},
		[dynamicTabs, setSelected, applyUrl],
	);

	// ── Keyboard navigation (the roving-tabindex ARIA tablist pattern) ──
	// MUI's Tabs handled arrow keys/Home/End before; keep that behaviour and
	// swap the horizontal arrows in RTL.
	const handleTabKeyDown = useCallback(
		(event: KeyboardEvent<HTMLDivElement>) => {
			const count = allTabs.length;
			if (!count) return;
			const rtl =
				typeof window !== "undefined" &&
				window.getComputedStyle(event.currentTarget).direction === "rtl";
			let next: number | null = null;
			switch (event.key) {
				case "ArrowDown":
					if (vertical) next = (activeIndex + 1) % count;
					break;
				case "ArrowUp":
					if (vertical) next = (activeIndex - 1 + count) % count;
					break;
				case "ArrowRight":
					if (!vertical)
						next = rtl
							? (activeIndex - 1 + count) % count
							: (activeIndex + 1) % count;
					break;
				case "ArrowLeft":
					if (!vertical)
						next = rtl
							? (activeIndex + 1) % count
							: (activeIndex - 1 + count) % count;
					break;
				case "Home":
					next = 0;
					break;
				case "End":
					next = count - 1;
					break;
				default:
					return;
			}
			if (next === null) return;
			event.preventDefault();
			handleTabChange(next);
			const tabs =
				event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]');
			tabs[next]?.focus();
		},
		[allTabs.length, activeIndex, handleTabChange, vertical],
	);

	// Get content elements, sorted by displayOrder
	const contentElements = useMemo(
		() =>
			(component.slotsFilled["content"] ?? [])
				.filter((e) => e.isActive)
				.sort((a, b) => a.displayOrder - b.displayOrder),
		[component],
	);

	const activeContentEl = contentElements[activeIndex] ?? null;

	if (!allTabs.length) {
		return <p className="text-sm text-muted-foreground">No tabs configured.</p>;
	}

	// Stable ids tie each tab to its panel (`aria-controls`/`aria-labelledby`).
	const baseId = `tabs-${component.id}`;
	const activeTabId = `${baseId}-tab-${activeIndex}`;
	const activePanelId = `${baseId}-panel-${activeIndex}`;

	return (
		<div className={vertical ? "flex flex-col gap-6 md:flex-row" : "flex flex-col gap-4"}>
			<div
				role="tablist"
				aria-orientation={vertical ? "vertical" : undefined}
				// UX-9 — a tablist with no accessible name is announced as just
				// "tab list": name it after the component the tabs belong to
				// (customer detail, …), which the backend already translated.
				aria-label={component.displayName || component.name}
				onKeyDown={handleTabKeyDown}
				className={
					vertical
						? "flex w-full shrink-0 flex-col items-stretch gap-0.5 text-muted-foreground md:w-48"
						: "flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-lg bg-muted p-1 text-muted-foreground"
				}
			>
				{allTabs.map((tab: any, idx: number) => {
					const selected = activeIndex === idx;
					const tabId = `${baseId}-tab-${idx}`;
					return (
						<button
							key={idx}
							id={tabId}
							type="button"
							role="tab"
							aria-selected={selected}
							aria-controls={`${baseId}-panel-${idx}`}
							data-state={selected ? "active" : "inactive"}
							tabIndex={selected ? 0 : -1}
							onClick={() => handleTabChange(idx)}
							className={
								vertical
									? "inline-flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-start text-sm font-medium transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-muted data-[state=active]:text-foreground"
									: "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
							}
						>
							<span>{tab.label}</span>
							{tab.stage && (
								<span
									className={`rounded-md border px-2 py-0.5 text-xs font-medium ${
										STAGE_CLASSES[tab.stage] ??
										"border-border text-muted-foreground"
									}`}
								>
									{tab.stage}
								</span>
							)}
						</button>
					);
				})}
			</div>

			{/* Active tab content */}
			<div
				role="tabpanel"
				id={activePanelId}
				aria-labelledby={activeTabId}
				tabIndex={0}
				className="min-w-0 flex-1 outline-none"
			>
				{activeContentEl?.referencedComponent ? (
					<ComponentRenderer
						component={activeContentEl.referencedComponent}
						pathParams={pathParams}
						paramBindings={activeContentEl.paramBindings}
						context={context}
					/>
				) : (
					<p className="text-sm text-muted-foreground">Coming soon</p>
				)}
			</div>
		</div>
	);
}
