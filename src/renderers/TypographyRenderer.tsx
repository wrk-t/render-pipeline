"use client";

import type { CSSProperties, ReactElement } from "react";
import type { RendererProps } from "../types";

// ──────────────────────────────────────────────────────────────────
// TypographyRenderer — headings and text.
//
// Each MUI typography variant maps to a semantic element plus the
// size/weight/line-height/letter-spacing classes that reproduce the same
// visual result (MUI's default type scale).
// ──────────────────────────────────────────────────────────────────

type TTypographyTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "span";

const VARIANTS: Record<
	string,
	{ tag: TTypographyTag; className: string }
> = {
	h1: {
		tag: "h1",
		className:
			"text-[6rem] font-light leading-[1.167] tracking-[-0.01562em]",
	},
	h2: {
		tag: "h2",
		className: "text-6xl font-light leading-[1.2] tracking-[-0.00833em]",
	},
	h3: {
		tag: "h3",
		className: "text-5xl font-normal leading-[1.167]",
	},
	h4: {
		tag: "h4",
		className:
			"text-[2.125rem] font-normal leading-[1.235] tracking-[0.00735em]",
	},
	h5: {
		tag: "h5",
		className: "text-2xl font-normal leading-[1.334]",
	},
	h6: {
		tag: "h6",
		className: "text-xl font-medium leading-[1.6] tracking-[0.0075em]",
	},
	subtitle1: {
		tag: "p",
		className: "text-base font-normal leading-[1.75] tracking-[0.00938em]",
	},
	subtitle2: {
		tag: "p",
		className: "text-sm font-medium leading-[1.57] tracking-[0.00714em]",
	},
	body1: {
		tag: "p",
		className: "text-base font-normal leading-[1.5] tracking-[0.00938em]",
	},
	body2: {
		tag: "p",
		className: "text-sm font-normal leading-[1.43] tracking-[0.01071em]",
	},
	button: {
		tag: "span",
		className:
			"text-sm font-medium uppercase leading-[1.75] tracking-[0.02857em]",
	},
	caption: {
		tag: "span",
		className: "text-xs font-normal leading-[1.66] tracking-[0.03333em]",
	},
	overline: {
		tag: "span",
		className:
			"text-xs font-normal uppercase leading-[2.66] tracking-[1em]",
	},
};

/** MUI colour tokens → semantic Tailwind colours. */
const COLOR: Record<string, string> = {
	"text.primary": "text-foreground",
	"text.secondary": "text-muted-foreground",
	"text.disabled": "text-muted-foreground/50",
	primary: "text-primary",
	secondary: "text-secondary-foreground",
	error: "text-destructive",
	warning: "text-warning-main",
	info: "text-info-main",
	success: "text-success-main",
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
