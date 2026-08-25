"use client";

import Container from "@mui/material/Container";
import type { ReactElement } from "react";
import type { RenderedComponent } from "../types";
import { LayoutChildren } from "./layoutChildren";

// ──────────────────────────────────────────────────────────────────
// ContainerRenderer — MUI Container: a max-width centered wrapper.
// The card surface is Paper (see PaperRenderer).
// ──────────────────────────────────────────────────────────────────

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

	return (
		<Container
			maxWidth={config.maxWidth ?? "md"}
			disableGutters={config.disableGutters}
			className={config.className}
		>
			<LayoutChildren elements={elements} pathParams={pathParams} context={context} />
		</Container>
	);
}
