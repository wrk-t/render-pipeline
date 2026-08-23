"use client";

import Typography from "@mui/material/Typography";
import type { ReactElement } from "react";
import type { RendererProps } from "../types";

// ──────────────────────────────────────────────────────────────────
// TypographyRenderer — MUI Typography (headings and text).
// ──────────────────────────────────────────────────────────────────

export function TypographyRenderer({ component }: RendererProps): ReactElement {
	const config = (component.config ?? {}) as {
		text?: string;
		variant?: string;
		align?: string;
		color?: string;
		className?: string;
	};

	return (
		<Typography
			variant={config.variant as any}
			align={config.align as any}
			color={config.color as any}
			className={config.className}
		>
			{config.text ?? component.displayName}
		</Typography>
	);
}
