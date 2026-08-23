"use client";

import Paper from "@mui/material/Paper";
import type { ReactElement } from "react";
import type { RenderedComponent } from "../types";
import { LayoutChildren } from "./layoutChildren";

// ──────────────────────────────────────────────────────────────────
// PaperRenderer — MUI Paper, the rounded surface (card). Replaces the
// renderer's hidden BodyCard: authors opt in with a Paper node.
// ──────────────────────────────────────────────────────────────────

export function PaperRenderer({
	component,
	pathParams,
}: {
	component: RenderedComponent;
	pathParams?: Record<string, string>;
}): ReactElement {
	const config = (component.config ?? {}) as {
		elevation?: number;
		variant?: "elevation" | "outlined";
		square?: boolean;
		padding?: number | string;
		radius?: number | string;
		maxWidth?: number | string;
		fullBleed?: boolean;
	};

	const elements = (component.slotsFilled["content"] ?? [])
		.filter((e) => e.isActive)
		.sort((a, b) => a.displayOrder - b.displayOrder);

	const children = <LayoutChildren elements={elements} pathParams={pathParams} />;

	if (config.fullBleed === true) {
		return children;
	}

	return (
		<Paper
			elevation={config.elevation ?? 1}
			variant={config.variant}
			square={config.square}
			sx={{
				p: config.padding ?? 2.5,
				borderRadius: config.radius ?? 2,
				height: "100%",
				...(config.maxWidth != null
					? { maxWidth: config.maxWidth, mx: "auto" }
					: {}),
			}}
		>
			{children}
		</Paper>
	);
}
