"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
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

	return (
		<Stack spacing={2} className="h-40">
			<Typography variant="subtitle1" className="font-bold">
				{component.displayName}
			</Typography>

			{!hasConfigParams && params.length > 0 && (
				<Stack direction="row" spacing={2}>
					{params.map((p: any) => (
						<TextField
							key={p.name}
							size="small"
							label={p.label}
							required={p.required}
							value={paramValues[p.name] ?? ""}
							onChange={(e) =>
								setParamValues((prev) => ({
									...prev,
									[p.name]: e.target.value,
								}))
							}
							sx={{ minWidth: 200 }}
							// eslint-disable-next-line @typescript-eslint/no-explicit-any
							{...({
								type:
									p.type === "datetime"
										? "datetime-local"
										: p.type === "number"
											? "number"
											: "text",
								InputLabelProps:
									p.type === "datetime" ? { shrink: true } : undefined,
							} as any)}
						/>
					))}
				</Stack>
			)}

			{!hasConfigParams && (
				<Stack direction="row" spacing={2} className="items-center">
					<Button
						variant="contained"
						size="small"
						onClick={() => execute()}
						disabled={loading || !queryId}
					>
						{loading ? <CircularProgress size={16} /> : "Execute"}
					</Button>
				</Stack>
			)}

			{error && (
				<Typography variant="body2" color="error">
					{error}
				</Typography>
			)}

			{loading && (
				<Box className="flex items-center justify-center py-8">
					<CircularProgress />
				</Box>
			)}

			{result != null && !loading && isTableData && (
				<TableContainer component={Paper} variant="outlined">
					<Table size="small">
						<TableHead>
							<TableRow>
								{extractColumns(sortedData).map((col) => (
									<TableCell
										key={col.key}
										sx={{ fontWeight: 600, whiteSpace: "nowrap" }}
									>
										{col.label}
									</TableCell>
								))}
							</TableRow>
						</TableHead>
						<TableBody>
							{sortedData.map((row: any, i: number) => {
								const isUnmatched = !row.id && row.packageId === "_unmatched";
								const displayRow = {
									...row,
									displayName: isUnmatched
										? "Other"
										: row.displayName || row.name || "",
								};
								return (
									<TableRow
										key={row.id ?? row.packageId ?? i}
										sx={isUnmatched ? { opacity: 0.5 } : undefined}
									>
										{extractColumns(sortedData).map((col) => (
											<TableCell key={col.key} sx={{ whiteSpace: "nowrap" }}>
												{col.format
													? col.format(displayRow[col.key])
													: String(displayRow[col.key] ?? "")}
											</TableCell>
										))}
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
					{resultMeta && (
						<Box sx={{ p: 1, textAlign: "right" }}>
							<Typography variant="caption" color="text.secondary">
								{resultMeta.total} row{resultMeta.total === 1 ? "" : "s"}
							</Typography>
						</Box>
					)}
				</TableContainer>
			)}

			{result != null && !loading && !isTableData && (
				<Box
					component="pre"
					sx={{
						p: 2,
						backgroundColor: "grey.900",
						color: "grey.100",
						borderRadius: 1,
						overflow: "auto",
						maxHeight: 500,
						fontSize: 13,
						fontFamily: "monospace",
					}}
				>
					{JSON.stringify(result, null, 2)}
				</Box>
			)}
		</Stack>
	);
}
