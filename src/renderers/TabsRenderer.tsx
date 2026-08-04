"use client";

import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import {
	type ReactElement,
	type SyntheticEvent,
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

const STAGE_COLORS: Record<
	string,
	"default" | "warning" | "success" | "error"
> = {
	draft: "warning",
	published: "success",
	deprecated: "error",
};

export function TabsRenderer({
	component,
	pathParams,
}: {
	component: RenderedComponent;
	pathParams?: Record<string, string>;
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
		(_event: SyntheticEvent, newIndex: number) => {
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
		return (
			<Typography variant="body2" color="text.secondary">
				No tabs configured.
			</Typography>
		);
	}

	return (
		<Stack spacing={2}>
			<Tabs
				value={activeIndex}
				onChange={handleTabChange}
				variant="scrollable"
				scrollButtons="auto"
				sx={{ borderBottom: 1, borderColor: "divider" }}
			>
				{allTabs.map((tab: any, idx: number) => (
					<Tab
						key={idx}
						label={
							<Stack direction="row" spacing={1} className="items-center">
								<span>{tab.label}</span>
								{tab.stage && (
									<Chip
										label={tab.stage}
										size="small"
										color={STAGE_COLORS[tab.stage] ?? "default"}
										variant="outlined"
										sx={{ height: 20, fontSize: "0.65rem" }}
									/>
								)}
							</Stack>
						}
					/>
				))}
			</Tabs>

			{/* Active tab content */}
			<Box>
				{activeContentEl?.referencedComponent ? (
					<ComponentRenderer
						component={activeContentEl.referencedComponent}
						pathParams={pathParams}
						paramBindings={activeContentEl.paramBindings}
					/>
				) : (
					<Typography variant="body2" color="text.secondary">
						Coming soon
					</Typography>
				)}
			</Box>
		</Stack>
	);
}
