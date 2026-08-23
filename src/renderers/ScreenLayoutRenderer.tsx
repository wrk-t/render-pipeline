"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { type ReactElement, useMemo } from "react";
import { ComponentRenderer } from "../ComponentRenderer";
import { useFeatures } from "../hooks/useFeatures";
import type { RenderedComponent, RenderedElement } from "../types";
import { useDateRange } from "./DateRangeContext";
import { useVersion, VersionProvider } from "./VersionContext";

// ──────────────────────────────────────────────────────────────────
// ScreenLayoutRenderer — the screen shell.
//
// Renders the `header` slot (or the component's own title/description)
// and the `body` slot. Body children render directly in displayOrder —
// there is NO implicit grid or card wrapper anymore: authors express
// layout explicitly with Grid / Stack / Container nodes, so what you
// author is what renders (drag-and-drop builder friendly).
// ──────────────────────────────────────────────────────────────────

export function ScreenLayoutRenderer({
	component,
	pathParams,
}: {
	component: RenderedComponent;
	pathParams?: Record<string, string>;
}): ReactElement {
	// Inject date range from DateRangeContext into pathParams for all child components
	const { range } = useDateRange();
	const { selected: selectedVersion } = useVersion();
	const { features } = useFeatures();
	const dateParams = useMemo(
		() => ({
			from: String(range.from),
			to: String(range.to),
		}),
		[range],
	);
	const extendedPathParams = {
		...pathParams,
		...dateParams,
		...(selectedVersion?.id ? { versionId: selectedVersion.id } : {}),
	};
	const headerElements = component.slotsFilled["header"] ?? [];
	const bodyElements = component.slotsFilled["body"] ?? [];

	// Feature-gated elements: hidden when their component requires a
	// feature flag that is OFF for the current user context.
	const isFeatureVisible = (el: RenderedElement): boolean => {
		const required = el.referencedComponent?.config?.requiresFeature as
			| string
			| undefined;
		if (!required) return true;
		return features[required] === true;
	};

	const sortedBody = [...bodyElements]
		.filter((e) => e.isActive)
		.filter(isFeatureVisible)
		.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

	const activeHeaderEls = headerElements
		.filter((e) => e.isActive)
		.filter(isFeatureVisible)
		.sort((a, b) => a.displayOrder - b.displayOrder);

	return (
		<Box className="px-4 py-6">
			{/* ── Header area ──────────────────────────────────── */}
			<Stack spacing={1} className="mb-4">
				{activeHeaderEls.length > 0 ? (
					activeHeaderEls.map((el) => {
						if (el.elementType === "component_ref" && el.referencedComponent) {
							return (
								<ComponentRenderer
									key={el.id}
									component={el.referencedComponent}
									pathParams={extendedPathParams}
									paramBindings={el.paramBindings}
								/>
							);
						}
						return null;
					})
				) : (
					<>
						{component.displayName && (
							<Typography variant="h4" className="font-bold">
								{component.displayName}
							</Typography>
						)}
						{component.description && (
							<Typography variant="subtitle2" color="text.secondary">
								{component.description}
							</Typography>
						)}
					</>
				)}
			</Stack>

			{/* ── Body area — explicit layout (Grid/Stack/Container) ── */}
			{sortedBody.map((el) => {
				if (el.elementType === "component_ref" && el.referencedComponent) {
					return (
						<ComponentRenderer
							key={el.id}
							component={el.referencedComponent}
							pathParams={extendedPathParams}
							paramBindings={el.paramBindings}
						/>
					);
				}
				return null;
			})}
		</Box>
	);
}
