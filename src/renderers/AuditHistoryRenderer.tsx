// ═══════════════════════════════════════════════════════════════
// AuditHistoryRenderer — change history for a resource instance.
//
// Fetches every audit entry for resource + resourceId (newest first)
// and renders each change as a card: the recorded diff/state in a
// read-only Monaco JSON editor, followed by the change date and the
// user who made it.
//
// Config:
//   datasource.endpoint  — `/api/v1/audit-logs/history?resource={resource}&resourceId={resourceId}`
//   datasource.params    — extra query params (e.g. limit)
//   emptyMessage         — shown when no changes exist
// ═══════════════════════════════════════════════════════════════
"use client";

import { type ReactElement, useMemo } from "react";
import useSWR from "swr";
import { LocalMonacoEditor } from "../components/common/LocalMonacoEditor";
import { getApiClient } from "../deps";
import { formatDate } from "../formatting/date";
import type { RenderedComponent } from "../types";

interface HistoryEntry {
	id: number | string;
	action?: string | null;
	resource?: string;
	resourceId?: string | null;
	// New activity-feed shape
	summary?: string | null;
	changes?: unknown;
	userDisplayName?: string | null;
	// Legacy audit-logs shape
	data?: unknown;
	createdAt?: string;
	user?: { id?: string; email?: string } | null;
}

const EDITOR_OPTIONS: Record<string, unknown> = {
	readOnly: true,
	minimap: { enabled: false },
	fontSize: 12,
	lineNumbers: "off",
	folding: false,
	glyphMargin: false,
	scrollBeyondLastLine: false,
	wordWrap: "on",
};

function formatTimestamp(value: string): string {
	// Same locale-aware formatter as the date cells: an audit row and the
	// record's own dates cannot disagree about the format. An unparseable
	// value keeps its raw text instead of disappearing.
	return formatDate(value, { showTime: true }) || value;
}

export function AuditHistoryRenderer({
	component,
	pathParams,
}: {
	component: RenderedComponent;
	pathParams?: Record<string, string>;
}): ReactElement {
	const config = (component.config ?? {}) as Record<string, any>;
	const datasource = config?.datasource;

	const endpoint = useMemo(() => {
		if (!datasource?.endpoint) return null;
		const resolved = datasource.endpoint.replace(
			/\{(\w+)\}/g,
			(_: string, key: string) =>
				pathParams && key in pathParams ? String(pathParams[key]) : `{${key}}`,
		);
		const params = (datasource.params ?? {}) as Record<string, string>;
		const keys = Object.keys(params);
		if (keys.length === 0) return resolved;
		const qs = new URLSearchParams(params).toString();
		return `${resolved}${resolved.includes("?") ? "&" : "?"}${qs}`;
	}, [datasource?.endpoint, datasource?.params, pathParams]);

	const {
		data: response,
		isLoading,
		error,
	} = useSWR(endpoint, async (url: string) => {
		const r = await getApiClient().get(url);
		return r.data?.data ?? r.data ?? null;
	});

	const entries: HistoryEntry[] = Array.isArray(response?.data)
		? response.data
		: Array.isArray(response)
			? response
			: [];

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-8">
				<span
					role="status"
					aria-label="Loading"
					className="h-10 w-10 animate-spin rounded-full border-2 border-muted border-t-primary"
				/>
			</div>
		);
	}

	if (error) {
		return (
			<div
				role="alert"
				className="rounded-lg border border-error-main/40 bg-error-main/10 px-4 py-3 text-start text-sm text-error-main"
			>
				Failed to load audit history
				{config?.resource || config?.resourceId
					? ` for ${config.resource}/${config.resourceId}`
					: ""}
				.
			</div>
		);
	}

	if (entries.length === 0) {
		return (
			<div
				role="status"
				className="rounded-lg border border-border bg-muted px-4 py-3 text-start text-sm text-muted-foreground"
			>
				{config?.emptyMessage ?? "No changes recorded for this resource."}
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			{entries.map((entry) => {
				const payload = entry.data ?? entry.changes ?? {};
				const actor = entry.user?.email ?? entry.userDisplayName ?? "\u2014";

				return (
					<article
						key={String(entry.id)}
						className="overflow-hidden rounded-lg border border-border bg-card"
					>
						{/* Change header: action + resource (+ feed summary) */}
						<header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
							<div className="flex min-w-0 items-center gap-2">
								{entry.action && (
									<span className="inline-flex shrink-0 items-center rounded-full border border-primary/50 px-2 py-0.5 text-xs text-primary">
										{entry.action}
									</span>
								)}
								{entry.resource && (
									<span className="truncate text-xs text-muted-foreground">
										{entry.resource}
									</span>
								)}
							</div>
							{entry.summary && (
								<span className="text-end text-xs font-medium text-foreground">
									{entry.summary}
								</span>
							)}
						</header>
						{/* Change payload in Monaco */}
						<div className="h-[220px]">
							<LocalMonacoEditor
								height="220px"
								defaultLanguage="json"
								value={JSON.stringify(payload, null, 2)}
								theme="vs"
								options={EDITOR_OPTIONS}
							/>
						</div>
						{/* Change date + acting user */}
						<footer className="flex items-center justify-between gap-2 px-3 py-2">
							<span className="text-xs text-muted-foreground">
								{entry.createdAt ? formatTimestamp(entry.createdAt) : "\u2014"}
							</span>
							<span className="text-xs font-medium text-foreground">
								{actor}
							</span>
						</footer>
					</article>
				);
			})}
		</div>
	);
}
