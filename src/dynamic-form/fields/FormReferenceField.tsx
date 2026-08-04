// ═══════════════════════════════════════════════════════════════
// FormReferenceField – Renders an autocomplete / reference field
// with support for static and service datasources.
//
// When a service datasource is present, the component fetches
// results from the server as the user types, with debounce and
// minimum-character thresholds.  Static datasources are filtered
// client-side as before.
//
// The field stores only the **option value** (e.g. the entity ID)
// in Formik, not the full option object. This keeps the form
// values clean and passes schema validation (string / number).
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
	EntityMeta,
	FieldDatasource,
	ReferenceField,
	SelectOption,
} from "../types";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function FormReferenceField({
	field,
}: {
	field: ReferenceField;
}): ReactElement {
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
	const entityMeta = serviceDs?.entityMeta;

	const staticOptions: SelectOption[] =
		!isService && isStatic && "options" in (ds ?? {})
			? (ds as { options: SelectOption[] }).options.map((o) =>
					toSelectOption(o, entityMeta),
				)
			: [];

	// ── Search state (debounced server-side search) ────────────
	const [inputValue, setInputValue] = useState("");
	const [search, setSearch] = useState<string | null>(null);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const debounceMs = 300;
	const minChars = 2;

	const handleInputChange = useCallback(
		(_event: SyntheticEvent, value: string) => {
			setInputValue(value);
			if (debounceRef.current) clearTimeout(debounceRef.current);
			debounceRef.current = setTimeout(() => {
				setSearch(value.length >= minChars ? value : null);
			}, debounceMs);
		},
		[],
	);

	useEffect(() => {
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, []);

	// ── Build the SWR key ──────────────────────────────────────
	const swrKey = useServiceSwrKey(serviceDs, search, entityMeta, formValues);

	// ── Fetch service data on user input ───────────────────────
	const { data: serviceData, isLoading: serviceLoading } = useSWR(
		swrKey,
		async () => {
			if (!serviceDs) return [];
			const baseUrl = process.env.NEXT_PUBLIC_ENDPOINT ?? "";
			const params = new URLSearchParams();

			// Always send searchFields when the entity declares them.
			if (entityMeta?.searchFields?.length) {
				params.set("searchFields", entityMeta.searchFields.join(","));
			}

			if (search) {
				params.set("search", search);
			}
			if (entityMeta?.filter) {
				// Filter params are passed directly (e.g. ?status=active),
				// matching the backend's filterableFields per entity.
				params.set(entityMeta.filter.field, String(entityMeta.filter.value));
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

	// ── Build final options ────────────────────────────────────
	const options: SelectOption[] = serviceDs
		? Array.isArray(serviceData)
			? serviceData.map((item: unknown) => toSelectOption(item, entityMeta))
			: []
		: staticOptions;

	const selectedOption = options.find((opt) => opt.value === value) ?? null;

	const handleChange = (
		_event: SyntheticEvent,
		option: SelectOption | null,
	): void => {
		setValue(option ? (option.value as string | number) : null);
		setTouched(true);
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
				filterOptions={isService ? (x) => x : undefined}
				renderInput={(params) => (
					<TextField
						{...params}
						name={field.name}
						label={field.label}
						placeholder={field.uiOverrides.behavior?.displayField ?? ""}
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
// Helper: build a stable SWR key
// ─────────────────────────────────────────────────────────────

function useServiceSwrKey(
	serviceDs: Extract<FieldDatasource, { type: "service" }> | null,
	search: string | null,
	entityMeta: EntityMeta | undefined,
	formValues: Record<string, unknown>,
): string | null {
	if (!serviceDs) return null;
	const parts = [serviceDs.endpoint, serviceDs.method ?? "GET"];
	if (search) parts.push(`search:${search}`);
	if (entityMeta?.searchFields?.length)
		parts.push(`sf:${entityMeta.searchFields.join(",")}`);
	if (entityMeta?.filter) {
		const filterVal = String(entityMeta.filter.value);
		const resolved = filterVal.replace(/\{(\w+)\}/g, (_, key) =>
			key in formValues ? String(formValues[key] ?? "") : `{${key}}`,
		);
		parts.push(`filter:${entityMeta.filter.field}=${resolved}`);
	}
	if (entityMeta?.orderBy)
		parts.push(
			`sort:${entityMeta.orderBy.field}:${entityMeta.orderBy.direction}`,
		);
	return parts.join("|");
}
