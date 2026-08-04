"use client";

import { ResponsiveBar } from "@nivo/bar";
import type { ReactElement } from "react";
import type { RenderedComponent } from "../types";
import { ChartWrapper } from "./ChartWrapper";

// ──────────────────────────────────────────────────────────────────
// Default Nivo bar options
// ──────────────────────────────────────────────────────────────────

const DEFAULT_OPTIONS: Record<string, unknown> = {
	margin: { top: 20, right: 110, bottom: 50, left: 60 },
	padding: 0.3,
	valueScale: { type: "linear" },
	indexScale: { type: "band", round: true },
	axisBottom: { tickRotation: -45 },
	legends: [
		{
			dataFrom: "keys",
			anchor: "bottom-right",
			direction: "column",
			justify: false,
			translateX: 120,
			translateY: 0,
			itemsSpacing: 2,
			itemWidth: 100,
			itemHeight: 20,
			itemDirection: "left-to-right",
			symbolSize: 12,
		},
	],
};

// ──────────────────────────────────────────────────────────────────
// Data mapping
// ──────────────────────────────────────────────────────────────────

interface BarMapping {
	itemsPath?: string;
	indexKey: string;
	valueKeys: string[];
	valueLabels?: Record<string, string>;
	seriesPath?: string;
	seriesIdKey?: string;
	seriesValueKey?: string;
}

function resolvePath(obj: unknown, path: string): unknown {
	if (!obj || typeof obj !== "object") return undefined;
	return path.split(".").reduce((acc: unknown, key: string) => {
		if (acc && typeof acc === "object")
			return (acc as Record<string, unknown>)[key];
		return undefined;
	}, obj);
}

function mapBarData(
	response: unknown,
	mapping: Record<string, unknown>,
): unknown {
	const m = mapping as unknown as BarMapping;
	const itemsPath = m.itemsPath ?? "data";
	const rawItems = resolvePath(response, itemsPath);

	const items: Record<string, unknown>[] = Array.isArray(rawItems)
		? (rawItems as Record<string, unknown>[])
		: Array.isArray(response)
			? (response as Record<string, unknown>[])
			: [];

	if (items.length === 0) return [];

	// Multi-series: each item has sub-buckets (e.g. ES date_histogram with terms sub-aggs)
	if (m.seriesPath) {
		const labelKey = m.indexKey;
		const seriesIdKey = m.seriesIdKey ?? "key";
		const seriesValueKey = m.seriesValueKey ?? "doc_count";

		const seriesSet = new Set<string>();
		const rows: Record<string, unknown>[] = [];

		for (const item of items) {
			const label = item[labelKey];
			const subBuckets = resolvePath(item, m.seriesPath) as
				| Record<string, unknown>[]
				| undefined;
			if (!Array.isArray(subBuckets)) continue;

			const row: Record<string, unknown> = { label };
			for (const sub of subBuckets) {
				const sid = String(sub[seriesIdKey] ?? "");
				row[sid] = Number(sub[seriesValueKey]) ?? 0;
				seriesSet.add(sid);
			}
			rows.push(row);
		}

		// Fill missing series keys with 0 on all rows
		const allSeries = [...seriesSet];
		for (const row of rows) {
			for (const s of allSeries) {
				if (row[s] === undefined) row[s] = 0;
			}
		}

		return rows;
	}

	// Single series
	return items.map((item) => {
		const row: Record<string, unknown> = {
			[m.indexKey]: item[m.indexKey],
		};
		for (const key of m.valueKeys) {
			row[key] = Number(item[key]) ?? 0;
		}
		return row;
	});
}

// ──────────────────────────────────────────────────────────────────
// BarRenderer
// ──────────────────────────────────────────────────────────────────

export function BarRenderer({
	component,
	pathParams,
}: {
	component: RenderedComponent;
	pathParams?: Record<string, string>;
}): ReactElement {
	return (
		<ChartWrapper
			component={component}
			pathParams={pathParams}
			mapData={mapBarData}
			defaultChartOptions={DEFAULT_OPTIONS}
		>
			{(chartData, mergedOptions) => {
				const cfg = (component.config ?? {}) as Record<string, unknown>;
				const dataMapping = (cfg.dataMapping ?? {}) as BarMapping;
				const indexBy = dataMapping.indexKey ?? "label";
				const keys = dataMapping.seriesPath
					? chartData && Array.isArray(chartData) && chartData.length > 0
						? Object.keys((chartData as Record<string, unknown>[])[0]).filter(
								(k) => k !== "label" && k !== indexBy,
							)
						: []
					: (dataMapping.valueKeys ?? []);

				return (
					<div style={{ height: 350 }}>
						<ResponsiveBar
							data={chartData as any}
							keys={keys}
							indexBy={indexBy}
							{...mergedOptions}
						/>
					</div>
				);
			}}
		</ChartWrapper>
	);
}
