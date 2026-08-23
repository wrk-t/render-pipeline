"use client";

import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { ReactElement } from "react";
import { ComponentRenderer } from "../ComponentRenderer";
import type { RenderedComponent } from "../types";
import { LayoutChildren } from "./layoutChildren";

// ──────────────────────────────────────────────────────────────────
// LayoutRenderer — the default page/panel shell: a titled Paper card.
//
//   Paper (surface)
//     └─ header: title (Typography h6) + description (body2) + actions
//     └─ content: the component tree
//
// Composes the Paper surface with a title/description header, so
// screens get a card look without hand-wrapping every widget in Paper.
// ──────────────────────────────────────────────────────────────────

export function LayoutRenderer({
	component,
	pathParams,
}: {
	component: RenderedComponent;
	pathParams?: Record<string, string>;
}): ReactElement {
	const config = (component.config ?? {}) as {
		title?: string;
		elevation?: number;
		padding?: number | string;
		radius?: number | string;
		maxWidth?: number | string;
		fullBleed?: boolean;
	};
	// `description` is an identity key — it lives on the component column,
	// not in config (same for displayName as the title fallback).
	const title = config.title ?? (component.displayName || component.name);
	const description = component.description ?? undefined;

	const content = (component.slotsFilled["content"] ?? [])
		.filter((e) => e.isActive)
		.sort((a, b) => a.displayOrder - b.displayOrder);
	const actions = (component.slotsFilled["actions"] ?? [])
		.filter(
			(e) => e.isActive && e.elementType === "component_ref" && e.referencedComponent,
		)
		.sort((a, b) => a.displayOrder - b.displayOrder);

	const hasHeader = !!(title || description || actions.length > 0);

	if (config.fullBleed === true) {
		return <LayoutChildren elements={content} pathParams={pathParams} />;
	}

	return (
		<Paper
			elevation={config.elevation ?? 1}
			sx={{
				p: config.padding ?? 2.5,
				borderRadius: config.radius ?? 2,
				height: "100%",
				...(config.maxWidth != null
					? { maxWidth: config.maxWidth, mx: "auto" }
					: {}),
			}}
		>
			{hasHeader && (
				<Stack
					direction="row"
					className="mb-3 items-center justify-between"
					spacing={2}
				>
					<Box>
						{title && (
							<Typography variant="h6" className="font-semibold">
								{title}
							</Typography>
						)}
						{description && (
							<Typography variant="body2" color="text.secondary">
								{description}
							</Typography>
						)}
					</Box>
					{actions.length > 0 && (
						<Stack direction="row" spacing={1}>
							{actions.map((el) => (
								<ComponentRenderer
									key={el.id}
									component={el.referencedComponent!}
									pathParams={pathParams}
									paramBindings={el.paramBindings}
								/>
							))}
						</Stack>
					)}
				</Stack>
			)}
			<LayoutChildren elements={content} pathParams={pathParams} />
		</Paper>
	);
}
