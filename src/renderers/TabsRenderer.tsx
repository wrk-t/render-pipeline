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

/** Stage pill colours — border/text pairs matching the old chip tones. */
const STAGE_CLASSES: Record<string, string> = {
	draft: "border-warning-main text-warning-main",
	published: "border-success-main text-success-main",
	deprecated: "border-error-main text-error-main",
};

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
	const staticTabs: Array<{ label: string; icon?: string }> =
		(component.config as any)?.tabs ?? [];
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

	const [activeIndex, setActiveIndex] = useState(0);

	const handleTabChange = useCallback(
		(newIndex: number) => {
			setActiveIndex(newIndex);
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
		[dynamicTabs, setSelected],
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
				case "ArrowRight":
					next = rtl
						? (activeIndex - 1 + count) % count
						: (activeIndex + 1) % count;
					break;
				case "ArrowLeft":
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
			event.preventDefault();
			handleTabChange(next);
			const tabs =
				event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]');
			tabs[next]?.focus();
		},
		[allTabs.length, activeIndex, handleTabChange],
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
		<div className="flex flex-col gap-4">
			<div
				role="tablist"
				// UX-9 — a tablist with no accessible name is announced as just
				// "tab list": name it after the component the tabs belong to
				// (customer detail, …), which the backend already translated.
				aria-label={component.displayName || component.name}
				onKeyDown={handleTabKeyDown}
				className="flex gap-1 overflow-x-auto border-b border-border"
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
							tabIndex={selected ? 0 : -1}
							onClick={() => handleTabChange(idx)}
							className={`-mb-px inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-start text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
								selected
									? "border-primary text-primary"
									: "border-transparent text-muted-foreground hover:text-foreground"
							}`}
						>
							<span>{tab.label}</span>
							{tab.stage && (
								<span
									className={`rounded-full border px-2 py-0.5 text-xs ${
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
				className="focus-visible:outline-none"
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
