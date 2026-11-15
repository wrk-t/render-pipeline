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

import { Box, Link, Stack, Typography } from "@mui/material";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import {
	MaterialReactTable,
	MRT_ActionMenuItem,
	type MRT_ColumnDef,
	type MRT_ColumnFiltersState,
	type MRT_ColumnPinningState,
	type MRT_PaginationState,
	type MRT_SortingState,
	type MRT_TableInstance,
	useMaterialReactTable,
} from "material-react-table";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
	type KeyboardEvent as ReactKeyboardEvent,
	type MouseEvent as ReactMouseEvent,
	type ReactElement,
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import useSWR, { useSWRConfig } from "swr";
import { useCan } from "../ability";
import { checkComponentPermission } from "../ability/checkComponentPermission";
import { checkTier, resolveTier } from "../ability/checkTier";
import { getApiClient, useRenderUser } from "../deps";
import type {
	TableAction,
	TableBulkAction,
	TableMetadata,
	TableRowCondition,
} from "../dynamic-form/types";
import { useFeatures } from "../hooks/useFeatures";
import { useResolvedParams } from "../hooks/useResolvedParams";
import { useSnack } from "../hooks/useSnack";
import type { QueryParams } from "../query-builder";
import { resolveUrlTemplate } from "../query-builder";
import { columnCellRenderers } from "../renderers/columnCellRenderers";
import { TABLE_DATA_KEY_PREFIX } from "../renderers/SwitchCell";
import { TextCell } from "../renderers/TextCell";
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
	id: number;
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
		/** Hide this column when every row on the page has an empty value. */
		hideWhenEmpty?: boolean | null;
		editable?: boolean | null;
		filterType?: "text" | "number" | "select" | "date" | "boolean" | null;
		/** Select-filter options — static list or service-backed fetch. */
		filterOptions?: {
			type?: "static" | "service";
			options?: Array<{ label?: string; value?: unknown }> | null;
			endpoint?: string;
			labelField?: string;
			valueField?: string;
		} | null;
		format?: {
			/** Cell renderer key (see `columnCellRenderers`). */
			type: string;
			/** Renderer options (currency/currencyField, displayField, …). */
			props?: Record<string, unknown>;
			/** Legacy: reference label field at the format level. */
			displayField?: string;
		} | null;
	} | null;
	/** Field datasource (e.g. static select options) — feeds select filters
	 *  and the reference cell's id→label lookup. */
	datasource?: {
		type?: string;
		options?: Array<{ label?: string; value?: unknown }> | null;
		endpoint?: string;
		method?: string;
		params?: Record<string, unknown>;
		entityMeta?: {
			displayField?: string;
			valueField?: string;
			labelTemplate?: string;
		} | null;
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

/**
 * Platform default rows per page. A table may override it in its seed only
 * with a recorded reason (e.g. a month of calendar days), so page size no
 * longer drifts per screen (25 / 50 / 100 / 10).
 */
const DEFAULT_PAGE_SIZE = 25;

/**
 * UX-25 — CSV export streams the filtered list in pages of this size, so a
 * large export never asks the API for one giant `limit` response.
 */
const EXPORT_PAGE_SIZE = 500;
/** Safety cap for a runaway export (a browser tab still holds the CSV). */
const EXPORT_MAX_ROWS = 50_000;

/**
 * UX-25 — filter state lives in the URL so a filtered view can be shared.
 * The prefix keeps it clear of route params (e.g. `menuId`, `dialog`).
 */
const URL_STATE_PREFIX = "tf_";
const URL_KEYS = {
	search: `${URL_STATE_PREFIX}q`,
	page: `${URL_STATE_PREFIX}page`,
	size: `${URL_STATE_PREFIX}size`,
	sort: `${URL_STATE_PREFIX}sort`,
	order: `${URL_STATE_PREFIX}order`,
	includeDeleted: `${URL_STATE_PREFIX}deleted`,
	chip: `${URL_STATE_PREFIX}chip`,
	filterPrefix: `${URL_STATE_PREFIX}f_`,
} as const;

interface TableUrlState {
	pageIndex: number;
	pageSize: number;
	sorting: MRT_SortingState;
	globalFilter: string;
	columnFilters: MRT_ColumnFiltersState;
	includeDeleted: boolean;
	chipValue: string | null;
}

/**
 * Read a table's shareable state from the query string. Only server-side
 * tables persist/restore it: their filters are query params, while a
 * client-side table keeps its filters inside MRT.
 */
function readTableUrlState(
	searchParams: Pick<URLSearchParams, "get" | "entries">,
	defaultPageSize: number,
): TableUrlState | null {
	const page = Number(searchParams.get(URL_KEYS.page));
	const size = Number(searchParams.get(URL_KEYS.size));
	const sort = searchParams.get(URL_KEYS.sort);
	const order = searchParams.get(URL_KEYS.order);
	const filterEntries: MRT_ColumnFiltersState = [];
	for (const [key, value] of searchParams.entries()) {
		if (key.startsWith(URL_KEYS.filterPrefix) && value !== "") {
			filterEntries.push({
				id: key.slice(URL_KEYS.filterPrefix.length),
				value,
			});
		}
	}
	return {
		pageIndex: Number.isFinite(page) && page > 1 ? page - 1 : 0,
		pageSize: Number.isFinite(size) && size > 0 ? size : defaultPageSize,
		sorting: sort
			? [{ id: sort, desc: order !== "asc" } as MRT_SortingState[number]]
			: [],
		globalFilter: searchParams.get(URL_KEYS.search) ?? "",
		columnFilters: filterEntries,
		includeDeleted: searchParams.get(URL_KEYS.includeDeleted) === "1",
		chipValue: searchParams.get(URL_KEYS.chip) || null,
	};
}

// ─────────────────────────────────────────────────────────────
// CSV helpers (UX-25)
// ─────────────────────────────────────────────────────────────

/** Read a row cell, supporting the dotted accessors the DSL uses (`data.x`). */
function readRowValue(row: Record<string, unknown>, accessor: string): unknown {
	if (!accessor.includes(".")) return row[accessor];
	return accessor.split(".").reduce<unknown>((value, key) => {
		if (value === null || value === undefined) return undefined;
		return (value as Record<string, unknown>)[key];
	}, row);
}

/** CSV fields containing any of these need quoting (RFC 4180). */
const CSV_QUOTE_RE = /[",\n\r]/;

/** One RFC-4180 CSV field — quotes only when needed, doubles inner quotes. */
function csvCell(value: unknown): string {
	if (value === null || value === undefined) return "";
	let text: string;
	if (value instanceof Date) {
		text = value.toISOString();
	} else if (typeof value === "object") {
		text = JSON.stringify(value);
	} else {
		text = String(value);
	}
	return CSV_QUOTE_RE.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Serialise the visible columns, in table order, to CSV text. */
function toCsv(
	columns: Array<{ accessor: string; header: string }>,
	rows: Record<string, unknown>[],
): string {
	const lines = [columns.map((column) => csvCell(column.header)).join(",")];
	for (const row of rows) {
		lines.push(
			columns
				.map((column) => csvCell(readRowValue(row, column.accessor)))
				.join(","),
		);
	}
	return lines.join("\r\n");
}

/** Trigger a client download of the CSV text (BOM keeps Excel's UTF-8 right). */
function downloadCsv(filename: string, csv: string): void {
	const blob = new Blob([`\uFEFF${csv}`], {
		type: "text/csv;charset=utf-8;",
	});
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	setTimeout(() => URL.revokeObjectURL(url), 0);
}

function buildColumnDef(
	col: DynamicTableColumn,
	filterSelectOptions?: Array<{
		label?: string | number | null;
		value?: unknown;
	}>,
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

	// Internal marker for the page-level empty-column filter below. MRT's
	// column def has no place for app metadata, so carry it privately.
	if (config?.hideWhenEmpty) {
		(def as { __hideWhenEmpty?: boolean }).__hideWhenEmpty = true;
	}

	// ── Column filter variant ────────────────────────────────────
	// Map the metadata filterType to an MRT filter UI: select columns
	// render a dropdown (options from the field's static datasource),
	// boolean columns a Yes/No select, date columns a date picker.
	if (config?.filterable && config.filterType) {
		switch (config.filterType) {
			case "select": {
				def.filterVariant = "select";
				// Prefer the resolved options passed by the caller (columnConfig
				// filterOptions — static or service-backed); fall back to the
				// field's static datasource options (the form's options, reused).
				const options = filterSelectOptions ?? (col.datasource as any)?.options;
				if (Array.isArray(options) && options.length > 0) {
					def.filterSelectOptions = options.map(
						(o: { label?: string; value?: unknown }) => ({
							label: String(o.label ?? o.value ?? ""),
							value: String(o.value ?? ""),
						}),
					);
				}
				break;
			}
			case "boolean": {
				def.filterVariant = "select";
				def.filterSelectOptions = [
					{ label: "Yes", value: "true" },
					{ label: "No", value: "false" },
				];
				break;
			}
			case "date": {
				def.filterVariant = "date";
				break;
			}
			default: {
				def.filterVariant = "text";
			}
		}
	}

	// Format-based cell rendering — delegates to column cell renderers
	if (config?.format) {
		const fmt = config.format;
		const CellComponent = columnCellRenderers[fmt.type];
		if (CellComponent) {
			def.Cell = CellComponent as any;
			// A reference column can resolve its `{id → label}` lookup from the
			// field's datasource; carry it next to the format props so the cell
			// needs no seed-specific wiring (`format.props.datasource` wins).
			const columnFormat: Record<string, unknown> = { ...fmt };
			if (fmt.type === "reference") {
				const props = { ...(fmt.props ?? {}) } as Record<string, unknown>;
				if (props.datasource === undefined && col.datasource) {
					props.datasource = col.datasource;
				}
				if (
					props.displayField === undefined &&
					fmt.displayField !== undefined
				) {
					props.displayField = fmt.displayField;
				}
				columnFormat.props = props;
			}
			(def as any).columnFormat = columnFormat;
		}
	}

	// Default cell: the shared text renderer stringifies non-string values
	// (booleans, objects) and truncates a long value with an ellipsis while
	// revealing it in a tooltip — a wide text column can no longer force the
	// table to overflow instead of clipping.
	if (!def.Cell) {
		def.Cell = TextCell as any;
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
 * True when a click inside a table row belongs to a control (row-action menu,
 * selection checkbox, a link or a cell widget) rather than to the row itself.
 * The row opens its detail route; its controls must keep their own click and
 * must not also navigate.
 */
function isRowControlTarget(target: EventTarget | null): boolean {
	if (!(target instanceof Element)) return true;
	return Boolean(
		target.closest(
			'button, a, input, select, textarea, label, [role="button"], [role="link"], [role="checkbox"], [role="menuitem"], [role="switch"]',
		),
	);
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
	/** Selected filter-chip values, forwarded as query params. */
	chipParams?: Record<string, string>;
	/** Export override: request this page instead of the visible one. */
	pageOverride?: number;
	/** Export override: request this page size instead of the visible one. */
	limitOverride?: number;
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
	chipParams,
	pageOverride,
	limitOverride,
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

	// Selected filter chips (e.g. a category) — an explicit choice, not a
	// column filter: it narrows the whole server-side result set, so a page
	// shows a filtered page rather than the filtered rows of one page.
	if (chipParams) {
		for (const [key, value] of Object.entries(chipParams)) {
			params.set(key, value);
		}
	}

	// Pagination (`pageOverride` / `limitOverride` are used by CSV export)
	params.set("page", String(pageOverride ?? pagination.pageIndex + 1)); // 1-based
	params.set("limit", String(limitOverride ?? pagination.pageSize));

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
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const { mutate: globalMutate } = useSWRConfig();
	const snack = useSnack();
	const muiTheme = useTheme();
	// The opt-in mobile cards replace the table on phones only (MUI sm=600,
	// the same edge the DSL dialogs go full-screen at).
	const isPhone = useMediaQuery(muiTheme.breakpoints.down("sm"), {
		noSsr: true,
	});

	// ── Server-side state ──────────────────────────────────────
	// One platform page size (25). A seed may override it only with a
	// recorded reason; the renderer falls back to the platform default when
	// a table does not declare one.
	const initialPageSize =
		datasource.pagination?.defaultPageSize ?? DEFAULT_PAGE_SIZE;
	// ── Filter chips (e.g. menu categories) ────────────────────
	// An explicit chip row above the table: the chosen value is forwarded to
	// the datasource as a query param, so a server-side table filters across
	// pages instead of only the rows the browser already holds. Client-side
	// and externally supplied tables filter their rows directly.
	// A sub-table (detail panel) stays compact: the chip row belongs to the
	// page-level list it filters.
	const filterChips = subRow ? null : (settings.filterChips ?? null);

	// ── Shareable filter state (UX-25) ─────────────────────────
	// A server-side table restores search/filters/page/sort from `tf_*`
	// query params on first render, so a copied URL reproduces the view.
	const initialUrlState = useMemo(
		() =>
			isServerSide && !hasExternalData
				? readTableUrlState(searchParams, initialPageSize)
				: null,
		[isServerSide, hasExternalData, searchParams, initialPageSize],
	);
	const [pagination, setPagination] = useState<MRT_PaginationState>({
		pageIndex: initialUrlState?.pageIndex ?? 0,
		pageSize: initialUrlState?.pageSize ?? initialPageSize,
	});
	const [sorting, setSorting] = useState<MRT_SortingState>(
		initialUrlState?.sorting ?? [],
	);
	const [globalFilter, setGlobalFilter] = useState(
		initialUrlState?.globalFilter ?? "",
	);
	const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(
		initialUrlState?.columnFilters ?? [],
	);
	const [includeDeleted, setIncludeDeleted] = useState(
		initialUrlState?.includeDeleted ?? false,
	);

	const [chipValue, setChipValue] = useState<string | null>(
		filterChips ? (initialUrlState?.chipValue ?? null) : null,
	);

	const chipParams = useMemo<Record<string, string> | undefined>(() => {
		if (!filterChips?.field || !chipValue) return undefined;
		return { [filterChips.field]: chipValue };
	}, [filterChips?.field, chipValue]);

	const chipQuery = useMemo(() => {
		const params = new URLSearchParams();
		params.set("limit", String(filterChips?.limit ?? 100));
		for (const [key, value] of Object.entries(filterChips?.params ?? {})) {
			const resolved = resolveParamValue(value, resolvedPathParams);
			if (resolved !== undefined) params.set(key, resolved);
		}
		return {
			endpoint: filterChips?.endpoint
				? resolveUrlTemplate(filterChips.endpoint, resolvedPathParams)
				: "",
			search: params.toString(),
		};
	}, [filterChips, resolvedPathParams]);

	const chipOptionsKey = filterChips?.endpoint
		? `table-filter-chips:${chipQuery.endpoint}?${chipQuery.search}`
		: null;

	const { data: chipOptions } = useSWR(
		chipOptionsKey,
		async () => {
			const baseUrl = process.env.NEXT_PUBLIC_ENDPOINT ?? "";
			const res = await getApiClient().get(
				`${baseUrl}${chipQuery.endpoint}?${chipQuery.search}`,
			);
			// The list endpoints all wrap their rows the same way.
			const rows = res.data?.data?.data ?? res.data?.data ?? res.data ?? [];
			const list = Array.isArray(rows) ? rows : [rows];
			const labelField = filterChips?.labelField ?? "name";
			const valueField = filterChips?.valueField ?? "id";
			return list
				.map((row: Record<string, unknown>) => ({
					label: String(row[labelField] ?? row.name ?? row.displayName ?? ""),
					value: String(row[valueField] ?? row.id ?? ""),
				}))
				.filter((option) => option.label && option.value);
		},
		{ revalidateOnFocus: false },
	);

	const selectChip = useCallback((value: string | null) => {
		setChipValue(value);
		// A new filter is a new result set — never land on an out-of-range page.
		setPagination((previous) => ({ ...previous, pageIndex: 0 }));
	}, []);

	// ── Mirror the filter state into the URL (UX-25) ───────────
	// `tf_*` params make a filtered view shareable. Only non-default values
	// are written, so an unfiltered list keeps a clean URL; route params
	// (`menuId`, `dialog`, …) are preserved. Server-side only: a client-side
	// table keeps its filters inside MRT.
	// `history.replaceState` (not router.replace) keeps typing in the search
	// box from triggering a server round-trip on every keystroke.
	useEffect(() => {
		if (subRow || !isServerSide || hasExternalData) return;
		const params = new URLSearchParams(window.location.search);
		const currentQuery = params.toString();
		for (const key of Array.from(params.keys())) {
			if (key.startsWith(URL_STATE_PREFIX)) params.delete(key);
		}
		if (globalFilter) params.set(URL_KEYS.search, globalFilter);
		if (pagination.pageIndex > 0) {
			params.set(URL_KEYS.page, String(pagination.pageIndex + 1));
		}
		if (pagination.pageSize !== initialPageSize) {
			params.set(URL_KEYS.size, String(pagination.pageSize));
		}
		if (sorting[0]) {
			params.set(URL_KEYS.sort, sorting[0].id);
			params.set(URL_KEYS.order, sorting[0].desc ? "desc" : "asc");
		}
		if (includeDeleted) params.set(URL_KEYS.includeDeleted, "1");
		if (chipValue && filterChips?.field) {
			params.set(URL_KEYS.chip, chipValue);
		}
		for (const filter of columnFilters) {
			const value = filter.value;
			if (typeof value === "string" || typeof value === "number") {
				if (value !== "") {
					params.set(`${URL_KEYS.filterPrefix}${filter.id}`, String(value));
				}
			}
		}
		const nextQuery = params.toString();
		if (nextQuery === currentQuery) return;
		window.history.replaceState(
			null,
			"",
			`${pathname}${nextQuery ? `?${nextQuery}` : ""}`,
		);
	}, [
		subRow,
		isServerSide,
		hasExternalData,
		globalFilter,
		pagination,
		sorting,
		includeDeleted,
		chipValue,
		filterChips?.field,
		columnFilters,
		initialPageSize,
		pathname,
	]);

	// ── Build MRT column definitions ───────────────────────────
	// Hide `deletedAt` column unless the user chose to see deleted items.

	// Service-backed select-filter options (e.g. tiers) — collected once,
	// fetched under a single SWR key covering every endpoint.
	const serviceFilterSources = useMemo(
		() =>
			columnInstances
				.filter((col) => col.isActive !== false)
				.filter((col) => col.columnConfig?.filterType === "select")
				.filter((col) => col.columnConfig?.filterOptions?.type === "service")
				.map((col) => ({
					columnId: col.id,
					endpoint: col.columnConfig?.filterOptions?.endpoint ?? "",
					labelField:
						col.columnConfig?.filterOptions?.labelField ?? "displayName",
					valueField: col.columnConfig?.filterOptions?.valueField ?? "id",
				})),
		[columnInstances],
	);

	const { data: serviceOptions } = useSWR(
		serviceFilterSources.length
			? ["column-filter-options", serviceFilterSources.map((s) => s.endpoint)]
			: null,
		async ([, endpoints]: [string, string[]]) => {
			const entries = await Promise.all(
				endpoints.map(async (endpoint) => {
					const res = await getApiClient().get(endpoint);
					const items =
						res.data?.data?.data ?? res.data?.data ?? res.data ?? [];
					return [endpoint, Array.isArray(items) ? items : [items]];
				}),
			);
			return Object.fromEntries(entries);
		},
	);

	const columns = useMemo<MRT_ColumnDef<Record<string, unknown>>[]>(() => {
		const optionsByColumn = new Map<
			number,
			Array<{ label: string; value: string }>
		>();
		for (const src of serviceFilterSources) {
			const rows = (serviceOptions ?? {})[src.endpoint];
			if (!Array.isArray(rows)) continue;
			optionsByColumn.set(
				src.columnId,
				rows.map((row: any) => ({
					label: String(
						row[src.labelField] ?? row.displayName ?? row.name ?? "",
					),
					value: String(row[src.valueField] ?? row.id ?? ""),
				})),
			);
		}

		return columnInstances
			.filter((col) => col.isActive !== false)
			.filter((col) => includeDeleted || col.name !== "deletedAt")
			.sort((a, b) => a.displayOrder - b.displayOrder)
			.map((col) => {
				// Static options come straight from the column config; service
				// options come from the fetched rows.
				const staticOpts =
					col.columnConfig?.filterType === "select" &&
					col.columnConfig?.filterOptions?.type === "static"
						? (col.columnConfig.filterOptions.options ?? [])
						: undefined;
				return buildColumnDef(col, staticOpts ?? optionsByColumn.get(col.id));
			});
	}, [columnInstances, includeDeleted, serviceFilterSources, serviceOptions]);

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
			chipParams,
		});
		const suffix = otherQueryString ? `&${otherQueryString}` : "";
		return `${TABLE_DATA_KEY_PREFIX}${resolvedEndpoint}?${qs.toString()}${suffix}`;
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
		chipParams,
	]);

	// ── CSV export (UX-25) ─────────────────────────────────────
	// Runs over the SAME list endpoint and the SAME query builder as the
	// table, so tenant scope, search, column filters, chip and route params
	// all apply. It pages through the filtered result set (`limit` is the
	// export page size) instead of downloading only the visible page.
	const [exporting, setExporting] = useState(false);

	// ── Download the filtered rows as CSV (UX-25) ──────────────
	const exportCsv = useCallback(
		async (instance: MRT_TableInstance<Record<string, unknown>>) => {
			if (exporting || !isServerSide || hasExternalData) return;
			setExporting(true);
			try {
				// Only the columns the user can see right now — hiding a
				// column also keeps it out of the export.
				const exportColumns = instance
					.getVisibleLeafColumns()
					.filter((column) => !column.id.startsWith("mrt-row-"))
					.map((column) => {
						const def = column.columnDef as {
							accessorKey?: string;
							header?: unknown;
						};
						const accessor = String(def.accessorKey ?? column.id);
						return {
							accessor,
							header: typeof def.header === "string" ? def.header : accessor,
						};
					})
					.filter((column) => Boolean(column.accessor));

				const baseUrl = process.env.NEXT_PUBLIC_ENDPOINT ?? "";
				const sep = resolvedEndpoint.includes("?") ? "&" : "?";
				const suffix = otherQueryString ? `&${otherQueryString}` : "";
				const rows: Record<string, unknown>[] = [];
				let page = 1;
				let total: number | null = null;
				while (
					rows.length < EXPORT_MAX_ROWS &&
					page <= Math.ceil(EXPORT_MAX_ROWS / EXPORT_PAGE_SIZE)
				) {
					// Same builder as the visible fetch — export can never
					// disagree with the table about filters or scope.
					const qs = buildSearchParams({
						pagination,
						sorting,
						globalFilter,
						columnFilters,
						includeDeleted,
						searchableFields: settings.searchableFields,
						datasourceParams: datasource.params,
						pathParams: resolvedPathParams,
						chipParams,
						pageOverride: page,
						limitOverride: EXPORT_PAGE_SIZE,
					});
					const res = await getApiClient().get(
						`${baseUrl}${resolvedEndpoint}${sep}${qs.toString()}${suffix}`,
					);
					const inner = res.data?.data;
					if (Array.isArray(inner)) {
						// A flat (non-paginated) endpoint returns its whole list.
						rows.push(...(inner as Record<string, unknown>[]));
						break;
					}
					const pageRows: Record<string, unknown>[] = inner?.data ?? [];
					if (typeof inner?.total === "number") total = inner.total;
					rows.push(...pageRows);
					if (
						pageRows.length < EXPORT_PAGE_SIZE ||
						(total !== null && rows.length >= total)
					) {
						break;
					}
					page += 1;
				}

				// An empty filtered result still exports a header-only file,
				// exactly like the empty table the user is looking at.
				const csv = toCsv(exportColumns, rows.slice(0, EXPORT_MAX_ROWS));
				const stamp = new Date().toISOString().slice(0, 10);
				downloadCsv(`${tableMetadata.name || "table"}-${stamp}.csv`, csv);
			} catch (error) {
				await snack.error(error);
			} finally {
				setExporting(false);
			}
		},
		[
			exporting,
			isServerSide,
			hasExternalData,
			resolvedEndpoint,
			otherQueryString,
			pagination,
			sorting,
			globalFilter,
			columnFilters,
			includeDeleted,
			settings.searchableFields,
			datasource.params,
			resolvedPathParams,
			chipParams,
			snack,
			tableMetadata.name,
		],
	);

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
				pathParams: resolvedPathParams,
				chipParams,
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
	const sourceData = hasExternalData ? (externalData ?? []) : fetchedData;
	// A server-side table already applied the chip filter (and paged the
	// filtered set), so re-filtering here could only drop correct rows. A
	// client-side / externally supplied table has to filter its rows.
	const data = useMemo(() => {
		if (!filterChips?.field || !chipValue) return sourceData;
		if (isServerSide && !hasExternalData) return sourceData;
		return sourceData.filter(
			(row) => String(row[filterChips.field] ?? "") === chipValue,
		);
	}, [
		sourceData,
		filterChips?.field,
		chipValue,
		isServerSide,
		hasExternalData,
	]);

	// Some columns only apply to one kind of row (e.g. "Added" exists for a
	// manual group member, but is null for every rule-resolved member). Hiding
	// them only when the whole page is empty keeps the table honest without
	// making the audience mode part of the table schema.
	const visibleColumns = useMemo(() => {
		return columns.filter((column) => {
			if (!(column as { __hideWhenEmpty?: boolean }).__hideWhenEmpty) {
				return true;
			}
			const accessor = String(
				(column as { accessorKey?: string }).accessorKey ?? column.id ?? "",
			);
			return (data as Array<Record<string, unknown>>).some(
				(row) =>
					row[accessor] !== null &&
					row[accessor] !== undefined &&
					row[accessor] !== "",
			);
		});
	}, [columns, data]);

	// ── Pinned columns ─────────────────────────────────────────
	// The identity column stays at the logical START and the row-action menu
	// at the logical END, so both remain visible while the wide value columns
	// scroll. Pinning the first column also keeps the row's own identity in
	// view when the detail columns overflow at 1280px.
	const pinnedLeftColumnIds = useMemo(() => {
		const first = visibleColumns[0] as
			| { accessorKey?: string; id?: string }
			| undefined;
		const firstId = first?.accessorKey ?? first?.id;
		const ids = firstId ? [firstId] : [];
		// The selection checkbox leads the row and must stay visible with it.
		return selection?.enabled || (tableMetadata.bulkActions ?? []).length > 0
			? ["mrt-row-select", ...ids]
			: ids;
	}, [visibleColumns, selection?.enabled, tableMetadata.bulkActions]);

	// Additional pins the user chose from the column menu. The two edges above
	// are always merged back in, so a user action can never hide the row
	// actions or the identity column.
	const [userColumnPinning, setUserColumnPinning] =
		useState<MRT_ColumnPinningState>({});
	const columnPinning = useMemo<MRT_ColumnPinningState>(
		() => ({
			left: Array.from(
				new Set([...pinnedLeftColumnIds, ...(userColumnPinning.left ?? [])]),
			),
			right: Array.from(
				new Set([...(userColumnPinning.right ?? []), "mrt-row-actions"]),
			),
		}),
		[userColumnPinning, pinnedLeftColumnIds],
	);

	// ── Permission check ──────────────────────────────────────
	const can = useCan();
	const { data: user } = useRenderUser();
	const userPermissions: Array<{ resource: string; scope?: string }> =
		(user as any)?.permissions?.data ?? [];
	const workspaceTier = resolveTier(user as any);

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
						)) &&
					checkTier((a as any).requiredTier, workspaceTier) &&
					(!(a as any).requiresFeature || features[(a as any).requiresFeature]),
			),
		[
			tableMetadata.toolbarActions ?? [],
			checkPermission,
			userPermissions,
			workspaceTier,
			features,
		],
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
						)) &&
					checkTier((a as any).requiredTier, workspaceTier) &&
					(!(a as any).requiresFeature || features[(a as any).requiresFeature]),
			),
		[
			tableMetadata.toolbarActions,
			checkPermission,
			userPermissions,
			workspaceTier,
			features,
		],
	);

	// ── Bulk actions (UX-25) ───────────────────────────────────
	// Declared by the seed; the selection column and the bulk bar only exist
	// while this list is non-empty. Gated exactly like a toolbar action.
	const bulkActions = useMemo<TableBulkAction[]>(
		() =>
			subRow
				? []
				: (tableMetadata.bulkActions ?? []).filter(
						(action) =>
							Boolean(action.endpoint) &&
							(!action.permissions?.length ||
								action.permissions.some(checkPermission)) &&
							(!action.visibleToPermissions?.length ||
								checkComponentPermission(
									userPermissions,
									action.visibleToPermissions,
								)) &&
							checkTier(action.requiredTier, workspaceTier) &&
							(!action.requiresFeature || features[action.requiresFeature]),
					),
		[
			subRow,
			tableMetadata.bulkActions,
			checkPermission,
			userPermissions,
			workspaceTier,
			features,
		],
	);
	const hasRowSelection =
		(selection?.enabled ?? false) || bulkActions.length > 0;

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
				// Row-derived dialog extras (CRM-27): a shortcut prefills the form it
				// opens. `rowFields` copies row values onto form fields (rename-friendly);
				// `extra` adds constants, and a `"{rowKey}"` placeholder in one resolves
				// against the row like any other action. Both land in pathParams, which
				// FormRenderer applies to nested (dotted) field names.
				const rowExtras: Record<string, string> = {};
				const rowFieldSpec = action.dialog.rowFields;
				if (row && rowFieldSpec) {
					if (Array.isArray(rowFieldSpec)) {
						for (const field of rowFieldSpec) {
							if (row[field] !== undefined && row[field] !== null) {
								rowExtras[field] = String(row[field]);
							}
						}
					} else {
						for (const [formField, rowField] of Object.entries(rowFieldSpec)) {
							const value = row[rowField];
							if (value !== undefined && value !== null) {
								rowExtras[formField] = String(value);
							}
						}
					}
				}

				for (const [key, value] of Object.entries(action.dialog.extra ?? {})) {
					rowExtras[key] =
						typeof value === "string"
							? resolveRowPlaceholders(value, row)
							: String(value);
				}

				const extraObj = {
					_actionId: action.id,
					...resolvedPathParams,
					...(row ? { id: row.id as string } : {}),
					...rowExtras,
				};
				setDialogState(
					action.dialog.context ?? "edit",
					row ? String(row.id ?? "") : "",
					action.dialog.componentId ?? action.dialog.formId ?? "",
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
						// A title the admin must retype (CRM-13): resolve `{title}` from the
						// row here, so the dialog never has to guess.
						...(action.confirm.confirmByTitle
							? {
									confirmByTitle: resolveRowPlaceholders(
										action.confirm.confirmByTitle,
										row,
									),
								}
							: {}),
						successRedirect: action.successRedirect,
						// A static body (e.g. PATCH { isActive: false }) must survive the
						// confirmation step, not just the direct path (CRM-28).
						...(action.body ? { body: action.body } : {}),
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
				} else if (row) {
					// Row-level custom actions carry the row so the host (TableRenderer)
					// can open app-specific dialogs (e.g. view QR code).
					onRowAction?.(action.customAction ?? action.id, row);
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

	/**
	 * The detail route a row opens when the table declares one — the
	 * `navigate` target, or the legacy `redirect` template (feature-gated
	 * fallback included). Returns undefined when a row click opens a dialog or
	 * fires an API call: only a real destination is a link, so middle-click
	 * and keyboard open cannot invent one.
	 */
	const resolveRowHref = useCallback(
		(row: Record<string, unknown>): string | undefined => {
			const onClick = tableMetadata.onRowClick;
			if (!onClick) return undefined;
			if (onClick.action === "navigate" && onClick.path) {
				return resolveRowPlaceholders(onClick.path.replace(/^~\//, "/"), row);
			}
			if (onClick.action === "openDialog" || onClick.action === "apiCall") {
				return undefined;
			}
			// Legacy redirect/endpoint format.
			let redirect = onClick.redirect;
			if (!redirect) return undefined;
			// Feature-gated navigation: when the flag is OFF and the row carries
			// a default version, use the fallback target instead.
			const versions = (row.versions ?? row.serviceVersions) as
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
			return resolveRowPlaceholders(redirect.replace(/^~\//, "/"), row);
		},
		[tableMetadata.onRowClick, resolveRowPlaceholders, features],
	);

	// ── Build the MRT instance ─────────────────────────────────
	// Row actions pin to the logical END of the table — the right edge
	// in LTR, the left edge in RTL. MRT treats pinning sides as logical
	// and flips them for RTL tables, so "right" pins to the visual end
	// in BOTH directions.

	/**
	 * The actions this row can see. Used by the action menu AND by the phone
	 * card, so the two presentations cannot drift apart.
	 */
	const visibleRowActions = useCallback(
		(row: Record<string, unknown>): TableAction[] =>
			(tableMetadata.rowActions ?? []).filter((action) => {
				// Feature-flag gating (e.g. staging actions only when enabled)
				if (action.requiresFeature && !features[action.requiresFeature]) {
					return false;
				}
				// Tier gating (e.g. team-only actions)
				if (!checkTier((action as any).requiredTier, workspaceTier)) {
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
					const fieldValue = row[field];
					switch (operator) {
						case "eq":
							return fieldValue === value;
						case "ne":
							return fieldValue !== value;
						case "in":
							// The authoring DSL's ConditionOperator includes
							// "in" (a list of accepted values) — e.g. the
							// campaign Schedule action on draft OR paused.
							return Array.isArray(value) && value.includes(fieldValue);
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
			}),
		[
			tableMetadata.rowActions,
			features,
			workspaceTier,
			checkPermission,
			userPermissions,
		],
	);

	/** Run a row action through the same dispatcher the menu uses. */
	const dispatchAction = useCallback(
		(action: TableAction, row?: Record<string, unknown>) => {
			if (
				action.action === "openDialog" ||
				action.action === "navigate" ||
				action.action === "apiCall" ||
				action.action === "custom"
			) {
				handleAction(action, row);
				return;
			}
			if ("redirect" in action && action.redirect) {
				handleRedirect(action.redirect, row);
				return;
			}
			if (row) onRowAction?.(action.id, row);
		},
		[handleAction, handleRedirect, onRowAction],
	);

	// ── Bulk action execution (UX-25) ──────────────────────────
	const [pendingBulkAction, setPendingBulkAction] = useState<{
		action: TableBulkAction;
		rows: Record<string, unknown>[];
	} | null>(null);
	const [bulkRunningId, setBulkRunningId] = useState<string | null>(null);

	/** The selected rows, in the current page's order. */
	const selectedRows = useCallback(
		(): Record<string, unknown>[] =>
			Object.keys(rowSelection)
				.filter((key) => rowSelection[key])
				.map((key) => data[Number(key)])
				.filter(Boolean) as Record<string, unknown>[],
		[rowSelection, data],
	);

	const clearSelection = useCallback(() => {
		setRowSelection({});
		onSelectionChange?.([]);
	}, [onSelectionChange]);

	// A selection belongs to the page/filters it was made on: MRT keeps
	// row-index state across pages, so carrying it would let a bulk action
	// hit a different row than the one the user ticked.
	// biome-ignore lint/correctness/useExhaustiveDependencies: these are the triggers that change the result set, not reads in the callback
	useEffect(() => {
		setRowSelection({});
	}, [
		pagination.pageIndex,
		pagination.pageSize,
		sorting,
		globalFilter,
		columnFilters,
		chipValue,
		includeDeleted,
	]);

	/**
	 * Run one request per selected row, in small batches. A non-toggle action
	 * sends its static body; a toggle action sends the inverse of the row's
	 * own field, so the same action is also the undo.
	 */
	const executeBulkAction = useCallback(
		async (action: TableBulkAction, rows: Record<string, unknown>[]) => {
			setBulkRunningId(action.id);
			try {
				const baseUrl = process.env.NEXT_PUBLIC_ENDPOINT ?? "";
				const batchSize = 10;
				for (let index = 0; index < rows.length; index += batchSize) {
					await Promise.all(
						rows.slice(index, index + batchSize).map((row) => {
							const payload = action.toggleField
								? { [action.toggleField]: !row[action.toggleField] }
								: action.body;
							return getApiClient().request({
								url: `${baseUrl}${resolveRowPlaceholders(action.endpoint, row)}`,
								method: action.method ?? "PATCH",
								...(payload ? { data: payload } : {}),
							});
						}),
					);
				}
				clearSelection();
				await mutate();
			} catch (error) {
				await snack.error(error);
			} finally {
				setBulkRunningId(null);
				setPendingBulkAction(null);
			}
		},
		[resolveRowPlaceholders, clearSelection, mutate, snack],
	);

	const requestBulkAction = useCallback(
		(action: TableBulkAction, rows: Record<string, unknown>[]) => {
			if (action.confirm) {
				setPendingBulkAction({ action, rows });
				return;
			}
			executeBulkAction(action, rows);
		},
		[executeBulkAction],
	);

	/**
	 * The label/icon/colour a toggle action shows for this selection: while
	 * every selected row is already off, it offers the inverse (undo)
	 * direction ("Activate" after "Deactivate").
	 */
	const bulkActionView = useCallback(
		(action: TableBulkAction, rows: Record<string, unknown>[]) => {
			const inverse =
				Boolean(action.toggleField) &&
				rows.length > 0 &&
				rows.every((row) => !row[action.toggleField as string]);
			return {
				label: inverse ? (action.labelOff ?? action.label) : action.label,
				icon: inverse ? (action.iconOff ?? action.icon) : action.icon,
				color: inverse ? (action.colorOff ?? action.color) : action.color,
			};
		},
		[],
	);

	// ── Empty state (UX-24) ────────────────────────────────────
	// A table's DSL `emptyState` explains what belongs here and offers the
	// first action; when a search/filter is active the filtered variant offers
	// "clear filters" instead. A table without one keeps MRT's generic
	// "No records to display", and filtering still distinguishes itself with
	// MRT's own "No results found" copy.
	const emptyState = tableMetadata.emptyState ?? null;

	/** Whether a search, column filter or chip narrows the list right now. */
	const hasActiveFilters = useCallback(
		(instance: MRT_TableInstance<Record<string, unknown>>): boolean => {
			const state = instance.getState();
			return (
				Boolean(state.globalFilter?.trim()) ||
				(state.columnFilters ?? []).some(
					(filter) => filter.value !== "" && filter.value != null,
				) ||
				Boolean(chipValue)
			);
		},
		[chipValue],
	);

	/**
	 * Clear every filter the user set — search, column filters and the chip
	 * row — and start again at the first page. The MRT instance is cleared as
	 * well, because a client-side table keeps its filters inside MRT rather
	 * than in the controlled server-side state.
	 */
	const clearFilters = useCallback(
		(instance: MRT_TableInstance<Record<string, unknown>>) => {
			instance.setGlobalFilter("");
			instance.setColumnFilters([]);
			setGlobalFilter("");
			setColumnFilters([]);
			setChipValue(null);
			setPagination((previous) => ({ ...previous, pageIndex: 0 }));
		},
		[],
	);

	/**
	 * The empty table body. Returns `undefined` when the table has no
	 * `emptyState` (or no filtered copy) so MRT paints its own default, and
	 * `null` while a fetch is in flight so the tailored state does not flash
	 * before the first page arrives.
	 */
	const renderEmptyState = useCallback(
		(
			instance: MRT_TableInstance<Record<string, unknown>>,
		): ReactNode | undefined => {
			if (isServerSide && isLoading) return null;
			if (!emptyState) return undefined;

			if (hasActiveFilters(instance)) {
				const filtered = emptyState.filtered;
				if (!filtered) return undefined;
				return (
					<Stack spacing={1.5} sx={{ alignItems: "center", py: 6, px: 2 }}>
						<Box sx={{ color: "text.disabled", display: "flex" }}>
							<TableIcon name={filtered.icon ?? "Search"} size={42} />
						</Box>
						<Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
							{filtered.title}
						</Typography>
						{filtered.description ? (
							<Typography
								variant="body2"
								color="text.secondary"
								sx={{ maxWidth: 420, textAlign: "center" }}
							>
								{filtered.description}
							</Typography>
						) : null}
						<Button
							size="small"
							variant="outlined"
							startIcon={<TableIcon name="FilterList" size={18} />}
							onClick={() => clearFilters(instance)}
						>
							{filtered.clearLabel}
						</Button>
					</Stack>
				);
			}

			// The primary action must be visible on the toolbar. An action the
			// user's permission, tier or feature flags hide is not offered here.
			const primary = topActions.find(
				(action) => action.id === String(emptyState.action ?? ""),
			);

			return (
				<Stack spacing={1.5} sx={{ alignItems: "center", py: 6, px: 2 }}>
					{emptyState.icon ? (
						<Box sx={{ color: "text.disabled", display: "flex" }}>
							<TableIcon name={emptyState.icon} size={42} />
						</Box>
					) : null}
					<Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
						{emptyState.title}
					</Typography>
					{emptyState.description ? (
						<Typography
							variant="body2"
							color="text.secondary"
							sx={{ maxWidth: 420, textAlign: "center" }}
						>
							{emptyState.description}
						</Typography>
					) : null}
					{primary ? (
						<Button
							variant="contained"
							size="small"
							color={(primary.color as any) ?? "primary"}
							startIcon={
								primary.icon ? (
									<TableIcon name={primary.icon} size={18} />
								) : undefined
							}
							onClick={() => dispatchAction(primary)}
						>
							{primary.label}
						</Button>
					) : null}
					{emptyState.prerequisite ? (
						<Link
							href={emptyState.prerequisite.href}
							variant="body2"
							underline="hover"
							sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
							onClick={(event) => {
								event.preventDefault();
								push(emptyState.prerequisite?.href ?? "/");
							}}
						>
							<TableIcon name="ArrowForward" size={16} />
							{emptyState.prerequisite.label}
						</Link>
					) : null}
				</Stack>
			);
		},
		[
			emptyState,
			hasActiveFilters,
			clearFilters,
			topActions,
			dispatchAction,
			isServerSide,
			isLoading,
			push,
		],
	);

	const table = useMaterialReactTable({
		// MRT paints its table paper with `background.default` (the page
		// colour), which reads as a white sheet dropped on a themed card.
		// Use the theme's paper surface so the table sits on the same surface
		// as the card it lives in, and picks up any palette change.
		mrtTheme: {
			baseBackgroundColor: muiTheme.palette.background.paper,
		},

		muiTableHeadRowProps() {
			return { sx: { boxShadow: "none" } };
		},

		// ── Core ────────────────────────────────────────────────
		columns: visibleColumns,
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
			// Both edges are pinned: the identity column at the logical START,
			// the row-action menu at the logical END; MRT flips "left"/"right"
			// for RTL tables, so each stays at its visual edge in either
			// direction. The action menu therefore never scrolls out of view,
			// while the first column keeps identifying each row.
			columnPinning,
		},

		// Pinning is what makes the actions reachable at 1280px: the right
		// column stays sticky over the horizontally scrolling value columns.
		// (MRT's `enableColumnPinning` default is false, so the state alone
		// would be ignored.)
		enableColumnPinning: true,
		// Keep the column menu's pin buttons working; the two mandatory pins
		// are merged back in by `columnPinning` above.
		onColumnPinningChange: setUserColumnPinning,

		// ── Manual (server-side) controllers ───────────────────
		manualPagination: isServerSide,
		manualSorting: isServerSide,
		// A server-side table has already had its filtering applied by the
		// request (the builder sends both `search` and every column filter),
		// so re-applying it client-side can only ever REMOVE rows the server
		// correctly returned. Global search is the visible case: searching
		// `0912 555 4242` matches the normalized `+989125554242` on the
		// server, but the raw term does not contain the stored value, so the
		// client filter emptied a one-row response into "No results found".
		// Matches manualPagination/manualSorting: trust the server.
		manualFiltering: isServerSide,
		rowCount: isServerSide ? rowCount : undefined,
		onPaginationChange: isServerSide ? setPagination : undefined,
		onSortingChange: isServerSide ? setSorting : undefined,
		onGlobalFilterChange: isServerSide ? setGlobalFilter : undefined,
		onColumnFiltersChange: isServerSide ? setColumnFilters : undefined,

		// ── Page size options from the contract ────────────────
		paginationDisplayMode: "pages",
		// Honour a seeded override's options — a deliberate page size outside
		// MRT's defaults (e.g. 31 calendar days) would otherwise select blank.
		...(datasource.pagination?.pageSizeOptions?.length
			? {
					muiPaginationProps: {
						rowsPerPageOptions: datasource.pagination.pageSizeOptions,
					},
				}
			: {}),

		// ── Initial state (density) ────────────────────────────
		initialState: {
			density: toMrtDensity(settings.density),
			// Client-side tables use MRT's initial state (server-side tables are
			// controlled above); both start at the platform page size so a
			// client-side list cannot drift to MRT's default of 10.
			pagination: {
				pageIndex: 0,
				pageSize: initialPageSize,
			},
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
		// Enabled by an explicit `selection` config OR by declaring bulk
		// actions — a bulk bar without a selection column would be unusable.
		enableRowSelection: hasRowSelection,
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
				// Fixed width — the actions column holds icon buttons only.
				size: 50,
				// grow:0 stops MRT's proportional flex growth (columns grow to
				// fill the table when there are few columns).
				grow: 0,
				// Center the actions icon within the column. MRT hardcodes
				// ml:10px on the toggle button — reset it so the icon truly
				// centers in the fixed-width column. A subtle edge shadow marks
				// the pinned column as floating over the scrolling content.
				// The app's RTL cache plugin (cssjanus) flips box-shadow
				// x-offsets, so a single source value renders on the CONTENT
				// side in both directions: LTR → -4px (left edge), RTL → +4px
				// (right edge). MRT's own pinned :before shadow assumes LTR —
				// suppress it so only ours shows.
				muiTableBodyCellProps: {
					align: "center",
					sx: {
						"& .MuiIconButton-root": { ml: "0 !important" },
						"&[data-pinned='true']:before": { boxShadow: "none" },
						boxShadow: "-4px 0 8px -4px rgba(0, 0, 0, 0.08)",
					},
				},
				muiTableHeadCellProps: {
					align: "center",
				},
			},
		},
		renderRowActionMenuItems: ({ closeMenu, row, table }) =>
			visibleRowActions(row.original).map((action) => (
				<MRT_ActionMenuItem
					key={action.id}
					label={action.label}
					icon={
						action.icon ? <TableIcon name={action.icon} size={18} /> : undefined
					}
					table={table}
					onClick={() => {
						dispatchAction(action, row.original);
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
			: ({ table: instance }) => {
					const selectedCount =
						Object.values(rowSelection).filter(Boolean).length;
					const selectionToolbarActions = (
						tableMetadata.toolbarActions ?? []
					).filter(
						(a) => a.action === "linkSelected" || a.action === "unlinkSelected",
					);
					const showExport =
						isServerSide && !hasExternalData && Boolean(settings.exportable);

					if (
						selectedCount > 0 &&
						(bulkActions.length > 0 || selectionToolbarActions.length > 0)
					) {
						const rows = selectedRows();
						return (
							<Stack
								direction="row"
								spacing={1}
								sx={{
									width: "auto",
									gap: 1,
									flexWrap: "wrap",
									alignItems: "center",
									alignSelf: "center",
									"& .MuiButton-root": {
										width: "auto",
										flexShrink: 0,
										whiteSpace: "nowrap",
									},
								}}
							>
								<Chip
									label={`${selectedCount} selected`}
									size="small"
									color="primary"
								/>
								{bulkActions.map((action) => {
									const view = bulkActionView(action, rows);
									return (
										<Button
											key={action.id}
											variant="contained"
											size="small"
											color={(view.color as any) ?? "primary"}
											disabled={Boolean(bulkRunningId)}
											startIcon={
												view.icon ? (
													<TableIcon name={view.icon} size={18} />
												) : undefined
											}
											onClick={() => requestBulkAction(action, rows)}
										>
											{view.label}
										</Button>
									);
								})}
								{selectionToolbarActions.map((action) => (
									<Button
										key={action.id}
										variant="contained"
										size="small"
										color={(action.color as any) ?? "primary"}
										startIcon={
											action.icon ? <TableIcon name={action.icon} /> : undefined
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
								<Tooltip title="Clear selection">
									<IconButton
										size="small"
										onClick={clearSelection}
										sx={{ alignSelf: "center" }}
									>
										<TableIcon name="Close" />
									</IconButton>
								</Tooltip>
							</Stack>
						);
					}

					return (
						<>
							<Stack
								spacing={0.5}
								sx={{
									width: "auto",
									gap: 1,
									flexDirection: "row",
									flexWrap: "wrap",
									alignItems: "center",
									alignSelf: "center",
									"& .MuiButton-root": {
										width: "auto",
										flexShrink: 0,
										whiteSpace: "nowrap",
									},
								}}
							>
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
												action.icon ? (
													<TableIcon name={action.icon} />
												) : undefined
											}
											onClick={() => dispatchAction(action)}
										>
											{action.label}
										</Button>
									))}
								{showExport ? (
									<Button
										variant="outlined"
										size="small"
										color="inherit"
										disabled={exporting}
										startIcon={<TableIcon name="Download" size={18} />}
										onClick={() => exportCsv(instance)}
									>
										{settings.exportLabel ?? "Export CSV"}
									</Button>
								) : null}
							</Stack>
							{internalActions.length > 0 ? (
								<Stack
									direction="row"
									spacing={0.5}
									sx={{
										flexShrink: 0,
										alignItems: "center",
										alignSelf: "center",
									}}
								>
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
														} else if (
															action.customAction === "toggleDeleted"
														) {
															setIncludeDeleted((v) => !v);
														} else if (action.customAction === "refreshData") {
															mutate();
														} else if (action.redirect) {
															handleRedirect(action.redirect);
														}
													}}
												>
													{action.icon ? (
														<TableIcon name={action.icon} />
													) : null}
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
							) : null}
						</>
					);
				},

		// UX-24 — a configured empty state replaces MRT's generic copy. When
		// the table has none, returning undefined keeps "No records to
		// display" (and MRT's own "No results found" while filtering).
		renderEmptyRowsFallback: ({ table: instance }) =>
			renderEmptyState(instance),

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
		muiTopToolbarProps: subRow
			? { sx: { display: "none" } }
			: {
					// The action row must wrap instead of pushing the internal
					// toolbar buttons (search, columns, density) off a phone.
					sx: { "& > div": { flexWrap: "wrap", rowGap: 1 } },
				},
		muiBottomToolbarProps: subRow ? { sx: { display: "none" } } : undefined,

		// ── Paper / outer wrapper ───────────────────────────────
		muiTablePaperProps: {
			elevation: 0,
			sx: {
				border: settings.bordered ? "1px solid" : "none",
				borderColor: "divider",
				// The panel draws the border, so the radius has to live here —
				// a radius on the container alone is clipped by this surface.
				// Passed as a string: `sx` multiplies a numeric `borderRadius`
				// by `shape.borderRadius`, which would give 4 units × 4 = 64px.
				borderRadius: `${Number(muiTheme.shape.borderRadius) * 4}px`,
				// Clip the flush table so its square cell corners cannot poke
				// out of the rounded panel.
				overflow: "hidden",
				// Never let the panel's min-content width push the page
				// sideways on a phone: the value columns scroll INSIDE the
				// card (see muiTableContainerProps), not the whole page.
				maxWidth: "100%",
				minWidth: 0,
			},
		},

		// The table sits flush inside the paper, so the concentric rule makes
		// the inner radius equal the outer one. The container is left to the
		// theme (`MuiTableContainer` uses the same box tier) instead of
		// restating a radius here, which only drifted from it.
		muiTableContainerProps: {
			// Horizontal scroll inside the card: the minimum a DSL table owes
			// a phone at 375px. MRT already sets overflow:auto; the explicit
			// max-width is what stops a wide column set from widening the page.
			// `sx`, not a Tailwind class: this package is not scanned by the
			// front's Tailwind build.
			sx: { maxWidth: "100%", overflowX: "auto" },
		},

		// ── Rows ────────────────────────────────────────────────
		muiTableBodyRowProps: ({ row }) => {
			const onClick = tableMetadata.onRowClick;
			// The detail route this row declares, when the table declares one.
			// Only a navigation yields a URL — openDialog/apiCall rows stay
			// click-only, so a middle click cannot open a page that does not exist.
			const detailHref = resolveRowHref(row.original);

			const handleRowClick = () => {
				if (!onClick) return;
				// Skip navigation if a dialog was just closed (avoid stray clicks)
				if (document.querySelector(".MuiDialog-root")) return;

				// New action-discriminant format: navigate / apiCall / openDialog
				if (onClick.action === "navigate" && onClick.path) {
					if (detailHref) push(detailHref);
					return;
				}
				if (onClick.action === "apiCall" && onClick.endpoint) {
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
					return;
				}
				if (onClick.action === "openDialog" && onClick.dialog) {
					const extraObj = {
						_actionId: "onRowClick",
						...resolvedPathParams,
						id: String(row.original.id ?? ""),
					};
					setDialogState(
						onClick.dialog.context ?? "edit",
						String(row.original.id ?? ""),
						String(onClick.dialog.componentId ?? ""),
						JSON.stringify(extraObj),
					);
					return;
				}

				// Legacy redirect/endpoint format. The redirect — including its
				// feature-gated fallback — is resolved once by `resolveRowHref`.
				if (onClick.redirect) {
					if (detailHref) push(detailHref);
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
			const matchedCondition = (settings.rowConditions ?? []).find((c) =>
				matchRowCondition(row.original, c),
			);

			return {
				sx: {
					cursor: onClick ? "pointer" : undefined,
					// Rows sit on the table's surface, not on a hardcoded white
					// sheet — the theme's paper colour keeps the table on the
					// same surface as the card it lives in.
					backgroundColor:
						matchedCondition?.backgroundColor ??
						muiTheme.palette.background.paper,
					// A detail row is keyboard focusable; show where focus is.
					...(detailHref
						? {
								"&:focus-visible": {
									outline: `2px solid ${muiTheme.palette.primary.main}`,
									outlineOffset: "-2px",
								},
							}
						: {}),
				},
				className: matchedCondition?.className,
				// A row with a detail route behaves like a link: focusable, Enter
				// opens it, middle-click opens it in a new tab. Clicks on the
				// row's own controls (action menu, selection checkbox, cell
				// widgets) are excluded, so those keep working without navigating.
				...(detailHref
					? {
							tabIndex: 0,
							onKeyDown: (event: ReactKeyboardEvent<HTMLTableRowElement>) => {
								if (event.key !== "Enter") return;
								// Enter belongs to a focused control (action button,
								// link, checkbox); on the row or one of its cells it
								// opens the detail route. MRT makes cells focusable,
								// so the event usually targets a cell, not the row.
								if (isRowControlTarget(event.target)) return;
								event.preventDefault();
								handleRowClick();
							},
							onAuxClick: (event: ReactMouseEvent<HTMLTableRowElement>) => {
								if (event.button !== 1) return;
								if (isRowControlTarget(event.target)) return;
								event.preventDefault();
								window.open(detailHref, "_blank", "noopener,noreferrer");
							},
						}
					: {}),
				onClick: onClick
					? (event: ReactMouseEvent<HTMLTableRowElement>) => {
							if (isRowControlTarget(event.target)) return;
							handleRowClick();
						}
					: undefined,
			};
		},
	});

	/**
	 * The phone presentation (opt-in through `settings.mobileCard`). A wide
	 * DSL table can always scroll sideways inside its card, but the job (find
	 * a row, read its status, act on it) is better served by a short card:
	 * title, subtitle, status, row actions — nothing else.
	 */
	const mobileCard = subRow ? null : (settings.mobileCard ?? null);
	const cardValue = (
		row: Record<string, unknown>,
		accessor?: string,
	): string => {
		if (!accessor) return "";
		const value = row[accessor];
		if (value === null || value === undefined) return "";
		if (typeof value === "boolean") return value ? "Yes" : "No";
		if (typeof value === "object") return JSON.stringify(value);
		return String(value);
	};

	// ── Filter chips (category-style) ──────────────────────────
	// Shown above both presentations. Clicking the active chip clears the
	// filter, so there is no separate "All" caption to translate.
	const chipsRow =
		filterChips && (chipOptions?.length ?? 0) > 0 ? (
			<Box
				sx={{
					display: "flex",
					flexWrap: "wrap",
					alignItems: "center",
					gap: 1,
					mb: 1,
				}}
			>
				{chipOptions?.map((option) => {
					const selected = chipValue === option.value;
					return (
						<Chip
							key={option.value}
							label={option.label}
							size="small"
							color={selected ? "primary" : "default"}
							variant={selected ? "filled" : "outlined"}
							onClick={() => selectChip(selected ? null : option.value)}
						/>
					);
				})}
			</Box>
		) : null;

	if (isPhone && mobileCard) {
		return (
			<Stack spacing={1}>
				{chipsRow}
				{data.length === 0
					? // UX-24 — the phone card shows the same contextual (or
						// filtered) empty state as the table body; without one it
						// keeps MRT's own copy. `undefined` means "no configured
						// state"; `null` means "fetching, show nothing".
						(() => {
							const node = renderEmptyState(table);
							if (node !== undefined) return node;
							return (
								<Typography
									variant="body2"
									color="text.secondary"
									sx={{ py: 4, textAlign: "center" }}
								>
									{hasActiveFilters(table)
										? (table.options.localization?.noResultsFound ??
											"No results found")
										: (table.options.localization?.noRecordsToDisplay ??
											"No records to display")}
								</Typography>
							);
						})()
					: data.map((row, index) => {
							const actions =
								mobileCard.actions === false ? [] : visibleRowActions(row);
							const status = cardValue(row, mobileCard.status);
							const href = resolveRowHref(row);
							return (
								<Box
									key={String(row.id ?? index)}
									onClick={href ? () => push(href) : undefined}
									sx={{
										p: 1.5,
										border: "1px solid",
										borderColor: "divider",
										borderRadius: 2,
										bgcolor: "background.paper",
										cursor: href ? "pointer" : undefined,
									}}
								>
									<Stack
										direction="row"
										spacing={1}
										sx={{
											alignItems: "flex-start",
											justifyContent: "space-between",
										}}
									>
										<Box sx={{ minWidth: 0, flex: 1 }}>
											<Typography
												sx={{
													fontWeight: 600,
													overflow: "hidden",
													textOverflow: "ellipsis",
													whiteSpace: "nowrap",
												}}
											>
												{cardValue(row, mobileCard.title)}
											</Typography>
											{mobileCard.subtitle ? (
												<Typography
													variant="body2"
													color="text.secondary"
													sx={{
														overflow: "hidden",
														textOverflow: "ellipsis",
														whiteSpace: "nowrap",
													}}
												>
													{cardValue(row, mobileCard.subtitle)}
												</Typography>
											) : null}
										</Box>
										{status ? (
											<Chip size="small" variant="outlined" label={status} />
										) : null}
										{actions.length > 0 ? (
											<Stack direction="row" spacing={0.5}>
												{actions.map((action) => (
													<Tooltip key={action.id} title={action.label}>
														<IconButton
															size="small"
															color={(action.color as any) ?? "default"}
															onClick={(event) => {
																event.stopPropagation();
																dispatchAction(action, row);
															}}
														>
															{action.icon ? (
																<TableIcon name={action.icon} />
															) : null}
														</IconButton>
													</Tooltip>
												))}
											</Stack>
										) : null}
									</Stack>
								</Box>
							);
						})}
			</Stack>
		);
	}

	return (
		<Box>
			{chipsRow}
			<MaterialReactTable table={table} />
			{/* UX-25 — a bulk action may declare a confirmation (destructive). */}
			<Dialog
				open={Boolean(pendingBulkAction)}
				onClose={() => {
					if (!bulkRunningId) setPendingBulkAction(null);
				}}
				maxWidth="xs"
				fullWidth
			>
				<DialogTitle>
					{pendingBulkAction?.action.confirm?.title ??
						pendingBulkAction?.action.label}
				</DialogTitle>
				<DialogContent>
					<DialogContentText>
						{pendingBulkAction?.action.confirm?.message}
					</DialogContentText>
				</DialogContent>
				<DialogActions>
					<Button
						disabled={Boolean(bulkRunningId)}
						onClick={() => setPendingBulkAction(null)}
					>
						Cancel
					</Button>
					<Button
						variant="contained"
						color="error"
						disabled={Boolean(bulkRunningId)}
						onClick={() => {
							if (pendingBulkAction) {
								executeBulkAction(
									pendingBulkAction.action,
									pendingBulkAction.rows,
								);
							}
						}}
					>
						{pendingBulkAction?.action.label}
					</Button>
				</DialogActions>
			</Dialog>
		</Box>
	);
}
