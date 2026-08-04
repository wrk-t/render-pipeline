"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { ReactElement } from "react";
import { ComponentRenderer } from "../ComponentRenderer";
import type { RenderedComponent } from "../types";

export function PageRenderer({
	component,
	pathParams,
}: {
	component: RenderedComponent;
	pathParams?: Record<string, string>;
}): ReactElement {
	const bodyElements = component.slotsFilled["body"] ?? [];

	// Sort by grid row then col for css-grid layout
	const sorted = [...bodyElements]
		.filter((e) => e.isActive)
		.sort((a, b) => {
			const aRow = a.grid?.row ?? 0;
			const bRow = b.grid?.row ?? 0;
			if (aRow !== bRow) return aRow - bRow;
			return (a.grid?.col ?? 0) - (b.grid?.col ?? 0);
		});

	return (
		<Box className="p-4">
			{component.displayName && (
				<Typography variant="h4" className="mb-4 font-bold">
					{component.displayName}
				</Typography>
			)}
			<Stack spacing={3}>
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
			</Stack>
		</Box>
	);
}
