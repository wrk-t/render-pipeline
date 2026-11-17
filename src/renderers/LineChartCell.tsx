"use client";

import { ResponsiveLine } from "@nivo/line";
import {
	type MouseEvent as ReactMouseEvent,
	type ReactElement,
	useEffect,
	useRef,
	useState,
} from "react";
import { Unicon } from "../components/common/icon/Unicon";
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

// The dialog is the fixed, full-viewport overlay (its `::backdrop` is the
// scrim); the panel inside it is the card. `bg-transparent` / `border-0` /
// `p-0` strip the UA dialog chrome so only the panel paints. Below `sm` the
// panel owns the viewport, like every DSL dialog.
const DIALOG_CLASS =
	"fixed inset-0 z-50 m-0 h-full max-h-none w-full max-w-none border-0 bg-transparent p-0 text-foreground [&::backdrop]:bg-black/50 open:flex items-center justify-center p-4 max-sm:p-0";
const PANEL_CLASS =
	"flex max-h-[calc(100dvh-2rem)] w-full max-w-[1200px] flex-col overflow-hidden rounded-lg border border-border bg-card text-foreground shadow-lg max-sm:h-[100dvh] max-sm:max-h-none max-sm:max-w-none max-sm:rounded-none max-sm:border-0";

/** `showModal()` gives the top layer + focus trap; jsdom/older engines fall back. */
const openModal = (dialog: HTMLDialogElement) => {
	if (dialog.open) return;
	if (typeof dialog.showModal !== "function") {
		dialog.setAttribute("open", "");
		return;
	}
	try {
		dialog.showModal();
	} catch {
		dialog.setAttribute("open", "");
	}
};

const closeModal = (dialog: HTMLDialogElement) => {
	if (!dialog.open) return;
	if (typeof dialog.close === "function") dialog.close();
	else dialog.removeAttribute("open");
};

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

	const { range } = useDateRange();

	const rowData = cell?.row?.original ?? {};
	// Query params are version-scoped: prefer the row's current version
	// (e.g. packages list rows carry `versions[0]`), fall back to the row id
	// for rows that ARE versions (e.g. the package versions table).
	const versionId =
		rowData.versions?.[0]?.id ?? rowData.id ?? rowData.packageId ?? "";
	const columnDef = cell?.column?.columnDef ?? {};
	const fmt = (columnDef as any).columnFormat ?? {};
	const cellHeight = fmt.height ?? 48;
	const cellWidth = fmt.width ?? 160;
	const queryId = fmt.queryId as string | undefined;

	const dialogRef = useRef<HTMLDialogElement>(null);

	// `open` is React state; the element itself stays mounted so `close()`
	// can run and restore focus.
	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) return;
		if (dialogOpen) openModal(dialog);
		else closeModal(dialog);
	}, [dialogOpen]);

	// Escape and a backdrop click are close requests. The dialog fills the
	// viewport, so a click whose target *is* the dialog came from the
	// `::backdrop` area (clicks inside the panel target a child).
	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) return;
		const onCancel = (event: Event) => {
			event.preventDefault();
			setDialogOpen(false);
		};
		const onClick = (event: MouseEvent) => {
			if (event.target === dialog) setDialogOpen(false);
		};
		dialog.addEventListener("cancel", onCancel);
		dialog.addEventListener("click", onClick);
		return () => {
			dialog.removeEventListener("cancel", onCancel);
			dialog.removeEventListener("click", onClick);
		};
	}, []);

	if (!(queryId && versionId)) {
		return <div style={{ minHeight: cellHeight }}>—</div>;
	}

	const params: Record<string, string> = {
		from: String(range.from),
		to: String(range.to),
		versionId,
	};

	const handleClick = (e: ReactMouseEvent) => {
		e.stopPropagation();
		e.preventDefault();
		setDialogOpen(true);
	};

	const renderChart = (data: unknown, full: boolean) => {
		const series = data as LineSeries[];
		return (
			<div
				style={{
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
			</div>
		);
	};

	return (
		<>
			<div
				onMouseDown={handleClick}
				className="flex w-full cursor-pointer items-center transition-opacity hover:opacity-80"
				style={{ minHeight: cellHeight }}
			>
				<CellChartWrapper
					queryId={queryId}
					params={params}
					parseData={parseTimeSeries}
				>
					{(data) => renderChart(data, false)}
				</CellChartWrapper>
			</div>

			<dialog
				ref={dialogRef}
				className={DIALOG_CLASS}
				aria-label={
					typeof columnDef.header === "string" ? columnDef.header : undefined
				}
			>
				{/* Unmount the content while closed; a closed cell chart
				    must not keep a second query alive. */}
				{dialogOpen ? (
					<div className={PANEL_CLASS}>
						<div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
							<h2 className="text-lg font-semibold text-foreground">
								{columnDef.header}
							</h2>
							<button
								type="button"
								onClick={() => setDialogOpen(false)}
								aria-label="Close"
								title="Close"
								className="-me-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
							>
								<Unicon name="Close" size={18} />
							</button>
						</div>
						<div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
							<CellChartWrapper
								queryId={queryId}
								params={params}
								parseData={parseTimeSeries}
							>
								{(data) => renderChart(data, true)}
							</CellChartWrapper>
						</div>
					</div>
				) : null}
			</dialog>
		</>
	);
}
