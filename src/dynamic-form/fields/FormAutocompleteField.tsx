// ═══════════════════════════════════════════════════════════════
// FormAutocompleteField – Renders an autocomplete field with
// support for static options, service endpoints, and entity
// references resolved by the backend.
//
// When the datasource is a service (including resolved entity
// datasources), the component fetches options dynamically as the
// user types, with debounce and minimum character thresholds.
//
// The control is a small custom combobox (text input + listbox) so
// the package stays free of UI-kit imports: Up/Down move the active
// option, Enter selects it, Escape closes the list.
//
// Like FormReferenceField, only the option **value** (e.g. the
// entity ID) is stored in Formik, keeping form values clean.
// ═══════════════════════════════════════════════════════════════
"use client";

import { useField, useFormikContext } from "formik";
import {
	type KeyboardEvent,
	type ReactElement,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import useSWR from "swr";
import { getApiClient } from "../../deps";
import { fieldAccessibleName } from "../fieldHelpers";
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

const INPUT_CLASS =
	"flex h-9 w-full rounded-md border bg-transparent ps-3 py-1 text-sm text-start shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const LISTBOX_CLASS =
	"absolute start-0 top-full z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md";

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

	const { values: formValues, setFieldValue } =
		useFormikContext<Record<string, unknown>>();

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
	// Typing is debounced into the server-side `search` term; the input
	// text itself is the combobox's visible value.
	const [search, setSearch] = useState<string | null>(null);
	const [inputValue, setInputValue] = useState("");
	const [open, setOpen] = useState(false);
	const [highlightedIndex, setHighlightedIndex] = useState(-1);
	const listRef = useRef<HTMLDivElement | null>(null);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const debounceMs = field.uiOverrides.behavior?.debounce ?? 300;
	const minChars = field.uiOverrides.behavior?.minChars ?? 2;

	const handleInputChange = useCallback(
		(next: string) => {
			setInputValue(next);
			setOpen(true);
			setHighlightedIndex(-1);
			if (debounceRef.current) clearTimeout(debounceRef.current);
			debounceRef.current = setTimeout(() => {
				setSearch(next.length >= minChars ? next : null);
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
	// selected option disappears and the input snaps back to the value's
	// label mid-typing.
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
	// Deriving it from the live options list on every render would hand the
	// sync effect a NEW object each time and reset the input to the option's
	// label — wiping keystrokes mid-edit.
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

	// The visible text follows the selection whenever it changes from
	// outside (form reset, preset value, async options arriving).
	useEffect(() => {
		setInputValue(selectedOption?.label ?? "");
	}, [selectedOption]);

	/**
	 * "Use this template": copy the picked row's content into the form
	 * (`copyFields`), so choosing a catalog entry fills the message instead of
	 * only recording its id (CRM-17).
	 *
	 * A target that already holds text is only replaced after the admin says
	 * so — a click must not silently discard a typed body.
	 */
	const copyFromRow = (raw: Record<string, unknown> | undefined): void => {
		const copyFields = entityMeta?.copyFields;
		if (!raw || !copyFields) return;

		const writes: Array<[string, string]> = [];
		let conflicts = 0;

		for (const [target, source] of Object.entries(copyFields)) {
			const next = raw[source];
			if (next === undefined || next === null) continue;

			const current = formValues[target];
			const currentText =
				typeof current === "string" ? current.trim() : String(current ?? "");
			if (currentText.length > 0 && currentText !== String(next).trim()) {
				conflicts += 1;
			}
			writes.push([target, String(next)]);
		}

		if (writes.length === 0) return;
		if (
			conflicts > 0 &&
			!window.confirm(
				"Replace the content you already typed with this template's?",
			)
		) {
			return;
		}

		for (const [target, next] of writes) void setFieldValue(target, next);
	};

	// ── Handle selection — store only the value ────────────────
	const accessibleName = fieldAccessibleName(field);

	const choose = (option: SelectOption): void => {
		setValue(option.value as string | number);
		setSelectedOption(option);
		setInputValue(option.label);
		setOpen(false);
		setHighlightedIndex(-1);
		if (entityMeta?.copyFields) copyFromRow(option.raw);
		// Delay touched to let Formik process the value change first
		setTimeout(() => setTouched(true), 0);
	};

	const clearSelection = (): void => {
		setValue(null);
		setSelectedOption(null);
		setInputValue("");
		setOpen(false);
		setHighlightedIndex(-1);
		setTimeout(() => setTouched(true), 0);
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			if (!open) {
				setOpen(true);
				setHighlightedIndex(options.length > 0 ? 0 : -1);
				return;
			}
			setHighlightedIndex((index) =>
				options.length === 0 ? -1 : Math.min(index + 1, options.length - 1),
			);
			return;
		}
		if (event.key === "ArrowUp") {
			event.preventDefault();
			if (!open) {
				setOpen(true);
				setHighlightedIndex(options.length > 0 ? options.length - 1 : -1);
				return;
			}
			setHighlightedIndex((index) => (index <= 0 ? 0 : index - 1));
			return;
		}
		if (event.key === "Escape") {
			if (!open) return;
			event.preventDefault();
			setOpen(false);
			setHighlightedIndex(-1);
			return;
		}
		if (event.key !== "Enter") return;
		if (!open || highlightedIndex < 0) return;
		const option = options[highlightedIndex];
		if (!option) return;
		event.preventDefault();
		choose(option);
	};

	// Keep the keyboard-active option visible inside the scrollable listbox.
	useEffect(() => {
		if (!open || highlightedIndex < 0) return;
		const active = listRef.current?.querySelector<HTMLElement>(
			'[data-active="true"]',
		);
		active?.scrollIntoView({ block: "nearest" });
	}, [open, highlightedIndex]);

	const isError = Boolean(meta.touched && meta.error);
	const hasValue = value !== null && value !== undefined && value !== "";
	// UX-9 — name the control explicitly: a seed field with no displayName
	// otherwise reaches the input unnamed (a CUID or nothing at all).
	const inputId = `field-autocomplete-${field.name}`;
	const listboxId = `${inputId}-listbox`;
	const placeholder = field.uiOverrides.behavior?.placeholder ?? "Search...";
	const noOptionsText =
		search && search.length >= minChars
			? "No results found"
			: `Type at least ${minChars} characters to search`;

	return (
		<div className="flex flex-col gap-2">
			<label
				htmlFor={inputId}
				className={`text-sm font-medium leading-none ${
					isError ? "text-destructive" : "text-foreground"
				}`}
			>
				{field.label}
				{field.isRequired ? (
					<span className="text-destructive" aria-hidden="true">
						{" "}
						*
					</span>
				) : null}
			</label>
			<div className="relative">
				<input
					id={inputId}
					name={field.name}
					type="text"
					role="combobox"
					autoComplete="off"
					aria-label={accessibleName}
					aria-expanded={open}
					aria-controls={listboxId}
					aria-autocomplete="list"
					aria-activedescendant={
						open && highlightedIndex >= 0
							? `${inputId}-option-${highlightedIndex}`
							: undefined
					}
					aria-invalid={isError || undefined}
					aria-required={field.isRequired || undefined}
					value={inputValue}
					placeholder={placeholder}
					disabled={field.isReadOnly}
					onChange={(event) => handleInputChange(event.target.value)}
					onFocus={() => setOpen(true)}
					onBlur={() => {
						setOpen(false);
						setHighlightedIndex(-1);
						setInputValue(selectedOption?.label ?? "");
					}}
					onKeyDown={handleKeyDown}
					className={[
						INPUT_CLASS,
						hasValue ? "pe-9" : "pe-3",
						isError
							? "border-destructive focus-visible:ring-destructive/20"
							: "border-input",
					].join(" ")}
				/>
				{hasValue && !field.isReadOnly ? (
					<button
						type="button"
						aria-label="Clear selection"
						onMouseDown={(event) => event.preventDefault()}
						onClick={clearSelection}
						className="absolute end-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground"
					>
						<span aria-hidden="true">×</span>
					</button>
				) : null}
				{open ? (
					<div
						ref={listRef}
						id={listboxId}
						role="listbox"
						aria-label={accessibleName}
						className={LISTBOX_CLASS}
					>
						{serviceLoading ? (
							<div className="px-2 py-1.5 text-sm text-muted-foreground">
								Searching...
							</div>
						) : options.length === 0 ? (
							<div className="px-2 py-1.5 text-sm text-muted-foreground">
								{noOptionsText}
							</div>
						) : (
							options.map((option, index) => {
								const isSelected = option.value === value;
								return (
									<div
										key={String(option.value)}
										id={`${inputId}-option-${index}`}
										role="option"
										tabIndex={-1}
										aria-selected={isSelected}
										data-active={index === highlightedIndex || undefined}
										onMouseDown={(event) => {
											// Keep the input focused so the click is a selection,
											// not a blur that closes the list first.
											event.preventDefault();
										}}
										onClick={() => choose(option)}
										onKeyDown={(event) => {
											if (event.key !== "Enter" && event.key !== " ") return;
											event.preventDefault();
											choose(option);
										}}
										onMouseEnter={() => setHighlightedIndex(index)}
										className={[
											"cursor-pointer rounded-sm px-2 py-1.5 text-start text-sm",
											index === highlightedIndex
												? "bg-accent text-accent-foreground"
												: "",
											isSelected ? "font-medium" : "",
										].join(" ")}
									>
										{entityMeta?.splitLabel && option.raw ? (
											<span className="flex w-full items-center justify-between gap-2">
												<span>
													{String(
														option.raw[entityMeta.displayField] ??
															option.raw.displayName ??
															option.label,
													)}
												</span>
												<span className="text-xs text-muted-foreground">
													{String(
														option.raw[entityMeta.valueField] ??
															option.raw.id ??
															"",
													)}
												</span>
											</span>
										) : (
											option.label
										)}
									</div>
								);
							})
						)}
					</div>
				) : null}
			</div>
			{isError ? (
				<p className="text-sm text-destructive">{meta.error}</p>
			) : null}
			{field.fieldOverrides?.description ? (
				<p className="text-sm text-muted-foreground">
					{field.fieldOverrides.description}
				</p>
			) : null}
		</div>
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
