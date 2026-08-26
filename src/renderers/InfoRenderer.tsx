"use client";

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { type ReactElement, useMemo } from "react";
import useSWR from "swr";
import { ComponentRenderer } from "../ComponentRenderer";
import { getApiClient } from "../deps";
import { useFeatures } from "../hooks/useFeatures";
import type { RenderedComponent } from "../types";
import { isFieldFeatureVisible } from "./FormFieldRenderer";

function getNestedValue(obj: any, path: string): any {
	return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

export function InfoRenderer({
	component,
	pathParams,
}: {
	component: RenderedComponent;
	pathParams?: Record<string, string>;
}): ReactElement {
	const config = (component.config ?? {}) as Record<string, any>;
	const datasource = config?.datasource;
	const dataRoot: string = config?.dataRoot ?? "";
	const { features } = useFeatures();

	const endpoint = useMemo(() => {
		if (!datasource?.endpoint) return null;
		return datasource.endpoint.replace(
			/\{(\w+)\}/g,
			(_: string, key: string) =>
				pathParams && key in pathParams ? String(pathParams[key]) : `{${key}}`,
		);
	}, [datasource?.endpoint, pathParams]);

	const {
		data: recordData,
		isLoading,
		error,
	} = useSWR(endpoint, async (url: string) => {
		const r = await getApiClient().get(url);
		return r.data?.data ?? r.data ?? null;
	});

	// Resolve the root object for field lookups
	const rootData = dataRoot ? getNestedValue(recordData, dataRoot) : recordData;

	// Walk content elements
	const contentElements = (component.slotsFilled["content"] ?? [])
		.filter((e) => e.isActive)
		.sort((a, b) => a.displayOrder - b.displayOrder);

	if (isLoading) {
		return (
			<Box className="flex items-center justify-center py-8">
				<CircularProgress />
			</Box>
		);
	}

	if (error || !recordData) {
		return (
			<Typography variant="body2" color="error">
				Failed to load data.
			</Typography>
		);
	}

	return (
		<Box>
			{component.displayName && (
				<Typography variant="h6" className="mb-4">
					{component.displayName}
				</Typography>
			)}
			<Stack spacing={2} direction="row">
				{contentElements.map((el) => {
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
					if (el.elementType === "field") {
						// Feature-gated fields never render (e.g. the MI selector
						// behind `multi_mi_instance`).
						if (!isFieldFeatureVisible(el.overrides, features)) return null;
						const name =
							(el.overrides as any)?.name ??
							el.name ??
							el.fieldDefinitionId ??
							"";
						const value = name ? getNestedValue(rootData, name) : undefined;
						const displayName =
							(el.overrides as any)?.displayName ?? el.label ?? name;
						const colSpan = (el.overrides as any)?.colSpan ?? 6;
						return (
							<Box key={el.id} sx={{ flexBasis: `${(colSpan / 12) * 100}%` }}>
								<Stack className="items-center">
									<Typography
										variant="caption"
										className="!font-bold"
										color="textSecondary"
									>
										{displayName}
									</Typography>
									<Typography variant="body1">
										{value == null ? "\u2014" : String(value)}
									</Typography>
								</Stack>
							</Box>
						);
					}
					return null;
				})}
			</Stack>
		</Box>
	);
}
