"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { ReactElement } from "react";
import { ComponentRenderer } from "../ComponentRenderer";
import type { RenderedComponent } from "../types";

// ──────────────────────────────────────────────────────────────────
// PageRenderer — a plain page shell.
//
// Renders the `body` slot children directly in displayOrder — no
// implicit grid. Authors express layout explicitly with Grid / Stack /
// Container nodes.
// ──────────────────────────────────────────────────────────────────

export function PageRenderer({
	component,
	pathParams,
}: {
	component: RenderedComponent;
	pathParams?: Record<string, string>;
}): ReactElement {
	const bodyElements = component.slotsFilled["body"] ?? [];

	const sorted = [...bodyElements]
		.filter((e) => e.isActive)
		.sort((a, b) => a.displayOrder - b.displayOrder);

	return (
		<Box className="p-4">
			{component.displayName && (
				<Typography variant="h4" className="mb-4 font-bold">
					{component.displayName}
				</Typography>
			)}
			{sorted.map((el) => {
				if (el.elementType === "component_ref" && el.referencedComponent) {
					return (
						<Box key={el.id}>
							<ComponentRenderer
								component={el.referencedComponent}
								pathParams={pathParams}
								paramBindings={el.paramBindings}
							/>
						</Box>
					);
				}
				return null;
			})}
		</Box>
	);
}
