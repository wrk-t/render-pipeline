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

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { type ReactElement, useMemo } from "react";
import useSWR from "swr";
import { LocalMonacoEditor } from "../components/common/LocalMonacoEditor";
import { getApiClient } from "../deps";
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

function formatDate(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return date.toLocaleString();
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
			<Box className="flex items-center justify-center py-8">
				<CircularProgress />
			</Box>
		);
	}

	if (error) {
		return (
			<Alert severity="error">
				Failed to load audit history
				{config?.resource || config?.resourceId
					? ` for ${config.resource}/${config.resourceId}`
					: ""}
				.
			</Alert>
		);
	}

	if (entries.length === 0) {
		return (
			<Alert severity="info">
				{config?.emptyMessage ?? "No changes recorded for this resource."}
			</Alert>
		);
	}

	return (
		<Stack spacing={2}>
			{entries.map((entry) => {
				const payload = entry.data ?? entry.changes ?? {};
				const actor = entry.user?.email ?? entry.userDisplayName ?? "\u2014";

				return (
					<Paper
						key={String(entry.id)}
						variant="outlined"
						className="overflow-hidden"
						sx={{ borderColor: "divider" }}
					>
						{/* Change header: action + resource (+ feed summary) */}
						<Box className="flex items-center justify-between gap-2 border-b border-divider px-3 py-2">
							<Stack direction="row" spacing={1} className="items-center">
								{entry.action && (
									<Chip
										label={entry.action}
										size="small"
										color="primary"
										variant="outlined"
									/>
								)}
								{entry.resource && (
									<Typography variant="caption" color="textSecondary">
										{entry.resource}
									</Typography>
								)}
							</Stack>
							{entry.summary && (
								<Typography variant="caption" className="!font-medium">
									{entry.summary}
								</Typography>
							)}
						</Box>
						{/* Change payload in Monaco */}
						<Box sx={{ height: 220 }}>
							<LocalMonacoEditor
								height="220px"
								defaultLanguage="json"
								value={JSON.stringify(payload, null, 2)}
								theme="vs"
								options={EDITOR_OPTIONS}
							/>
						</Box>
						{/* Change date + acting user */}
						<Box className="flex items-center justify-between gap-2 px-3 py-2">
							<Typography variant="caption" color="textSecondary">
								{entry.createdAt ? formatDate(entry.createdAt) : "\u2014"}
							</Typography>
							<Typography variant="caption" className="!font-medium">
								{actor}
							</Typography>
						</Box>
					</Paper>
				);
			})}
		</Stack>
	);
}
