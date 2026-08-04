"use client";

import { ResponsiveLine } from "@nivo/line";
import type { ReactElement } from "react";
import type { RenderedComponent } from "../types";
import { ChartWrapper } from "./ChartWrapper";

// ──────────────────────────────────────────────────────────────────
// Default Nivo line options
// ──────────────────────────────────────────────────────────────────

const DEFAULT_OPTIONS: Record<string, unknown> = {
	margin: { top: 20, right: 120, bottom: 50, left: 60 },
	xScale: { type: "point" },
	yScale: { type: "linear", min: 0, max: "auto" },
	axisTop: null,
	axisRight: null,
	axisBottom: { tickSize: 5, tickPadding: 5, tickRotation: -45 },
	axisLeft: { tickSize: 5, tickPadding: 5 },
	pointSize: 6,
	pointColor: { theme: "background" },
	pointBorderWidth: 2,
	pointBorderColor: { from: "serieColor" },
	useMesh: true,
	curve: "monotoneX",
	colors: { scheme: "category10" },
	legends: [
		{
			anchor: "bottom-right",
			direction: "column",
			justify: false,
			translateX: 100,
			translateY: 0,
			itemsSpacing: 0,
			itemWidth: 80,
			itemHeight: 20,
			symbolSize: 12,
			symbolShape: "circle",
		},
	],
};

// ──────────────────────────────────────────────────────────────────
// Data mapping
// ──────────────────────────────────────────────────────────────────

interface LineMapping {
	/** Dot-path to the array of data buckets in the response */
	bucketsPath?: string;
	/** Field for the x-axis value */
	xKey: string;
	/** Field for the y-axis value */
	yKey: string;
	/** If true, treat x values as dates for formatting */
	xFormat?: "date" | "number" | "string";
	/** For multi-series: dot-path to sub-buckets in each bucket */
	seriesPath?: string;
	/** Key in series items for the series id */
	seriesIdKey?: string;
	/** Key in series items for the series value */
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

interface LineSeries {
	id: string;
	data: { x: string | number; y: number }[];
}

function mapLineData(
	response: unknown,
	mapping: Record<string, unknown>,
): LineSeries[] {
	const m = mapping as unknown as LineMapping;
	const bucketsPath = m.bucketsPath ?? "data";
	const rawBuckets = resolvePath(response, bucketsPath);

	const buckets: Record<string, unknown>[] = Array.isArray(rawBuckets)
		? (rawBuckets as Record<string, unknown>[])
		: [];

	if (buckets.length === 0) return [];

	// Multi-series: each bucket has sub-buckets (date_histogram + terms)
	if (m.seriesPath) {
		const seriesIdKey = m.seriesIdKey ?? "key";
		const seriesValueKey = m.seriesValueKey ?? "doc_count";
		const seriesMap = new Map<string, { x: string | number; y: number }[]>();

		for (const bucket of buckets) {
			const xVal = bucket[m.xKey] as string | number;
			const subBuckets = resolvePath(bucket, m.seriesPath) as
				| Record<string, unknown>[]
				| undefined;
			if (!Array.isArray(subBuckets)) continue;

			for (const sub of subBuckets) {
				const sid = String(sub[seriesIdKey] ?? "unknown");
				const yVal = Number(sub[seriesValueKey]) ?? 0;
				if (!seriesMap.has(sid)) seriesMap.set(sid, []);
				seriesMap.get(sid)!.push({ x: xVal, y: yVal });
			}
		}

		return [...seriesMap.entries()].map(([id, data]) => ({ id, data }));
	}

	// Single series
	return [
		{
			id: "data",
			data: buckets.map((bucket) => ({
				x: bucket[m.xKey] as string | number,
				y: Number(bucket[m.yKey]) ?? 0,
			})),
		},
	];
}

// ──────────────────────────────────────────────────────────────────
// LineRenderer
// ──────────────────────────────────────────────────────────────────

export function LineRenderer({
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
			mapData={mapLineData}
			defaultChartOptions={DEFAULT_OPTIONS}
		>
			{(chartData, mergedOptions) => (
				<div style={{ height: 350 }}>
					<ResponsiveLine data={chartData as any} {...mergedOptions} />
				</div>
			)}
		</ChartWrapper>
	);
}
