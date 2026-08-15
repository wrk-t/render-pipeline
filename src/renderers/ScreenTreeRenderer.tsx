// ═══════════════════════════════════════════════════════════════
// ScreenTreeRenderer – Visual diagram of a screen's component tree
// (blueprint "screen-tree").
//
// Fetches GET /api/v1/screens/{screenId}/tree which returns a nested
// tree of components with their elements, slots, grid positions
// (row/col/colSpan on a 12-col grid) and field definitions.
//
// Rendering model:
//   - every component is a card (header = displayName + blueprint badge)
//   - elements are grouped per slot, then per grid row — a flex row of
//     boxes whose widths mirror colSpan/12
//   - component_ref elements nest their child card inside the box
//   - field elements render as compact chips (label + field type)
//
// Pure HTML/MUI — no canvas. The tree shape mirrors the arch schema
// (components + elements), so the same data can later drive an editor.
// ═══════════════════════════════════════════════════════════════
"use client";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { type ReactElement, useMemo } from "react";
import useSWR from "swr";
import { getApiClient } from "../deps";
import { useResolvedParams } from "../hooks/useResolvedParams";
import { resolveUrlTemplate } from "../query-builder";
import type { RenderedComponent } from "../types";

// ── Tree types (mirror the backend /screens/:id/tree contract) ──

interface TreeGrid {
	row?: number;
	col?: number;
	rowSpan?: number;
	colSpan?: number;
}

interface TreeFieldDefinition {
	id: string;
	name: string | null;
	type: string | null;
	displayName: string | null;
}

interface TreeElement {
	id: string;
	slotName: string;
	elementType: "field" | "component_ref" | "renderer";
	displayOrder: number;
	grid?: TreeGrid | null;
	paramBindings?: Record<string, unknown> | null;
	overrides?: Record<string, unknown> | null;
	fieldDefinition?: TreeFieldDefinition | null;
	child?: TreeNode | null;
}

interface TreeNode {
	id: string;
	name: string;
	displayName: string | null;
	type: string | null;
	description: string | null;
	elements: TreeElement[];
}

interface ScreenTreePayload {
	screen?: { id: string; name: string; displayName: string } | null;
	roots?: TreeNode[];
}

// ── Blueprint → chip color hint ─────────────────────────────────

const BP_COLOR: Record<
	string,
	"primary" | "success" | "warning" | "error" | "info" | "secondary" | "default"
> = {
	screen_layout_general: "primary",
	page: "primary",
	table: "info",
	form: "success",
	section: "warning",
	tabs: "secondary",
	info: "secondary",
	list: "secondary",
	"raw-json": "secondary",
	"audit-history": "secondary",
};

function bpColor(type: string | null): string {
	return BP_COLOR[type ?? ""] ?? "default";
}

// ── Helpers ────────────────────────────────────────────────────

function gridWidth(el: TreeElement): number {
	return Math.min(((el.grid?.colSpan ?? 12) / 12) * 100, 100);
}

function groupByRow(
	elements: TreeElement[],
): Array<{ row: number; items: TreeElement[] }> {
	const rows = new Map<number, TreeElement[]>();
	for (const el of elements) {
		const row = el.grid?.row ?? 0;
		const list = rows.get(row) ?? [];
		list.push(el);
		rows.set(row, list);
	}
	return [...rows.entries()]
		.sort((a, b) => a[0] - b[0])
		.map(([row, items]) => ({
			row,
			items: [...items].sort(
				(a, b) => (a.grid?.col ?? 0) - (b.grid?.col ?? 0),
			),
		}));
}

function elementLabel(el: TreeElement): string {
	if (el.overrides?.displayName) return String(el.overrides.displayName);
	if (el.fieldDefinition?.displayName) return el.fieldDefinition.displayName;
	if (el.fieldDefinition?.name) return el.fieldDefinition.name;
	return el.elementType;
}

// ── Element renderers ──────────────────────────────────────────

function FieldChip({ el }: { el: TreeElement }): ReactElement {
	const fd = el.fieldDefinition;
	const bodyKey =
		(el.overrides?.name as string | undefined) ?? fd?.name ?? null;

	return (
		<Box
			sx={{
				border: 1,
				borderColor: "divider",
				borderRadius: 1,
				bgcolor: "action.hover",
				px: 1,
				py: 0.5,
			}}
		>
			<Stack direction="row" spacing={1} className="items-center" sx={{ minWidth: 0 }}>
				<Typography
					variant="caption"
					className="font-semibold"
					sx={{ fontWeight: 600 }}
					noWrap
				>
					{elementLabel(el)}
				</Typography>
				{fd?.type ? (
					<Chip
						label={fd.type}
						size="small"
						variant="outlined"
						sx={{ height: 16, fontSize: "0.6rem" }}
					/>
				) : null}
				{bodyKey && bodyKey !== elementLabel(el) ? (
					<Typography
						variant="caption"
						color="text.secondary"
						sx={{ fontFamily: "monospace", fontSize: "0.65rem" }}
						noWrap
					>
						{bodyKey}
					</Typography>
				) : null}
			</Stack>
		</Box>
	);
}

function NodeCard({ node, depth }: { node: TreeNode; depth: number }): ReactElement {
	const rows = groupByRow(node.elements);

	return (
		<Card
			variant="outlined"
			sx={{
				width: "100%",
				borderLeft: depth > 0 ? 3 : 1,
				borderLeftColor: depth > 0 ? "divider" : "primary.main",
			}}
		>
			{/* Header */}
			<Stack
				direction="row"
				spacing={1}
				className="items-center justify-between px-3 py-2"
				sx={{ borderBottom: 1, borderColor: "divider" }}
			>
				<Stack direction="row" spacing={1} className="min-w-0 items-center">
					<Typography variant="subtitle2" className="font-bold" noWrap>
						{node.displayName ?? node.name}
					</Typography>
					{node.type ? (
						<Chip
							label={node.type}
							size="small"
							variant="outlined"
							color={bpColor(node.type) as any}
							sx={{ height: 18, fontSize: "0.65rem" }}
						/>
					) : null}
					<Typography
						variant="caption"
						color="text.secondary"
						sx={{ fontFamily: "monospace" }}
						noWrap
					>
						{node.name}
					</Typography>
				</Stack>
				<Typography
					variant="caption"
					color="text.secondary"
					sx={{ whiteSpace: "nowrap" }}
				>
					{node.elements.length} element{node.elements.length === 1 ? "" : "s"}
				</Typography>
			</Stack>

			{/* Body: slot groups → grid rows */}
			{node.elements.length === 0 ? (
				<Typography
					variant="caption"
					color="text.disabled"
					className="px-3 py-2"
					component="div"
				>
					no elements
				</Typography>
			) : (
				<Stack spacing={1.5} className="px-3 py-2">
					{groupByRow(node.elements)
						.reduce<Array<{ slot: string; rows: typeof rows }>>((acc, r) => {
							const last = acc[acc.length - 1];
							if (last && last.slot === r.items[0]?.slotName) {
								last.rows.push(r);
							} else {
								acc.push({ slot: r.items[0]?.slotName ?? "", rows: [r] });
							}
							return acc;
						}, [])
						.map((group) => (
							<Box key={group.slot || "slot"}>
								{group.slot ? (
									<Typography
										variant="overline"
										color="text.secondary"
										sx={{ fontSize: "0.6rem", letterSpacing: 0.08 }}
									>
										slot: {group.slot}
									</Typography>
								) : null}
								<Stack spacing={0.75}>
									{group.rows.map((row) => (
										<Box
											key={row.row}
											sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}
										>
											{row.items.map((el) => (
												<Box
													key={el.id}
													sx={{
														flex: `0 0 calc(${gridWidth(el)}% - 8px)`,
														minWidth: 140,
													}}
												>
													{el.elementType === "component_ref" ? (
														el.child ? (
															<NodeCard node={el.child} depth={depth + 1} />
														) : (
															<Box
																sx={{
																	border: "1px dashed",
																	borderColor: "divider",
																	borderRadius: 1,
																	px: 1,
																	py: 0.5,
																}}
															>
																<Typography
																	variant="caption"
																	color="text.disabled"
																>
																	missing component
																</Typography>
															</Box>
														)
													) : (
														<FieldChip el={el} />
													)}
												</Box>
											))}
										</Box>
									))}
								</Stack>
							</Box>
						))}
				</Stack>
			)}
		</Card>
	);
}

// ── Component ──────────────────────────────────────────────────

export function ScreenTreeRenderer({
	component,
	pathParams,
}: {
	component: RenderedComponent;
	pathParams?: Record<string, string>;
}): ReactElement {
	const config = (component.config ?? {}) as Record<string, any>;
	const datasource = config.datasource ?? {};
	const settings = config.settings ?? {};

	const resolvedPathParams = useResolvedParams(pathParams);

	const endpoint = useMemo(() => {
		const base = resolveUrlTemplate(
			datasource.endpoint ?? "",
			resolvedPathParams,
		);
		const params = datasource.params as Record<string, string> | undefined;
		if (!params || Object.keys(params).length === 0) return base;
		const qs = new URLSearchParams(params).toString();
		return base.includes("?") ? `${base}&${qs}` : `${base}?${qs}`;
	}, [datasource.endpoint, datasource.params, resolvedPathParams]);

	const { data, isLoading } = useSWR(
		endpoint ? [endpoint] : null,
		async ([url]: [string]) => {
			const res = await getApiClient().get(url);
			return (res.data?.data ?? null) as ScreenTreePayload | null;
		},
	);

	const title =
		typeof component.displayName === "string"
			? component.displayName.replace(/^\$trl_/, "")
			: "";
	const emptyMessage = settings.emptyMessage ?? "No components";
	const roots = data?.roots ?? [];
	const screen = data?.screen ?? null;

	return (
		<Box>
			{/* ── Header ── */}
			{(title || screen?.displayName) && (
				<Stack
					direction="row"
					className="mb-3 w-full items-center justify-between"
				>
					<Stack direction="row" spacing={1} className="items-center">
						{title && (
							<Typography variant="h6" className="font-bold">
								{title}
							</Typography>
						)}
						{screen?.displayName ? (
							<Chip label={screen.displayName} size="small" variant="outlined" />
						) : null}
					</Stack>
				</Stack>
			)}

			{/* ── Body ── */}
			{isLoading ? (
				<Stack className="items-center py-8">
					<CircularProgress size={24} />
				</Stack>
			) : roots.length === 0 ? (
				<Typography
					variant="body2"
					color="text.secondary"
					className="py-8 text-center"
				>
					{emptyMessage}
				</Typography>
			) : (
				<Stack spacing={2}>
					{roots.map((root) => (
						<NodeCard key={root.id} node={root} depth={0} />
					))}
				</Stack>
			)}
		</Box>
	);
}
