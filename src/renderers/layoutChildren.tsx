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

/** Static `sm:col-span-*` classes — Tailwind must see every literal. */
const GRID_SPAN: Record<number, string> = {
	1: "sm:col-span-1",
	2: "sm:col-span-2",
	3: "sm:col-span-3",
	4: "sm:col-span-4",
	5: "sm:col-span-5",
	6: "sm:col-span-6",
	7: "sm:col-span-7",
	8: "sm:col-span-8",
	9: "sm:col-span-9",
	10: "sm:col-span-10",
	11: "sm:col-span-11",
	12: "sm:col-span-12",
};

/** A field's `colSpan` (1–12) → its grid span; 12 when unspecified. */
function gridSpanClass(el: RenderedElement): string {
	const raw = Number((el.overrides as { colSpan?: number } | undefined)?.colSpan);
	const span = Number.isFinite(raw)
		? Math.min(12, Math.max(1, Math.round(raw)))
		: 12;
	return GRID_SPAN[span] ?? "sm:col-span-12";
}

export function LayoutChildren({
	elements,
	pathParams,
	context,
	grid = false,
}: {
	elements: RenderedElement[];
	pathParams?: Record<string, string>;
	/** Dialog context — flows to fields (visibleWhen/readOnlyWhen) and children. */
	context?: string;
	/** When true, each child is a grid item: fields use their colSpan (1–12). */
	grid?: boolean;
}): ReactElement | null {
	const formik = useOptionalFormikContext();
	const { features } = useFeatures();

	return (
		<>
			{elements.map((el) => {
				const itemClass = grid ? gridSpanClass(el) : undefined;
				if (el.elementType === "component_ref" && el.referencedComponent) {
					const node = (
						<ComponentRenderer
							component={el.referencedComponent}
							pathParams={pathParams}
							paramBindings={el.paramBindings}
							context={context}
						/>
					);
					return grid ? (
						<div key={el.id} className={itemClass}>
							{node}
						</div>
					) : (
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
							<div key={el.id} className={itemClass}>
								<FormFieldRenderer element={el} context={context} />
							</div>
						);
					}
					return (
						<div
							key={el.id}
							className={[
								"flex items-center justify-between gap-4 py-1 text-sm",
								itemClass,
							]
								.filter(Boolean)
								.join(" ")}
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
