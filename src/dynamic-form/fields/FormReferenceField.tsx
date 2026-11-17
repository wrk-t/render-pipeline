// ═══════════════════════════════════════════════════════════════
// FormReferenceField – Renders an autocomplete / reference field
// with support for static and service datasources.
//
// When a service datasource is present, the component fetches
// results from the server as the user types, with debounce and
// minimum-character thresholds.  Static datasources are filtered
// client-side as before.
//
// The control is a small custom combobox (text input + listbox):
// Up/Down move the active option, Enter selects it, Escape closes
// the list.
//
// The field stores only the **option value** (e.g. the entity ID)
// in Formik, not the full option object. This keeps the form
// values clean and passes schema validation (string / number).
// ═══════════════════════════════════════════════════════════════
"use client";

import { useField, useFormikContext } from "formik";
import {
	type KeyboardEvent,
	type ReactElement,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import useSWR from "swr";
import { getApiClient } from "../../deps";
import { fieldAccessibleName } from "../fieldHelpers";
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

const INPUT_CLASS =
	"flex h-9 w-full rounded-md border bg-transparent ps-3 py-1 text-sm text-start shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const LISTBOX_CLASS =
	"absolute start-0 top-full z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md";

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

	// ── Search / combobox state ────────────────────────────────
	const [inputValue, setInputValue] = useState("");
	const [search, setSearch] = useState<string | null>(null);
	const [open, setOpen] = useState(false);
	const [highlightedIndex, setHighlightedIndex] = useState(-1);
	const listRef = useRef<HTMLDivElement | null>(null);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const debounceMs = 300;
	const minChars = 2;

	const handleInputChange = useCallback((next: string) => {
		setInputValue(next);
		setOpen(true);
		setHighlightedIndex(-1);
		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(() => {
			setSearch(next.length >= minChars ? next : null);
		}, debounceMs);
	}, []);

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

	// Server-side filtering is already done for service datasources; static
	// options are matched locally on their label (the old MUI default).
	const query = inputValue.trim().toLowerCase();
	const visibleOptions: SelectOption[] = isService
		? options
		: query
			? options.filter((opt) => opt.label.toLowerCase().includes(query))
			: options;

	// ── Selected option — a stable reference for the current value ──
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
		// Value unchanged — populate the selection once options arrive for a
		// preset value.
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

	// UX-9 — name the control explicitly: a seed field with no displayName
	// otherwise reaches the input unnamed (a CUID or nothing at all).
	const accessibleName = fieldAccessibleName(field);

	const choose = (option: SelectOption): void => {
		setValue(option.value as string | number);
		setSelectedOption(option);
		setInputValue(option.label);
		setOpen(false);
		setHighlightedIndex(-1);
		setTouched(true);
	};

	const clearSelection = (): void => {
		setValue(null);
		setSelectedOption(null);
		setInputValue("");
		setOpen(false);
		setHighlightedIndex(-1);
		setTouched(true);
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			if (!open) {
				setOpen(true);
				setHighlightedIndex(visibleOptions.length > 0 ? 0 : -1);
				return;
			}
			setHighlightedIndex((index) =>
				visibleOptions.length === 0
					? -1
					: Math.min(index + 1, visibleOptions.length - 1),
			);
			return;
		}
		if (event.key === "ArrowUp") {
			event.preventDefault();
			if (!open) {
				setOpen(true);
				setHighlightedIndex(
					visibleOptions.length > 0 ? visibleOptions.length - 1 : -1,
				);
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
		const option = visibleOptions[highlightedIndex];
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
	const inputId = `field-reference-${field.name}`;
	const listboxId = `${inputId}-listbox`;
	const placeholder = field.uiOverrides.behavior?.displayField ?? "";
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
						) : visibleOptions.length === 0 ? (
							<div className="px-2 py-1.5 text-sm text-muted-foreground">
								{noOptionsText}
							</div>
						) : (
							visibleOptions.map((option, index) => {
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
										{option.label}
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
