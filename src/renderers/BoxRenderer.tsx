"use client";

import Box from "@mui/material/Box";
import type { ReactElement } from "react";
import type { RenderedComponent } from "../types";
import { LayoutChildren } from "./layoutChildren";

// ──────────────────────────────────────────────────────────────────
// BoxRenderer — MUI Box (generic div with system props). The catch-all
// for layout that isn't Stack/Grid/Container.
// ──────────────────────────────────────────────────────────────────

export function BoxRenderer({
	component,
	pathParams,
}: {
	component: RenderedComponent;
	pathParams?: Record<string, string>;
}): ReactElement {
	const config = (component.config ?? {}) as {
		display?: string;
		flexDirection?: string;
		alignItems?: string;
		justifyContent?: string;
		gap?: number | string;
		padding?: number | string;
		margin?: number | string;
		width?: number | string;
		height?: number | string;
		maxWidth?: number | string;
		minWidth?: number | string;
		textAlign?: string;
		bgcolor?: string;
		className?: string;
	};

	const elements = (component.slotsFilled["content"] ?? [])
		.filter((e) => e.isActive)
		.sort((a, b) => a.displayOrder - b.displayOrder);

	return (
		<Box
			className={config.className}
			sx={
				{
					display: config.display,
					flexDirection: config.flexDirection,
					alignItems: config.alignItems,
					justifyContent: config.justifyContent,
					gap: config.gap,
					p: config.padding,
					m: config.margin,
					width: config.width,
					height: config.height,
					maxWidth: config.maxWidth,
					minWidth: config.minWidth,
					textAlign: config.textAlign,
					bgcolor: config.bgcolor,
				} as any
			}
		>
			<LayoutChildren elements={elements} pathParams={pathParams} />
		</Box>
	);
}
