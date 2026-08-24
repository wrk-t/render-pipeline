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

import { Box, Stack, Typography } from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import { useField, useFormikContext } from "formik";
	import {
		type ReactElement,
		type SyntheticEvent,
		useCallback,
		useEffect,
		useMemo,
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
		return {
			label: String(obj.label ?? ""),
			value: obj.value,
			raw: obj,
		};
	}

	const displayField = entityMeta?.displayField;
	const valueField = entityMeta?.valueField ?? "id";

	// Label template — "{field}" tokens replaced from the row (e.g.
	// "{displayName}  {id}" to disambiguate tenants by id).
	let label: string;
	if (entityMeta?.labelTemplate) {
		label = entityMeta.labelTemplate.replace(
			/\{(\w+)\}/g,
			(_: string, key: string) => String(obj[key] ?? ""),
		);
	} else {
		label = String(
			obj[displayField ?? "displayName"] ??
				obj.displayName ??
				obj.name ??
				obj.label ??
				"",
		);
	}

	return {
		label,
		value: obj[valueField] ?? obj.id ?? obj.value,
		raw: obj,
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
	// The MUI input is UNCONTROLLED (no inputValue prop) — controlling it
	// fights the user's typing (programmatic "reset" syncs wipe keystrokes).
	// We only track the text via onInputChange to drive the server search.
	const [search, setSearch] = useState<string | null>(null);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const debounceMs = field.uiOverrides.behavior?.debounce ?? 300;
	const minChars = field.uiOverrides.behavior?.minChars ?? 2;

	// Debounce user input → trigger search. Only real typing (reason
	// "input") searches — MUI fires onInputChange with "reset"/"clear"
	// when it syncs the input to the selected option's label; treating
	// those as searches would fire a request for the full label (which
	// never matches) and oscillate forever.
	const handleInputChange = useCallback(
		(_event: SyntheticEvent, value: string, reason: string) => {
			if (reason !== "input") return;
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
	// keepPreviousData: during a search the key changes and the new key
	// has no cached rows — without it `options` briefly empties, the
	// selected option disappears and MUI snaps the input back to the
	// value's label mid-typing.
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
		{ keepPreviousData: true },
	);

	// ── Build the final option list ────────────────────────────
	// Memoised on the SWR data (stable between fetches) so the option
	// objects keep their identity across re-renders.
	const options: SelectOption[] = useMemo(
		() =>
			serviceDs
				? Array.isArray(serviceData)
					? serviceData.map((item: unknown) => toSelectOption(item, entityMeta))
					: []
				: staticOptions,
		[serviceDs, serviceData, entityMeta, staticOptions],
	);

	// ── Selected option — a STABLE reference for the current value ──
	// Deriving it from the live options list would hand MUI a NEW `value`
	// object on every re-render (the mapped options are fresh each time);
	// MUI treats any `value` reference change as a value change and resets
	// the input to the option's label — wiping keystrokes mid-edit.
	const [selectedOption, setSelectedOption] = useState<SelectOption | null>(
		null,
	);
	const prevValueRef = useRef<string | number | null>(value);

	useEffect(() => {
		const valueChanged = prevValueRef.current !== value;
		prevValueRef.current = value;
		if (valueChanged) {
			setSelectedOption(
				!value ? null : (options.find((opt) => opt.value === value) ?? null),
			);
			return;
		}
		// Value unchanged — only populate the selection if we don't have one
		// yet (e.g. options arrived after mount with a preset value).
		if (!selectedOption && value) {
			const match = options.find((opt) => opt.value === value);
			if (match) setSelectedOption(match);
		}
	}, [value, options, selectedOption]);

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
				renderOption={(props, option) => {
					// Split layout: display field left, value (e.g. id) right.
					const raw = (option as SelectOption).raw;
					if (entityMeta?.splitLabel && raw) {
						const left = String(
							raw[entityMeta.displayField] ?? raw.displayName ?? option.label,
						);
						const right = String(raw[entityMeta.valueField] ?? raw.id ?? "");
						return (
							<li {...props}>
								<Box
									sx={{
										display: "flex",
										justifyContent: "space-between",
										alignItems: "center",
										width: "100%",
										gap: 2,
									}}
								>
									<span>{left}</span>
									<span className="text-sm opacity-60">{right}</span>
								</Box>
							</li>
						);
					}
					return <li {...props}>{option.label}</li>;
				}}
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
