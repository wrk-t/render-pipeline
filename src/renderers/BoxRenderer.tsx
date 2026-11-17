"use client";

import type { CSSProperties, ReactElement } from "react";
import type { RenderedComponent } from "../types";
import { LayoutChildren } from "./layoutChildren";

// ──────────────────────────────────────────────────────────────────
// BoxRenderer — the generic div wrapper. The catch-all for layout that
// isn't Stack/Grid/Container.
//
// The config is authored against MUI's system props (`display`, `gap`,
// `p`, `width`, …). Enumerable values become Tailwind utilities; the
// runtime/arbitrary values (spacing, sizes, arbitrary colours) become an
// inline style, because metadata-driven values cannot be known by
// Tailwind's source scanner at build time.
// ──────────────────────────────────────────────────────────────────

const DISPLAY: Record<string, string> = {
	block: "block",
	flex: "flex",
	grid: "grid",
	inline: "inline",
	"inline-flex": "inline-flex",
	"inline-block": "inline-block",
	none: "hidden",
};

const FLEX_DIRECTION: Record<string, string> = {
	row: "flex-row",
	"row-reverse": "flex-row-reverse",
	column: "flex-col",
	"column-reverse": "flex-col-reverse",
};

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

const TEXT_ALIGN: Record<string, string> = {
	left: "text-start",
	center: "text-center",
	right: "text-end",
	justify: "text-justify",
};

/** MUI palette tokens used by authored boxes → semantic Tailwind tokens. */
const BGCOLOR: Record<string, string> = {
	"background.paper": "bg-card",
	"background.default": "bg-background",
	"action.hover": "bg-accent",
	"action.selected": "bg-accent",
	"action.disabledBackground": "bg-muted",
	"primary.main": "bg-primary",
	"secondary.main": "bg-secondary",
	"grey.100": "bg-muted",
	"grey.200": "bg-muted",
	transparent: "bg-transparent",
};

/** `sx` spacing units are 8px each. */
function spacingStyle(
	value: number | string | undefined,
): number | string | undefined {
	if (value === undefined || value === null || value === "") return undefined;
	return typeof value === "number" ? value * 8 : value;
}

/** `sx` sizing: numbers ≤ 1 are percentages, larger numbers are px. */
function sizingStyle(
	value: number | string | undefined,
): number | string | undefined {
	if (value === undefined || value === null || value === "") return undefined;
	if (typeof value !== "number") return value;
	return value <= 1 && value !== 0 ? `${value * 100}%` : `${value}px`;
}

export function BoxRenderer({
	component,
	pathParams,
	context,
}: {
	component: RenderedComponent;
	pathParams?: Record<string, string>;
	context?: string;
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

	const className = [
		config.display ? DISPLAY[config.display] : undefined,
		config.flexDirection ? FLEX_DIRECTION[config.flexDirection] : undefined,
		config.alignItems ? ALIGN_ITEMS[config.alignItems] : undefined,
		config.justifyContent
			? JUSTIFY_CONTENT[config.justifyContent]
			: undefined,
		config.textAlign ? TEXT_ALIGN[config.textAlign] : undefined,
		config.bgcolor ? BGCOLOR[config.bgcolor] : undefined,
		config.className,
	]
		.filter(Boolean)
		.join(" ");

	const style: CSSProperties = {};
	const gap = spacingStyle(config.gap);
	if (gap !== undefined) style.gap = gap;
	const padding = spacingStyle(config.padding);
	if (padding !== undefined) style.padding = padding;
	const margin = spacingStyle(config.margin);
	if (margin !== undefined) style.margin = margin;
	const width = sizingStyle(config.width);
	if (width !== undefined) style.width = width;
	const height = sizingStyle(config.height);
	if (height !== undefined) style.height = height;
	const maxWidth = sizingStyle(config.maxWidth);
	if (maxWidth !== undefined) style.maxWidth = maxWidth;
	const minWidth = sizingStyle(config.minWidth);
	if (minWidth !== undefined) style.minWidth = minWidth;
	// An arbitrary colour string (hex/rgb/var) has no Tailwind token.
	if (config.bgcolor && !BGCOLOR[config.bgcolor]) {
		style.backgroundColor = config.bgcolor;
	}

	return (
		<div
			className={className || undefined}
			style={Object.keys(style).length > 0 ? style : undefined}
		>
			<LayoutChildren elements={elements} pathParams={pathParams} context={context} />
		</div>
	);
}
