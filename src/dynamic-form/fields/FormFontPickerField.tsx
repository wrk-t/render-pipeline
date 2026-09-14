// ═══════════════════════════════════════════════════════════════
// FormFontPickerField – searchable font selector (react-fontpicker-ts).
//
// Lists the app's LOCAL fonts (registered via `configureRenderPipeline`
// → `localFonts`) plus Google fonts. The value is the font family NAME
// (e.g. "Bodoni Moda") — the same string the theme's `fontFamily`
// expects, so the stored value plugs straight into MUI typography.
//
// Local font files are loaded by the app's own `@font-face` rules
// (the picker only auto-loads Google fonts); Google fonts are
// restricted off for now — the public page must be able to load any
// chosen font, and only local fonts are guaranteed there.
// ═══════════════════════════════════════════════════════════════
"use client";

import Typography from "@mui/material/Typography";
import { useField } from "formik";
import { type ReactElement, useCallback, useMemo } from "react";
import FontPicker from "react-fontpicker-ts";
import { getLocalFonts } from "../../deps";

// react-fontpicker-ts compares props by REFERENCE — an inline `[]` for
// googleFonts would be a NEW array every render, cascading into a
// recomputed font list + a new `defaultCurrent` object, which makes the
// picker's internal `useEffect(() => setCurrent(defaultCurrent), [defaultCurrent])`
// loop forever (frozen page). Keep every prop identity stable.
const NO_GOOGLE_FONTS: never[] = [];

export function FormFontPickerField({
	field,
}: {
	field: {
		name: string;
		label?: string;
		isRequired?: boolean;
		isReadOnly?: boolean;
	};
}): ReactElement {
	const [formikField, meta, helpers] = useField(field.name);

	const current =
		typeof formikField.value === "string" ? formikField.value : "";

	// Stable identity for the onChange callback (see NO_GOOGLE_FONTS note).
	const handleChange = useCallback(
		(v: string) => helpers.setValue(v),
		[helpers],
	);

	// Map the app's local font catalog to the picker's Font shape.
	const localFonts = useMemo(
		() =>
			(getLocalFonts() ?? []).map((f) => ({
				name: f.name,
				category: f.category ?? "Local",
				variants: f.variants,
				isLocal: true,
				sane: f.name.toLowerCase().replace(/\s+/g, "-"),
				cased: f.name.toLowerCase(),
			})),
		[],
	);

	return (
		<div className="flex flex-col gap-1">
			{field.label && (
				<Typography variant="body2">
					{field.label}
					{field.isRequired && (
						<Typography component="span" color="error">
							{" "}
							*
						</Typography>
					)}
				</Typography>
			)}
			<FontPicker
				defaultValue={current}
				value={handleChange}
				noMatches="No matches"
				localFonts={localFonts}
				googleFonts={NO_GOOGLE_FONTS}
				mode="combo"
				autoLoad={false}
				inputId={`font-${field.name}`}
			/>
			{meta.touched && meta.error ? (
				<Typography variant="caption" color="error">
					{meta.error}
				</Typography>
			) : null}
		</div>
	);
}
