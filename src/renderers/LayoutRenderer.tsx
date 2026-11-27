"use client";

import type { CSSProperties } from "react";
import { type ReactElement, useMemo } from "react";
import useSWR from "swr";
import { ComponentRenderer } from "../ComponentRenderer";
import { getApiClient } from "../deps";
import { useResolvedParams } from "../hooks/useResolvedParams";
import type { RenderedComponent } from "../types";
import { LayoutChildren } from "./layoutChildren";
import { RecordProvider, type TRecordData } from "./RecordContext";
import { ScreenContentContext } from "./ScreenContentContext";

// ──────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════
// LayoutRenderer — the screen shell: a page header + a card surface.
//
//   div.flex.flex-col
//     ├─ header: title (text-2xl) + description (text-sm) + actions
//     └─ card (surface) — the content/component tree only
//
// The title/description live OUTSIDE the card (they are page-level),
// the card wraps just the components on the screen.
// ══════════════════════════════════════════════════════════════

/** MUI `spacing` units (8px each) → Tailwind gap steps (4px each). */
const GAP: Record<number, string> = {
	0: "gap-0",
	0.5: "gap-1",
	1: "gap-2",
	1.5: "gap-3",
	2: "gap-4",
	2.5: "gap-5",
	3: "gap-6",
	3.5: "gap-7",
	4: "gap-8",
	5: "gap-10",
	6: "gap-12",
	8: "gap-16",
	10: "gap-20",
};

/** `sx` spacing units are 8px each. */
function spacingStyle(value: number | string): number | string {
	return typeof value === "number" ? value * 8 : value;
}

/** `sx` sizing: numbers ≤ 1 are percentages, larger numbers are px. */
function sizingStyle(value: number | string): number | string {
	if (typeof value !== "number") return value;
	return value <= 1 && value !== 0 ? `${value * 100}%` : `${value}px`;
}

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
		/** The container wrapper: a centered max-w-3xl column (settings). */
		container?: boolean;
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
	const contentSpacing = config.spacing ?? (config.fullBleed === true ? 0 : 3);
	const contentGapClass = GAP[contentSpacing];
	const contentGapStyle: CSSProperties | undefined = contentGapClass
		? undefined
		: { gap: `${contentSpacing * 8}px` };
	const contentEl = (
		<LayoutChildren
			elements={content}
			pathParams={pathParams}
			context={context}
		/>
	);
	const contentWithSpacing =
		contentSpacing > 0 ? (
			<div
				className={["flex flex-col", contentGapClass].filter(Boolean).join(" ")}
				style={contentGapStyle}
			>
				{contentEl}
			</div>
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

	const surfaceStyle: CSSProperties = {};
	if (config.padding != null) {
		surfaceStyle.padding = spacingStyle(config.padding);
	}
	if (config.radius != null) {
		surfaceStyle.borderRadius = spacingStyle(config.radius);
	}
	if (config.maxWidth != null) {
		surfaceStyle.maxWidth = sizingStyle(config.maxWidth);
	}

	// Two screen wrappers: the regular full-width layout, or the centered
	// container for settings screens. The container has one fixed width so
	// every settings screen shares the same page width.
	const containerClass = config.container
		? "mx-auto w-full max-w-3xl"
		: "w-full";

	return (
		<RecordProvider value={record ?? null}>
			<div className={containerClass}>
			<div className="flex h-full flex-col gap-3">
				{hasHeader && (
					/* One row from 768px; a wrapped column on phones. */
					<div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
						<div className="min-w-0">
							{title && (
								<h5 className="text-2xl font-semibold break-words tracking-tight text-foreground">
									{title}
								</h5>
							)}
							{description && (
								<p className="text-sm break-words text-muted-foreground">
									{description}
								</p>
							)}
						</div>
						{actions.length > 0 && (
							/* Phones: the primary action is a full-width tap target,
							   not a squeezed pill next to the title. */
							<div className="flex w-full flex-col items-stretch gap-4 [&>button]:w-full sm:w-auto sm:flex-row sm:items-center sm:[&>button]:w-auto">
								{actions.map((el) => (
									<ComponentRenderer
										key={el.id}
										component={el.referencedComponent!}
										pathParams={pathParams}
										paramBindings={el.paramBindings}
										context={context}
									/>
								))}
							</div>
						)}
					</div>
				)}
				<div
					className={[
						// The shell already provides the working surface (an inset
						// panel); a second card here would nest cards. Screens keep
						// their own section surfaces instead.
						"flex min-h-0 flex-1 flex-col",
						config.maxWidth != null ? "mx-auto w-full" : undefined,
					]
						.filter(Boolean)
						.join(" ")}
					style={Object.keys(surfaceStyle).length > 0 ? surfaceStyle : undefined}
				>
					{/* The spaced wrapper, not the bare children: a detail page stacks
					    summary/info/form blocks and they must not touch. Children know
					    the layout already owns the screen title. */}
					<ScreenContentContext.Provider value={true}>
						{contentWithSpacing}
					</ScreenContentContext.Provider>
				</div>
			</div>
			</div>
		</RecordProvider>
	);
}
