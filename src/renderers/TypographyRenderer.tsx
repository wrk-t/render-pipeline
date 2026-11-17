"use client";

import type { CSSProperties, ReactElement } from "react";
import type { RendererProps } from "../types";

// ──────────────────────────────────────────────────────────────────
// TypographyRenderer — headings and text.
//
// Each authored typography variant maps to a semantic element plus the
// Tailwind type-scale utilities that give it the corresponding role in
// shadcn's visual language (no MUI type scale, no uppercase labels).
// ──────────────────────────────────────────────────────────────────

type TTypographyTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "span";

const VARIANTS: Record<
	string,
	{ tag: TTypographyTag; className: string }
> = {
	h1: {
		tag: "h1",
		className: "text-4xl font-bold tracking-tight",
	},
	h2: {
		tag: "h2",
		className: "text-3xl font-semibold tracking-tight",
	},
	h3: {
		tag: "h3",
		className: "text-2xl font-semibold tracking-tight",
	},
	h4: {
		tag: "h4",
		className: "text-xl font-semibold tracking-tight",
	},
	h5: {
		tag: "h5",
		className: "text-lg font-semibold",
	},
	h6: {
		tag: "h6",
		className: "text-base font-semibold",
	},
	subtitle1: {
		tag: "p",
		className: "text-base font-medium",
	},
	subtitle2: {
		tag: "p",
		className: "text-sm font-medium",
	},
	body1: {
		tag: "p",
		className: "text-base",
	},
	body2: {
		tag: "p",
		className: "text-sm",
	},
	button: {
		tag: "span",
		className: "text-sm font-medium",
	},
	caption: {
		tag: "span",
		className: "text-xs",
	},
	overline: {
		tag: "span",
		className: "text-xs font-medium tracking-widest",
	},
};

/** Authored colour names → semantic Tailwind colours. */
const COLOR: Record<string, string> = {
	"text.primary": "text-foreground",
	"text.secondary": "text-muted-foreground",
	"text.disabled": "text-muted-foreground/50",
	primary: "text-primary",
	secondary: "text-secondary-foreground",
	error: "text-destructive",
	// shadcn has no warning/info/success semantic tokens; use the stock
	// Tailwind palette so the authored colour still reads distinctly.
	warning: "text-amber-600 dark:text-amber-500",
	info: "text-sky-600 dark:text-sky-400",
	success: "text-emerald-600 dark:text-emerald-500",
	inherit: "",
};

/** `align` is physical in the DSL; render it with logical utilities. */
const ALIGN: Record<string, string> = {
	left: "text-start",
	center: "text-center",
	right: "text-end",
	justify: "text-justify",
	inherit: "",
};

export function TypographyRenderer({ component }: RendererProps): ReactElement {
	const config = (component.config ?? {}) as {
		text?: string;
		variant?: string;
		align?: string;
		color?: string;
		className?: string;
	};

	const variant =
		config.variant && VARIANTS[config.variant] ? config.variant : "body1";
	const { tag: Tag, className: variantClass } = VARIANTS[variant];

	// A raw CSS colour (hex/rgb/var) has no Tailwind token → keep it inline.
	const style: CSSProperties | undefined =
		config.color && !(config.color in COLOR)
			? { color: config.color }
			: undefined;

	const className = [
		variantClass,
		config.color ? COLOR[config.color] : undefined,
		config.align ? ALIGN[config.align] : undefined,
		config.className,
	]
		.filter(Boolean)
		.join(" ");

	return (
		<Tag className={className} style={style}>
			{config.text ?? component.displayName}
		</Tag>
	);
}
