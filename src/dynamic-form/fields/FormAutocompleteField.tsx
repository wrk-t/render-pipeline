// ═══════════════════════════════════════════════════════════════
// FormAutocompleteField – Renders an autocomplete field with
// support for static options, service endpoints, and entity
// references resolved by the backend.
//
// When the datasource is a service (including resolved entity
// datasources), the component fetches options dynamically as the
// user types, with debounce and minimum character thresholds.
//
// Like FormReferenceField, only the option **value** (e.g. the
// entity ID) is stored in Formik, keeping form values clean.
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
import type {
	AutocompleteField as AutocompleteFieldType,
	EntityMeta,
	FieldDatasource,
	SelectOption,
} from "../types";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Normalise an API response item into a SelectOption.
 * Uses entityMeta.displayField / entityMeta.valueField when
 * available, otherwise falls back to common field names.
 */
function toSelectOption(item: unknown, entityMeta?: EntityMeta): SelectOption {
	if (item === null || item === undefined) return { label: "", value: "" };

	const obj = item as Record<string, unknown>;

	// Already a SelectOption shape
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

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function FormAutocompleteField({
	field,
}: {
	field: AutocompleteFieldType;
}): ReactElement {
	// ── Formik integration — value is just the ID / scalar ─────
	const [{ value }, meta, { setValue, setTouched }] = useField<
		string | number | null
	>(field.name);

	const { values: formValues } = useFormikContext<Record<string, unknown>>();

	// ── Resolve datasource ─────────────────────────────────────
	const ds = field.fieldOverrides?.datasource as FieldDatasource | undefined;
	const isService = ds?.type === "service";
	const isStatic = ds?.type === "static";

	const serviceDs = isService
		? (ds as Extract<FieldDatasource, { type: "service" }>)
		: null;

	const staticOptions: SelectOption[] =
		isStatic && "options" in ds
			? (ds.options as SelectOption[])
			: (field.options ?? []);

	const entityMeta = serviceDs?.entityMeta;

	// ── Search state ────────────────────────────────────────────
	const [inputValue, setInputValue] = useState("");
	const [search, setSearch] = useState<string | null>(null);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const debounceMs = field.uiOverrides.behavior?.debounce ?? 300;
	const minChars = field.uiOverrides.behavior?.minChars ?? 2;

	// Debounce user input → trigger search
	const handleInputChange = useCallback(
		(_event: SyntheticEvent, value: string) => {
			setInputValue(value);
			if (debounceRef.current) clearTimeout(debounceRef.current);
			debounceRef.current = setTimeout(() => {
				setSearch(value.length >= minChars ? value : null);
			}, debounceMs);
		},
		[debounceMs, minChars],
	);

	useEffect(() => {
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, []);

	// ── Build the SWR key for dynamic fetching ─────────────────
	const swrKey = useServiceSwrKey(serviceDs, search, entityMeta, formValues);

	// ── Fetch options when serviceDs is present ─────────────────
	const { data: serviceData, isLoading: serviceLoading } = useSWR(
		swrKey,
		async () => {
			if (!serviceDs) return [];
			const baseUrl = process.env.NEXT_PUBLIC_ENDPOINT ?? "";

			// Build query string with search + entityMeta filter/orderBy
			const params = new URLSearchParams();

			// Always send searchFields when the entity declares them,
			// so the backend knows which columns to search even on initial fetch.
			if (entityMeta?.searchFields?.length) {
				params.set("searchFields", entityMeta.searchFields.join(","));
			}

			if (search) {
				params.set("search", search);
			}

			if (entityMeta?.filter) {
				// Resolve {fieldName} placeholders from form values
				const rawVal = String(entityMeta.filter.value);
				const resolved = rawVal.replace(/\{(\w+)\}/g, (_, key) =>
					key in formValues ? String(formValues[key] ?? "") : `{${key}}`,
				);
				if (resolved) params.set(entityMeta.filter.field, resolved);
			}

			if (entityMeta?.orderBy) {
				params.set("sortBy", entityMeta.orderBy.field);
				params.set("sortOrder", entityMeta.orderBy.direction);
			}

			// Use 'limit' for page size (matches BasePagableQueryDto)
			params.set("limit", "25");

			const qs = params.toString();
			const url = `${baseUrl}${serviceDs.endpoint}${qs ? `?${qs}` : ""}`;

			const res = await getApiClient().request({
				url,
				method: serviceDs.method ?? "GET",
			});
			const body = res.data?.data;
			if (Array.isArray(body)) return body;
			if (body && Array.isArray(body.data)) return body.data;
			return [];
		},
	);

	// ── Build the final option list ────────────────────────────
	const options: SelectOption[] = serviceDs
		? Array.isArray(serviceData)
			? serviceData.map((item: unknown) => toSelectOption(item, entityMeta))
			: []
		: staticOptions;

	// ── Find the currently selected option object ──────────────
	const selectedOption = options.find((opt) => opt.value === value) ?? null;

	// ── Handle selection — store only the value ────────────────
	const handleChange = (
		_event: SyntheticEvent,
		option: SelectOption | null,
	): void => {
		setValue(option ? (option.value as string | number) : null);
		// Delay touched to let Formik process the value change first
		setTimeout(() => setTouched(true), 0);
	};

	return (
		<Stack spacing={0.2}>
			<Autocomplete<SelectOption, false, false, false>
				value={selectedOption}
				onChange={handleChange}
				inputValue={inputValue}
				onInputChange={handleInputChange}
				options={options}
				getOptionLabel={(opt: SelectOption) => opt.label}
				isOptionEqualToValue={(opt: SelectOption, val: SelectOption) =>
					opt.value === val.value
				}
				loading={serviceLoading}
				loadingText="Searching..."
				noOptionsText={
					search && search.length >= minChars
						? "No results found"
						: `Type at least ${minChars} characters to search`
				}
				filterOptions={(x) => x} // server-side filtering, no client filter
				renderInput={(params) => (
					<TextField
						{...params}
						name={field.name}
						label={field.label}
						placeholder={field.uiOverrides.behavior?.placeholder ?? "Search..."}
						error={meta.touched && Boolean(meta.error)}
						helperText={meta.touched ? meta.error : undefined}
						required={field.isRequired}
					/>
				)}
				disabled={field.isReadOnly}
				fullWidth
			/>

			{field.fieldOverrides?.description ? (
				<Typography variant="caption" color="text.secondary" className="pl-3">
					{field.fieldOverrides.description}
				</Typography>
			) : null}
		</Stack>
	);
}

// ─────────────────────────────────────────────────────────────
// Helper: build a stable SWR key from service datasource + search
// ─────────────────────────────────────────────────────────────

function useServiceSwrKey(
	serviceDs: Extract<FieldDatasource, { type: "service" }> | null,
	search: string | null,
	entityMeta: EntityMeta | undefined,
	formValues: Record<string, unknown>,
): string | null {
	if (!serviceDs) return null;

	// Build a deterministic key that includes everything affecting the fetch
	const parts = [serviceDs.endpoint, serviceDs.method ?? "GET"];

	if (search) parts.push(`search:${search}`);

	if (entityMeta?.searchFields?.length)
		parts.push(`sf:${entityMeta.searchFields.join(",")}`);

	if (entityMeta?.filter) {
		// Resolve {fieldName} placeholders in the filter value from form values
		const filterVal = String(entityMeta.filter.value);
		const resolved = filterVal.replace(/\{(\w+)\}/g, (_, key) =>
			key in formValues ? String(formValues[key] ?? "") : `{${key}}`,
		);
		parts.push(`f:${entityMeta.filter.field}=${resolved}`);
	}

	if (entityMeta?.orderBy)
		parts.push(
			`sort:${entityMeta.orderBy.field}:${entityMeta.orderBy.direction}`,
		);

	return parts.join("|");
}
