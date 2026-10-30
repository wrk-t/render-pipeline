"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { type ReactElement, useMemo } from "react";
import useSWR from "swr";
import { ComponentRenderer } from "../ComponentRenderer";
import { getApiClient } from "../deps";
import { useResolvedParams } from "../hooks/useResolvedParams";
import type { RenderedComponent } from "../types";
import { LayoutChildren } from "./layoutChildren";
import { Paper } from "@mui/material";
import { RecordProvider, type TRecordData } from "./RecordContext";

// ──────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════
// LayoutRenderer — the screen shell: a page header + a Paper card.
//
//   Stack
//     ├─ header: title (Typography h5) + description (body2) + actions
//     └─ Paper (surface) — the content/component tree only
//
// The title/description live OUTSIDE the paper (they are page-level),
// the paper wraps just the components on the screen.
// ══════════════════════════════════════════════════════════════

export function LayoutRenderer({
	component,
	pathParams,
	context,
}: {
	component: RenderedComponent;
	pathParams?: Record<string, string>;
	context?: string;
}): ReactElement {
	const config = (component.config ?? {}) as {
		title?: string;
		elevation?: number;
		padding?: number | string;
		radius?: number | string;
		maxWidth?: number | string;
		fullBleed?: boolean;
		/** Vertical gap between content children. */
		spacing?: number;
		/**
		 * The row this detail page is about. Fetched once and provided through
		 * `RecordContext`, so the header's action buttons evaluate their
		 * `condition` against it (Pause vs Resume) and can resolve `{title}`.
		 */
		datasource?: { endpoint?: string; method?: string };
	};
	// `description` is an identity key — it lives on the component column,
	// not in config (same for displayName as the title fallback).
	const title = config.title ?? (component.displayName || component.name);
	const description = component.description ?? undefined;

	const resolvedPathParams = useResolvedParams(pathParams);
	const recordEndpoint = useMemo(() => {
		const endpoint = config.datasource?.endpoint;
		if (!endpoint) return null;
		return endpoint.replace(
			/\{(\w+)\}/g,
			(_: string, key: string) => resolvedPathParams[key] ?? `{${key}}`,
		);
	}, [config.datasource?.endpoint, resolvedPathParams]);

	const { data: record } = useSWR<TRecordData>(
		recordEndpoint,
		async (url: string) => {
			const res = await getApiClient().get(url);
			return (res.data?.data ?? res.data ?? null) as TRecordData;
		},
	);

	const content = (component.slotsFilled["content"] ?? [])
		.filter((e) => e.isActive)
		.sort((a, b) => a.displayOrder - b.displayOrder);
	const actions = (component.slotsFilled["actions"] ?? [])
		.filter(
			(e) =>
				e.isActive &&
				e.elementType === "component_ref" &&
				e.referencedComponent,
		)
		.sort((a, b) => a.displayOrder - b.displayOrder);

	const hasHeader = !!(title || description || actions.length > 0);

	// Vertical gap between content children (e.g. stacked cards). A detail page
	// stacks its summary/info/form blocks; without a default they touched each
	// other, so the page read as one dense wall of fields.
	const contentSpacing =
		config.spacing ?? (config.fullBleed === true ? 0 : 3);
	const contentEl = (
		<LayoutChildren
			elements={content}
			pathParams={pathParams}
			context={context}
		/>
	);
	const contentWithSpacing =
		contentSpacing > 0 ? (
			<Stack spacing={contentSpacing}>{contentEl}</Stack>
		) : (
			contentEl
		);

	if (config.fullBleed === true) {
		return (
			<RecordProvider value={record ?? null}>
				{contentWithSpacing}
			</RecordProvider>
		);
	}

	return (
		<RecordProvider value={record ?? null}>
			<Stack spacing={1.5} className="h-full">
				{hasHeader && (
					<Stack
						direction="row"
						className="items-center justify-between"
						spacing={2}
					>
						<Box>
							{title && (
								<Typography variant="h5" className="font-semibold">
									{title}
								</Typography>
							)}
							{description && (
								<Typography variant="body2" color="text.secondary">
									{description}
								</Typography>
							)}
						</Box>
						{actions.length > 0 && (
							<Stack direction="row" spacing={1}>
								{actions.map((el) => (
									<ComponentRenderer
										key={el.id}
										component={el.referencedComponent!}
										pathParams={pathParams}
										paramBindings={el.paramBindings}
										context={context}
									/>
								))}
							</Stack>
						)}
					</Stack>
				)}
				<Paper
					elevation={config.elevation ?? 1}
					sx={{
						p: config.padding ?? 3,
						borderRadius: config.radius ?? 2,
						flex: 1,
						minHeight: 0,
						...(config.maxWidth != null
							? { maxWidth: config.maxWidth, mx: "auto", width: "100%" }
							: {}),
					}}
				>
					<LayoutChildren
						elements={content}
						pathParams={pathParams}
						context={context}
					/>
				</Paper>
			</Stack>
		</RecordProvider>
	);
}
