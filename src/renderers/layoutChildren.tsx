"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useFormikContext } from "formik";
import type { ReactElement } from "react";
import { ComponentRenderer } from "../ComponentRenderer";
import type { RenderedElement } from "../types";
import { FormFieldRenderer } from "./FormFieldRenderer";

// ──────────────────────────────────────────────────────────────────
// LayoutChildren — renders the `content` slot elements of an explicit
// layout primitive (Grid / Stack / Container).
//
//   component_ref → ComponentRenderer (nested components, incl. Grid items)
//   field         → FormFieldRenderer inside a Formik context, otherwise a
//                   read-only label/value pair (same as SectionRenderer)
//   renderer      → leaf renderers (badge, action-button, …) are not yet
//                   rendered by the pipeline — skipped.
// ──────────────────────────────────────────────────────────────────

function useOptionalFormikContext() {
	try {
		return useFormikContext<Record<string, unknown>>();
	} catch {
		return undefined;
	}
}

export function LayoutChildren({
	elements,
	pathParams,
}: {
	elements: RenderedElement[];
	pathParams?: Record<string, string>;
}): ReactElement | null {
	const formik = useOptionalFormikContext();

	return (
		<>
			{elements.map((el) => {
				if (el.elementType === "component_ref" && el.referencedComponent) {
					return (
						<ComponentRenderer
							key={el.id}
							component={el.referencedComponent}
							pathParams={pathParams}
							paramBindings={el.paramBindings}
						/>
					);
				}

				if (el.elementType === "field") {
					const name =
						(el.overrides as any)?.name ??
						el.name ??
						el.fieldDefinitionId ??
						"";
					const displayName =
						(el.overrides as any)?.displayName ?? el.label ?? name;
					if (formik) {
						return (
							<Box key={el.id}>
								<FormFieldRenderer element={el} />
							</Box>
						);
					}
					return (
						<Stack
							key={el.id}
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
					);
				}

				return null;
			})}
		</>
	);
}
