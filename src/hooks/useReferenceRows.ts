"use client";

// ──────────────────────────────────────────────────────────────────
// Reference datasource rows — the `{id → label}` lookup for a
// `reference` column whose cell holds a bare id.
//
// A reference field normally carries an expanded object from the
// backend (the join already happened). When it does not, the seed can
// point the column at its datasource (`format.props.endpoint` or the
// field datasource) and the cell resolves the label here. The list is
// SWR-cached by endpoint, so every cell in the table shares one fetch.
//
// A failing lookup returns no rows — the cell then shows its empty
// placeholder instead of falling back to the id.
// ──────────────────────────────────────────────────────────────────

import useSWR from "swr";
import { getApiClient, getUserSnapshot } from "../deps";
import type {
	ReferenceDatasource,
	ReferenceFormatOptions,
} from "../formatting/reference";

/** SWR key prefix — shared by every reference lookup on the page. */
export const REFERENCE_ROWS_KEY = "render-pipeline:reference";

interface ReferenceSource {
	endpoint: string;
	method: "GET" | "POST";
	params: Record<string, unknown>;
}

function tenantId(): string | null {
	try {
		return getUserSnapshot()?.tenant?.id ?? null;
	} catch {
		return null;
	}
}

/** Resolve the service source from the props/datasource, if there is one. */
export function referenceSource(
	props: ReferenceFormatOptions | null | undefined,
): ReferenceSource | null {
	const datasource = (props?.datasource ?? null) as ReferenceDatasource | null;
	const endpoint = props?.endpoint ?? datasource?.endpoint;
	if (!endpoint) return null;
	const method = (props?.method ?? datasource?.method ?? "GET").toUpperCase();
	return {
		endpoint,
		method: method === "POST" ? "POST" : "GET",
		params: props?.params ?? datasource?.params ?? {},
	};
}

function resolveParams(
	params: Record<string, unknown>,
): Record<string, string> {
	const tenant = tenantId();
	const resolved: Record<string, string> = {};
	for (const [key, value] of Object.entries(params)) {
		if (value === null || value === undefined) continue;
		const text = String(value).replace(/\{tenantId\}/g, tenant ?? "");
		if (text.includes("{")) continue; // unresolved template — drop it
		resolved[key] = text;
	}
	return resolved;
}

function unwrapRows(body: unknown): Record<string, unknown>[] {
	if (Array.isArray(body)) return body as Record<string, unknown>[];
	if (body && typeof body === "object") {
		const candidate = (body as { data?: unknown }).data;
		if (Array.isArray(candidate)) return candidate as Record<string, unknown>[];
	}
	return [];
}

/**
 * Fetch the option rows for a reference column. `null` disables the
 * fetch (the cell already has a label or no datasource).
 */
export function useReferenceRows(
	props: ReferenceFormatOptions | null | undefined,
): Record<string, unknown>[] {
	const source = referenceSource(props);
	const params = source ? resolveParams(source.params) : {};
	const key = source
		? `${REFERENCE_ROWS_KEY}:${source.method}:${source.endpoint}:${JSON.stringify(params)}`
		: null;

	const { data } = useSWR(
		key,
		async () => {
			if (!source) return [];
			const query = new URLSearchParams(params);
			// A reference list is small; one page is enough to resolve the ids
			// on screen. Leave an explicit limit alone.
			if (!query.has("limit")) query.set("limit", "100");
			const separator = source.endpoint.includes("?") ? "&" : "?";
			const url = `${source.endpoint}${separator}${query.toString()}`;
			try {
				const res = await getApiClient().request({
					url,
					method: source.method,
				});
				return unwrapRows(res.data?.data ?? res.data);
			} catch {
				return [];
			}
		},
		{
			revalidateOnFocus: false,
			shouldRetryOnError: false,
			dedupingInterval: 60_000,
		},
	);

	return Array.isArray(data) ? data : [];
}

/** The label of one fetched row, matched by its value field. */
export function referenceRowLabel(
	rows: Record<string, unknown>[],
	id: string | null,
	props: ReferenceFormatOptions | null | undefined,
): string | null {
	if (!id || rows.length === 0) return null;
	const datasource = (props?.datasource ?? null) as ReferenceDatasource | null;
	const valueField =
		props?.valueField ??
		datasource?.entityMeta?.valueField ??
		props?.entityMeta?.valueField ??
		"id";
	const labelField =
		props?.displayField ??
		props?.labelField ??
		datasource?.entityMeta?.displayField ??
		props?.entityMeta?.displayField ??
		"displayName";

	for (const row of rows) {
		if (String(row[valueField] ?? row.id) !== String(id)) continue;
		const direct = row[labelField];
		if (typeof direct === "string" && direct.trim()) return direct.trim();
		for (const field of ["displayName", "name", "title", "number", "label", "email"]) {
			const fallback = row[field];
			if (typeof fallback === "string" && fallback.trim()) {
				return fallback.trim();
			}
		}
	}
	return null;
}
