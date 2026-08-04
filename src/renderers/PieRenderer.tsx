"use client";

import { ResponsivePie } from "@nivo/pie";
import type { ReactElement } from "react";
import type { RenderedComponent } from "../types";
import { ChartWrapper } from "./ChartWrapper";

// ──────────────────────────────────────────────────────────────────
// Default Nivo pie options
// ──────────────────────────────────────────────────────────────────

const DEFAULT_OPTIONS: Record<string, unknown> = {
	margin: { top: 20, right: 20, bottom: 20, left: 20 },
	innerRadius: 0.5,
	padAngle: 0.7,
	cornerRadius: 3,
	activeOuterRadiusOffset: 8,
	borderWidth: 1,
	borderColor: { theme: "background" },
	arcLinkLabelsSkipAngle: 10,
	arcLinkLabelsTextColor: "#333333",
	arcLinkLabelsThickness: 2,
	arcLinkLabelsColor: { from: "color" },
	arcLabelsSkipAngle: 10,
	arcLabelsTextColor: { from: "color", modifiers: [["darker", 2]] },
	legends: [
		{
			anchor: "bottom",
			direction: "row",
			justify: false,
			translateY: 56,
			itemsSpacing: 0,
			itemWidth: 100,
			itemHeight: 18,
			itemTextColor: "#999",
			itemDirection: "left-to-right",
			itemOpacity: 1,
			symbolSize: 18,
			symbolShape: "circle",
			effects: [{ on: "hover", style: { itemTextColor: "#000" } }],
		},
	],
};

// ──────────────────────────────────────────────────────────────────
// Data mapping
// ──────────────────────────────────────────────────────────────────

interface PieMapping {
	itemsPath?: string;
	labelKey: string;
	valueKey: string;
	idKey?: string;
	colorKey?: string;
}

function mapPieData(
	response: unknown,
	mapping: Record<string, unknown>,
): unknown {
	const m = mapping as unknown as PieMapping;
	const itemsPath = m.itemsPath ?? "data";
	const rawItems = resolvePath(response, itemsPath);
	let items: Record<string, unknown>[];

	if (Array.isArray(rawItems)) {
		items = rawItems as Record<string, unknown>[];
	} else if (rawItems && typeof rawItems === "object") {
		// ES filters aggregation returns { success: { doc_count: X }, failure: { doc_count: Y } }
		items = Object.entries(rawItems as Record<string, unknown>).map(
			([key, value]) => ({
				key,
				doc_count: (value as Record<string, unknown>).doc_count,
			}),
		);
	} else if (Array.isArray(response)) {
		items = response as Record<string, unknown>[];
	} else {
		items = [];
	}

	return items.map((item) => ({
		id: String(item[m.idKey ?? m.labelKey] ?? ""),
		label: String(item[m.labelKey] ?? ""),
		value: Number(item[m.valueKey]) ?? 0,
		...(m.colorKey && item[m.colorKey]
			? { color: String(item[m.colorKey]) }
			: {}),
	}));
}

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function resolvePath(obj: unknown, path: string): unknown {
	if (!obj || typeof obj !== "object") return undefined;
	return path.split(".").reduce((acc: unknown, key: string) => {
		if (acc && typeof acc === "object")
			return (acc as Record<string, unknown>)[key];
		return undefined;
	}, obj);
}

// ──────────────────────────────────────────────────────────────────
// PieRenderer
// ──────────────────────────────────────────────────────────────────

export function PieRenderer({
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
			mapData={mapPieData}
			defaultChartOptions={DEFAULT_OPTIONS}
		>
			{(chartData, mergedOptions) => (
				<div style={{ height: 300 }}>
					<ResponsivePie data={chartData as any} {...mergedOptions} />
				</div>
			)}
		</ChartWrapper>
	);
}
