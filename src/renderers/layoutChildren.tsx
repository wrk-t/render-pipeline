"use client";

import { FormikContext, type FormikContextType } from "formik";
import { type ReactElement, useContext } from "react";
import { ComponentRenderer } from "../ComponentRenderer";
import { useFeatures } from "../hooks/useFeatures";
import type { RenderedElement } from "../types";
import { FormFieldRenderer, isFieldFeatureVisible } from "./FormFieldRenderer";

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

/**
 * Read Formik's context without `useFormikContext()`.
 *
 * Formik's hook warns (`tiny-warning`) when there is no provider — it does not
 * throw, so the old `try/catch` never silenced it and every layout rendered
 * outside a form logged "Formik context is undefined". Reading the context
 * directly returns `undefined` quietly, which is what this slot means: no
 * form context → render the read-only label/value fallback below.
 */
function useOptionalFormikContext():
	| FormikContextType<Record<string, unknown>>
	| undefined {
	return useContext(FormikContext) as
		| FormikContextType<Record<string, unknown>>
		| undefined;
}

export function LayoutChildren({
	elements,
	pathParams,
	context,
}: {
	elements: RenderedElement[];
	pathParams?: Record<string, string>;
	/** Dialog context — flows to fields (visibleWhen/readOnlyWhen) and children. */
	context?: string;
}): ReactElement | null {
	const formik = useOptionalFormikContext();
	const { features } = useFeatures();

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
							context={context}
						/>
					);
				}

				if (el.elementType === "field") {
					// Feature-gated fields never render, even in the read-only
					// (non-Formik) fallback — e.g. the MI selector behind
					// `multi_mi_instance`.
					if (!isFieldFeatureVisible(el.overrides, features)) return null;
					const name =
						(el.overrides as any)?.name ??
						el.name ??
						el.fieldDefinitionId ??
						"";
					const displayName =
						(el.overrides as any)?.displayName ?? el.label ?? name;
					if (formik) {
						return (
							<div key={el.id}>
								<FormFieldRenderer element={el} context={context} />
							</div>
						);
					}
					return (
						<div
							key={el.id}
							className="flex items-center justify-between gap-4 py-1 text-sm"
						>
							<span className="text-muted-foreground">{displayName}</span>
							<span className="font-medium text-foreground">
								{/* Placeholder — value comes from parent data */}—
							</span>
						</div>
					);
				}

				return null;
			})}
		</>
	);
}
