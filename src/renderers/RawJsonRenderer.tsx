"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { getApiClient } from "../deps";
import type { RenderedComponent } from "../types";
import { useDateRange } from "./DateRangeContext";

// Preferred column order and formatters for stats tables
const STATS_COLUMNS: Record<
	string,
	{ label: string; format?: (v: unknown) => string }
> = {
	displayName: { label: "Package" },
	totalRequests: { label: "Requests", format: (v) => String(v ?? 0) },
	successRate: {
		label: "Success %",
		format: (v) => `${Number(v ?? 0).toFixed(1)}%`,
	},
	averageResponseTime: {
		label: "Avg Response (ms)",
		format: (v) => Number(v ?? 0).toFixed(2),
	},
};

// Fields to hide from the table (internal/system)
const HIDDEN_FIELDS = new Set([
	"id",
	"packageId",
	"name",
	"description",
	"ownerUserId",
	"ownerTenantId",
	"monetizationPlanId",
	"billingCycle",
	"totalLimit",
	"disorderThreshold",
	"responseTimeThreshold",
	"servicesContext",
	"visibility",
	"status",
	"meta",
	"createdAt",
	"updatedAt",
	"deletedAt",
	"deletedBy",
	"updatedBy",
	"createdBy",
	"tenantId",
	"overridesComponentId",
	"overridesWidgetId",
	"overridesScreenId",
	"overridesModuleId",
	"ownedBy",
	"pathPattern",
	"visibleToPermissions",
	"displayOrder",
	"isActive",
	"isSystem",
	"config",
	"slots",
	"slotsFilled",
	"contract",
	"category",
	"icon",
	"blueprintId",
	"blueprintName",
	"accessLevel",
]);

function isPrimitive(v: unknown): boolean {
	if (v === null || v === undefined) return false;
	const t = typeof v;
	return t === "string" || t === "number" || t === "boolean";
}

function extractColumns(
	rows: Record<string, unknown>[],
): { key: string; label: string; format?: (v: unknown) => string }[] {
	const seen = new Set<string>();
	for (const row of rows) {
		for (const key of Object.keys(row)) {
			if (isPrimitive(row[key]) && !HIDDEN_FIELDS.has(key)) seen.add(key);
		}
	}

	// Separate known stats columns from the rest
	const known: string[] = [];
	const rest: string[] = [];
	for (const key of seen) {
		if (STATS_COLUMNS[key]) {
			known.push(key);
		} else {
			rest.push(key);
		}
	}

	// Order: known columns first, then rest alphabetically
	return [
		...known.map((k) => ({ key: k, ...STATS_COLUMNS[k] })),
		...rest.sort().map((k) => ({
			key: k,
			label: k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()),
		})),
	];
}

/** The inline spinner used while a query runs or the result loads. */
function Spinner({ className }: { className: string }) {
	return (
		<span
			role="status"
			aria-label="Loading"
			className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
		/>
	);
}

export function RawJsonRenderer({
	component,
	pathParams,
}: {
	component: RenderedComponent;
	pathParams?: Record<string, string>;
}) {
	const config = (component.config ?? {}) as Record<string, any>;
	// queryId comes from config; fall back to the URL path param so any
	// query can be tested from its own detail screen (e.g. :id).
	const queryId: string = config?.queryId ?? pathParams?.id ?? "";
	const configParams: Record<string, unknown> | undefined = config?.parameters;
	const { range } = useDateRange();

	// Use config params as base, but override from/to with date range context
	const effectiveParams = useMemo(() => {
		const base = { ...(configParams ?? {}) };
		// Always use the date range context for from/to
		base.from = String(range.from);
		base.to = String(range.to);
		return base;
	}, [configParams, range]);

	const hasConfigParams =
		effectiveParams != null &&
		typeof effectiveParams === "object" &&
		Object.keys(effectiveParams).length > 0;

	const { data: queryDef } = useSWR(
		queryId ? `/api/v1/queries/${queryId}` : null,
		async (url: string) => {
			try {
				const r = await getApiClient().get(url);
				return r.data?.data ?? r.data ?? null;
			} catch {
				return null;
			}
		},
	);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const params: any[] = queryDef?.parameters ?? [];
	const [paramValues, setParamValues] = useState<Record<string, string>>({});
	const [result, setResult] = useState<unknown>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const executedRef = useRef(false);

	useEffect(() => {
		if (params.length > 0) {
			const defaults: Record<string, string> = {};
			for (const p of params) {
				if (p.default != null) defaults[p.name] = String(p.default);
			}
			setParamValues((prev: Record<string, string>) => ({
				...defaults,
				...prev,
			}));
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [queryDef]);

	const execute = useCallback(
		async (overrides?: Record<string, unknown>) => {
			if (!queryId) return;
			setLoading(true);
			setError(null);
			try {
				const parameters: Record<string, unknown> = { ...overrides };
				if (!overrides) {
					for (const p of params) {
						const val = paramValues[p.name];
						if (val) {
							parameters[p.name] = p.type === "number" ? Number(val) : val;
						}
					}
				}
				const queryParams = new URLSearchParams();
				for (const [k, v] of Object.entries(parameters)) {
					if (v != null && v !== "") queryParams.set(k, String(v));
				}
				const r = await getApiClient().get(
					`/api/v1/queries/${queryId}/execute?${queryParams.toString()}`,
				);
				setResult(r.data?.data ?? r.data);
			} catch (e: any) {
				setError(
					e?.response?.data?.message ?? e?.message ?? "Execution failed",
				);
			} finally {
				setLoading(false);
			}
		},
		[queryId, params, paramValues],
	);

	// Auto-execute when config provides hardcoded parameters, and re-execute on date change
	useEffect(() => {
		if (hasConfigParams && queryId) {
			executedRef.current = true;
			execute(effectiveParams);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [hasConfigParams, queryId, range.from, range.to]);

	// ── Render helpers ───────────────────────────────────────────

	const resultData = (result as any)?.data;
	const resultMeta = (result as any)?.meta;
	const isTableData =
		Array.isArray(resultData) &&
		resultData.length > 0 &&
		typeof resultData[0] === "object";

	// Sort: matched packages first (by name), unmatched last
	const sortedData = isTableData
		? [...resultData].sort((a: any, b: any) => {
				const aUn = a.packageId === "_unmatched";
				const bUn = b.packageId === "_unmatched";
				if (aUn && !bUn) return 1;
				if (!aUn && bUn) return -1;
				return (a.displayName || a.name || "").localeCompare(
					b.displayName || b.name || "",
				);
			})
		: [];

	const columns = extractColumns(sortedData);

	return (
		<div className="flex min-h-40 flex-col gap-4">
			<h3 className="text-start text-base font-bold text-foreground">
				{component.displayName}
			</h3>

			{!hasConfigParams && params.length > 0 && (
				<div className="flex flex-wrap items-end gap-4">
					{params.map((p: any) => (
						<label key={p.name} className="flex min-w-[200px] flex-col gap-1">
							<span className="text-start text-xs font-medium text-muted-foreground">
								{p.label}
								{p.required ? (
									<span className="ms-0.5 text-error-main">*</span>
								) : null}
							</span>
							<input
								type={
									p.type === "datetime"
										? "datetime-local"
										: p.type === "number"
											? "number"
											: "text"
								}
								value={paramValues[p.name] ?? ""}
								onChange={(e) =>
									setParamValues((prev) => ({
										...prev,
										[p.name]: e.target.value,
									}))
								}
								className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
							/>
						</label>
					))}
				</div>
			)}

			{!hasConfigParams && (
				<div className="flex flex-wrap items-center gap-4">
					<button
						type="button"
						onClick={() => execute()}
						disabled={loading || !queryId}
						className="inline-flex min-w-16 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-primary px-4 py-1.5 text-sm font-medium uppercase tracking-[0.02857em] text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{loading ? <Spinner className="size-4" /> : "Execute"}
					</button>
				</div>
			)}

			{error && (
				<p role="alert" className="text-start text-sm text-error-main">
					{error}
				</p>
			)}

			{loading && (
				<div className="flex items-center justify-center py-8">
					<span
						role="status"
						aria-label="Loading"
						className="h-10 w-10 animate-spin rounded-full border-2 border-muted border-t-primary"
					/>
				</div>
			)}

			{result != null && !loading && isTableData && (
				<div className="overflow-hidden rounded-lg border border-border bg-card">
					<div className="overflow-x-auto">
						<table className="w-full border-collapse text-sm">
							<thead>
								<tr className="border-b border-border bg-muted/40">
									{columns.map((col) => (
										<th
											key={col.key}
											scope="col"
											className="whitespace-nowrap px-3 py-2 text-start text-xs font-semibold text-foreground"
										>
											{col.label}
										</th>
									))}
								</tr>
							</thead>
							<tbody className="divide-y divide-border">
								{sortedData.map((row: any, i: number) => {
									const isUnmatched = !row.id && row.packageId === "_unmatched";
									const displayRow = {
										...row,
										displayName: isUnmatched
											? "Other"
											: row.displayName || row.name || "",
									};
									return (
										<tr
											key={row.id ?? row.packageId ?? i}
											className={isUnmatched ? "opacity-50" : undefined}
										>
											{columns.map((col) => (
												<td
													key={col.key}
													className="whitespace-nowrap px-3 py-2 text-sm text-foreground"
												>
													{col.format
														? col.format(displayRow[col.key])
														: String(displayRow[col.key] ?? "")}
												</td>
											))}
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
					{resultMeta && (
						<div className="border-t border-border p-2 text-end">
							<span className="text-xs text-muted-foreground">
								{resultMeta.total} row{resultMeta.total === 1 ? "" : "s"}
							</span>
						</div>
					)}
				</div>
			)}

			{result != null && !loading && !isTableData && (
				<pre className="max-h-[500px] overflow-auto rounded-lg bg-foreground p-4 font-mono text-[13px] leading-5 text-background">
					{JSON.stringify(result, null, 2)}
				</pre>
			)}
		</div>
	);
}
