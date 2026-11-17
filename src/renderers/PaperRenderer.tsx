"use client";

import type { CSSProperties, ReactElement } from "react";
import type { RenderedComponent } from "../types";
import { LayoutChildren } from "./layoutChildren";

// ──────────────────────────────────────────────────────────────────
// PaperRenderer — the rounded surface (card). Replaces the renderer's
// hidden BodyCard: authors opt in with a Paper node.
//
// Surface: `bg-card` + `border border-border` + `rounded-lg` (the card
// token). Runtime config (padding / radius / maxWidth) still wins, as an
// inline style, because authored values are not known at build time.
// ──────────────────────────────────────────────────────────────────

/** `sx` spacing units are 8px each. */
function spacingStyle(value: number | string): number | string {
	return typeof value === "number" ? value * 8 : value;
}

/** `sx` sizing: numbers ≤ 1 are percentages, larger numbers are px. */
function sizingStyle(value: number | string): number | string {
	if (typeof value !== "number") return value;
	return value <= 1 && value !== 0 ? `${value * 100}%` : `${value}px`;
}

export function PaperRenderer({
	component,
	pathParams,
	context,
}: {
	component: RenderedComponent;
	pathParams?: Record<string, string>;
	context?: string;
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

	const children = (
		<LayoutChildren elements={elements} pathParams={pathParams} context={context} />
	);

	if (config.fullBleed === true) {
		return children;
	}

	const className = [
		"bg-card text-card-foreground border border-border h-full",
		config.square ? "rounded-none" : "rounded-lg",
		config.variant === "outlined"
			? undefined
			: (config.elevation ?? 1) > 0
				? "shadow-sm"
				: undefined,
		config.padding != null ? undefined : "p-5",
		config.maxWidth != null ? "mx-auto" : undefined,
	]
		.filter(Boolean)
		.join(" ");

	const style: CSSProperties = {};
	if (config.padding != null) style.padding = spacingStyle(config.padding);
	if (config.radius != null) style.borderRadius = spacingStyle(config.radius);
	if (config.maxWidth != null) style.maxWidth = sizingStyle(config.maxWidth);

	return (
		<div
			className={className}
			style={Object.keys(style).length > 0 ? style : undefined}
		>
			{children}
		</div>
	);
}
