"use client";

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
		<div className="p-4">
			{component.displayName && (
				<h1 className="mb-4 text-[2.125rem] leading-tight font-bold text-foreground">
					{component.displayName}
				</h1>
			)}
			{sorted.map((el) => {
				if (el.elementType === "component_ref" && el.referencedComponent) {
					return (
						<div key={el.id}>
							<ComponentRenderer
								component={el.referencedComponent}
								pathParams={pathParams}
								paramBindings={el.paramBindings}
							/>
						</div>
					);
				}
				return null;
			})}
		</div>
	);
}
