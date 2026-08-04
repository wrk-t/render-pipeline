"use client";

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { type ReactElement, useMemo } from "react";
import { ComponentRenderer } from "../ComponentRenderer";
import { useFeatures } from "../hooks/useFeatures";
import type { RenderedComponent, RenderedElement } from "../types";
import { useDateRange } from "./DateRangeContext";
import { useVersion, VersionProvider } from "./VersionContext";

// Blueprint names that render their own background/padding and should
// not be wrapped in a white card.
const FULL_BLEED_BLUEPRINTS = new Set(["date-range-picker"]);

// Card wrapper for body children
function BodyCard({
	children,
	fullBleed,
}: {
	children: ReactElement;
	fullBleed?: boolean;
}) {
	if (fullBleed) {
		return children;
	}
	return (
		<Box
			sx={(theme) => {
				return {
					background: theme.palette.common.white,
					p: 2.5,
					borderRadius: 2,
					height: "100%",
				};
			}}
		>
			{children}
		</Box>
	);
}

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
	const layout = (component.config as any)?.layout ?? "stacked";

	// Feature-gated elements: hidden when their component requires a
	// feature flag that is OFF for the current user context.
	const isFeatureVisible = (el: RenderedElement): boolean => {
		const required = el.referencedComponent?.config?.requiresFeature as
			| string
			| undefined;
		if (!required) return true;
		return features[required] === true;
	};

	// Sort body elements: explicit rows first, then by displayOrder
	const sortedBody = [...bodyElements]
		.filter((e) => e.isActive)
		.filter(isFeatureVisible)
		.sort((a, b) => {
			const aRow = a.grid?.row ?? Number.POSITIVE_INFINITY;
			const bRow = b.grid?.row ?? Number.POSITIVE_INFINITY;
			if (aRow !== bRow) return aRow - bRow;
			return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
		});

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

			{/* ── Body area ────────────────────────────────────── */}
			{layout === "sidebar" ? (
				<Stack direction="row" spacing={3}>
					<Box className="flex-1">
						<Stack spacing={3}>
							{sortedBody.map((el) => {
								if (
									el.elementType === "component_ref" &&
									el.referencedComponent
								) {
									return (
										<BodyCard
											key={el.id}
											fullBleed={FULL_BLEED_BLUEPRINTS.has(
												el.referencedComponent.blueprintName,
											)}
										>
											<ComponentRenderer
												component={el.referencedComponent}
												pathParams={extendedPathParams}
												paramBindings={el.paramBindings}
											/>
										</BodyCard>
									);
								}
								return null;
							})}
						</Stack>
					</Box>
				</Stack>
			) : (
				<Grid container spacing={2}>
					{sortedBody.map((el) => {
						if (el.elementType === "component_ref" && el.referencedComponent) {
							const colSpan = el.grid?.colSpan ?? 12;
							const row = el.grid?.row;
							return (
								<Grid key={el.id} size={{ xs: 12, sm: colSpan }}>
									<BodyCard
										fullBleed={FULL_BLEED_BLUEPRINTS.has(
											el.referencedComponent.blueprintName,
										)}
									>
										<ComponentRenderer
											component={el.referencedComponent}
											pathParams={extendedPathParams}
											paramBindings={el.paramBindings}
										/>
									</BodyCard>
								</Grid>
							);
						}
						return null;
					})}
				</Grid>
			)}
		</Box>
	);
}
