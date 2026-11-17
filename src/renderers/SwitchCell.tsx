"use client";

// ──────────────────────────────────────────────────────────────────
// SwitchCell — an inline, optimistic boolean switch inside a table.
//
// A read-only `boolean` column shows check/cross icons; a column that
// must be changed from the table (item availability, category
// visibility) opts into `format: { type: "switch" }` instead.
//
// Format config:
//   { type: "switch", props: { endpoint: "/api/v1/menu-items/{id}/toggle-availability" } }
//   { type: "switch", props: { endpoint: "/api/v1/menu-categories/{id}",
//                              method: "PATCH", field: "isVisible" } }
//
//   - `endpoint` — PATCH target; `{rowField}` placeholders resolve from the
//     row (the usual `{id}`), and the API base comes from
//     NEXT_PUBLIC_ENDPOINT, like every other table request.
//   - `field`     — when set, the request body is `{ [field]: nextValue }`
//     (a generic update route). When omitted the endpoint owns the flip
//     (a `toggle-*` route) and no body is sent.
//   - `valueField` — row field holding the boolean (defaults to the column
//     accessor).
//
// Optimistic: the switch shows the new value immediately. On success the
// table cache is revalidated so the row reflects the server's answer; on
// failure the optimistic value is dropped (the row's last known value is
// restored) and the user gets an error snackbar — never a switch that
// silently lies about what was saved.
// ──────────────────────────────────────────────────────────────────

import { type ChangeEvent, type ReactElement, useState } from "react";
import { useSWRConfig } from "swr";
import { getApiClient } from "../deps";
import { useSnack } from "../hooks/useSnack";
import { BooleanCell } from "./BooleanCell";

/** Every server-side table caches its page under this SWR key prefix. */
export const TABLE_DATA_KEY_PREFIX = "table-data:";

/** SWR global-mutate filter — the current table's (and any sibling's) pages. */
function isTableDataKey(key: unknown): boolean {
	return typeof key === "string" && key.startsWith(TABLE_DATA_KEY_PREFIX);
}

interface SwitchCellProps {
	cell: any;
	columnDef?: any;
}

interface SwitchFormatProps {
	endpoint?: string;
	method?: "PATCH" | "POST" | "PUT";
	/** Body field to write (omit for a `toggle-*` endpoint). */
	field?: string | null;
	/** Row field holding the boolean (defaults to the column accessor). */
	valueField?: string | null;
	/** Extra static body fields sent along with `field`. */
	body?: Record<string, unknown> | null;
}

const TRUE_VALUES = new Set<unknown>([true, 1, "true", "1"]);

/** Resolve `{rowField}` placeholders in the endpoint from the row. */
function resolveEndpoint(
	template: string,
	row: Record<string, unknown>,
): string | null {
	let missing = false;
	const url = template.replace(/\{(\w+)\}/g, (_match, key: string) => {
		const value = row[key];
		if (value === null || value === undefined) {
			missing = true;
			return "";
		}
		return encodeURIComponent(String(value));
	});
	return missing ? null : url;
}

export function SwitchCell({ cell }: SwitchCellProps): ReactElement {
	const value = cell.getValue();
	const fmt = cell?.column?.columnDef?.columnFormat ?? {};
	const props = (fmt?.props ?? {}) as SwitchFormatProps;
	const row = (cell?.row?.original ?? {}) as Record<string, unknown>;
	const accessor = String(
		props.valueField ??
			cell?.column?.id ??
			cell?.column?.columnDef?.accessorKey ??
			"",
	);
	const rowValue = accessor ? row[accessor] : value;
	const truthy = TRUE_VALUES.has(rowValue);

	// Optimistic display: the row keeps the last value the server sent
	// until a revalidation replaces it, so the switch never invents one.
	const [pending, setPending] = useState<boolean | null>(null);
	const [busy, setBusy] = useState(false);
	const { mutate: globalMutate } = useSWRConfig();
	const snack = useSnack();

	const endpointTemplate = props.endpoint;
	if (!endpointTemplate) {
		// A switch with nowhere to write is a read-only boolean; showing a
		// dead control would be worse than the icons.
		return <BooleanCell cell={cell} columnDef={cell?.column?.columnDef} />;
	}

	const checked = pending ?? truthy;
	const header = cell?.column?.columnDef?.header;
	const label = typeof header === "string" ? header : undefined;

	const onChange = async (
		event: ChangeEvent<HTMLInputElement>,
		next: boolean,
	) => {
		event.stopPropagation();
		if (busy) return;

		const url = resolveEndpoint(endpointTemplate, row);
		if (!url) return;

		setPending(next);
		setBusy(true);
		try {
			await getApiClient().request({
				url: `${process.env.NEXT_PUBLIC_ENDPOINT ?? ""}${url}`,
				method: props.method ?? "PATCH",
				// A `toggle-*` endpoint owns the flip and takes no body; a
				// generic update gets the explicit next value.
				...(props.field
					? { data: { ...(props.body ?? {}), [props.field]: next } }
					: props.body
						? { data: props.body }
						: {}),
			});
			// The response is the source of truth (a toggle may have flipped a
			// value the page held stale) — re-read this page.
			await globalMutate(isTableDataKey, undefined, { revalidate: true });
		} catch (error) {
			// Roll back: drop the optimistic value and resync so the switch
			// shows what is actually stored.
			setPending(null);
			await globalMutate(isTableDataKey);
			await snack.error(error, "Update failed");
		} finally {
			setPending(null);
			setBusy(false);
		}
	};

	return (
		<span
			title={label ?? ""}
			className="flex w-full items-center justify-center"
			onClick={(event) => event.stopPropagation()}
		>
			<label
				className={`relative inline-flex h-5 w-9 shrink-0 items-center ${
					busy ? "cursor-not-allowed" : "cursor-pointer"
				}`}
			>
				<input
					type="checkbox"
					role="switch"
					className="peer sr-only"
					checked={checked}
					aria-checked={checked}
					disabled={busy}
					onChange={(event) => {
						onChange(event, event.target.checked);
					}}
					aria-label={label ?? accessor}
				/>
				{/* Track — the native input stays accessible but invisible. */}
				<span
					aria-hidden
					className="absolute inset-0 rounded-full bg-input transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-disabled:opacity-50"
				/>
				{/* Thumb — `ms` flips with the writing direction. */}
				<span
					aria-hidden
					className="relative z-10 ms-0.5 h-4 w-4 rounded-full bg-background shadow-sm transition-all duration-200 peer-checked:ms-[18px] peer-disabled:opacity-50"
				/>
			</label>
		</span>
	);
}
