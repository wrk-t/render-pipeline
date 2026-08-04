// ═══════════════════════════════════════════════════════════════
// FormMultiSelectField — Autocomplete with multiple selection.
// Uses the same datasource pattern as FormAutocompleteField.
// ═══════════════════════════════════════════════════════════════
"use client";

import { Stack, Typography } from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import { useField, useFormikContext } from "formik";
import {
	type ReactElement,
	type SyntheticEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import useSWR from "swr";
import { getApiClient } from "../../deps";
import type { EntityMeta, MultiselectField, SelectOption } from "../types";

// ── Helpers ──────────────────────────────────────────────────

function toSelectOption(item: unknown, entityMeta?: EntityMeta): SelectOption {
	if (item === null || item === undefined) return { label: "", value: "" };
	const obj = item as Record<string, unknown>;
	if ("label" in obj && "value" in obj) {
		return { label: String(obj.label ?? ""), value: obj.value };
	}
	const displayField = entityMeta?.displayField;
	const valueField = entityMeta?.valueField ?? "id";
	return {
		label: String(
			obj[displayField ?? "displayName"] ??
				obj.displayName ??
				obj.name ??
				obj.label ??
				"",
		),
		value: obj[valueField] ?? obj.id ?? obj.value,
	};
}

// ── Component ────────────────────────────────────────────────

export function FormMultiSelectField({
	field,
}: {
	field: MultiselectField;
}): ReactElement {
	const [{ value: rawValue }, meta, { setValue, setTouched }] = useField<
		string[]
	>(field.name);
	const { isSubmitting } = useFormikContext();

	const [options, setOptions] = useState<SelectOption[]>([]);
	const [loading, setLoading] = useState(false);
	const [inputValue, setInputValue] = useState("");

	const datasource = field.datasource;
	const entityMeta =
		datasource?.type === "service" ? datasource.entityMeta : undefined;

	// Normalise value to an array
	const selectedValues: string[] = Array.isArray(rawValue)
		? rawValue
		: rawValue
			? [rawValue]
			: [];

	const selectedOptions = options.filter((o) =>
		selectedValues.includes(String(o.value)),
	);

	// Load options
	const loadOptions = useCallback(async () => {
		if (!datasource) return;
		setLoading(true);
		try {
			if (datasource.type === "static") {
				setOptions(
					(datasource.options ?? []).map((o: any) => ({
						label: String(o.label ?? ""),
						value: o.value,
					})),
				);
			} else if (datasource.type === "service") {
				const res = await getApiClient().get(datasource.endpoint);
				const items = res.data?.data?.data ?? res.data?.data ?? res.data ?? [];
				const arr = Array.isArray(items) ? items : [items];
				setOptions(
					arr.map((item: unknown) => toSelectOption(item, entityMeta)),
				);
			}
		} catch {
			// silent
		} finally {
			setLoading(false);
		}
	}, [datasource, entityMeta]);

	useEffect(() => {
		loadOptions();
	}, [loadOptions]);

	const handleChange = useCallback(
		(_: SyntheticEvent, newValue: SelectOption[]) => {
			const ids = newValue.map((o) => o.value as string);
			setValue(ids);
			setTimeout(() => setTouched(true), 0);
		},
		[setValue, setTouched],
	);

	return (
		<Stack spacing={0.5}>
			<Autocomplete
				multiple
				options={options}
				loading={loading}
				value={selectedOptions}
				onChange={handleChange}
				inputValue={inputValue}
				onInputChange={(_, v) => setInputValue(v)}
				disabled={isSubmitting || field.isReadOnly}
				getOptionLabel={(o) => o.label}
				isOptionEqualToValue={(o, v) => String(o.value) === String(v.value)}
				renderInput={(params) => (
					<TextField
						{...params}
						label={field.label}
						error={meta.touched && !!meta.error}
						helperText={meta.touched && meta.error ? meta.error : undefined}
						size="small"
					/>
				)}
			/>
			{field.description && (
				<Typography variant="caption" color="text.secondary">
					{field.description}
				</Typography>
			)}
		</Stack>
	);
}
