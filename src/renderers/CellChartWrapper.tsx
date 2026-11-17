"use client";

import { type ReactElement, type ReactNode, useEffect, useState } from "react";
import { getApiClient } from "../deps";

// ──────────────────────────────────────────────────────────────────
// CellChartWrapper
//
// Lightweight lifecycle wrapper for charts embedded in table cells.
// Handles fetch, loading, empty, and error states — the cell
// renderer only provides the query and chart rendering.
//
// Usage:
//   <CellChartWrapper queryId="..." params={{ from, to }}>
//     {(data) => <ResponsiveLine data={data} />}
//   </CellChartWrapper>
// ──────────────────────────────────────────────────────────────────

export interface CellChartWrapperProps {
	/** Query ID to execute via GET /api/v1/queries/:id/execute */
	queryId: string;
	/** URL params appended to the execute endpoint */
	params: Record<string, string>;
	/** Transform the raw ES response into chart data */
	parseData: (raw: unknown) => unknown;
	/** Render prop: receives parsed data */
	children: (data: unknown, loading: boolean) => ReactNode;
}

export function CellChartWrapper({
	queryId,
	params,
	parseData,
	children,
}: CellChartWrapperProps): ReactElement {
	const [chartData, setChartData] = useState<unknown>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		setError(false);

		const qp = new URLSearchParams(params);
		getApiClient()
			.get(`/api/v1/queries/${queryId}/execute?${qp.toString()}`)
			.then((res) => {
				if (cancelled) return;
				const raw = res.data?.data ?? res.data ?? null;
				setChartData(parseData(raw));
			})
			.catch(() => {
				if (cancelled) return;
				setError(true);
				setChartData(null);
			})
			.finally(() => {
				if (cancelled) setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [queryId, JSON.stringify(params)]);

	// ── Loading ──
	if (loading) {
		return (
			<div className="flex min-h-12 items-center justify-center">
				<span
					role="status"
					aria-label="Loading"
					className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted border-t-primary"
				/>
			</div>
		);
	}

	// ── Error / Empty ──
	if (
		error ||
		chartData == null ||
		(Array.isArray(chartData) && chartData.length === 0)
	) {
		return (
			<p className="w-full text-center text-xs text-muted-foreground">
				no data
			</p>
		);
	}

	// ── Chart ──
	return <>{children(chartData, loading)}</>;
}
