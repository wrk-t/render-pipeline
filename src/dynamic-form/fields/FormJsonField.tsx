// ═══════════════════════════════════════════════════════════════
// FormJsonField — Monaco-based JSON editor for form fields.
// ═══════════════════════════════════════════════════════════════
"use client";

import { useField } from "formik";
import { type ReactElement, useMemo } from "react";
import { LocalMonacoEditor } from "../../components/common/LocalMonacoEditor";

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

	const isError = Boolean(meta.touched && meta.error);

	return (
		<div className="flex w-full flex-col">
			{field.label && (
				<span className="mb-1 text-sm font-medium text-foreground">
					{field.label}
					{field.isRequired && (
						<span className="ms-0.5 text-destructive" aria-hidden="true">
							*
						</span>
					)}
				</span>
			)}
			<div
				className={`overflow-hidden rounded-lg ${
					field.bordered === false
						? ""
						: `border ${isError ? "border-destructive" : "border-border"}`
				}`}
			>
				<LocalMonacoEditor
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
			</div>
			{isError && <p className="text-xs text-destructive">{meta.error}</p>}
		</div>
	);
}
