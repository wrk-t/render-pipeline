// ═══════════════════════════════════════════════════════════════
// FormJsonField — Monaco-based JSON editor for form fields.
// ═══════════════════════════════════════════════════════════════
"use client";

import { useField } from "formik";
import { useMemo, type ReactElement } from "react";
import Editor from "@monaco-editor/react";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";

interface FormJsonFieldProps {
	field: {
		name: string;
		label?: string;
		isRequired?: boolean;
		isReadOnly?: boolean;
		placeholder?: string;
		colSpan?: number | null;
		    /** Extra Monaco options merged over the defaults (see DEFAULT_EDITOR_OPTIONS). */
		    editorOptions?: Record<string, unknown>;
		    /** Monaco editor height. */
		    height?: string | number;
		    /** Whether to draw the divider border around the editor (default true). */
		    bordered?: boolean;
		  };
		}

const DEFAULT_EDITOR_OPTIONS: Record<string, unknown> = {
	minimap: { enabled: false },
	fontSize: 13,
	lineNumbers: "on",
	scrollBeyondLastLine: false,
	wordWrap: "on",
};

export function FormJsonField({ field }: FormJsonFieldProps): ReactElement {
	const [formikField, meta] = useField(field.name);

	const value =
		typeof formikField.value === "string"
			? formikField.value
			: JSON.stringify(formikField.value ?? {}, null, 2);

	const editorOptions = useMemo(
		() => ({ ...DEFAULT_EDITOR_OPTIONS, ...(field.editorOptions ?? {}) }),
		[field.editorOptions],
	);

	return (
		<FormControl fullWidth error={meta.touched && !!meta.error}>
			{field.label && (
				<Typography variant="body2" className="mb-1">
					{field.label}
					{field.isRequired && (
						<Typography component="span" color="error">
							{" "}
							*
						</Typography>
					)}
				</Typography>
			)}
			      <Box
			        className={`overflow-hidden rounded-[10px] ${field.bordered === false ? "" : "border border-divider"}`}
			        sx={{
			          borderColor: meta.touched && meta.error ? "error.main" : "divider",
			        }}
			      >
				<Editor
					height={field.height ?? "300px"}
					defaultLanguage="json"
					value={value}
					onChange={(val) => {
						if (!field.isReadOnly) {
							formikField.onChange({
								target: { name: field.name, value: val ?? "" },
							});
						}
					}}
					theme="vs"
					options={{
						...editorOptions,
						readOnly: field.isReadOnly,
					}}
				/>
			</Box>
			{meta.touched && meta.error && (
				<FormHelperText error>{meta.error}</FormHelperText>
			)}
		</FormControl>
	);
}
