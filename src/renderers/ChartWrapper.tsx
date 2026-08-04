"use client";

import { useMemo, type ReactElement, type ReactNode } from "react";
import useSWR from "swr";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import { getApiClient } from "../deps";
import { useDateRange } from "./DateRangeContext";
import { EmptyChart } from "../components/common/emptyChart/EmptyChart";
import type { RenderedComponent } from "../types";
import { Stack } from "@mui/material";

// ──────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────

export interface ChartWrapperProps {
	/** The rendered component from the backend (config, displayName, etc.) */
	component: RenderedComponent;
	/** Route params for endpoint interpolation */
	pathParams?: Record<string, string>;
	/**
	 * Transform the raw API response into chart-ready data.
	 * Receives the full response and the dataMapping from component.config.
	 */
	mapData: (response: unknown, mapping: Record<string, unknown>) => unknown;
	/** Default Nivo options merged under any chartOptions from config */
	defaultChartOptions?: Record<string, unknown>;
	/** Render prop: receives (chartData, mergedOptions) → chart element */
	children: (
		chartData: unknown,
		mergedOptions: Record<string, unknown>,
	) => ReactNode;
}

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function getNestedValue(obj: unknown, path: string): unknown {
	if (!obj || typeof obj !== "object") return undefined;
	return (path as string).split(".").reduce((acc: unknown, key: string) => {
		if (acc && typeof acc === "object")
			return (acc as Record<string, unknown>)[key];
		return undefined;
	}, obj);
}

/**
 * Does the response look like it has no meaningful data?
 * Checks common ES patterns (hits.total.value === 0) and array emptiness.
 */
function isResponseEmpty(response: unknown, chartData: unknown): boolean {
	console.log({ response, chartData });

	// Check ES-style total
	const total = getNestedValue(response, "hits.total.value");
	console.log({ total });
	if (typeof total === "number" && total === 0) return true;

	// Check null/undefined (metric/gauge renderers return null when no value found)
	if (chartData == null) return true;

	// Check array emptiness
	if (Array.isArray(chartData) && chartData.length === 0) return true;

	return false;
}

// ──────────────────────────────────────────────────────────────────
// ChartWrapper
// ──────────────────────────────────────────────────────────────────

export function ChartWrapper({
	component,
	pathParams,
	mapData,
	defaultChartOptions = {},
	children,
}: ChartWrapperProps): ReactElement {
	const config = (component.config ?? {}) as Record<string, unknown>;
	const queryId = config.queryId as string | undefined;
	const datasource = config.datasource as
		| { endpoint?: string; method?: string }
		| undefined;
	const dataMapping = (config.dataMapping ?? {}) as Record<string, unknown>;
	const chartOptions = (config.chartOptions ?? {}) as Record<string, unknown>;
	const { range } = useDateRange();

	// ── Fetch data ────────────────────────────────────────────────
	const { data, isLoading, error } = useSWR(
		queryId
			? [queryId, range.from, range.to]
			: datasource?.endpoint
				? [datasource.endpoint, datasource?.method ?? "GET", range]
				: null,
		async ([idOrUrl, _methodOrFrom, _rangeOrTo]: [
			string,
			string | undefined,
			unknown,
		]) => {
			if (queryId) {
				const qp = new URLSearchParams();
				qp.set("from", String(range.from));
				qp.set("to", String(range.to));
				const res = await getApiClient().get(
					`/api/v1/queries/${queryId}/execute?${qp.toString()}`,
				);
				return res.data?.data ?? res.data ?? null;
			}

			// Legacy: datasource.endpoint with path param interpolation
			const url = idOrUrl.replace(/\{(\w+)\}/g, (_: string, key: string) =>
				pathParams && key in pathParams ? String(pathParams[key]) : `{${key}}`,
			);
			const method = ((_methodOrFrom ?? "GET") as string).toLowerCase() as
				| "get"
				| "post";
			const qp = new URLSearchParams();
			qp.set("from", String(range.from));
			qp.set("to", String(range.to));
			const fullUrl = `${url}?${qp.toString()}`;
			const res = await getApiClient().request({
				url: fullUrl,
				method,
			});
			return res.data?.data ?? res.data ?? null;
		},
	);

	// ── Map data ────────────────────────────────────────────────────
	const chartData = useMemo(() => {
		console.log({ data, dataMapping });
		return mapData(data, dataMapping);
	}, [data, dataMapping, mapData]);

	// ── Merged options ──────────────────────────────────────────────
	const mergedOptions = useMemo(
		() => ({ ...defaultChartOptions, ...chartOptions }),
		[defaultChartOptions, chartOptions],
	);

	// ── State-dependent body ────────────────────────────────────────
	let body: ReactNode;
	if (isLoading) {
		body = (
			<Box className="flex items-center justify-center py-12 min-h-50">
				<CircularProgress />
			</Box>
		);
	} else if (error) {
		body = (
			<Alert severity="error" className="my-2 min-h-50">
				{error?.message ?? "Failed to load chart data"}
			</Alert>
		);
	} else if (isResponseEmpty(data, chartData)) {
		body = (
			<Stack className="min-h-50 h-full flex-1">
				<EmptyChart />
			</Stack>
		);
	} else {
		body = children(chartData, mergedOptions);
	}

	// ── Render ───────────────────────────────────────────────────────
	return (
		<Stack className="flex-1 h-full">
			{/* Title — always visible */}
			{component.displayName && (
				<Typography variant="subtitle1" className="mb-2 font-semibold">
					{component.displayName}
				</Typography>
			)}
			{component.description && (
				<Typography variant="body2" color="text.secondary" className="mb-4">
					{component.description}
				</Typography>
			)}

			<Stack className="flex-1 place-content-center">{body}</Stack>
		</Stack>
	);
}
