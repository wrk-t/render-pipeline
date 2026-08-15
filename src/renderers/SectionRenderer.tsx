"use client";

import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useFormikContext } from "formik";
import { type ReactElement, useState } from "react";
import { checkComponentPermission } from "../ability/checkComponentPermission";
import { ComponentRenderer } from "../ComponentRenderer";
import { Unicon } from "../components/common/icon/Unicon";
import { useRenderUser } from "../deps";
import { useFeatures } from "../hooks/useFeatures";
import type { RenderedComponent } from "../types";
import { FormFieldRenderer } from "./FormFieldRenderer";

function useOptionalFormikContext() {
	try {
		return useFormikContext<Record<string, unknown>>();
	} catch {
		return undefined;
	}
}

/** Converts colSpan (1-12) to MUI Grid size */
function toGridSize(colSpan: number | null | undefined): number {
	if (colSpan === null || colSpan === undefined || colSpan < 1) return 12;
	return Math.min(Math.max(Math.round(colSpan), 1), 12);
}

export function SectionRenderer({
	component,
	pathParams,
}: {
	component: RenderedComponent;
	pathParams?: Record<string, string>;
}): ReactElement {
	const title = (component.config as any)?.title ?? component.displayName;
	const collapsible = (component.config as any)?.collapsible ?? false;
	const [collapsed, setCollapsed] = useState<boolean>(
		(component.config as any)?.collapsedByDefault ?? false,
	);
	const formik = useOptionalFormikContext();

	const { data: user } = useRenderUser();
	const userPermissions: Array<{ resource: string; scope?: string }> =
		(user as any)?.permissions?.data ?? [];
	const { features } = useFeatures();

	const contentElements = (component.slotsFilled["content"] ?? [])
		.filter((e) => e.isActive)
		.filter((e) => {
			const vp = (e.overrides as any)?.visibleToPermissions;
			if (!vp || vp.length === 0) return true;
			return checkComponentPermission(userPermissions, vp);
		})
		// Feature-gated fields — same semantics as FormRenderer:
		// `requiresFeature` shows only when the flag is ON;
		// `hiddenWhenFeature` hides when the flag is ON (e.g. version-level
		// fields on the package form, which belong to the versions screen).
		.filter((e) => {
			const rf = (e.overrides as any)?.requiresFeature;
			if (rf && !features[rf]) return false;
			const hwf = (e.overrides as any)?.hiddenWhenFeature;
			if (hwf && features[hwf]) return false;
			return true;
		})
		.sort((a, b) => a.displayOrder - b.displayOrder);

	return (
		<Box>
			{title && (
				<Stack
					direction="row"
					spacing={1}
					className={`mb-4 items-center ${collapsible ? "cursor-pointer select-none" : ""}`}
					onClick={() => collapsible && setCollapsed((prev) => !prev)}
				>
					{collapsible && (
						<Unicon
							name="NavigateNext"
							style={{
								transform: collapsed ? "rotate(0deg)" : "rotate(90deg)",
								transition: "transform 0.1s",
							}}
						/>
					)}
					<Typography variant="subtitle1" className="font-semibold">
						{title}
					</Typography>
				</Stack>
			)}
			{collapsible ? (
				<Collapse in={!collapsed}>
					<Grid container spacing={2} className="mb-3">
						{contentElements.map((el) => {
							if (
								el.elementType === "component_ref" &&
								el.referencedComponent
							) {
								return (
									<Grid key={el.id} size={{ xs: 12 }}>
										<ComponentRenderer
											component={el.referencedComponent}
											pathParams={pathParams}
											paramBindings={el.paramBindings}
										/>
									</Grid>
								);
							}
							if (el.elementType === "field") {
								const colSpan = (el.overrides as any)?.colSpan ?? 12;
								if (formik) {
									return (
										<Grid
											key={el.id}
											size={{ xs: 12, sm: toGridSize(colSpan) }}
										>
											<FormFieldRenderer element={el} />
										</Grid>
									);
								}

								const displayName =
									(el.overrides as any)?.displayName ??
									el.label ??
									el.name ??
									"";
								const name =
									(el.overrides as any)?.name ??
									el.name ??
									el.fieldDefinitionId ??
									"";
								return (
									<Grid key={el.id} size={{ xs: 12, sm: toGridSize(colSpan) }}>
										<Stack
											direction="row"
											className="justify-between items-center"
										>
											<Typography variant="body2" color="text.secondary">
												{displayName}
											</Typography>
											<Typography variant="body2">
												{/* Placeholder — value comes from parent data */}—
											</Typography>
										</Stack>
									</Grid>
								);
							}
							return null;
						})}
					</Grid>
				</Collapse>
			) : (
				<Grid container spacing={2} className="mb-3">
					{contentElements.map((el) => {
						if (el.elementType === "component_ref" && el.referencedComponent) {
							return (
								<Grid key={el.id} size={{ xs: 12 }}>
									<ComponentRenderer
										component={el.referencedComponent}
										pathParams={pathParams}
										paramBindings={el.paramBindings}
									/>
								</Grid>
							);
						}
						if (el.elementType === "field") {
							const colSpan = (el.overrides as any)?.colSpan ?? 12;
							if (formik) {
								return (
									<Grid key={el.id} size={{ xs: 12, sm: toGridSize(colSpan) }}>
										<FormFieldRenderer element={el} />
									</Grid>
								);
							}

							const displayName =
								(el.overrides as any)?.displayName ?? el.label ?? el.name ?? "";
							const name =
								(el.overrides as any)?.name ??
								el.name ??
								el.fieldDefinitionId ??
								"";
							return (
								<Grid key={el.id} size={{ xs: 12, sm: toGridSize(colSpan) }}>
									<Stack
										direction="row"
										className="justify-between items-center"
									>
										<Typography variant="body2" color="text.secondary">
											{displayName}
										</Typography>
										<Typography variant="body2">
											{/* Placeholder — value comes from parent data */}—
										</Typography>
									</Stack>
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
