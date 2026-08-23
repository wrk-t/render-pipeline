"use client";

import { Box, Dialog, DialogContent, DialogTitle } from "@mui/material";
import { ResponsiveLine } from "@nivo/line";
import { type ReactElement, useState } from "react";
import { CellChartWrapper } from "./CellChartWrapper";
import { useDateRange } from "./DateRangeContext";

const LINE_COLORS = [
	"#2563eb",
	"#dc2626",
	"#16a34a",
	"#d97706",
	"#8b5cf6",
	"#ec4899",
	"#14b8a6",
	"#f97316",
];

interface LineSeries {
	id: string;
	data: { x: string; y: number }[];
}

// ── Data Parsing ──────────────────────────────────────────────

function parseTimeSeries(raw: unknown): LineSeries[] {
	const buckets = extractAggBuckets(raw);
	if (buckets.length === 0) return [];

	return buckets.map((bucket: Record<string, unknown>) => {
		const status = String(bucket.key ?? "");
		const histData = (bucket.dateHistogram as any)?.buckets ?? [];
		return {
			id: status,
			data: histData.map((h: Record<string, unknown>) => ({
				x: String(h.key_as_string ?? h.key ?? ""),
				y: Number(h.doc_count) || 0,
			})),
		};
	});
}

function extractAggBuckets(data: unknown): Record<string, unknown>[] {
	if (!data || typeof data !== "object") return [];
	const obj = data as Record<string, unknown>;
	if (obj.aggregations) {
		const aggs = obj.aggregations as Record<string, unknown>;
		const firstAgg = aggs[Object.keys(aggs)[0]] as
			| Record<string, unknown>
			| undefined;
		return (firstAgg?.buckets as Record<string, unknown>[]) ?? [];
	}
	return [];
}

// ── LineChartCell ─────────────────────────────────────────────

export function LineChartCell({ cell }: any): ReactElement {
	const [dialogOpen, setDialogOpen] = useState(false);
	const [fullData, setFullData] = useState<LineSeries[]>([]);

	const { range } = useDateRange();

	const rowData = cell?.row?.original ?? {};
	// Query params are version-scoped: prefer the row's current version
	// (e.g. packages list rows carry `versions[0]`), fall back to the row id
	// for rows that ARE versions (e.g. the package versions table).
	const versionId = rowData.versions?.[0]?.id ?? rowData.id ?? rowData.packageId ?? "";
	const columnDef = cell?.column?.columnDef ?? {};
	const fmt = (columnDef as any).columnFormat ?? {};
	const cellHeight = fmt.height ?? 48;
	const cellWidth = fmt.width ?? 160;
	const queryId = fmt.queryId as string | undefined;

	if (!(queryId && versionId)) {
		return <Box sx={{ minHeight: cellHeight }}>—</Box>;
	}

	const params: Record<string, string> = {
		from: String(range.from),
		to: String(range.to),
		versionId,
	};

	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		e.preventDefault();
		setDialogOpen(true);
	};

	const renderChart = (data: unknown, full: boolean) => {
		const series = data as LineSeries[];
		return (
			<Box
				sx={{
					width: full ? "100%" : cellWidth,
					height: full ? 400 : cellHeight,
				}}
			>
				<ResponsiveLine
					data={series}
					xScale={{ type: "point" }}
					yScale={{ type: "linear", min: 0, max: "auto" }}
					axisTop={null}
					axisRight={null}
					colors={LINE_COLORS}
					curve="monotoneX"
					{...(full
						? {
								margin: { top: 20, right: 120, bottom: 50, left: 60 },
								axisBottom: {
									tickSize: 5,
									tickPadding: 5,
									tickRotation: -45,
									legend: "Date",
									legendOffset: 40,
									legendPosition: "middle",
								},
								axisLeft: {
									tickSize: 5,
									tickPadding: 5,
									legend: "Count",
									legendOffset: -50,
									legendPosition: "middle",
								},
								pointSize: 6,
								pointColor: { theme: "background" },
								pointBorderWidth: 2,
								pointBorderColor: { from: "serieColor" },
								useMesh: true,
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
							}
						: {
								margin: { top: 2, right: 2, bottom: 2, left: 2 },
								axisBottom: null,
								axisLeft: null,
								enableGridX: false,
								enableGridY: false,
								enablePoints: false,
								useMesh: false,
								animate: false,
							})}
				/>
			</Box>
		);
	};

	return (
		<>
			<Box
				onMouseDown={handleClick}
				sx={{
					cursor: "pointer",
					display: "flex",
					alignItems: "center",
					width: "100%",
					minHeight: cellHeight,
					"&:hover": { opacity: 0.8 },
				}}
			>
				<CellChartWrapper
					queryId={queryId}
					params={params}
					parseData={parseTimeSeries}
				>
					{(data) => renderChart(data, false)}
				</CellChartWrapper>
			</Box>

			<Dialog
				open={dialogOpen}
				onClose={() => setDialogOpen(false)}
				maxWidth="lg"
				fullWidth
			>
				<DialogTitle>{columnDef.header}</DialogTitle>
				<DialogContent>
					<CellChartWrapper
						queryId={queryId}
						params={params}
						parseData={parseTimeSeries}
					>
						{(data) => renderChart(data, true)}
					</CellChartWrapper>
				</DialogContent>
			</Dialog>
		</>
	);
}
