"use client";

import { useState, useEffect, type ReactElement, type ReactNode } from "react";
import { Box, CircularProgress, Typography } from "@mui/material";
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
			<Box
				sx={{
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					minHeight: 48,
				}}
			>
				<CircularProgress size={14} />
			</Box>
		);
	}

	// ── Error / Empty ──
	if (
		error ||
		chartData == null ||
		(Array.isArray(chartData) && chartData.length === 0)
	) {
		return (
			<Typography
				variant="caption"
				color="textSecondary"
				className="text-center w-full"
			>
				no data
			</Typography>
		);
	}

	// ── Chart ──
	return <>{children(chartData, loading)}</>;
}
