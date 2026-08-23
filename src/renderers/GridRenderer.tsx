"use client";

import Grid from "@mui/material/Grid";
import type { ReactElement } from "react";
import type { RenderedComponent } from "../types";
import { LayoutChildren } from "./layoutChildren";

// ──────────────────────────────────────────────────────────────────
// GridRenderer — explicit MUI Grid layout.
//
//   config.container === true  → `<Grid container>`; children are grid
//                                items (nested grid components with
//                                `sizes`) or full-width components.
//   config.container falsy     → a grid item: `<Grid size={config.sizes}>`
//                                used when the node is a child of a
//                                container grid.
//
// Replaces the renderer's hidden implicit grid: spacing, sizing and
// offsets now come from the authored config, so the rendered output
// matches the DSL tree exactly (drag-and-drop builder friendly).
// ──────────────────────────────────────────────────────────────────

	export function GridRenderer({
		component,
		pathParams,
	}: {
		component: RenderedComponent;
		pathParams?: Record<string, string>;
	}): ReactElement {
		const config = (component.config ?? {}) as {
			container?: boolean;
			spacing?: number;
			direction?: "row" | "row-reverse";
			alignItems?: "flex-start" | "center" | "flex-end" | "stretch" | "baseline";
			justifyContent?:
				| "flex-start"
				| "center"
				| "flex-end"
				| "space-between"
				| "space-around"
				| "space-evenly";
			sizes?: Record<string, number>;
			offset?: Record<string, number>;
		};

		const elements = (component.slotsFilled["content"] ?? [])
			.filter((e) => e.isActive)
			.sort((a, b) => a.displayOrder - b.displayOrder);

		if (config.container === true) {
			return (
				<Grid
					container
					spacing={config.spacing ?? 2}
					direction={config.direction}
					sx={{
						...(config.alignItems ? { alignItems: config.alignItems } : {}),
						...(config.justifyContent
							? { justifyContent: config.justifyContent }
							: {}),
					}}
				>
					<LayoutChildren elements={elements} pathParams={pathParams} />
				</Grid>
			);
		}

		return (
			<Grid size={config.sizes} offset={config.offset}>
				<LayoutChildren elements={elements} pathParams={pathParams} />
			</Grid>
		);
	}
