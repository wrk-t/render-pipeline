// ═══════════════════════════════════════════════════════════════
// DynamicTable – renders a metadata-driven data table with
// @tanstack/react-table v8, semantic HTML and Tailwind tokens.
//
// Supports two modes:
//   1. Server-side (default) — fetches data from the endpoint
//      defined in TableMetadata.datasource. Pagination, sorting and
//      filtering are forwarded to the API (`manual*` controllers).
//   2. Client-side — accepts data via the `data` prop and sorts /
//      filters / paginates it in the browser.
//
// The public API (DynamicTableProps / DynamicTableColumn) and every
// callback contract is unchanged from the previous implementation. The grid
// is a real <table>, the filter row is native inputs/selects, the toolbar is
// buttons, and the bulk confirmation is a native <dialog>.
// ═══════════════════════════════════════════════════════════════
"use client";

import {
	type CellContext,
	type Column,
	type ColumnDef,
	type ColumnFiltersState,
	type FilterFn,
	type OnChangeFn,
	type PaginationState,
	type RowSelectionState,
	type SortingState,
	type Table as TanStackTable,
	type VisibilityState,
	flexRender,
	functionalUpdate,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
	type ButtonHTMLAttributes,
	type ChangeEvent,
	type KeyboardEvent as ReactKeyboardEvent,
	type MouseEvent as ReactMouseEvent,
	type ReactElement,
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
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
	TableDensity,
	TableMetadata,
	TableRowCondition,
} from "../dynamic-form/types";
import { useFeatures } from "../hooks/useFeatures";
import { useResolvedParams } from "../hooks/useResolvedParams";
import { useSnack } from "../hooks/useSnack";
import type { QueryParams } from "../query-builder";
import { resolveUrlTemplate } from "../query-builder";
import { columnCellRenderers } from "../renderers/columnCellRenderers";
import { useDateRange } from "../renderers/DateRangeContext";
import { TABLE_DATA_KEY_PREFIX } from "../renderers/SwitchCell";
import { TextCell } from "../renderers/TextCell";
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
	/** The field name in the response data (the table accessor). */
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
	 * panels: no pagination, no toolbar, no search/filters, no sticky header.
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
// Constants
// ─────────────────────────────────────────────────────────────

/**
 * Platform default rows per page. A table may override it in its seed only
 * with a recorded reason (e.g. a month of calendar days), so page size no
 * longer drifts per screen (25 / 50 / 100 / 10).
 */
const DEFAULT_PAGE_SIZE = 25;

/** Page size choices when the seed does not declare any. */
const DEFAULT_PAGE_SIZE_OPTIONS = [5, 10, 15, 20, 25, 30, 50, 100];

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

/** The synthetic columns that bookend the data columns. */
const SELECT_COLUMN_ID = "__select";
const ACTIONS_COLUMN_ID = "__actions";
/** Width of the selection column — the first data column sticks after it. */
const SELECT_COLUMN_WIDTH = 40;
/** Width of the row-actions column. */
const ACTIONS_COLUMN_WIDTH = 50;

/** Tailwind `start-*` offset that clears the sticky selection column. */
const STICKY_FIRST_COLUMN_OFFSET = "start-10";

// ─────────────────────────────────────────────────────────────
// Table state types
// ─────────────────────────────────────────────────────────────

type TableRow = Record<string, unknown>;

interface TableUrlState {
	pageIndex: number;
	pageSize: number;
	sorting: SortingState;
	globalFilter: string;
	columnFilters: ColumnFiltersState;
	includeDeleted: boolean;
	chipValue: string | null;
}

/**
 * Read a table's shareable state from the query string. Only server-side
 * tables persist/restore it: their filters are query params, while a
 * client-side table keeps its filters in local state.
 */
function readTableUrlState(
	searchParams: Pick<URLSearchParams, "get" | "entries">,
	defaultPageSize: number,
): TableUrlState | null {
	const page = Number(searchParams.get(URL_KEYS.page));
	const size = Number(searchParams.get(URL_KEYS.size));
	const sort = searchParams.get(URL_KEYS.sort);
	const order = searchParams.get(URL_KEYS.order);
	const filterEntries: ColumnFiltersState = [];
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
		sorting: sort ? [{ id: sort, desc: order !== "asc" }] : [],
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
function readRowValue(row: TableRow, accessor: string): unknown {
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
	rows: TableRow[],
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

// ─────────────────────────────────────────────────────────────
// Column building
// ─────────────────────────────────────────────────────────────

/** Rendering metadata carried on a column definition. */
interface TableColumnMeta {
	/** Raw row accessor (may be dotted). */
	accessor?: string;
	/** Logical text alignment; shadcn's table default is start-aligned. */
	align?: "left" | "center" | "right";
	/** Which native filter control the header row renders. */
	filterType?: "text" | "number" | "select" | "date" | "boolean" | null;
	/** Resolved options for a select/boolean filter. */
	filterOptions?: Array<{ label: string; value: string }>;
	/** Fixed maximum width — long values truncate instead of stretching. */
	fixedWidth?: number;
	/** Inline editing through a double-click. */
	editable?: boolean;
	/** Hide the column when every row on the page has an empty value. */
	hideWhenEmpty?: boolean;
}

type DataColumnDef = ColumnDef<TableRow, unknown>;

/** A column definition with the cell-renderer config the renderers read. */
type DynamicColumnDef = DataColumnDef & {
	columnFormat?: Record<string, unknown>;
};

function defMeta(def: ColumnDef<TableRow, unknown>): TableColumnMeta {
	return (def.meta ?? {}) as TableColumnMeta;
}

function columnMeta(column: Column<TableRow, unknown>): TableColumnMeta {
	return defMeta(column.columnDef);
}

const BOOLEAN_FILTER_OPTIONS = [
	{ label: "Yes", value: "true" },
	{ label: "No", value: "false" },
];

/** Normalise static/datasource options into `{ label, value }` strings. */
function resolveFilterOptions(
	options?: ReadonlyArray<{
		label?: string | number | null;
		value?: unknown;
	}> | null,
): Array<{ label: string; value: string }> {
	if (!Array.isArray(options)) return [];
	const resolved: Array<{ label: string; value: string }> = [];
	for (const option of options) {
		const value = String(option.value ?? "");
		if (value === "") continue;
		resolved.push({ label: String(option.label ?? option.value ?? ""), value });
	}
	return resolved;
}

/** Client-side text filter — substring match, case-insensitive. */
const containsFilter: FilterFn<TableRow> = (row, columnId, filterValue) => {
	const needle = String(filterValue ?? "").toLowerCase();
	if (!needle) return true;
	return String(row.getValue(columnId) ?? "")
		.toLowerCase()
		.includes(needle);
};

/** Client-side select/boolean filter — exact string equality. */
const equalsFilter: FilterFn<TableRow> = (row, columnId, filterValue) =>
	String(row.getValue(columnId) ?? "") === String(filterValue ?? "");

/** Client-side date filter — the row's ISO date starts with the picked day. */
const dateFilter: FilterFn<TableRow> = (row, columnId, filterValue) => {
	const needle = String(filterValue ?? "");
	if (!needle) return true;
	return String(row.getValue(columnId) ?? "")
		.slice(0, 10)
		.startsWith(needle);
};

function buildColumnDef(
	col: DynamicTableColumn,
	filterSelectOptions?: Array<{
		label?: string | number | null;
		value?: unknown;
	}>,
): DynamicColumnDef {
	const config = col.columnConfig;
	const overrides = col.fieldOverrides as
		| { name?: string; displayName?: string | null }
		| null
		| undefined;
	const accessor = overrides?.name ?? col.name;
	const header = overrides?.displayName ?? col.name;
	const filterable = config?.filterable ?? true;
	const filterType = filterable ? (config?.filterType ?? "text") : null;

	// Format-based cell rendering — delegates to the shared column cell
	// renderers. A reference column can resolve its `{id → label}` lookup
	// from the field's datasource; the lookup is carried next to the format
	// props so the cell needs no seed-specific wiring.
	let CellComponent: React.ComponentType<any> = TextCell;
	let columnFormat: Record<string, unknown> | undefined;
	if (config?.format) {
		const fmt = config.format;
		const renderer = columnCellRenderers[fmt.type];
		if (renderer) {
			CellComponent = renderer;
			const next: Record<string, unknown> = { ...fmt };
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
				next.props = props;
			}
			columnFormat = next;
		}
	}

	// Select options: the resolved options passed by the caller (columnConfig
	// filterOptions — static or service-backed) win; otherwise the field's
	// static datasource options are reused.
	const selectOptions =
		filterType === "boolean"
			? BOOLEAN_FILTER_OPTIONS
			: filterType === "select"
				? resolveFilterOptions(
						filterSelectOptions ?? col.datasource?.options ?? undefined,
					)
				: undefined;

	const meta: TableColumnMeta = {
		accessor,
		align: config?.align && config.align !== "justify" ? config.align : "left",
		filterType,
		filterOptions: selectOptions,
		fixedWidth: numOrUndefined(config?.maxWidth ?? config?.width),
		editable: Boolean(config?.editable),
		hideWhenEmpty: Boolean(config?.hideWhenEmpty),
	};

	const def: DynamicColumnDef = {
		// An explicit id keeps dotted accessors intact for filter/sort params
		// (TanStack would otherwise replace `.` with `_` in the derived id).
		id: accessor,
		accessorKey: accessor,
		header,
		enableSorting: config?.sortable ?? true,
		enableColumnFilter: filterable,
		enableHiding: config?.hideable ?? true,
		size: numOrUndefined(config?.width),
		minSize: numOrUndefined(config?.minWidth),
		maxSize: numOrUndefined(config?.maxWidth),
		filterFn:
			filterType === "select" || filterType === "boolean"
				? equalsFilter
				: filterType === "date"
					? dateFilter
					: containsFilter,
		meta,
		cell: (context: CellContext<TableRow, unknown>) => (
			<CellComponent cell={context} columnDef={context.column.columnDef} />
		),
	};

	// The cell renderers read `cell.column.columnDef.columnFormat`; carry it
	// on the definition (ColumnDef has no field for app metadata).
	if (columnFormat) def.columnFormat = columnFormat;

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
			'button, a, input, select, textarea, label, summary, details, dialog, [role="button"], [role="link"], [role="checkbox"], [role="menuitem"], [role="switch"]',
		),
	);
}

// ─────────────────────────────────────────────────────────────
// Density & alignment helpers
// ─────────────────────────────────────────────────────────────

/** Cell padding per contract density (compact < normal < comfortable). */
const DENSITY_CELL_CLASS: Record<TableDensity, string> = {
	compact: "p-2 py-1",
	normal: "p-2",
	comfortable: "p-2 py-3",
};

/** The shadcn table wrapper: scroll container, radius and hairline border. */
const TABLE_WRAPPER_CLASS =
	"relative w-full overflow-x-auto rounded-md border border-border";

type ColumnAlign = "left" | "center" | "right";

const ALIGN_TEXT_CLASS: Record<ColumnAlign, string> = {
	left: "text-start",
	center: "text-center",
	right: "text-end",
};

const ALIGN_FLEX_CLASS: Record<ColumnAlign, string> = {
	left: "justify-start",
	center: "justify-center",
	right: "justify-end",
};

function alignText(align: ColumnAlign | undefined): string {
	return ALIGN_TEXT_CLASS[align ?? "left"];
}

function alignFlex(align: ColumnAlign | undefined): string {
	return ALIGN_FLEX_CLASS[align ?? "left"];
}

/** Build a nested PATCH body from a possibly dotted row accessor. */
function nestedBody(accessor: string, value: unknown): Record<string, unknown> {
	const keys = accessor.split(".");
	let body: unknown = value;
	for (let index = keys.length - 1; index >= 0; index -= 1) {
		body = { [keys[index]]: body };
	}
	return body as Record<string, unknown>;
}

/** Stable row key used for selection and React keys. */
function rowKeyOf(row: TableRow, index: number): string {
	return String(row.id ?? index);
}

// ─────────────────────────────────────────────────────────────
// Build URL search params for the fetch request
// ─────────────────────────────────────────────────────────────

interface FetchParams {
	pagination: PaginationState;
	sorting: SortingState;
	globalFilter: string;
	columnFilters: ColumnFiltersState;
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
// Small native UI primitives
// ─────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "outline" | "ghost" | "danger";

const BUTTON_BASE =
	"inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
	primary: "bg-primary text-primary-foreground hover:bg-primary/90",
	outline:
		"border border-input bg-background hover:bg-muted hover:text-foreground",
	ghost: "hover:bg-muted hover:text-foreground",
	danger: "bg-destructive text-white hover:bg-destructive/90",
};

/** Map an action's palette-style colour name onto one of our button variants. */
function buttonVariant(color?: string): ButtonVariant {
	if (color === "error" || color === "danger" || color === "delete") {
		return "danger";
	}
	if (!color || color === "primary") return "primary";
	return "outline";
}

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: ButtonVariant;
	icon?: ReactNode;
}

function ActionButton({
	variant = "primary",
	icon,
	children,
	className,
	...props
}: ActionButtonProps): ReactElement {
	return (
		<button
			type="button"
			className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${className ?? ""}`}
			{...props}
		>
			{icon}
			{children}
		</button>
	);
}

const ICON_BUTTON_CLASS =
	"inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

/** Pagination's outline icon button — shadcn `variant="outline" size="icon"`. */
const PAGINATION_BUTTON_CLASS = "border border-input bg-transparent";

interface IconActionButtonProps {
	label: string;
	icon: ReactNode;
	onClick?: () => void;
	disabled?: boolean;
	pressed?: boolean;
	/** Extra utilities (e.g. the pagination buttons' outline border). */
	className?: string;
}

function IconActionButton({
	label,
	icon,
	onClick,
	disabled,
	pressed,
	className,
}: IconActionButtonProps): ReactElement {
	return (
		<button
			type="button"
			title={label}
			aria-label={label}
			aria-pressed={pressed}
			disabled={disabled}
			onClick={onClick}
			className={`${ICON_BUTTON_CLASS} ${className ?? ""}`}
		>
			{icon}
		</button>
	);
}

function Chip({
	children,
	tone = "muted",
}: {
	children: ReactNode;
	tone?: "muted" | "primary" | "outline";
}): ReactElement {
	const tones: Record<"muted" | "primary" | "outline", string> = {
		muted: "border-transparent bg-secondary text-secondary-foreground",
		primary: "border-transparent bg-primary text-primary-foreground",
		outline: "border-border text-foreground",
	};
	return (
		<span
			className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${tones[tone]}`}
		>
			{children}
		</span>
	);
}

interface SelectionCheckboxProps {
	checked: boolean;
	indeterminate?: boolean;
	onChange: (event: ChangeEvent<HTMLInputElement>) => void;
	label: string;
	disabled?: boolean;
}

function SelectionCheckbox({
	checked,
	indeterminate,
	onChange,
	label,
	disabled,
}: SelectionCheckboxProps): ReactElement {
	const ref = useRef<HTMLInputElement>(null);
	useEffect(() => {
		if (ref.current) ref.current.indeterminate = Boolean(indeterminate);
	}, [indeterminate]);
	return (
		<input
			ref={ref}
			type="checkbox"
			checked={checked}
			disabled={disabled}
			aria-label={label}
			onChange={onChange}
			onClick={(event) => event.stopPropagation()}
			className="h-4 w-4 cursor-pointer rounded border-border accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
		/>
	);
}

interface ModalDialogProps {
	open: boolean;
	title: string;
	onClose: () => void;
	children: ReactNode;
	footer: ReactNode;
}

/** A native modal <dialog> — top layer, focus trap and Escape for free. */
function ModalDialog({
	open,
	title,
	onClose,
	children,
	footer,
}: ModalDialogProps): ReactElement {
	const ref = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		const dialog = ref.current;
		if (!dialog) return;
		if (open) {
			if (dialog.open) return;
			if (typeof dialog.showModal === "function") {
				try {
					dialog.showModal();
				} catch {
					dialog.setAttribute("open", "");
				}
			} else {
				dialog.setAttribute("open", "");
			}
		} else if (dialog.open) {
			if (typeof dialog.close === "function") dialog.close();
			else dialog.removeAttribute("open");
		}
	}, [open]);

	return (
		<dialog
			ref={ref}
			aria-label={title}
			onCancel={(event) => {
				event.preventDefault();
				onClose();
			}}
			onClick={(event) => {
				if (event.target === ref.current) onClose();
			}}
			className="fixed inset-0 z-50 m-auto h-fit max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-auto rounded-lg border border-border bg-card p-0 text-foreground shadow-lg [&::backdrop]:bg-black/50"
		>
			<div className="flex flex-col gap-4 p-6">
				<h2 className="text-lg font-semibold text-foreground">{title}</h2>
				<div className="text-sm text-muted-foreground">{children}</div>
				<div className="flex justify-end gap-2">{footer}</div>
			</div>
		</dialog>
	);
}

interface DebouncedInputProps {
	value: string;
	onChange: (value: string) => void;
	label: string;
	type?: "text" | "number" | "search";
	placeholder?: string;
	className?: string;
	delay?: number;
}

/**
 * A controlled text input that commits after a short pause (and on Enter or
 * blur), so typing in a server-side filter does not fire one request per
 * keystroke. The external value wins whenever the input is not focused, so
 * "clear filters" resets the draft too.
 */
function DebouncedInput({
	value,
	onChange,
	label,
	type = "text",
	placeholder,
	className,
	delay = 300,
}: DebouncedInputProps): ReactElement {
	const [draft, setDraft] = useState(value);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const focused = useRef(false);
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;

	useEffect(() => {
		if (!focused.current) setDraft(value);
	}, [value]);

	useEffect(
		() => () => {
			if (timer.current) clearTimeout(timer.current);
		},
		[],
	);

	const commit = (next: string) => {
		if (timer.current) {
			clearTimeout(timer.current);
			timer.current = null;
		}
		if (next !== value) onChangeRef.current(next);
	};

	return (
		<input
			type={type}
			value={draft}
			aria-label={label}
			placeholder={placeholder}
			className={className}
			onChange={(event) => {
				const next = event.target.value;
				setDraft(next);
				if (timer.current) clearTimeout(timer.current);
				timer.current = setTimeout(() => {
					timer.current = null;
					onChangeRef.current(next);
				}, delay);
			}}
			onFocus={() => {
				focused.current = true;
			}}
			onBlur={() => {
				focused.current = false;
				if (timer.current) commit(draft);
			}}
			onKeyDown={(event) => {
				if (event.key !== "Enter") return;
				event.preventDefault();
				commit(draft);
				event.currentTarget.blur();
			}}
		/>
	);
}

const FILTER_CONTROL_CLASS =
	"h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-sm text-foreground transition-colors outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

interface ColumnFilterControlProps {
	label: string;
	meta: TableColumnMeta;
	value: unknown;
	onChange: (value: string) => void;
}

/** The native filter widget for one column: input, date field or select. */
function ColumnFilterControl({
	label,
	meta,
	value,
	onChange,
}: ColumnFilterControlProps): ReactElement | null {
	if (!meta.filterType) return null;
	const current =
		typeof value === "string" || typeof value === "number" ? String(value) : "";

	if (meta.filterType === "select" || meta.filterType === "boolean") {
		const options = meta.filterOptions ?? [];
		return (
			<select
				aria-label={`Filter ${label}`}
				value={current}
				onChange={(event) => onChange(event.target.value)}
				className={FILTER_CONTROL_CLASS}
			>
				<option value="">All</option>
				{options.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
		);
	}

	if (meta.filterType === "date") {
		return (
			<input
				type="date"
				aria-label={`Filter ${label}`}
				value={current}
				onChange={(event) => onChange(event.target.value)}
				className={FILTER_CONTROL_CLASS}
			/>
		);
	}

	return (
		<DebouncedInput
			type={meta.filterType === "number" ? "number" : "text"}
			value={current}
			onChange={onChange}
			label={`Filter ${label}`}
			placeholder="Filter…"
			className={FILTER_CONTROL_CLASS}
		/>
	);
}

/** Width of the row-actions popup, used to keep it inside the viewport. */
const ROW_MENU_WIDTH = 176;

/**
 * The per-row action menu. The popup is `position: fixed` with coordinates
 * taken from the trigger: the table scrolls horizontally, so an absolutely
 * positioned menu inside a cell would be clipped by the scroll container.
 * A fixed element is not clipped by an ancestor's overflow (its containing
 * block is the viewport), so no portal is needed.
 */
function RowActionsMenu({
	actions,
	onSelect,
}: {
	actions: TableAction[];
	onSelect: (action: TableAction) => void;
}): ReactElement {
	const [open, setOpen] = useState(false);
	const [position, setPosition] = useState<{
		top: number;
		left: number;
	} | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (!open) return;
		const close = () => setOpen(false);
		const onPointerDown = (event: PointerEvent) => {
			if (containerRef.current?.contains(event.target as Node)) return;
			close();
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") close();
		};
		window.addEventListener("pointerdown", onPointerDown);
		window.addEventListener("keydown", onKeyDown);
		// A fixed popup would drift over a scrolling table — close on scroll.
		window.addEventListener("scroll", close, true);
		window.addEventListener("resize", close);
		return () => {
			window.removeEventListener("pointerdown", onPointerDown);
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("scroll", close, true);
			window.removeEventListener("resize", close);
		};
	}, [open]);

	const toggleMenu = () => {
		if (open) {
			setOpen(false);
			return;
		}
		const rect = buttonRef.current?.getBoundingClientRect();
		if (!rect) return;
		const viewport = window.innerWidth;
		const left = Math.min(
			Math.max(rect.left, 8),
			Math.max(viewport - ROW_MENU_WIDTH - 8, 8),
		);
		setPosition({ top: rect.bottom + 4, left });
		setOpen(true);
	};

	return (
		<div ref={containerRef} className="relative inline-block text-start">
			<button
				ref={buttonRef}
				type="button"
				aria-haspopup="true"
				aria-expanded={open}
				title="Row actions"
				aria-label="Row actions"
				onClick={toggleMenu}
				className={ICON_BUTTON_CLASS}
			>
				<TableIcon name="MoreHoriz" size={18} />
			</button>
			{open && position ? (
				<div
					onClick={(event) => event.stopPropagation()}
					style={{ position: "fixed", top: position.top, left: position.left }}
					className="z-50 min-w-44 rounded-md border border-border bg-popover p-1 text-start text-popover-foreground shadow-md"
				>
					{actions.map((action) => (
						<button
							key={action.id}
							type="button"
							onClick={(event) => {
								event.stopPropagation();
								setOpen(false);
								onSelect(action);
							}}
							className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-start text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>
							{action.icon ? <TableIcon name={action.icon} size={16} /> : null}
							<span
								className={
									action.color === "error" || action.color === "delete"
										? "text-destructive"
										: undefined
								}
							>
								{action.label}
							</span>
						</button>
					))}
				</div>
			) : null}
		</div>
	);
}

/**
 * Tracks the phone breakpoint (600px, where DSL dialogs go full screen).
 * Starts `false` on the server and on the first client paint, then follows
 * the media query natively.
 */
const PHONE_QUERY = "(max-width: 639.98px)";

function usePhoneLayout(): boolean {
	const [isPhone, setIsPhone] = useState(false);

	useEffect(() => {
		if (typeof window === "undefined" || !window.matchMedia) return;
		const query = window.matchMedia(PHONE_QUERY);
		const update = () => setIsPhone(query.matches);
		update();
		if (typeof query.addEventListener !== "function") return;
		query.addEventListener("change", update);
		return () => query.removeEventListener("change", update);
	}, []);

	return isPhone;
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
	const isServerSide = datasource.serverSide === true;
	const isSubRow = subRow === true;

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
	// The previous renderer treated an omitted flag as enabled (its
	// `enableFilters`/`enableHiding` options defaulted to true), so an
	// incomplete seed keeps the same behaviour.
	const searchable = settings.searchable ?? true;
	const columnToggle = settings.columnToggle ?? true;
	const hasExternalData = externalData !== undefined;
	const { push } = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const { mutate: globalMutate } = useSWRConfig();
	const snack = useSnack();
	const isPhone = usePhoneLayout();

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
	const filterChips = isSubRow ? null : (settings.filterChips ?? null);

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

	const [pagination, setPagination] = useState<PaginationState>({
		pageIndex: initialUrlState?.pageIndex ?? 0,
		pageSize: initialUrlState?.pageSize ?? initialPageSize,
	});
	const [sorting, setSorting] = useState<SortingState>(
		initialUrlState?.sorting ?? [],
	);
	const [globalFilter, setGlobalFilter] = useState(
		initialUrlState?.globalFilter ?? "",
	);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(
		initialUrlState?.columnFilters ?? [],
	);
	const [includeDeleted, setIncludeDeleted] = useState(
		initialUrlState?.includeDeleted ?? false,
	);
	const [chipValue, setChipValue] = useState<string | null>(
		filterChips ? (initialUrlState?.chipValue ?? null) : null,
	);

	const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
	const [density, setDensity] = useState<TableDensity>(
		settings.density ?? "normal",
	);
	const [fullscreen, setFullscreen] = useState(false);
	const [exporting, setExporting] = useState(false);
	const [pendingBulkAction, setPendingBulkAction] = useState<{
		action: TableBulkAction;
		rows: TableRow[];
	} | null>(null);
	const [bulkRunningId, setBulkRunningId] = useState<string | null>(null);
	const [editingCell, setEditingCell] = useState<{
		rowId: string;
		columnId: string;
		accessor: string;
		original: TableRow;
	} | null>(null);
	const [editingValue, setEditingValue] = useState("");
	const cancelEditRef = useRef(false);

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
	// table keeps its filters in component state.
	// `history.replaceState` (not router.replace) keeps typing in the search
	// box from triggering a server round-trip on every keystroke.
	useEffect(() => {
		if (isSubRow || !isServerSide || hasExternalData) return;
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
		isSubRow,
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

	// ── Build column definitions ───────────────────────────────
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

	const dataColumns = useMemo<DynamicColumnDef[]>(() => {
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
	const exportCsv = useCallback(
		async (instance: TanStackTable<TableRow>) => {
			if (exporting || !isServerSide || hasExternalData) return;
			setExporting(true);
			try {
				// Only the columns the user can see right now — hiding a
				// column also keeps it out of the export.
				const exportColumns = instance
					.getVisibleLeafColumns()
					.filter((column) => !column.id.startsWith("__"))
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
				const rows: TableRow[] = [];
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
						rows.push(...(inner as TableRow[]));
						break;
					}
					const pageRows: TableRow[] = inner?.data ?? [];
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
	const fetchedData: TableRow[] = Array.isArray(inner)
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
		return dataColumns.filter((column) => {
			const meta = defMeta(column);
			if (!meta.hideWhenEmpty) return true;
			const accessor = meta.accessor ?? "";
			return data.some(
				(row) =>
					row[accessor] !== null &&
					row[accessor] !== undefined &&
					row[accessor] !== "",
			);
		});
	}, [dataColumns, data]);

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
			isSubRow
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
			isSubRow,
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
		(template: string, row?: TableRow): string => {
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
		(redirect: string, row?: TableRow) => {
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
		(action: TableAction, row?: TableRow) => {
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
			onRowAction,
			onToolbarAction,
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
		(row: TableRow): string | undefined => {
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

	/**
	 * Navigate/act on a row click. Only a declared `onRowClick` makes rows
	 * interactive; the handler skips clicks that belong to a row control.
	 */
	const handleRowClick = useCallback(
		(row: TableRow) => {
			const onClick = tableMetadata.onRowClick;
			if (!onClick) return;
			// Skip navigation if a dialog is currently open (avoid stray clicks).
			if (document.querySelector("dialog[open], .MuiDialog-root")) return;

			// New action-discriminant format: navigate / apiCall / openDialog
			if (onClick.action === "navigate" && onClick.path) {
				const href = resolveRowHref(row);
				if (href) push(href);
				return;
			}
			if (onClick.action === "apiCall" && onClick.endpoint) {
				const baseUrl = process.env.NEXT_PUBLIC_ENDPOINT ?? "";
				const endpoint = resolveRowPlaceholders(onClick.endpoint, row);
				getApiClient().request({
					url: `${baseUrl}${endpoint}`,
					method: onClick.method ?? "GET",
					data: row,
				});
				return;
			}
			if (onClick.action === "openDialog" && onClick.dialog) {
				const extraObj = {
					_actionId: "onRowClick",
					...resolvedPathParams,
					id: String(row.id ?? ""),
				};
				setDialogState(
					onClick.dialog.context ?? "edit",
					String(row.id ?? ""),
					String(onClick.dialog.componentId ?? ""),
					JSON.stringify(extraObj),
				);
				return;
			}

			// Legacy redirect/endpoint format. The redirect — including its
			// feature-gated fallback — is resolved once by `resolveRowHref`.
			if (onClick.redirect) {
				const href = resolveRowHref(row);
				if (href) push(href);
			} else if (onClick.endpoint) {
				const baseUrl = process.env.NEXT_PUBLIC_ENDPOINT ?? "";
				const endpoint = resolveRowPlaceholders(onClick.endpoint, row);
				getApiClient().request({
					url: `${baseUrl}${endpoint}`,
					method: onClick.method ?? "GET",
					data: row,
				});
			}
		},
		[
			tableMetadata.onRowClick,
			resolveRowHref,
			resolveRowPlaceholders,
			resolvedPathParams,
			setDialogState,
			push,
		],
	);

	/**
	 * The actions this row can see. Used by the action menu AND by the phone
	 * card, so the two presentations cannot drift apart.
	 */
	const visibleRowActions = useCallback(
		(row: TableRow): TableAction[] =>
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
		(action: TableAction, row?: TableRow) => {
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

	// ── Row selection ──────────────────────────────────────────
	/** The selected rows, in the current page's order. */
	const selectedRows = useCallback((): TableRow[] => {
		const keys = Object.keys(rowSelection).filter((key) => rowSelection[key]);
		if (keys.length === 0) return [];
		const selected = new Set(keys);
		return data.filter((row, index) => selected.has(rowKeyOf(row, index)));
	}, [rowSelection, data]);

	const clearSelection = useCallback(() => {
		setRowSelection({});
		onSelectionChange?.([]);
	}, [onSelectionChange]);

	/** Report the selected ids (row.id → operations.id → index key). */
	const reportSelection = useCallback(
		(next: RowSelectionState) => {
			const keys = new Set(Object.keys(next).filter((key) => next[key]));
			const ids = data
				.filter((row, index) => keys.has(rowKeyOf(row, index)))
				.map(
					(row) =>
						row.id ??
						(row.operations as Record<string, unknown> | undefined)?.id,
				)
				.filter(Boolean)
				.map(String);
			onSelectionChange?.(ids);
		},
		[data, onSelectionChange],
	);

	const handleRowSelectionChange = useCallback<OnChangeFn<RowSelectionState>>(
		(updater) => {
			const next = functionalUpdate(updater, rowSelection);
			setRowSelection(next);
			reportSelection(next);
		},
		[rowSelection, reportSelection],
	);

	// A selection belongs to the page/filters it was made on: keeping
	// row-index state across pages would let a bulk action hit a different
	// row than the one the user ticked.
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

	// ── Bulk action execution (UX-25) ──────────────────────────
	/**
	 * Run one request per selected row, in small batches. A non-toggle action
	 * sends its static body; a toggle action sends the inverse of the row's
	 * own field, so the same action is also the undo.
	 */
	const executeBulkAction = useCallback(
		async (action: TableBulkAction, rows: TableRow[]) => {
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
		(action: TableBulkAction, rows: TableRow[]) => {
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
		(action: TableBulkAction, rows: TableRow[]) => {
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
	// "clear filters" instead. A table without one keeps the renderer's
	// generic "No records to display" copy.
	const emptyState = tableMetadata.emptyState ?? null;

	/** Whether a search, column filter or chip narrows the list right now. */
	const hasActiveFilters = useCallback(
		(): boolean =>
			Boolean(globalFilter.trim()) ||
			columnFilters.some(
				(filter) => filter.value !== "" && filter.value != null,
			) ||
			Boolean(chipValue),
		[globalFilter, columnFilters, chipValue],
	);

	/**
	 * Clear every filter the user set — search, column filters and the chip
	 * row — and start again at the first page.
	 */
	const clearFilters = useCallback(() => {
		setGlobalFilter("");
		setColumnFilters([]);
		setChipValue(null);
		setPagination((previous) => ({ ...previous, pageIndex: 0 }));
	}, []);

	/**
	 * The empty table body. Returns `undefined` when the table has no
	 * `emptyState` (or no filtered copy) so the generic copy paints instead,
	 * and `null` while a fetch is in flight so the tailored state does not
	 * flash before the first page arrives.
	 */
	const renderEmptyState = (): ReactNode | undefined => {
		if (isServerSide && isLoading) return null;
		if (!emptyState) return undefined;

		if (hasActiveFilters()) {
			const filtered = emptyState.filtered;
			if (!filtered) return undefined;
			return (
				<div className="flex flex-col items-center gap-3 px-4 py-8">
					<TableIcon
						name={filtered.icon ?? "Search"}
						size={42}
						className="text-muted-foreground"
					/>
					<p className="text-base font-semibold text-foreground">
						{filtered.title}
					</p>
					{filtered.description ? (
						<p className="max-w-md text-center text-sm text-muted-foreground">
							{filtered.description}
						</p>
					) : null}
					<ActionButton
						variant="outline"
						icon={<TableIcon name="FilterList" size={18} />}
						onClick={clearFilters}
					>
						{filtered.clearLabel}
					</ActionButton>
				</div>
			);
		}

		// The primary action must be visible on the toolbar. An action the
		// user's permission, tier or feature flags hide is not offered here.
		const primary = topActions.find(
			(action) => action.id === String(emptyState.action ?? ""),
		);

		return (
			<div className="flex flex-col items-center gap-3 px-4 py-8">
				{emptyState.icon ? (
					<TableIcon
						name={emptyState.icon}
						size={42}
						className="text-muted-foreground"
					/>
				) : null}
				<p className="text-base font-semibold text-foreground">
					{emptyState.title}
				</p>
				{emptyState.description ? (
					<p className="max-w-md text-center text-sm text-muted-foreground">
						{emptyState.description}
					</p>
				) : null}
				{primary ? (
					<ActionButton
						variant={buttonVariant(primary.color)}
						icon={
							primary.icon ? (
								<TableIcon name={primary.icon} size={18} />
							) : undefined
						}
						onClick={() => dispatchAction(primary)}
					>
						{primary.label}
					</ActionButton>
				) : null}
				{emptyState.prerequisite ? (
					<a
						href={emptyState.prerequisite.href}
						className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
						onClick={(event) => {
							event.preventDefault();
							push(emptyState.prerequisite?.href ?? "/");
						}}
					>
						<TableIcon name="ArrowForward" size={16} />
						{emptyState.prerequisite.label}
					</a>
				) : null}
			</div>
		);
	};

	// ── Table columns: selection + data + row actions ──────────
	const hasRowActions = (tableMetadata.rowActions ?? []).length > 0;

	const tableColumns = useMemo<DynamicColumnDef[]>(() => {
		const selectionColumn: DynamicColumnDef = {
			id: SELECT_COLUMN_ID,
			size: SELECT_COLUMN_WIDTH,
			header: ({ table: instance }) => (
				<SelectionCheckbox
					checked={instance.getIsAllPageRowsSelected()}
					indeterminate={
						!instance.getIsAllPageRowsSelected() &&
						instance.getIsSomePageRowsSelected()
					}
					onChange={instance.getToggleAllPageRowsSelectedHandler()}
					disabled={instance.getRowModel().rows.length === 0}
					label="Select all rows"
				/>
			),
			cell: ({ row }) => (
				<SelectionCheckbox
					checked={row.getIsSelected()}
					onChange={row.getToggleSelectedHandler()}
					disabled={!row.getCanSelect()}
					label="Select row"
				/>
			),
			enableSorting: false,
			enableHiding: false,
			enableColumnFilter: false,
			enableGlobalFilter: false,
			meta: { align: "center" },
		};

		const actionsColumn: DynamicColumnDef = {
			id: ACTIONS_COLUMN_ID,
			size: ACTIONS_COLUMN_WIDTH,
			header: "",
			cell: ({ row }) => {
				const actions = visibleRowActions(row.original);
				if (actions.length === 0) return null;
				return (
					<RowActionsMenu
						actions={actions}
						onSelect={(action) => dispatchAction(action, row.original)}
					/>
				);
			},
			enableSorting: false,
			enableHiding: false,
			enableColumnFilter: false,
			enableGlobalFilter: false,
			meta: { align: "center" },
		};

		return [
			...(hasRowSelection ? [selectionColumn] : []),
			...visibleColumns,
			...(hasRowActions ? [actionsColumn] : []),
		];
	}, [
		hasRowSelection,
		hasRowActions,
		visibleColumns,
		visibleRowActions,
		dispatchAction,
	]);

	// ── Build the table instance ───────────────────────────────
	// Server-side tables trust the API for sorting/filtering/pagination
	// (`manual*`); client-side tables run the TanStack row models.
	// Row actions pin to the logical END of the table; the identity column
	// (and the selection checkbox) pin to the logical START. Tailwind's
	// `start-*`/`end-*` utilities are logical, so both stay at their visual
	// edge in LTR and RTL.
	const table = useReactTable<TableRow>({
		data,
		columns: tableColumns,
		state: {
			pagination,
			sorting,
			globalFilter,
			columnFilters,
			rowSelection,
			columnVisibility,
		},
		getRowId: (row, index) => rowKeyOf(row, index),
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: isServerSide ? undefined : getSortedRowModel(),
		getFilteredRowModel: isServerSide ? undefined : getFilteredRowModel(),
		getPaginationRowModel: isServerSide ? undefined : getPaginationRowModel(),
		manualPagination: isServerSide,
		manualSorting: isServerSide,
		manualFiltering: isServerSide,
		rowCount: isServerSide ? rowCount : undefined,
		enableRowSelection: hasRowSelection,
		enableSorting: !isSubRow,
		enableFilters: !isSubRow && searchable,
		enableColumnFilters: !isSubRow && searchable,
		enableGlobalFilter: !isSubRow && searchable,
		enableMultiSort: false,
		enableSortingRemoval: true,
		autoResetPageIndex: false,
		onPaginationChange: (updater) => {
			setPagination((previous) => functionalUpdate(updater, previous));
		},
		onSortingChange: (updater) => {
			setSorting((previous) => functionalUpdate(updater, previous));
			// A new sort order reorders the whole result set — start at page 1.
			setPagination((previous) => ({ ...previous, pageIndex: 0 }));
		},
		onGlobalFilterChange: (updater) => {
			setGlobalFilter((previous) => functionalUpdate(updater, previous));
			setPagination((previous) => ({ ...previous, pageIndex: 0 }));
		},
		onColumnFiltersChange: (updater) => {
			setColumnFilters((previous) => functionalUpdate(updater, previous));
			setPagination((previous) => ({ ...previous, pageIndex: 0 }));
		},
		onRowSelectionChange: handleRowSelectionChange,
		onColumnVisibilityChange: (updater) => {
			setColumnVisibility((previous) => functionalUpdate(updater, previous));
		},
	});

	// ── Pinning / pagination derived values ────────────────────
	const visibleLeafColumns = table.getVisibleLeafColumns();
	const firstDataColumn = visibleLeafColumns.find(
		(column) => !column.id.startsWith("__"),
	);
	const pageCount = Math.max(1, table.getPageCount());
	const pageSizeOptions = useMemo(() => {
		const configured = (
			datasource.pagination?.pageSizeOptions ?? DEFAULT_PAGE_SIZE_OPTIONS
		).filter((size) => typeof size === "number" && size > 0);
		const base = configured.length > 0 ? configured : DEFAULT_PAGE_SIZE_OPTIONS;
		return Array.from(
			new Set([...base, initialPageSize, pagination.pageSize]),
		).sort((a, b) => a - b);
	}, [
		datasource.pagination?.pageSizeOptions,
		initialPageSize,
		pagination.pageSize,
	]);

	/** Sticky start/end classes for a column, in header or body position. */
	const stickyColumnClass = (columnId: string, isHeader: boolean): string => {
		const isSelection = columnId === SELECT_COLUMN_ID;
		const isFirstData = columnId === firstDataColumn?.id;
		if (isSelection || isFirstData) {
			const inset = isSelection
				? "start-0"
				: hasRowSelection
					? STICKY_FIRST_COLUMN_OFFSET
					: "start-0";
			return `sticky ${inset} ${isHeader ? "z-30" : "z-10"}`;
		}
		if (columnId === ACTIONS_COLUMN_ID) {
			return `sticky end-0 ${isHeader ? "z-30" : "z-10"}`;
		}
		return "";
	};

	const stickyEndShadow =
		"shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.08)] rtl:shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)]";

	// ── Filtering / pagination intent ──────────────────────────
	const filteringEnabled = !isSubRow && searchable;
	const showFilterRow =
		filteringEnabled &&
		visibleLeafColumns.some((column) => Boolean(columnMeta(column).filterType));

	const setColumnFilter = useCallback((columnId: string, value: string) => {
		setColumnFilters((previous) => {
			const next = previous.filter((filter) => filter.id !== columnId);
			if (value !== "") next.push({ id: columnId, value });
			return next;
		});
		setPagination((previous) => ({ ...previous, pageIndex: 0 }));
	}, []);

	const changePageSize = useCallback((pageSize: number) => {
		if (!Number.isFinite(pageSize) || pageSize <= 0) return;
		// A bigger/smaller page changes which rows page N holds — start over.
		setPagination({ pageIndex: 0, pageSize });
	}, []);

	const goToPage = useCallback(
		(pageIndex: number) => {
			setPagination((previous) => ({
				...previous,
				pageIndex: Math.min(Math.max(pageIndex, 0), pageCount - 1),
			}));
		},
		[pageCount],
	);

	// ── Toolbar derived content ────────────────────────────────
	const selectionToolbarActions = (tableMetadata.toolbarActions ?? []).filter(
		(action) =>
			action.action === "linkSelected" || action.action === "unlinkSelected",
	);
	const selectionCount = Object.values(rowSelection).filter(Boolean).length;
	const showExport =
		isServerSide && !hasExternalData && Boolean(settings.exportable);

	/** linkSelected / unlinkSelected: one request with the selected ids. */
	const runSelectionAction = useCallback(
		async (action: TableAction) => {
			const ids = selectedRows()
				.map((row) => row.id as string)
				.filter(Boolean);
			const baseUrl = process.env.NEXT_PUBLIC_ENDPOINT ?? "";
			const rawEndpoint = (action as any).endpoint;
			const endpoint = resolveUrlTemplate(
				String(rawEndpoint ?? ""),
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
		},
		[selectedRows, resolvedPathParams, mutate, onClose],
	);

	// ── Inline cell editing ────────────────────────────────────
	/**
	 * Save the edited cell with a PATCH against the table's own endpoint
	 * (the same target and `{placeholder}` resolution the table uses) and
	 * revalidate so the row shows the server's answer.
	 */
	const saveCellEdit = useCallback(async () => {
		const editing = editingCell;
		if (!editing) return;
		setEditingCell(null);
		const baseUrl = process.env.NEXT_PUBLIC_ENDPOINT ?? "";
		const endpoint = resolveRowPlaceholders(
			datasource.endpoint,
			editing.original,
		);
		const body = nestedBody(editing.accessor, editingValue);
		try {
			await getApiClient().request({
				url: `${baseUrl}${endpoint}`,
				method: "PATCH",
				data: body,
			});
			await mutate();
		} catch (error) {
			await snack.error(error);
		}
	}, [
		editingCell,
		editingValue,
		datasource.endpoint,
		resolveRowPlaceholders,
		mutate,
		snack,
	]);

	// ── Full-screen exit ──────────────────────────────────────
	useEffect(() => {
		if (!fullscreen) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") setFullscreen(false);
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [fullscreen]);

	// ── Filter chips (category-style) ──────────────────────────
	// Shown above both presentations. Clicking the active chip clears the
	// filter, so there is no separate "All" caption to translate.
	const chipsRow =
		filterChips && (chipOptions?.length ?? 0) > 0 ? (
			<div
				role="group"
				aria-label="Filters"
				className="mb-2 flex flex-wrap items-center gap-2"
			>
				{chipOptions?.map((option) => {
					const selected = chipValue === option.value;
					return (
						<button
							key={option.value}
							type="button"
							aria-pressed={selected}
							onClick={() => selectChip(selected ? null : option.value)}
							className={`inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
								selected
									? "border-transparent bg-primary text-primary-foreground"
									: "border-border bg-transparent text-foreground hover:bg-muted"
							}`}
						>
							{option.label}
						</button>
					);
				})}
			</div>
		) : null;

	const emptyNode = renderEmptyState();

	// ── Mobile card presentation (opt-in) ──────────────────────
	// A wide DSL table can always scroll sideways inside its card, but the
	// job (find a row, read its status, act on it) is better served by a
	// short card: title, subtitle, status, row actions.
	const mobileCard = isSubRow ? null : (settings.mobileCard ?? null);
	const cardValue = (row: TableRow, accessor?: string): string => {
		if (!accessor) return "";
		const value = row[accessor];
		if (value === null || value === undefined) return "";
		if (typeof value === "boolean") return value ? "Yes" : "No";
		if (typeof value === "object") return JSON.stringify(value);
		return String(value);
	};

	if (isPhone && mobileCard) {
		return (
			<div className="flex flex-col gap-2">
				{chipsRow}
				{data.length === 0 ? (
					<div>
						{/* UX-24 — the phone card shows the same contextual (or
						    filtered) empty state as the table body; without one it
						    keeps the generic copy. `undefined` means "no configured
						    state"; `null` means "fetching, show nothing". */}
						{emptyNode === null
							? null
							: (emptyNode ?? (
									<p className="py-4 text-center text-sm text-muted-foreground">
										{hasActiveFilters()
											? "No results found"
											: "No records to display"}
									</p>
								))}
					</div>
				) : (
					<ul className="flex flex-col gap-2">
						{data.map((row, index) => {
							const actions =
								mobileCard.actions === false ? [] : visibleRowActions(row);
							const status = cardValue(row, mobileCard.status);
							const href = resolveRowHref(row);
							return (
								<li
									key={String(row.id ?? index)}
									onClick={href ? () => push(href) : undefined}
									className={`flex items-start justify-between gap-2 rounded-lg border border-border bg-card p-3 ${
										href ? "cursor-pointer hover:bg-muted" : ""
									}`}
								>
									<div className="min-w-0 flex-1">
										<p className="truncate font-semibold text-foreground">
											{cardValue(row, mobileCard.title)}
										</p>
										{mobileCard.subtitle ? (
											<p className="truncate text-sm text-muted-foreground">
												{cardValue(row, mobileCard.subtitle)}
											</p>
										) : null}
									</div>
									<div className="flex shrink-0 items-center gap-1">
										{status ? <Chip tone="outline">{status}</Chip> : null}
										{actions.map((action) => (
											<IconActionButton
												key={action.id}
												label={action.label}
												icon={
													action.icon ? (
														<TableIcon name={action.icon} size={18} />
													) : null
												}
												onClick={() => dispatchAction(action, row)}
											/>
										))}
									</div>
								</li>
							);
						})}
					</ul>
				)}
			</div>
		);
	}

	// ── Toolbar ────────────────────────────────────────────────
	const selectionBar =
		selectionCount > 0 &&
		(bulkActions.length > 0 || selectionToolbarActions.length > 0) ? (
			<div className="flex flex-wrap items-center gap-2">
				<Chip tone="primary">{selectionCount} selected</Chip>
				{bulkActions.map((action) => {
					const view = bulkActionView(action, selectedRows());
					return (
						<ActionButton
							key={action.id}
							variant={buttonVariant(view.color)}
							disabled={Boolean(bulkRunningId)}
							icon={
								view.icon ? <TableIcon name={view.icon} size={18} /> : undefined
							}
							onClick={() => requestBulkAction(action, selectedRows())}
						>
							{view.label}
						</ActionButton>
					);
				})}
				{selectionToolbarActions.map((action) => (
					<ActionButton
						key={action.id}
						variant={buttonVariant(action.color)}
						icon={
							action.icon ? (
								<TableIcon name={action.icon} size={18} />
							) : undefined
						}
						onClick={() => runSelectionAction(action)}
					>
						{action.label}
					</ActionButton>
				))}
				<IconActionButton
					label="Clear selection"
					icon={<TableIcon name="Close" size={18} />}
					onClick={clearSelection}
				/>
			</div>
		) : null;

	const internalActionButtons = internalActions.map((action) => {
		const customAction = (action as { customAction?: string }).customAction;
		const isToggleDeleted = customAction === "toggleDeleted";
		const label = isToggleDeleted
			? includeDeleted
				? ((action as { labelOn?: string }).labelOn ?? "Hide Deleted")
				: ((action as { labelOff?: string }).labelOff ?? action.label)
			: action.label;
		const iconName = isToggleDeleted
			? includeDeleted
				? (action.iconOn ?? action.icon ?? "Visibility")
				: (action.iconOff ?? action.icon ?? "VisibilityOff")
			: action.icon;
		return (
			<IconActionButton
				key={action.id}
				label={label}
				pressed={isToggleDeleted ? includeDeleted : undefined}
				icon={iconName ? <TableIcon name={iconName} size={18} /> : null}
				onClick={() => dispatchAction(action)}
			/>
		);
	});

	const hideableColumns = table
		.getAllLeafColumns()
		.filter((column) => column.getCanHide());

	const toolbar = isSubRow ? null : (
		<div className="flex flex-col gap-2 p-2">
			{fetchError ? (
				<div
					role="alert"
					className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
				>
					{fetchError}
				</div>
			) : null}
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex flex-wrap items-center gap-2">
					{selectionBar ?? (
						<div className="flex flex-wrap items-center gap-2">
							{topActions.map((action) => (
								<ActionButton
									key={action.id}
									variant={buttonVariant(action.color)}
									icon={
										action.icon ? (
											<TableIcon name={action.icon} size={18} />
										) : undefined
									}
									onClick={() => dispatchAction(action)}
								>
									{action.label}
								</ActionButton>
							))}
							{showExport ? (
								<ActionButton
									variant="outline"
									disabled={exporting}
									icon={<TableIcon name="Download" size={18} />}
									onClick={() => exportCsv(table)}
								>
									{settings.exportLabel ?? "Export CSV"}
								</ActionButton>
							) : null}
						</div>
					)}
					{internalActionButtons.length > 0 ? (
						<div className="flex items-center gap-1">
							{internalActionButtons}
						</div>
					) : null}
				</div>
				<div className="flex flex-wrap items-center gap-2">
					{filteringEnabled ? (
						<DebouncedInput
							value={globalFilter}
							onChange={(value) => {
								setGlobalFilter(value);
								setPagination((previous) => ({
									...previous,
									pageIndex: 0,
								}));
							}}
							label="Search"
							type="search"
							placeholder="Search…"
							className="h-9 w-44 rounded-md border border-input bg-transparent px-3 text-sm text-foreground transition-colors outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
						/>
					) : null}
					{columnToggle && hideableColumns.length > 0 ? (
						<details className="relative">
							<summary
								aria-label="Toggle columns"
								title="Toggle columns"
								className={`${ICON_BUTTON_CLASS} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
							>
								<TableIcon name="ViewColumn" size={18} />
							</summary>
							<div className="absolute end-0 z-40 mt-1 min-w-45 rounded-md border border-border bg-popover p-2 text-start text-popover-foreground shadow-md">
								<p className="mb-1 px-1 text-xs font-medium text-muted-foreground">
									Columns
								</p>
								{hideableColumns.map((column) => (
									<label
										key={column.id}
										className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm text-foreground hover:bg-muted"
									>
										<input
											type="checkbox"
											checked={column.getIsVisible()}
											onChange={column.getToggleVisibilityHandler()}
											className="h-4 w-4 accent-primary"
										/>
										<span className="truncate">
											{typeof column.columnDef.header === "string"
												? column.columnDef.header
												: column.id}
										</span>
									</label>
								))}
							</div>
						</details>
					) : null}
					<label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
						<span className="sr-only">Row density</span>
						<select
							aria-label="Row density"
							title="Row density"
							value={density}
							onChange={(event) =>
								setDensity(event.target.value as TableDensity)
							}
							className="h-9 rounded-md border border-input bg-transparent ps-3 pe-8 text-sm text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
						>
							<option value="compact">Compact</option>
							<option value="normal">Normal</option>
							<option value="comfortable">Comfortable</option>
						</select>
					</label>
					<IconActionButton
						label={fullscreen ? "Exit full screen" : "Full screen"}
						pressed={fullscreen}
						icon={
							<TableIcon
								name={fullscreen ? "FullscreenExit" : "Fullscreen"}
								size={18}
							/>
						}
						onClick={() => setFullscreen((previous) => !previous)}
					/>
				</div>
			</div>
		</div>
	);

	const bodyCellPadding =
		DENSITY_CELL_CLASS[density] ?? DENSITY_CELL_CLASS.normal;
	const headerSticky = Boolean(settings.stickyHeader) && !isSubRow;
	const rows = table.getRowModel().rows;

	return (
		<div
			className={
				fullscreen
					? "fixed inset-0 z-50 flex flex-col overflow-auto bg-background p-4"
					: undefined
			}
		>
			{chipsRow}
			<div
				aria-busy={isServerSide && isLoading}
				className={`flex max-w-full flex-col ${
					fullscreen ? "min-h-0 flex-1" : ""
				}`}
			>
				{toolbar}
				{isServerSide && isLoading ? (
					<div
						role="progressbar"
						aria-label="Loading"
						className="h-0.5 w-full overflow-hidden bg-muted"
					>
						<div className="h-full w-1/3 animate-pulse bg-primary" />
					</div>
				) : null}
				<div
					className={`${
						settings.bordered === false
							? "relative w-full overflow-auto rounded-lg"
							: TABLE_WRAPPER_CLASS
					} ${fullscreen ? "min-h-0 flex-1 overflow-y-auto" : ""}`}
				>
					<table
						aria-label={tableMetadata.title || tableMetadata.name || "Table"}
						className="w-full caption-bottom text-sm"
					>
						<colgroup>
							{visibleLeafColumns.map((column) => {
								const width = column.columnDef.size;
								return (
									<col key={column.id} style={width ? { width } : undefined} />
								);
							})}
						</colgroup>
						<thead className="[&_tr]:border-b">
							{table.getHeaderGroups().map((headerGroup) => (
								<tr key={headerGroup.id} className="border-b border-border">
									{headerGroup.headers.map((header) => {
										const column = header.column;
										const meta = columnMeta(column);
										const sorted = column.getIsSorted();
										const canSort =
											column.getCanSort() && !column.id.startsWith("__");
										const isActions = column.id === ACTIONS_COLUMN_ID;
										const pinnedHeader = stickyColumnClass(column.id, true);
										const headerContent = flexRender(
											column.columnDef.header,
											header.getContext(),
										);
										return (
											<th
												key={header.id}
												scope="col"
												aria-sort={
													sorted === "asc"
														? "ascending"
														: sorted === "desc"
															? "descending"
															: undefined
												}
												className={`h-10 px-2 align-middle font-medium whitespace-nowrap text-muted-foreground ${alignText(meta.align)} ${
													headerSticky ? "sticky top-0" : ""
												} ${headerSticky || pinnedHeader ? "bg-background" : ""} ${pinnedHeader} ${
													headerSticky && !pinnedHeader ? "z-20" : ""
												} ${isActions ? stickyEndShadow : ""} ${
													isActions ? "w-[50px] min-w-[50px]" : ""
												} ${
													column.id === SELECT_COLUMN_ID ? "w-10 min-w-10" : ""
												}`}
											>
												{canSort ? (
													<button
														type="button"
														onClick={
															column.getToggleSortingHandler() ?? undefined
														}
														className={`inline-flex w-full items-center gap-1 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${alignFlex(meta.align)}`}
													>
														<span className="truncate">{headerContent}</span>
														<TableIcon
															name={
																sorted === "asc"
																	? "ArrowDropUp"
																	: sorted === "desc"
																		? "ArrowDropDown"
																		: "Sort"
															}
															size={14}
															className={sorted ? "opacity-100" : "opacity-50"}
														/>
													</button>
												) : (
													headerContent
												)}
											</th>
										);
									})}
								</tr>
							))}
							{showFilterRow ? (
								<tr className="border-b border-border">
									{visibleLeafColumns.map((column) => (
										<th
											key={`filter-${column.id}`}
											scope="col"
											className={`bg-background p-2 align-middle font-normal ${
												headerSticky ? "sticky top-10 z-20" : ""
											} ${stickyColumnClass(column.id, true)}`}
										>
											<ColumnFilterControl
												label={
													typeof column.columnDef.header === "string"
														? column.columnDef.header
														: column.id
												}
												meta={columnMeta(column)}
												value={
													columnFilters.find(
														(filter) => filter.id === column.id,
													)?.value
												}
												onChange={(value) => setColumnFilter(column.id, value)}
											/>
										</th>
									))}
								</tr>
							) : null}
						</thead>
						<tbody className="[&_tr:last-child]:border-0">
							{rows.length === 0 ? (
								emptyNode === null ? null : (
									<tr>
										<td
											colSpan={Math.max(visibleLeafColumns.length, 1)}
											className="p-2"
										>
											{emptyNode ?? (
												<p className="py-8 text-center text-sm text-muted-foreground">
													{hasActiveFilters()
														? "No results found"
														: "No records to display"}
												</p>
											)}
										</td>
									</tr>
								)
							) : (
								rows.map((row) => {
									const matchedCondition = (settings.rowConditions ?? []).find(
										(condition) => matchRowCondition(row.original, condition),
									);
									const detailHref = resolveRowHref(row.original);
									const rowOnClick = tableMetadata.onRowClick;
									const pinningClass = (columnId: string) =>
										stickyColumnClass(columnId, false);
									return (
										<tr
											key={row.id}
											data-state={row.getIsSelected() ? "selected" : undefined}
											tabIndex={detailHref ? 0 : undefined}
											className={`border-b border-border transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted ${settings.striped ? "even:bg-muted/50" : ""} ${
												detailHref
													? "cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
													: rowOnClick
														? "cursor-pointer"
														: ""
											} ${matchedCondition?.className ?? ""}`}
											style={
												matchedCondition?.backgroundColor
													? {
															backgroundColor: matchedCondition.backgroundColor,
														}
													: undefined
											}
											onClick={
												rowOnClick
													? (event) => {
															if (isRowControlTarget(event.target)) return;
															handleRowClick(row.original);
														}
													: undefined
											}
											onKeyDown={
												detailHref
													? (
															event: ReactKeyboardEvent<HTMLTableRowElement>,
														) => {
															if (event.key !== "Enter") return;
															// Enter belongs to a focused control (action button,
															// link, checkbox); on the row or one of its cells it
															// opens the detail route.
															if (isRowControlTarget(event.target)) return;
															event.preventDefault();
															handleRowClick(row.original);
														}
													: undefined
											}
											onAuxClick={
												detailHref
													? (event: ReactMouseEvent<HTMLTableRowElement>) => {
															if (event.button !== 1) return;
															if (isRowControlTarget(event.target)) return;
															event.preventDefault();
															window.open(
																detailHref,
																"_blank",
																"noopener,noreferrer",
															);
														}
													: undefined
											}
										>
											{row.getVisibleCells().map((cell) => {
												const meta = columnMeta(cell.column);
												const isActions = cell.column.id === ACTIONS_COLUMN_ID;
												const pinned =
													cell.column.id === SELECT_COLUMN_ID ||
													cell.column.id === ACTIONS_COLUMN_ID ||
													cell.column.id === firstDataColumn?.id;
												const isEditing =
													editingCell?.rowId === row.id &&
													editingCell?.columnId === cell.column.id;
												return (
													<td
														key={cell.id}
														className={`align-middle ${bodyCellPadding} ${alignText(meta.align)} ${
															meta.fixedWidth
																? "overflow-hidden text-ellipsis whitespace-nowrap"
																: "whitespace-nowrap"
														} ${pinningClass(cell.column.id)} ${
															pinned ? "bg-background" : ""
														} ${isActions ? stickyEndShadow : ""}`}
														style={
															meta.fixedWidth
																? { maxWidth: meta.fixedWidth }
																: undefined
														}
														onDoubleClick={
															!isEditing && meta.editable && meta.accessor
																? () => {
																		cancelEditRef.current = false;
																		setEditingValue(
																			cell.getValue() == null
																				? ""
																				: String(cell.getValue()),
																		);
																		setEditingCell({
																			rowId: row.id,
																			columnId: cell.column.id,
																			accessor: meta.accessor as string,
																			original: row.original,
																		});
																	}
																: undefined
														}
													>
														{isEditing ? (
															<input
																// biome-ignore lint/a11y/noAutofocus: editing a cell the user just double-clicked
																autoFocus
																value={editingValue}
																aria-label={`Edit ${meta.accessor ?? cell.column.id}`}
																onChange={(event) =>
																	setEditingValue(event.target.value)
																}
																onBlur={() => {
																	if (cancelEditRef.current) {
																		cancelEditRef.current = false;
																		return;
																	}
																	saveCellEdit();
																}}
																onKeyDown={(event) => {
																	if (event.key === "Enter") {
																		event.preventDefault();
																		saveCellEdit();
																	} else if (event.key === "Escape") {
																		event.preventDefault();
																		cancelEditRef.current = true;
																		setEditingCell(null);
																	}
																}}
																className="w-full min-w-0 rounded-md border border-input bg-transparent px-2 py-1 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
															/>
														) : (
															flexRender(
																cell.column.columnDef.cell,
																cell.getContext(),
															)
														)}
													</td>
												);
											})}
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>
				{isSubRow ? null : (
					<div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
						<div className="flex items-center gap-2">
							<label
								htmlFor="dynamic-table-rows-per-page"
								className="font-medium text-muted-foreground"
							>
								Rows per page
							</label>
							<select
								id="dynamic-table-rows-per-page"
								value={pagination.pageSize}
								onChange={(event) => changePageSize(Number(event.target.value))}
								className="h-9 rounded-md border border-input bg-transparent ps-3 pe-8 text-sm text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
							>
								{pageSizeOptions.map((size) => (
									<option key={size} value={size}>
										{size}
									</option>
								))}
							</select>
						</div>
						<div className="flex items-center justify-end gap-2">
							<span className="text-muted-foreground">
								Page {pagination.pageIndex + 1} of {pageCount}
							</span>
							<div className="flex items-center gap-2">
								<IconActionButton
									label="Go to first page"
									disabled={pagination.pageIndex <= 0}
									className={PAGINATION_BUTTON_CLASS}
									icon={
										<TableIcon
											name="ArrowBack"
											size={18}
											className="rtl:rotate-180"
										/>
									}
									onClick={() => goToPage(0)}
								/>
								<IconActionButton
									label="Go to previous page"
									disabled={pagination.pageIndex <= 0}
									className={PAGINATION_BUTTON_CLASS}
									icon={
										<TableIcon
											name="ChevronLeft"
											size={18}
											className="rtl:rotate-180"
										/>
									}
									onClick={() => goToPage(pagination.pageIndex - 1)}
								/>
								<IconActionButton
									label="Go to next page"
									disabled={pagination.pageIndex + 1 >= pageCount}
									className={PAGINATION_BUTTON_CLASS}
									icon={
										<TableIcon
											name="ChevronRight"
											size={18}
											className="rtl:rotate-180"
										/>
									}
									onClick={() => goToPage(pagination.pageIndex + 1)}
								/>
								<IconActionButton
									label="Go to last page"
									disabled={pagination.pageIndex + 1 >= pageCount}
									className={PAGINATION_BUTTON_CLASS}
									icon={
										<TableIcon
											name="ArrowForward"
											size={18}
											className="rtl:rotate-180"
										/>
									}
									onClick={() => goToPage(pageCount - 1)}
								/>
							</div>
						</div>
					</div>
				)}
			</div>
			{/* UX-25 — a bulk action may declare a confirmation (destructive). */}
			<ModalDialog
				open={Boolean(pendingBulkAction)}
				title={
					pendingBulkAction?.action.confirm?.title ??
					pendingBulkAction?.action.label ??
					""
				}
				onClose={() => {
					if (!bulkRunningId) setPendingBulkAction(null);
				}}
				footer={
					<>
						<ActionButton
							variant="outline"
							disabled={Boolean(bulkRunningId)}
							onClick={() => setPendingBulkAction(null)}
						>
							Cancel
						</ActionButton>
						<ActionButton
							variant="danger"
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
						</ActionButton>
					</>
				}
			>
				{pendingBulkAction?.action.confirm?.message}
			</ModalDialog>
		</div>
	);
}
