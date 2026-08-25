"use client";

import Stack from "@mui/material/Stack";
import type { ReactElement } from "react";
import type { RenderedComponent } from "../types";
import { LayoutChildren } from "./layoutChildren";

// ──────────────────────────────────────────────────────────────────
// StackRenderer — MUI Stack (flex with a uniform gap). The explicit
// counterpart of the implicit `<Stack spacing={N}>` wrappers the
// renderers used to hardcode.
// ──────────────────────────────────────────────────────────────────

export function StackRenderer({
	component,
	pathParams,
	context,
}: {
	component: RenderedComponent;
	pathParams?: Record<string, string>;
	context?: string;
}): ReactElement {
	const config = (component.config ?? {}) as {
		direction?: "row" | "column";
		spacing?: number;
		alignItems?: "flex-start" | "center" | "flex-end" | "stretch" | "baseline";
		justifyContent?:
			| "flex-start"
			| "center"
			| "flex-end"
			| "space-between"
			| "space-around"
			| "space-evenly";
	};

	const elements = (component.slotsFilled["content"] ?? [])
		.filter((e) => e.isActive)
		.sort((a, b) => a.displayOrder - b.displayOrder);

	return (
		<Stack
			direction={config.direction ?? "column"}
			spacing={config.spacing ?? 1}
			sx={{
				...(config.alignItems ? { alignItems: config.alignItems } : {}),
				...(config.justifyContent
					? { justifyContent: config.justifyContent }
					: {}),
			}}
		>
			<LayoutChildren elements={elements} pathParams={pathParams} context={context} />
		</Stack>
	);
}
