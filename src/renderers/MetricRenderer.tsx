"use client";

import type { ReactElement } from "react";
import type { RenderedComponent } from "../types";
import { ChartWrapper } from "./ChartWrapper";

// ──────────────────────────────────────────────────────────────────
// Data mapping
// ──────────────────────────────────────────────────────────────────

interface MetricMapping {
	/** Dot-path to the value in the API response */
	valuePath: string;
	/** Optional multiplier (e.g. 100 to convert decimal to percentage) */
	multiplier?: number;
	/** Unit label (e.g. "ms", "%", "req/s") */
	unit?: string;
	/** Number of decimal places */
	precision?: number;
}

function resolvePath(obj: unknown, path: string): unknown {
	if (!obj || typeof obj !== "object") return undefined;
	return path.split(".").reduce((acc: unknown, key: string) => {
		if (acc && typeof acc === "object")
			return (acc as Record<string, unknown>)[key];
		return undefined;
	}, obj);
}

interface MetricData {
	value: number;
	formatted: string;
}

function mapMetricData(
	response: unknown,
	mapping: Record<string, unknown>,
): MetricData | null {
	const m = mapping as unknown as MetricMapping;
	const raw = resolvePath(response, m.valuePath);
	if (raw == null) return null;

	const rawNum = Number(raw);
	if (isNaN(rawNum)) return null;

	const multiplier = m.multiplier ?? 1;
	const value = rawNum * multiplier;
	const precision = m.precision ?? (multiplier === 1 ? 0 : 1);
	const formatted = `${value.toFixed(precision)}${m.unit ? ` ${m.unit}` : ""}`;

	return { value, formatted };
}

// ──────────────────────────────────────────────────────────────────
// MetricRenderer
// ──────────────────────────────────────────────────────────────────

export function MetricRenderer({
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
			mapData={mapMetricData}
		>
			{(chartData) => {
				const metric = chartData as MetricData | null;
				if (!metric || metric.value == null) {
					return (
						<div className="flex min-h-32 items-center justify-center">
							<p className="text-sm text-muted-foreground">No data</p>
						</div>
					);
				}

				return (
					<div className="flex min-h-32 flex-col items-center justify-center">
						<h3 className="text-4xl font-bold tracking-tight tabular-nums text-foreground">
							{metric.formatted}
						</h3>
					</div>
				);
			}}
		</ChartWrapper>
	);
}
