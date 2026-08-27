"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { ReactElement } from "react";
import { ComponentRenderer } from "../ComponentRenderer";
import type { RenderedComponent } from "../types";
import { LayoutChildren } from "./layoutChildren";
import { Paper } from "@mui/material";

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
	};
	// `description` is an identity key — it lives on the component column,
	// not in config (same for displayName as the title fallback).
	const title = config.title ?? (component.displayName || component.name);
	const description = component.description ?? undefined;

	const content = (component.slotsFilled["content"] ?? [])
			.filter((e) => e.isActive)
			.sort((a, b) => a.displayOrder - b.displayOrder);
	const actions = (component.slotsFilled["actions"] ?? [])
			.filter(
				(e) => e.isActive && e.elementType === "component_ref" && e.referencedComponent,
			)
			.sort((a, b) => a.displayOrder - b.displayOrder);

	const hasHeader = !!(title || description || actions.length > 0);

	// Vertical gap between content children (e.g. stacked cards).
	const contentEl = (
		<LayoutChildren elements={content} pathParams={pathParams} context={context} />
	);
	const contentWithSpacing =
		config.spacing != null && config.spacing > 0 ? (
			<Stack spacing={config.spacing}>{contentEl}</Stack>
		) : (
			contentEl
		);

	if (config.fullBleed === true) {
		return contentWithSpacing;
	}

	return (
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
					p: config.padding ?? 2.5,
					borderRadius: config.radius ?? 2,
					flex: 1,
					minHeight: 0,
					...(config.maxWidth != null
						? { maxWidth: config.maxWidth, mx: "auto", width: "100%" }
						: {}),
				}}
			>
				<LayoutChildren elements={content} pathParams={pathParams} />
			</Paper>
		</Stack>
	);
}
