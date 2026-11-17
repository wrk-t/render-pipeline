"use client";

import type { ReactElement } from "react";
import type { RenderedComponent } from "../types";
import { LayoutChildren } from "./layoutChildren";

// ──────────────────────────────────────────────────────────────────
// ContainerRenderer — a max-width, centered wrapper with horizontal
// padding. The card surface is Paper (see PaperRenderer).
//
// MUI's Container widths are kept as explicit `max-w-[…]` steps; the
// gutters are the same 16px/24px steps MUI used below/above `sm`.
// ──────────────────────────────────────────────────────────────────

const MAX_WIDTH: Record<string, string> = {
	xs: "max-w-[444px]",
	sm: "max-w-[600px]",
	md: "max-w-[900px]",
	lg: "max-w-[1200px]",
	xl: "max-w-[1536px]",
};

export function ContainerRenderer({
	component,
	pathParams,
	context,
}: {
	component: RenderedComponent;
	pathParams?: Record<string, string>;
	context?: string;
}): ReactElement {
	const config = (component.config ?? {}) as {
		maxWidth?: "xs" | "sm" | "md" | "lg" | "xl" | false;
		disableGutters?: boolean;
		className?: string;
	};

	const elements = (component.slotsFilled["content"] ?? [])
		.filter((e) => e.isActive)
		.sort((a, b) => a.displayOrder - b.displayOrder);

	const className = [
		"mx-auto w-full",
		config.maxWidth === false
			? undefined
			: MAX_WIDTH[config.maxWidth ?? "md"],
		config.disableGutters ? undefined : "px-4 sm:px-6",
		config.className,
	]
		.filter(Boolean)
		.join(" ");

	return (
		<div className={className}>
			<LayoutChildren elements={elements} pathParams={pathParams} context={context} />
		</div>
	);
}
