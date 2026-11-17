// ═══════════════════════════════════════════════════════════════
// FormMultiSelectField — Combobox with multiple selection.
// Uses the same datasource pattern as FormAutocompleteField.
//
// The trigger area holds removable chips plus a text input; the
// absolutely-positioned listbox offers checkboxes, and Up/Down +
// Enter / Escape drive it from the keyboard.
//
// When `creatable` is set the field behaves as a free-solo combobox:
// the user can pick an existing option OR type a brand-new value and add
// it on the spot (Enter or the "Add …" suggestion). New values are stored
// as plain strings alongside existing ids and resolved/created by the
// backend on submit.
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
import { getApiClient } from "../../deps";
import { fieldAccessibleName } from "../fieldHelpers";
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

function optionLabel(o: string | SelectOption): string {
	return typeof o === "string" ? o : o.label;
}

function optionValue(o: string | SelectOption): string {
	return typeof o === "string" ? o : String(o.value ?? "");
}

/**
 * A stable empty selection. The memoised `selectedOptions` uses this so the
 * chips list is not rebuilt (and re-rendered) while nothing is selected.
 */
const EMPTY_SELECTED_OPTIONS: SelectOption[] = [];

const LISTBOX_CLASS =
	"absolute start-0 top-full z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md";

// ── Component ────────────────────────────────────────────────

export function FormMultiSelectField({
	field,
}: {
	field: MultiselectField;
}): ReactElement {
	const [{ value: rawValue }, meta, { setValue, setTouched }] = useField<
		string[]
	>(field.name);
	const { isSubmitting, values: formValues } =
		useFormikContext<Record<string, unknown>>();

	const [options, setOptions] = useState<SelectOption[]>([]);
	const [loading, setLoading] = useState(false);
	const [inputValue, setInputValue] = useState("");
	// Debounced term for `entityMeta.remoteSearch` pickers (see the effect below).
	const [searchTerm, setSearchTerm] = useState("");
	const [open, setOpen] = useState(false);
	const [highlightedIndex, setHighlightedIndex] = useState(-1);
	const listRef = useRef<HTMLDivElement | null>(null);

	// Arch elements carry the datasource in fieldOverrides; legacy forms
	// set it on the field itself.
	const datasource = field.fieldOverrides?.datasource ?? field.datasource;
	const entityMeta =
		datasource?.type === "service" ? datasource.entityMeta : undefined;
	const creatable = field.creatable === true;
	const remoteSearch = entityMeta?.remoteSearch;
	const minSearchLength = remoteSearch?.minSearchLength ?? 2;

	// Normalise value to an array
	const selectedValues = useMemo<string[]>(
		() => (Array.isArray(rawValue) ? rawValue : rawValue ? [rawValue] : []),
		[rawValue],
	);

	// Resolve selected values to options — synthesize an option for values
	// that aren't in the loaded list yet (newly created / prefill ids).
	const selectedOptions = useMemo<SelectOption[]>(() => {
		if (selectedValues.length === 0) return EMPTY_SELECTED_OPTIONS;
		return selectedValues.map((v) => {
			const found = options.find((o) => String(o.value) === v);
			return found ?? { label: v, value: v };
		});
	}, [selectedValues, options]);

	// Append an "Add …" suggestion for input that matches no existing option.
	const filterOptions = useCallback(
		(
			optionList: SelectOption[],
			state: { inputValue: string },
		): SelectOption[] => {
			const input = state.inputValue.trim().toLowerCase();
			// With a **server-side** search, the API has already matched the term
			// against every configured field (name, firstName, lastName, phone,
			// email). Re-filtering on the display label would drop a customer found
			// by email or a name part that is not in the label.
			const filtered = remoteSearch
				? [...optionList]
				: optionList.filter((o) => o.label.toLowerCase().includes(input));
			if (
				creatable &&
				input &&
				!optionList.some((o) => o.label.toLowerCase() === input)
			) {
				filtered.push({
					label: `Add "${state.inputValue.trim()}"`,
					value: state.inputValue.trim(),
				});
			}
			return filtered;
		},
		[creatable, remoteSearch],
	);

	// The option list the popup renders (same filtering the old MUI
	// `filterOptions` applied).
	const displayOptions = useMemo(
		() => filterOptions(options, { inputValue }),
		[filterOptions, options, inputValue],
	);

	// Resolve the `{fieldName}` filter placeholders from form values so
	// the fetch only re-runs when the CONTEXT changes (e.g. the category
	// picker's `{menuId}`), not on every form keystroke.
	const resolvedFilter = useMemo(() => {
		if (datasource?.type !== "service" || !entityMeta?.filter) return null;
		const rawVal = String(entityMeta.filter.value);
		return rawVal.replace(/\{(\w+)\}/g, (_, key: string) =>
			key in formValues ? String(formValues[key] ?? "") : `{${key}}`,
		);
	}, [datasource, entityMeta, formValues]);

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
				// Build query params like FormAutocompleteField: searchFields,
				// an entityMeta filter (with `{fieldName}` placeholders resolved
				// from form values — e.g. categoryIds filtered by `{menuId}`),
				// and an orderBy. Without these the picker would fetch every row
				// of the entity regardless of context.
				const baseUrl = process.env.NEXT_PUBLIC_ENDPOINT ?? "";
				const params = new URLSearchParams();
				if (entityMeta?.searchFields?.length) {
					params.set("searchFields", entityMeta.searchFields.join(","));
				}
				if (entityMeta?.filter && resolvedFilter) {
					params.set(entityMeta.filter.field, resolvedFilter);
				}
				if (entityMeta?.orderBy) {
					params.set("sortBy", entityMeta.orderBy.field);
					params.set("sortOrder", entityMeta.orderBy.direction);
				}
				// Remote search: ask for one page of matching rows instead of the
				// whole table. Without a term the first page still gives the picker
				// something to show.
				if (remoteSearch) {
					params.set("limit", "20");
					if (searchTerm) params.set("search", searchTerm);
				}
				const qs = params.toString();
				const url = `${baseUrl}${datasource.endpoint}${qs ? `?${qs}` : ""}`;
				const res = await getApiClient().get(url);
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
	}, [datasource, entityMeta, resolvedFilter, remoteSearch, searchTerm]);

	useEffect(() => {
		loadOptions();
	}, [loadOptions]);

	// Debounce typing into a search term. Clearing the box returns to the first
	// page rather than leaving stale matches behind.
	useEffect(() => {
		if (!remoteSearch) return;

		const term = inputValue.trim();
		if (term.length < minSearchLength) {
			setSearchTerm("");
			return;
		}

		const handle = setTimeout(() => setSearchTerm(term), 300);
		return () => clearTimeout(handle);
	}, [inputValue, remoteSearch, minSearchLength]);

	const disabled = isSubmitting || field.isReadOnly;

	/** Toggle one option in / out of the Formik array. */
	const toggleOption = useCallback(
		(option: SelectOption) => {
			const v = optionValue(option);
			const next = selectedValues.includes(v)
				? selectedValues.filter((selected) => selected !== v)
				: [...selectedValues, v];
			setValue(next);
			setInputValue("");
			setTimeout(() => setTouched(true), 0);
		},
		[selectedValues, setValue, setTouched],
	);

	// UX-9 — name the control explicitly: a seed field with no displayName
	// otherwise reaches the input unnamed (a CUID or nothing at all).
	const accessibleName = fieldAccessibleName(field);

	const handleRemove = useCallback(
		(removed: SelectOption) => {
			setValue(selectedValues.filter((v) => v !== String(removed.value)));
			setTimeout(() => setTouched(true), 0);
		},
		[selectedValues, setValue, setTouched],
	);

	// Free-solo Enter: commit the typed value directly (unless it exactly
	// matches an existing option, in which case selecting that option applies).
	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			if (!open) {
				setOpen(true);
				setHighlightedIndex(displayOptions.length > 0 ? 0 : -1);
				return;
			}
			setHighlightedIndex((index) =>
				displayOptions.length === 0
					? -1
					: Math.min(index + 1, displayOptions.length - 1),
			);
			return;
		}
		if (event.key === "ArrowUp") {
			event.preventDefault();
			if (!open) {
				setOpen(true);
				setHighlightedIndex(
					displayOptions.length > 0 ? displayOptions.length - 1 : -1,
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

		const highlighted =
			open && highlightedIndex >= 0
				? displayOptions[highlightedIndex]
				: undefined;
		if (highlighted) {
			event.preventDefault();
			toggleOption(highlighted);
			setHighlightedIndex(-1);
			return;
		}
		if (!creatable) {
			setOpen(false);
			return;
		}

		const value = inputValue.trim();
		if (!value) return;
		const existing = options.find(
			(o) => o.label.toLowerCase() === value.toLowerCase(),
		);
		if (existing) {
			event.preventDefault();
			toggleOption(existing);
			setHighlightedIndex(-1);
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		setOptions((prev) => [...prev, { label: value, value }]);
		setValue([...selectedValues, value]);
		setInputValue("");
		setHighlightedIndex(-1);
		setTimeout(() => setTouched(true), 0);
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
	const inputId = `field-multiselect-${field.name}`;
	const listboxId = `${inputId}-listbox`;

	return (
		<div className="flex flex-col gap-2">
			<label
				htmlFor={inputId}
				className={`text-sm font-medium leading-none ${
					isError ? "text-destructive" : "text-foreground"
				}`}
			>
				{field.label}
			</label>
			<div className="relative">
				<div
					className={[
						"flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border bg-transparent px-2 py-1 text-sm shadow-sm transition-colors focus-within:ring-2 focus-within:ring-offset-2",
						isError
							? "border-destructive focus-within:ring-destructive/20"
							: "border-input focus-within:ring-ring",
						disabled ? "cursor-not-allowed opacity-50" : "",
					].join(" ")}
				>
					{selectedOptions.map((opt) => (
						<span
							key={String(opt.value)}
							className="inline-flex max-w-full items-center gap-1 rounded-sm bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground"
						>
							<span className="truncate">{opt.label}</span>
							{!field.isReadOnly ? (
								<button
									type="button"
									aria-label={`Remove ${opt.label}`}
									onMouseDown={(event) => event.preventDefault()}
									onClick={() => handleRemove(opt)}
									className="shrink-0 rounded-sm text-muted-foreground transition-colors hover:text-foreground"
								>
									<span aria-hidden="true">×</span>
								</button>
							) : null}
						</span>
					))}
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
						value={inputValue}
						placeholder={
							selectedOptions.length === 0
								? field.uiOverrides?.behavior?.placeholder
								: undefined
						}
						disabled={disabled}
						onChange={(event) => {
							setInputValue(event.target.value);
							setOpen(true);
							setHighlightedIndex(-1);
						}}
						onFocus={() => setOpen(true)}
						onBlur={() => {
							setOpen(false);
							setHighlightedIndex(-1);
						}}
						onKeyDown={handleKeyDown}
						className="min-w-24 flex-1 bg-transparent px-1 py-0.5 text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
					/>
				</div>
				{open ? (
					<div
						ref={listRef}
						id={listboxId}
						role="listbox"
						aria-label={accessibleName}
						className={LISTBOX_CLASS}
					>
						{loading ? (
							<div className="px-2 py-1.5 text-sm text-muted-foreground">
								Loading...
							</div>
						) : displayOptions.length === 0 ? (
							<div className="px-2 py-1.5 text-sm text-muted-foreground">
								No options
							</div>
						) : (
							displayOptions.map((option, index) => {
								const isSelected = selectedValues.includes(optionValue(option));
								return (
									<div
										key={`${optionValue(option)}-${optionLabel(option)}`}
										id={`${inputId}-option-${index}`}
										role="option"
										tabIndex={-1}
										aria-selected={isSelected}
										data-active={index === highlightedIndex || undefined}
										onMouseDown={(event) => {
											// Keep the input focused so the click toggles a checkbox
											// instead of blurring the list closed first.
											event.preventDefault();
										}}
										onClick={() => toggleOption(option)}
										onKeyDown={(event) => {
											if (event.key !== "Enter" && event.key !== " ") return;
											event.preventDefault();
											toggleOption(option);
										}}
										onMouseEnter={() => setHighlightedIndex(index)}
										className={[
											"flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-start text-sm",
											index === highlightedIndex
												? "bg-accent text-accent-foreground"
												: "",
											isSelected ? "font-medium" : "",
										].join(" ")}
									>
										<input
											type="checkbox"
											checked={isSelected}
											readOnly
											tabIndex={-1}
											aria-hidden="true"
											className="size-4 shrink-0 rounded-sm border border-input accent-primary"
										/>
										<span className="truncate">{optionLabel(option)}</span>
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
			{field.description ? (
				<p className="text-sm text-muted-foreground">{field.description}</p>
			) : null}
		</div>
	);
}
