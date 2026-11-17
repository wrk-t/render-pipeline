"use client";

import type { CSSProperties, ReactElement } from "react";
import type { RenderedComponent } from "../types";
import { LayoutChildren } from "./layoutChildren";

// ──────────────────────────────────────────────────────────────────
// StackRenderer — a flex container with a uniform gap. The explicit
// counterpart of the implicit `<Stack spacing={N}>` wrappers the
// renderers used to hardcode.
// ──────────────────────────────────────────────────────────────────

const ALIGN_ITEMS: Record<string, string> = {
	"flex-start": "items-start",
	center: "items-center",
	"flex-end": "items-end",
	stretch: "items-stretch",
	baseline: "items-baseline",
};

const JUSTIFY_CONTENT: Record<string, string> = {
	"flex-start": "justify-start",
	center: "justify-center",
	"flex-end": "justify-end",
	"space-between": "justify-between",
	"space-around": "justify-around",
	"space-evenly": "justify-evenly",
};

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

	const spacing = config.spacing ?? 1;
	const gapClass = GAP[spacing];
	const style: CSSProperties | undefined = gapClass
		? undefined
		: { gap: `${spacing * 8}px` };

	const className = [
		"flex",
		config.direction === "row" ? "flex-row" : "flex-col",
		config.alignItems ? ALIGN_ITEMS[config.alignItems] : undefined,
		config.justifyContent
			? JUSTIFY_CONTENT[config.justifyContent]
			: undefined,
		gapClass,
	]
		.filter(Boolean)
		.join(" ");

	return (
		<div className={className} style={style}>
			<LayoutChildren elements={elements} pathParams={pathParams} context={context} />
		</div>
	);
}
