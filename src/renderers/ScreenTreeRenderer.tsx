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
// Pure HTML/Tailwind — no canvas. The tree shape mirrors the arch schema
// (components + elements), so the same data can later drive an editor.
// ═══════════════════════════════════════════════════════════════
"use client";

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

// ── Blueprint → badge tint ─────────────────────────────────────

const BP_BADGE: Record<string, string> = {
	screen_layout_general: "border-primary/50 text-primary",
	page: "border-primary/50 text-primary",
	table: "border-info-main/50 text-info-main",
	form: "border-success-main/50 text-success-main",
	section: "border-warning-main/50 text-warning-main",
	tabs: "border-border text-muted-foreground",
	info: "border-border text-muted-foreground",
	list: "border-border text-muted-foreground",
	"raw-json": "border-border text-muted-foreground",
	"audit-history": "border-border text-muted-foreground",
};

function bpBadgeClass(type: string | null): string {
	return BP_BADGE[type ?? ""] ?? "border-border text-muted-foreground";
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
			items: [...items].sort((a, b) => (a.grid?.col ?? 0) - (b.grid?.col ?? 0)),
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
		<div className="rounded-md border border-border bg-muted px-2 py-1">
			<div className="flex min-w-0 items-center gap-2">
				<span className="truncate text-xs font-semibold text-foreground">
					{elementLabel(el)}
				</span>
				{fd?.type ? (
					<span className="shrink-0 rounded-full border border-border px-1.5 text-[0.6rem] leading-4 text-muted-foreground">
						{fd.type}
					</span>
				) : null}
				{bodyKey && bodyKey !== elementLabel(el) ? (
					<span className="truncate font-mono text-[0.65rem] text-muted-foreground">
						{bodyKey}
					</span>
				) : null}
			</div>
		</div>
	);
}

function NodeCard({
	node,
	depth,
}: {
	node: TreeNode;
	depth: number;
}): ReactElement {
	const rows = groupByRow(node.elements);

	return (
		<article
			className={`w-full rounded-lg border border-border bg-card ${
				depth > 0 ? "border-s-[3px] border-s-border" : "border-s-primary"
			}`}
		>
			{/* Header */}
			<header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
				<div className="flex min-w-0 items-center gap-2">
					<h4 className="truncate text-sm font-bold text-foreground">
						{node.displayName ?? node.name}
					</h4>
					{node.type ? (
						<span
							className={`shrink-0 rounded-full border px-1.5 text-[0.65rem] leading-4 ${bpBadgeClass(node.type)}`}
						>
							{node.type}
						</span>
					) : null}
					<span className="truncate font-mono text-xs text-muted-foreground">
						{node.name}
					</span>
				</div>
				<span className="whitespace-nowrap text-xs text-muted-foreground">
					{node.elements.length} element{node.elements.length === 1 ? "" : "s"}
				</span>
			</header>

			{/* Body: slot groups → grid rows */}
			{node.elements.length === 0 ? (
				<p className="px-3 py-2 text-xs text-muted-foreground/50">
					no elements
				</p>
			) : (
				<div className="flex flex-col gap-3 px-3 py-2">
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
							<div key={group.slot || "slot"}>
								{group.slot ? (
									<span className="text-[0.6rem] uppercase tracking-[0.08em] text-muted-foreground">
										slot: {group.slot}
									</span>
								) : null}
								<div className="flex flex-col gap-1.5">
									{group.rows.map((row) => (
										<div key={row.row} className="flex flex-wrap gap-2">
											{row.items.map((el) => (
												<div
													key={el.id}
													style={{
														flex: `0 0 calc(${gridWidth(el)}% - 8px)`,
														minWidth: 140,
													}}
												>
													{el.elementType === "component_ref" ? (
														el.child ? (
															<NodeCard node={el.child} depth={depth + 1} />
														) : (
															<div className="rounded-md border border-dashed border-border px-2 py-1">
																<span className="text-xs text-muted-foreground/50">
																	missing component
																</span>
															</div>
														)
													) : (
														<FieldChip el={el} />
													)}
												</div>
											))}
										</div>
									))}
								</div>
							</div>
						))}
				</div>
			)}
		</article>
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
		<div>
			{/* ── Header ── */}
			{(title || screen?.displayName) && (
				<div className="mb-3 flex w-full items-center justify-between">
					<div className="flex items-center gap-2">
						{title && (
							<h2 className="text-start text-xl font-bold text-foreground">
								{title}
							</h2>
						)}
						{screen?.displayName ? (
							<span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
								{screen.displayName}
							</span>
						) : null}
					</div>
				</div>
			)}

			{/* ── Body ── */}
			{isLoading ? (
				<div className="flex items-center justify-center py-8">
					<span
						role="status"
						aria-label="Loading"
						className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary"
					/>
				</div>
			) : roots.length === 0 ? (
				<p className="py-8 text-center text-sm text-muted-foreground">
					{emptyMessage}
				</p>
			) : (
				<div className="flex flex-col gap-4">
					{roots.map((root) => (
						<NodeCard key={root.id} node={root} depth={0} />
					))}
				</div>
			)}
		</div>
	);
}
