"use client";

import type { CSSProperties, ReactElement } from "react";
import type { RenderedComponent } from "../types";
import { LayoutChildren } from "./layoutChildren";

// ──────────────────────────────────────────────────────────────────
// GridRenderer — explicit CSS grid layout.
//
//   config.container === true  → a 12-column grid container; children
//                                are grid items (nested grid components
//                                with `sizes`) or full-width components.
//   config.container falsy     → a grid item: it carries the responsive
//                                `col-span-*` classes from `sizes` (and
//                                `col-start-*` from `offset`).
//
// Replaces the renderer's hidden implicit grid: spacing, sizing and
// offsets now come from the authored config, so the rendered output
// matches the DSL tree exactly (drag-and-drop builder friendly).
//
// The class strings are static literals (not interpolated): Tailwind's
// source scanner must see every candidate it has to generate.
// ──────────────────────────────────────────────────────────────────

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

/** `sizes` (1–12 columns) → responsive `col-span` utilities. */
const SIZE_CLASSES: Record<string, Record<number, string>> = {
	xs: {
		1: "col-span-1",
		2: "col-span-2",
		3: "col-span-3",
		4: "col-span-4",
		5: "col-span-5",
		6: "col-span-6",
		7: "col-span-7",
		8: "col-span-8",
		9: "col-span-9",
		10: "col-span-10",
		11: "col-span-11",
		12: "col-span-12",
	},
	sm: {
		1: "sm:col-span-1",
		2: "sm:col-span-2",
		3: "sm:col-span-3",
		4: "sm:col-span-4",
		5: "sm:col-span-5",
		6: "sm:col-span-6",
		7: "sm:col-span-7",
		8: "sm:col-span-8",
		9: "sm:col-span-9",
		10: "sm:col-span-10",
		11: "sm:col-span-11",
		12: "sm:col-span-12",
	},
	md: {
		1: "md:col-span-1",
		2: "md:col-span-2",
		3: "md:col-span-3",
		4: "md:col-span-4",
		5: "md:col-span-5",
		6: "md:col-span-6",
		7: "md:col-span-7",
		8: "md:col-span-8",
		9: "md:col-span-9",
		10: "md:col-span-10",
		11: "md:col-span-11",
		12: "md:col-span-12",
	},
	lg: {
		1: "lg:col-span-1",
		2: "lg:col-span-2",
		3: "lg:col-span-3",
		4: "lg:col-span-4",
		5: "lg:col-span-5",
		6: "lg:col-span-6",
		7: "lg:col-span-7",
		8: "lg:col-span-8",
		9: "lg:col-span-9",
		10: "lg:col-span-10",
		11: "lg:col-span-11",
		12: "lg:col-span-12",
	},
	xl: {
		1: "xl:col-span-1",
		2: "xl:col-span-2",
		3: "xl:col-span-3",
		4: "xl:col-span-4",
		5: "xl:col-span-5",
		6: "xl:col-span-6",
		7: "xl:col-span-7",
		8: "xl:col-span-8",
		9: "xl:col-span-9",
		10: "xl:col-span-10",
		11: "xl:col-span-11",
		12: "xl:col-span-12",
	},
};

/** `offset` (columns skipped) → responsive `col-start` utilities. */
const START_CLASSES: Record<string, Record<number, string>> = {
	xs: {
		1: "col-start-1",
		2: "col-start-2",
		3: "col-start-3",
		4: "col-start-4",
		5: "col-start-5",
		6: "col-start-6",
		7: "col-start-7",
		8: "col-start-8",
		9: "col-start-9",
		10: "col-start-10",
		11: "col-start-11",
		12: "col-start-12",
	},
	sm: {
		1: "sm:col-start-1",
		2: "sm:col-start-2",
		3: "sm:col-start-3",
		4: "sm:col-start-4",
		5: "sm:col-start-5",
		6: "sm:col-start-6",
		7: "sm:col-start-7",
		8: "sm:col-start-8",
		9: "sm:col-start-9",
		10: "sm:col-start-10",
		11: "sm:col-start-11",
		12: "sm:col-start-12",
	},
	md: {
		1: "md:col-start-1",
		2: "md:col-start-2",
		3: "md:col-start-3",
		4: "md:col-start-4",
		5: "md:col-start-5",
		6: "md:col-start-6",
		7: "md:col-start-7",
		8: "md:col-start-8",
		9: "md:col-start-9",
		10: "md:col-start-10",
		11: "md:col-start-11",
		12: "md:col-start-12",
	},
	lg: {
		1: "lg:col-start-1",
		2: "lg:col-start-2",
		3: "lg:col-start-3",
		4: "lg:col-start-4",
		5: "lg:col-start-5",
		6: "lg:col-start-6",
		7: "lg:col-start-7",
		8: "lg:col-start-8",
		9: "lg:col-start-9",
		10: "lg:col-start-10",
		11: "lg:col-start-11",
		12: "lg:col-start-12",
	},
	xl: {
		1: "xl:col-start-1",
		2: "xl:col-start-2",
		3: "xl:col-start-3",
		4: "xl:col-start-4",
		5: "xl:col-start-5",
		6: "xl:col-start-6",
		7: "xl:col-start-7",
		8: "xl:col-start-8",
		9: "xl:col-start-9",
		10: "xl:col-start-10",
		11: "xl:col-start-11",
		12: "xl:col-start-12",
	},
};

function spanClass(
	breakpoint: string,
	value: number | undefined,
): string | undefined {
	if (value === undefined) return undefined;
	return SIZE_CLASSES[breakpoint]?.[value];
}

function startClass(
	breakpoint: string,
	offset: number | undefined,
): string | undefined {
	// `offset` is the number of skipped columns → start at offset + 1.
	if (offset === undefined || offset <= 0 || offset >= 12) return undefined;
	return START_CLASSES[breakpoint]?.[offset + 1];
}

export function GridRenderer({
	component,
	pathParams,
	context,
}: {
	component: RenderedComponent;
	pathParams?: Record<string, string>;
	context?: string;
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

	const spacing = config.spacing ?? 2;
	const gapClass = GAP[spacing];
	const style: CSSProperties | undefined = gapClass
		? undefined
		: { gap: `${spacing * 8}px` };

	if (config.container === true) {
		const className = [
			"grid grid-cols-12",
			gapClass,
			config.alignItems ? ALIGN_ITEMS[config.alignItems] : undefined,
			config.justifyContent
				? JUSTIFY_CONTENT[config.justifyContent]
				: undefined,
		]
			.filter(Boolean)
			.join(" ");

		return (
			<div className={className} style={style}>
				<LayoutChildren elements={elements} pathParams={pathParams} context={context} />
			</div>
		);
	}

	const sizes = config.sizes ?? {};
	const offset = config.offset ?? {};
	const className = [
		// An unsized item is a block in the authored tree → full width.
		spanClass("xs", sizes.xs) ?? "col-span-12",
		spanClass("sm", sizes.sm),
		spanClass("md", sizes.md),
		spanClass("lg", sizes.lg),
		spanClass("xl", sizes.xl),
		startClass("xs", offset.xs),
		startClass("sm", offset.sm),
		startClass("md", offset.md),
		startClass("lg", offset.lg),
		startClass("xl", offset.xl),
		"min-w-0",
	]
		.filter(Boolean)
		.join(" ");

	return (
		<div className={className}>
			<LayoutChildren elements={elements} pathParams={pathParams} context={context} />
		</div>
	);
}
