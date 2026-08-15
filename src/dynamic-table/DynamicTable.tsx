// ═══════════════════════════════════════════════════════════════
// DynamicTable – Renders a data table using material-react-table.
//
// Supports two modes:
//   1. Server-side (default) — fetches data from the endpoint
//      defined in TableMetadata.datasource.
//   2. Client-side — accepts data via the `data` prop.
//
// ⚡ Performance
//   - Columns are memoised inside useMemo so the reference stays
//     stable across re-renders.
//   - The MRT instance itself is highly optimised – only visible
//     rows / cells are actually rendered.
// ═══════════════════════════════════════════════════════════════
"use client";

import { Stack } from "@mui/material";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import {
	MaterialReactTable,
	MRT_ActionMenuItem,
	type MRT_ColumnDef,
	type MRT_ColumnFiltersState,
	type MRT_PaginationState,
	type MRT_SortingState,
	useMaterialReactTable,
} from "material-react-table";
import { useRouter } from "next/navigation";
import { type ReactElement, useCallback, useMemo, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { useCan } from "../ability";
import { checkComponentPermission } from "../ability/checkComponentPermission";
import { getApiClient, useRenderUser } from "../deps";
import type { TableAction, TableMetadata, TableRowCondition } from "../dynamic-form/types";
import { useFeatures } from "../hooks/useFeatures";
import { useResolvedParams } from "../hooks/useResolvedParams";
import type { QueryParams } from "../query-builder";
import { resolveUrlTemplate } from "../query-builder";
import { columnCellRenderers } from "../renderers/columnCellRenderers";
import { useDateRange } from "../renderers/DateRangeContext";
import { TableIcon } from "./TableIcon";

// ─────────────────────────────────────────────────────────────
// Resolved column type
//
// The render API resolves each TableColumnInstance against its
// linked FieldDefinition and supplies the field name directly.
// Only the fields actually used by buildColumnDef are required.
// ─────────────────────────────────────────────────────────────

export interface DynamicTableColumn {
	/** Column instance id from the backend. */
	id: string;
	/** The field name in the response data (maps to MRT accessorKey). */
	name: string;
	/** Display overrides (e.g. displayName → column header). */
	fieldOverrides?: { displayName?: string | null } | null;
	/** Column display configuration. */
	columnConfig?: {
		width?: string | number | null;
		minWidth?: string | number | null;
		maxWidth?: string | number | null;
		align?: "left" | "center" | "right" | "justify" | null;
		sortable?: boolean | null;
		filterable?: boolean | null;
		resizable?: boolean | null;
		hideable?: boolean | null;
		editable?: boolean | null;
		format?: { type: string } | null;
	} | null;
	/** Whether the column is active. */
	isActive?: boolean;
	/** Display order for sorting columns. */
	displayOrder: number;
}

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

export interface DynamicTableProps {
	/** Table metadata with settings, datasource, actions, … */
	tableMetadata: TableMetadata;

	/** Resolved column definitions (field name + instance config). */
	columns: DynamicTableColumn[];

	/**
	 * Client-supplied data rows.
	 *
	 * When omitted AND `tableMetadata.datasource.serverSide === true`
	 * the component fetches data from the configured endpoint
	 * automatically.
	 */
	data?: Record<string, unknown>[];

	/**
	 * When true, renders a minimal sub-table suitable for expandable detail
	 * panels: no column headers, no pagination, no toolbar, no search/filters.
	 */
	subRow?: boolean;

	/** Called when a row action is triggered. */
	onRowAction?: (action: string, row: Record<string, unknown>) => void;

	/** Called when a toolbar action button is clicked. */
	onToolbarAction?: (action: string) => void;

	/** Called when dialog state changes (openDialog / closeDialog actions). */
	onDialogChange?: (
		dialog: string | null,
		id: string,
		formId: string,
		extra: string,
	) => void;
	/** Called when row selection changes. Receives array of selected row IDs. */
	onSelectionChange?: (selectedIds: string[]) => void;

	/** Called to close the parent dialog (e.g., after linkSelected completes). */
	onClose?: () => void;

	/**
	 * Additional query/path params to inject into API calls.
	 *
	 * - `pathParams`  → resolves `{param}` templates in `datasource.endpoint`
	 * - `queryParams` → appended as URL search params on every fetch
	 * - `bodyParams`  → merged into create/update payloads
	 *
	 * Use the `usePageQueryParams` hook to build this from route params.
	 */
	otherParams?: QueryParams;
}

// ─────────────────────────────────────────────────────────────
// Helpers – map a DynamicTableColumn → MRT_ColumnDef
// ─────────────────────────────────────────────────────────────

function buildColumnDef(
	col: DynamicTableColumn,
): MRT_ColumnDef<Record<string, unknown>> {
	const config = col.columnConfig;
	const overrides = col.fieldOverrides;
	const header = overrides?.displayName ?? col.name;

	const def: MRT_ColumnDef<Record<string, unknown>> = {
		accessorKey: (overrides as any)?.name ?? col.name,
		header,
		enableSorting: config?.sortable ?? true,
		enableColumnFilter: config?.filterable ?? true,
		enableResizing: config?.resizable ?? true,
		enableHiding: config?.hideable ?? true,
		size: numOrUndefined(config?.width),
		minSize: numOrUndefined(config?.minWidth),
		maxSize: numOrUndefined(config?.maxWidth),
		...(config?.editable ? { enableEditing: true } : {}),
	};

	// Format-based cell rendering — delegates to column cell renderers
	if (config?.format) {
		const fmt = config.format;
		const CellComponent = columnCellRenderers[fmt.type];
		if (CellComponent) {
			def.Cell = CellComponent as any;
			(def as any).columnFormat = fmt;
		}
	}

	// Default cell: stringify non-string values so booleans (which React
	// renders as nothing) and objects never show up as empty cells.
	if (!def.Cell) {
		def.Cell = ({ cell }: any) => {
			const value = cell.getValue();
			if (value === null || value === undefined) return "";
			if (typeof value === "boolean") return value ? "Yes" : "No";
			if (typeof value === "object") return JSON.stringify(value);
			return String(value);
		};
	}

	// Alignment — default to center
	const align =
		config?.align && config.align !== "justify" ? config.align : "center";
	def.muiTableHeadCellProps = { align };

	// Fixed-length columns: MRT's maxSize only limits manual resizing, it
	// does not clip content during layout. Apply cell-level truncation so
	// width/maxWidth columns always render at their configured length.
	const fixedWidth = numOrUndefined(config?.maxWidth ?? config?.width);
	def.muiTableBodyCellProps = {
		align,
		...(fixedWidth
			? {
					sx: {
						maxWidth: fixedWidth,
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
					},
				}
			: {}),
	};

	return def;
}

function numOrUndefined(
	v: string | number | undefined | null,
): number | undefined {
	if (v == null) return undefined;
	if (typeof v === "number") return v;
	const n = Number(v);
	return Number.isFinite(n) ? n : undefined;
}

/**
 * Evaluate a row condition against a data row. Used by `rowConditions`
 * in table settings (e.g. failed activity rows get a reddish background).
 */
function matchRowCondition(
	row: Record<string, unknown>,
	condition: TableRowCondition,
): boolean {
	const value = row[condition.field];
	switch (condition.operator ?? "equals") {
		case "equals":
			return value === condition.value;
		case "notEquals":
			return value !== condition.value;
		case "notEmpty":
			return value !== null && value !== undefined && value !== "";
		case "isEmpty":
			return value === null || value === undefined || value === "";
		default:
			return false;
	}
}

/**
 * Map our contract density ("normal" → "comfortable", "comfortable" → "spacious")
 * to MRT's density values (which use "comfortable" | "compact" | "spacious").
 */
function toMrtDensity(
	d: TableMetadata["settings"]["density"],
): "comfortable" | "compact" | "spacious" {
	switch (d) {
		case "compact":
			return "compact";
		case "normal":
			return "comfortable";
		case "comfortable":
			return "spacious";
	}
}

// ─────────────────────────────────────────────────────────────
// Build URL search params for the fetch request
// ─────────────────────────────────────────────────────────────

interface FetchParams {
	pagination: MRT_PaginationState;
	sorting: MRT_SortingState;
	globalFilter: string;
	columnFilters: MRT_ColumnFiltersState;
	includeDeleted: boolean;
	searchableFields?: string[];
	datasourceParams?: Record<string, string>;
	pathParams?: Record<string, string>;
}

/**
 * Resolve `{param}` placeholders in a datasource param value against the
 * current path/query context. Values whose placeholders cannot be
 * resolved are DROPPED (returned as undefined) so filters only apply
 * when their context is present (e.g. actorId on a filtered view).
 */
function resolveParamValue(
	value: string,
	pathParams?: Record<string, string>,
): string | undefined {
	let resolved = value;
	if (pathParams) {
		for (const [key, v] of Object.entries(pathParams)) {
			resolved = resolved.replaceAll(`{${key}}`, encodeURIComponent(v));
		}
	}
	if (resolved.includes("{") && resolved.includes("}")) {
		return undefined; // unresolved placeholder → drop the param
	}
	return resolved;
}

function buildSearchParams({
	pagination,
	sorting,
	globalFilter,
	columnFilters,
	includeDeleted,
	searchableFields,
	datasourceParams,
	pathParams,
}: FetchParams): URLSearchParams {
	const params = new URLSearchParams();

	// Static datasource params — `{param}` placeholders are resolved
	// against the path/query context; unresolved ones are dropped.
	if (datasourceParams) {
		for (const [key, value] of Object.entries(datasourceParams)) {
			const resolved = resolveParamValue(value, pathParams);
			if (resolved !== undefined) {
				params.set(key, resolved);
			}
		}
	}

	// Pagination
	params.set("page", String(pagination.pageIndex + 1)); // 1-based
	params.set("limit", String(pagination.pageSize));

	// Sorting (take the first sort descriptor)
	if (sorting.length > 0) {
		params.set("sortBy", sorting[0].id);
		params.set("sortOrder", sorting[0].desc ? "desc" : "asc");
	}

	params.set("includeDeleted", includeDeleted ? "true" : "false");

	// Global search
	if (globalFilter) {
		params.set("search", globalFilter);

		// Tell the backend which fields to search
		if (searchableFields && searchableFields.length > 0) {
			params.set("searchFields", searchableFields.join(","));
		}
	}

	// Column-level filters — forwarded to the backend so filtering works
	// across pages (server-side). Endpoints without a matching filter
	// param ignore the extra query keys. Complex values (date ranges,
	// filterFn objects) are skipped — only scalar values are sent.
	for (const f of columnFilters) {
		const v = f.value;
		if (v === undefined || v === null || v === "") continue;
		if (typeof v === "string" || typeof v === "number") {
			params.set(f.id, String(v));
		}
	}

	return params;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function DynamicTable({
	tableMetadata,
	columns: columnInstances,
	data: externalData,
	subRow,
	onRowAction,
	onDialogChange,
	onToolbarAction,
	onSelectionChange,
	onClose,
	otherParams,
}: DynamicTableProps): ReactElement {
	const { settings, selection, datasource } = tableMetadata;
	const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
	const isServerSide = datasource.serverSide === true;

	// ── Resolve endpoint template with otherParams pathParams ──
	// Read date range from DateRangeContext (shared globally by the date range picker)
	const { range } = useDateRange();
	const { features } = useFeatures();
	// Route params + current user's tenant (for {tenantId} templates).
	const resolvedPathParams = useResolvedParams(otherParams?.pathParams);
	const resolvedEndpoint = useMemo(() => {
		const dateParams: Record<string, string> = {};
		if (range.from) dateParams.from = String(range.from);
		if (range.to) dateParams.to = String(range.to);
		return resolveUrlTemplate(datasource.endpoint, {
			...dateParams,
			...resolvedPathParams,
		});
	}, [datasource.endpoint, resolvedPathParams, range]);
	const hasExternalData = externalData !== undefined;
	const { push } = useRouter();
	const { mutate: globalMutate } = useSWRConfig();

	// ── Server-side state ──────────────────────────────────────
	const [pagination, setPagination] = useState<MRT_PaginationState>({
		pageIndex: 0,
		pageSize: datasource.pagination.defaultPageSize,
	});
	const [sorting, setSorting] = useState<MRT_SortingState>([]);
	const [globalFilter, setGlobalFilter] = useState("");
	const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(
		[],
	);
	const [includeDeleted, setIncludeDeleted] = useState(false);

	// ── Build MRT column definitions ───────────────────────────
	// Hide `deletedAt` column unless the user chose to see deleted items.
	const columns = useMemo<MRT_ColumnDef<Record<string, unknown>>[]>(
		() =>
			columnInstances
				.filter((col) => col.isActive !== false)
				.filter((col) => includeDeleted || col.name !== "deletedAt")
				.sort((a, b) => a.displayOrder - b.displayOrder)
				.map(buildColumnDef),
		[columnInstances, includeDeleted],
	);

	// ── Build the SWR cache key for server-side data ────────────
	// Same key is used by TableRenderer mutate() after create/update.
	// Includes the resolved endpoint + otherParams query string to isolate
	// caches per tenant/context scope.
	const otherQueryString = useMemo(
		() =>
			otherParams?.queryParams
				? new URLSearchParams(otherParams.queryParams).toString()
				: "",
		[otherParams?.queryParams],
	);

	const tableDataKey = useMemo(() => {
		const qs = buildSearchParams({
			pagination,
			sorting,
			globalFilter,
			columnFilters,
			includeDeleted,
			searchableFields: settings.searchableFields,
			datasourceParams: datasource.params,
			pathParams: resolvedPathParams,
		});
		const suffix = otherQueryString ? `&${otherQueryString}` : "";
		return `table-data:${resolvedEndpoint}?${qs.toString()}${suffix}`;
	}, [
		pagination,
		sorting,
		globalFilter,
		columnFilters,
		includeDeleted,
		resolvedEndpoint,
		resolvedPathParams,
		settings.searchableFields,
		otherQueryString,
	]);

	// ── Fetch data via SWR ──────────────────────────────────────
	const {
		data: swrResponse,
		error,
		isLoading,
		mutate,
	} = useSWR(
		isServerSide && !hasExternalData ? tableDataKey : null,
		async () => {
			const baseUrl = process.env.NEXT_PUBLIC_ENDPOINT ?? "";
			const qs = buildSearchParams({
				pagination,
				sorting,
				globalFilter,
				columnFilters,
				includeDeleted,
				searchableFields: settings.searchableFields,
				datasourceParams: datasource.params,
			});
			const suffix = otherQueryString ? `&${otherQueryString}` : "";
			const sep = resolvedEndpoint.includes("?") ? "&" : "?";
			const url = `${baseUrl}${resolvedEndpoint}${sep}${qs.toString()}${suffix}`;
			const res = await getApiClient().get(url);
			return res.data;
		},
		{
			revalidateOnFocus: false,
			keepPreviousData: true,
		},
	);

	// ── Extract rows and total from SWR response ───────────────
	// Some endpoints return { data: [...] } (flat array),
	// others return { data: { data: [...], total: N } } (paginated).
	const inner = swrResponse?.data;
	const fetchedData: Record<string, unknown>[] = Array.isArray(inner)
		? inner
		: (inner?.data ?? []);
	const rowCount: number = Array.isArray(inner)
		? inner.length
		: (inner?.total ?? inner?.meta?.total ?? 0);
	const fetchError: string | null = error?.message ?? null;

	// ── Decide which data to render ────────────────────────────
	const data = hasExternalData ? (externalData ?? []) : fetchedData;

	// ── Permission check ──────────────────────────────────────
	const can = useCan();
	const { data: user } = useRenderUser();
	const userPermissions: Array<{ resource: string; scope?: string }> =
		(user as any)?.permissions?.data ?? [];

	const checkPermission = useCallback(
		(p: string) => {
			const [resource, action] = p.split("_");
			if (action === "manage") {
				return (
					can("create", resource) &&
					can("read", resource) &&
					can("update", resource) &&
					can("delete", resource)
				);
			}
			return can(action, resource);
		},
		[can],
	);

	// ── Split toolbar actions by placement ──────────────────────
	const topActions = useMemo(
		() =>
			(tableMetadata.toolbarActions ?? []).filter(
				(a) =>
					a.placement !== "toolbar-actions" &&
					a.action !== "linkSelected" &&
					a.action !== "unlinkSelected" &&
					(!a.permissions?.length || a.permissions.some(checkPermission)) &&
					(!(a as any).visibleToPermissions?.length ||
						checkComponentPermission(
							userPermissions,
							(a as any).visibleToPermissions,
						)),
			),
		[tableMetadata.toolbarActions ?? [], checkPermission, userPermissions],
	);

	const internalActions: TableAction[] = useMemo(
		() =>
			(tableMetadata.toolbarActions ?? []).filter(
				(a) =>
					a.placement === "toolbar-actions" &&
					a.action !== "linkSelected" &&
					a.action !== "unlinkSelected" &&
					(!a.permissions?.length || a.permissions.some(checkPermission)) &&
					(!(a as any).visibleToPermissions?.length ||
						checkComponentPermission(
							userPermissions,
							(a as any).visibleToPermissions,
						)),
			),
		[tableMetadata.toolbarActions, checkPermission, userPermissions],
	);

	// ── In-memory dialog state (reported upward via onDialogChange) ──
	const setDialogState = useCallback(
		(d: string | null, id: string, formId: string, extra: string) => {
			onDialogChange?.(d, id, formId, extra);
		},
		[onDialogChange],
	);

	/**
	 * Resolve {fieldName} placeholders in a string from the row data.
	 * Supports nested paths: {serviceVersions[0].id} → row.serviceVersions[0].id
	 */
	const resolveRowPlaceholders = useCallback(
		(template: string, row?: Record<string, unknown>): string => {
			const data = { ...resolvedPathParams, ...(row ?? {}) };
			if (Object.keys(data).length === 0) return template;
			return template.replace(
				/\{(\w+(?:\.\w+|\[\d+\])*)\}/g,
				(_sub, key: string) => {
					const value = key
						.split(/(\.|\[\d+\])/)
						.reduce<unknown>((acc, part) => {
							if (part === "." || part === "") return acc;
							const idx = part.match(/^\[(\d+)\]$/);
							if (idx) {
								return Array.isArray(acc) ? acc[Number(idx[1])] : undefined;
							}
							if (acc == null) return undefined;
							return (acc as Record<string, unknown>)[part];
						}, data);
					return value == null ? `{${key}}` : String(value);
				},
			);
		},
		[resolvedPathParams],
	);

	/**
	 * Parse a redirect template and either set URL query params (for
	 * dialog-style `?dialog=...`) or navigate to a path (for path-style
	 * `/dashboard/...` or `./relative`). Placeholders like {id} are
	 * resolved from the row data.
	 */
	const handleRedirect = useCallback(
		(redirect: string, row?: Record<string, unknown>) => {
			// ── Path-style redirect: /absolute, ~/root-relative, or ./relative ──
			if (
				redirect.startsWith("/") ||
				redirect.startsWith("./") ||
				redirect.startsWith("~/")
			) {
				const normalized = redirect.replace(/^~\//, "/");
				const resolved = resolveRowPlaceholders(normalized, row);
				push(resolved);
				return;
			}

			// ── Query-style redirect: ?dialog=create&formId=... ──
			const qs = redirect.startsWith("?") ? redirect.slice(1) : redirect;
			const params = new URLSearchParams(qs);

			let newDialog: string | null = null;
			let newId: string | null = null;
			let newFormId: string | null = null;
			const extra: Record<string, string> = {};

			for (const [key, value] of params.entries()) {
				if (key === "dialog") {
					newDialog = value;
				} else if (key === "id") {
					const resolved =
						value === "{id}" && row ? String(row.id ?? "") : value;
					newId = resolved;
				} else if (key === "formId") {
					newFormId = value;
				} else {
					const resolved =
						value.startsWith("{") && value.endsWith("}") && row
							? String(row[value.slice(1, -1)] ?? "")
							: value;
					extra[key] = resolved;
				}
			}

			// Normalize legacy "update" → "edit"
			if (newDialog === "update") newDialog = "edit";

			setDialogState(
				newDialog,
				newId ?? "",
				newFormId ?? "",
				Object.keys(extra).length > 0 ? JSON.stringify(extra) : "",
			);
		},
		[setDialogState, push, resolveRowPlaceholders],
	);

	/**
	 * Handle the new typed action format.
	 * Dispatches based on the `action` discriminant:
	 *  - openDialog → sets dialog URL params (formId, context, row id)
	 *  - navigate   → resolves {placeholder} path and calls router.push
	 *  - apiCall    → invokes the endpoint, optionally refreshes table data
	 *  - custom     → handles toggleDeleted, refreshData, etc.
	 */
	const handleAction = useCallback(
		(action: TableAction, row?: Record<string, unknown>) => {
			if (action.action === "openDialog") {
				const extraObj = {
					_actionId: action.id,
					...resolvedPathParams,
					...(row ? { id: row.id as string } : {}),
				};
				setDialogState(
					action.dialog.context ?? "edit",
					row ? String(row.id ?? "") : "",
					action.dialog.formId,
					JSON.stringify(extraObj),
				);
				return;
			}

			if (action.action === "navigate") {
				const normalized = action.path.replace(/^~\//, "/");
				const resolved = resolveRowPlaceholders(normalized, row);
				push(resolved);
				return;
			}

			if (action.action === "apiCall") {
				if (action.confirm) {
					// Preserve row data + path params so confirm dialog can resolve {fieldName} placeholders
					const rowData = {
						...resolvedPathParams,
						...((row as Record<string, unknown>) ?? {}),
					};
					// Route to dialog-based confirmation instead of window.confirm
					const confirmPayload = JSON.stringify({
						endpoint: action.endpoint,
						method: action.method ?? "PATCH",
						title: action.confirm.title,
						message: action.confirm.message,
						successRedirect: action.successRedirect,
						...rowData,
					});
					setDialogState(
						"confirm",
						row ? String(row.id ?? "") : "",
						"",
						confirmPayload,
					);
					return;
				}
				const baseUrl = process.env.NEXT_PUBLIC_ENDPOINT ?? "";
				const endpoint = resolveRowPlaceholders(action.endpoint, row);

				// GET requests without confirm → treat as download / open in new tab
				if (action.method === "GET") {
					window.open(`${baseUrl}${endpoint}`, "_blank");
					return;
				}

				getApiClient()
					.request({
						url: `${baseUrl}${endpoint}`,
						method: action.method,
						data: action.body ?? row,
					})
					.then(() => {
						// onSuccess behaviour – refreshTable and closeDialog are
						// explicit opt-in. successRedirect alone is sufficient to navigate.
						if (action.onSuccess === "refreshTable") {
							mutate();
						}
						if (action.onSuccess === "refreshAll") {
							// Revalidate every SWR key — e.g. toggling a tenant
							// feature must refresh the feature flags consumed by
							// useFeatures (forms, tables, screen layouts).
							globalMutate(() => true);
						}
						if (action.onSuccess === "closeDialog") {
							setDialogState(null, "", "", "");
						}
						if (action.successRedirect) {
							push(resolveRowPlaceholders(action.successRedirect, row));
						}
					})
					.catch((err: unknown) => {
						console.error("DynamicTable apiCall failed:", err);
					});
				return;
			}

			if (action.action === "custom") {
				if (action.customAction === "toggleDeleted") {
					setIncludeDeleted((v) => !v);
				} else if (action.customAction === "refreshData") {
					mutate();
				} else if ("redirect" in action && action.redirect) {
					handleRedirect(action.redirect, row);
				} else {
					onToolbarAction?.(action.customAction ?? action.id);
				}
				return;
			}
		},
		[
			setDialogState,
			push,
			resolveRowPlaceholders,
			mutate,
			globalMutate,
			handleRedirect,
			resolvedPathParams,
		],
	);

	// ── Build the MRT instance ─────────────────────────────────
	const table = useMaterialReactTable({
		muiTableHeadRowProps() {
			return { sx: { boxShadow: "none" } };
		},

		// ── Core ────────────────────────────────────────────────
		columns,
		data,

		// ── Loading ─────────────────────────────────────────────
		state: {
			rowSelection,
			isLoading: isServerSide && isLoading,
			showProgressBars: isServerSide && isLoading,
			pagination: isServerSide ? pagination : undefined,
			sorting: isServerSide ? sorting : undefined,
			globalFilter: isServerSide ? globalFilter : undefined,
			columnFilters: isServerSide ? columnFilters : undefined,
		},

		// ── Manual (server-side) controllers ───────────────────
		manualPagination: isServerSide,
		manualSorting: isServerSide,
		// Column filters work client-side; only global search goes to backend
		manualFiltering: false,
		rowCount: isServerSide ? rowCount : undefined,
		onPaginationChange: isServerSide ? setPagination : undefined,
		onSortingChange: isServerSide ? setSorting : undefined,
		onGlobalFilterChange: isServerSide ? setGlobalFilter : undefined,
		onColumnFiltersChange: isServerSide ? setColumnFilters : undefined,

		// ── Page size options from the contract ────────────────
		paginationDisplayMode: "pages",

		// ── Initial state (density) ────────────────────────────
		initialState: {
			density: toMrtDensity(settings.density),
			pagination: isServerSide
				? {
						pageIndex: 0,
						pageSize: datasource.pagination.defaultPageSize,
					}
				: undefined,
		},

		// ── Sorting ─────────────────────────────────────────────
		enableSorting: subRow ? false : true,

		// ── Pagination ──────────────────────────────────────────
		enablePagination: subRow ? false : undefined,

		// ── Filtering ───────────────────────────────────────────
		enableColumnFilters: subRow ? false : settings.searchable,
		enableGlobalFilter: subRow ? false : settings.searchable,
		enableFilters: subRow ? false : settings.searchable,

		// ── Column headers ──────────────────────────────────────
		enableColumnActions: false,
		enableColumnOrdering: false,
		// ── Column visibility toggle ────────────────────────────
		enableHiding: subRow ? false : settings.columnToggle,

		// ── Row selection ───────────────────────────────────────
		enableRowSelection: selection?.enabled ?? false,
		editDisplayMode: "cell",
		enableEditing: true,
		onEditingRowSave: async ({ row, values }) => {
			const baseUrl = process.env.NEXT_PUBLIC_ENDPOINT ?? "";
			const endpoint = resolveRowPlaceholders(
				datasource.endpoint,
				row.original,
			);
			await getApiClient().request({
				url: baseUrl + endpoint,
				method: "PATCH",
				data: values,
			});
			mutate();
		},

		onRowSelectionChange: (updater: any) => {
			const next =
				typeof updater === "function" ? updater(rowSelection) : updater;
			setRowSelection(next);
			const ids = Object.keys(next)
				.filter((k) => next[k])
				.map((idx) => {
					const row = data[Number(idx)] as Record<string, unknown> | undefined;
					return (row?.id ??
						(row?.operations as Record<string, unknown> | undefined)
							?.id) as string;
				})
				.filter(Boolean);
			onSelectionChange?.(ids);
		},

		// ── Expandable sub-table rows ───────────────────────────
		...(tableMetadata.subTable?.tableName ? {} : {}),

		// ── Row actions ─────────────────────────────────────────
		enableRowActions: (tableMetadata.rowActions ?? []).length > 0,
		positionActionsColumn: "last",
		displayColumnDefOptions: {
			"mrt-row-actions": {
				header: "",
			},
		},
		renderRowActionMenuItems: ({ closeMenu, row, table }) =>
			(tableMetadata.rowActions ?? [])
				.filter((action) => {
					// Feature-flag gating (e.g. staging actions only when enabled)
					if (
						action.requiresFeature &&
						!features[action.requiresFeature]
					) {
						return false;
					}
					// Permission check
					if (
						action.permissions?.length &&
						!action.permissions.some(checkPermission)
					) {
						return false;
					}
					// Scope-aware visibility (e.g. super-admin-only actions)
					if (
						(action as any).visibleToPermissions?.length &&
						!checkComponentPermission(
							userPermissions,
							(action as any).visibleToPermissions,
						)
					) {
						return false;
					}
					// If the action has a condition, evaluate it against the row data
					if (!action.condition) return true;
					const conditions = Array.isArray(action.condition)
						? action.condition
						: [action.condition];
					return conditions.every(({ field, operator, value }) => {
						const fieldValue = row.original[field];
						switch (operator) {
							case "eq":
								return fieldValue === value;
							case "ne":
								return fieldValue !== value;
							case "isEmpty":
								return (
									fieldValue === undefined ||
									fieldValue === null ||
									fieldValue === ""
								);
							case "notEmpty":
								return (
									fieldValue !== undefined &&
									fieldValue !== null &&
									fieldValue !== ""
								);
							default:
								return true;
						}
					});
				})
				.map((action) => (
					<MRT_ActionMenuItem
						key={action.id}
						label={action.label}
						icon={
							action.icon ? (
								<TableIcon name={action.icon} size={18} />
							) : undefined
						}
						table={table}
						onClick={() => {
							if (action.action === "openDialog") {
								handleAction(action, row.original);
							} else if (action.action === "navigate") {
								handleAction(action, row.original);
							} else if (action.action === "apiCall") {
								handleAction(action, row.original);
							} else if (action.action === "custom") {
								handleAction(action, row.original);
							} else if (action.redirect) {
								handleRedirect(action.redirect, row.original);
							} else {
								onRowAction?.(action.id, row.original);
							}
							closeMenu();
						}}
						style={{
							color: action.color ? `${action.color}.main` : undefined,
						}}
					/>
				)),

		// ── Toolbar actions ──────────────────────────────────────
		renderTopToolbarCustomActions: subRow
			? undefined
			: () => {
					const selectedCount =
						Object.values(rowSelection).filter(Boolean).length;

					if (selectedCount > 0) {
						return (
							<Stack
								direction="row"
								spacing={1}
								className="self-center items-center"
							>
								<Chip
									label={`${selectedCount} selected`}
									size="small"
									color="primary"
								/>
								{(tableMetadata.toolbarActions ?? [])
									.filter(
										(a) =>
											a.action === "linkSelected" ||
											a.action === "unlinkSelected",
									)
									.map((action) => (
										<Button
											key={action.id}
											variant="contained"
											size="small"
											color={(action.color as any) ?? "primary"}
											startIcon={
												action.icon ? (
													<TableIcon name={action.icon} />
												) : undefined
											}
											onClick={async () => {
												const ids = Object.keys(rowSelection)
													.filter((k) => rowSelection[k])
													.map((idx) => data[Number(idx)]?.id as string)
													.filter(Boolean);
												const baseUrl = process.env.NEXT_PUBLIC_ENDPOINT ?? "";
												const rawEndpoint = (action as any).endpoint;
												const endpoint = resolveUrlTemplate(
													rawEndpoint,
													resolvedPathParams,
												);
												const method = (action as any).method ?? "POST";
												try {
													await getApiClient().request({
														url: `${baseUrl}${endpoint}`,
														method,
														data: { operationIds: ids },
													});
													mutate();
													// Close the outer dialog that wraps this table
													onClose?.();
												} catch (err) {
													console.error("Selection action failed:", err);
												}
											}}
										>
											{action.label}
										</Button>
									))}
							</Stack>
						);
					}

					return (
						<Stack direction="row" spacing={0.5} className="self-center">
							{topActions
								.filter(
									(a) =>
										a.action !== "linkSelected" &&
										a.action !== "unlinkSelected",
								)
								.map((action) => (
									<Button
										key={action.id}
										variant="contained"
										size="small"
										color={(action.color as any) ?? "primary"}
										startIcon={
											action.icon ? <TableIcon name={action.icon} /> : undefined
										}
										onClick={() => {
											if (action.action === "openDialog") {
												handleAction(action);
											} else if (action.action === "navigate") {
												handleAction(action);
											} else if (action.action === "apiCall") {
												handleAction(action);
											} else if (action.action === "custom") {
												handleAction(action);
											} else if (
												action.action === "linkSelected" ||
												action.action === "unlinkSelected"
											) {
												// Handled by selection bar — no-op here
											} else if (action.redirect) {
												handleRedirect(action.redirect);
											}
										}}
									>
										{action.label}
									</Button>
								))}
							{internalActions.map((action) => {
								return (
									<Tooltip
										key={action.id}
										title={
											(action as any).customAction === "toggleDeleted" &&
											includeDeleted
												? ((action as any).labelOn ?? "Hide Deleted")
												: (action as any).customAction === "toggleDeleted"
													? ((action as any).labelOff ?? action.label)
													: action.label
										}
									>
										<IconButton
											size="small"
											color={
												"customAction" in action &&
												action.customAction === "toggleDeleted" &&
												includeDeleted
													? "primary"
													: ((action.color as any) ?? "default")
											}
											onClick={() => {
												if (action.action === "openDialog") {
													handleAction(action);
												} else if (action.action === "navigate") {
													handleAction(action);
												} else if (action.action === "apiCall") {
													handleAction(action);
												} else if (action.action === "custom") {
													handleAction(action);
												} else if (action.customAction === "toggleDeleted") {
													setIncludeDeleted((v) => !v);
												} else if (action.customAction === "refreshData") {
													mutate();
												} else if (action.redirect) {
													handleRedirect(action.redirect);
												}
											}}
										>
											{action.icon ? <TableIcon name={action.icon} /> : null}
											{action.iconOn && action.iconOff ? (
												includeDeleted ? (
													<TableIcon name={action.iconOn} />
												) : (
													<TableIcon name={action.iconOff} />
												)
											) : null}

											{/* {action.customAction === "toggleDeleted" ? ( */}
											{/* 	<TableIcon */}
											{/* 		name={ */}
											{/* 			includeDeleted */}
											{/* 				? (action.iconOn ?? action.icon ?? "Visibility") */}
											{/* 				: (action.iconOff ?? action.icon ?? "VisibilityOff") */}
											{/* 		} */}
											{/* 	/> */}
											{/* ) : action.icon ? ( */}
											{/* 	<TableIcon name={action.icon} /> */}
											{/* ) : undefined} */}
										</IconButton>
									</Tooltip>
								);
							})}
						</Stack>
					);
				},

		// ── Styling & display ──────────────────────────────────
		enableStickyHeader: subRow ? false : settings.stickyHeader,
		enableFullScreenToggle: subRow ? false : true,
		enableDensityToggle: subRow ? false : true,

		// ── Error / selection banner ─────────────────────────
		renderToolbarAlertBannerContent: subRow
			? undefined
			: () => {
					if (fetchError) {
						return (
							<div style={{ color: "error.main", padding: "8px" }}>
								{fetchError}
							</div>
						);
					}
					return null;
				},
		positionToolbarAlertBanner: "none",

		// ── Hide empty toolbar containers in subRow mode ────────
		muiTopToolbarProps: subRow ? { sx: { display: "none" } } : undefined,
		muiBottomToolbarProps: subRow ? { sx: { display: "none" } } : undefined,

		// ── Paper / outer wrapper ───────────────────────────────
		muiTablePaperProps: {
			elevation: 0,
			sx: {
				border: settings.bordered ? "1px solid" : "none",
				borderColor: "divider",
				// borderRadius: "8px",
			},
		},

		muiTableContainerProps: {
			sx: {
				borderRadius: "0px",
			},
		},

		// ── Striped rows (alternating background) ──────────────
		muiTableBodyRowProps: ({ row }) => {
			const onClick = tableMetadata.onRowClick;
			const rowId = String(row.original.id ?? "");

			const handleRowClick = () => {
				if (!onClick) return;
				// Skip navigation if a dialog was just closed (avoid stray clicks)
				if (document.querySelector(".MuiDialog-root")) return;

				if (onClick.redirect) {
					let redirect = onClick.redirect;
					// Feature-gated navigation: when the flag is OFF and the row
					// carries a default version, jump to the fallback target.
					// Packages include `versions`, services include `serviceVersions`.
					const rowVersions = row.original.versions ?? row.original.serviceVersions;
					const versions = rowVersions as
						| Array<{ id?: string }>
						| undefined;
					if (
						onClick.fallbackFeature &&
						onClick.fallbackRedirect &&
						!features[onClick.fallbackFeature] &&
						versions?.length
					) {
						redirect = onClick.fallbackRedirect;
					}
					// Strip ~/ prefix (root-relative shorthand)
					redirect = redirect.replace(/^~\//, "/");
					const url = resolveRowPlaceholders(redirect, row.original);
					push(url);
				} else if (onClick.endpoint) {
					const baseUrl = process.env.NEXT_PUBLIC_ENDPOINT ?? "";
					const endpoint = resolveRowPlaceholders(
						onClick.endpoint,
						row.original,
					);
					getApiClient().request({
						url: `${baseUrl}${endpoint}`,
						method: onClick.method ?? "GET",
						data: row.original,
					});
				}
			};

			// First matching row condition wins (e.g. failed rows get a
			// reddish background).
			const matchedCondition = (settings.rowConditions ?? []).find(
				(c) => matchRowCondition(row.original, c),
			);

			return {
				sx: {
					cursor: onClick ? "pointer" : undefined,
					backgroundColor:
						matchedCondition?.backgroundColor ??
						(settings.striped && row.index % 2 === 1 ? "grey.100" : undefined),
				},
				className: matchedCondition?.className,
				onClick: onClick ? handleRowClick : undefined,
			};
		},
	});

	return <MaterialReactTable table={table} />;
}
