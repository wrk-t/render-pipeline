// ═══════════════════════════════════════════════════════════════
// FormMultiSelectField — Autocomplete with multiple selection.
// Uses the same datasource pattern as FormAutocompleteField.
//
// When `creatable` is set the field behaves as a free-solo autocomplete:
// the user can pick an existing option OR type a brand-new value and add
// it on the spot (Enter or the "Add …" suggestion). New values are stored
// as plain strings alongside existing ids and resolved/created by the
// backend on submit.
// ═══════════════════════════════════════════════════════════════
"use client";

import { Box, Chip, Stack, Typography } from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import { useField, useFormikContext } from "formik";
import {
  type KeyboardEvent,
  type ReactElement,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
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

function optionLabel(o: string | SelectOption): string {
  return typeof o === "string" ? o : o.label;
}

function optionValue(o: string | SelectOption): string {
  return typeof o === "string" ? o : String(o.value ?? "");
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
  const { isSubmitting, values: formValues } = useFormikContext<Record<string, unknown>>();

  const [options, setOptions] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");

  // Arch elements carry the datasource in fieldOverrides; legacy forms
  // set it on the field itself.
  const datasource = field.fieldOverrides?.datasource ?? field.datasource;
  const entityMeta =
    datasource?.type === "service" ? datasource.entityMeta : undefined;
  const creatable = field.creatable === true;

  // Normalise value to an array
  const selectedValues: string[] = Array.isArray(rawValue)
    ? rawValue
    : rawValue
      ? [rawValue]
      : [];

  // Resolve selected values to options — synthesize an option for values
  // that aren't in the loaded list yet (newly created / prefill ids).
  const selectedOptions: SelectOption[] = selectedValues.map((v) => {
    const found = options.find((o) => String(o.value) === v);
    return found ?? { label: v, value: v };
  });

  // Append an "Add …" suggestion for input that matches no existing option.
  const filterOptions = useCallback(
    (
      optionList: SelectOption[],
      state: { inputValue: string },
    ): SelectOption[] => {
      const input = state.inputValue.trim().toLowerCase();
      const filtered = optionList.filter((o) =>
        o.label.toLowerCase().includes(input),
      );
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
    [creatable],
  );

  // Free-solo Enter: commit the typed value directly (unless it exactly
  // matches an existing option, in which case default selection applies).
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (!creatable || e.key !== "Enter") return;
      const value = inputValue.trim();
      if (!value) return;
      const exists = options.some(
        (o) => o.label.toLowerCase() === value.toLowerCase(),
      );
      if (exists) return; // default behaviour: select the highlighted option
      e.preventDefault();
      e.stopPropagation();
      setOptions((prev) => [...prev, { label: value, value }]);
      setValue([...selectedValues, value]);
      setInputValue("");
      setTimeout(() => setTouched(true), 0);
    },
    [creatable, inputValue, options, selectedValues, setValue, setTouched],
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
  }, [datasource, entityMeta, resolvedFilter]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  const handleChange = useCallback(
    (_: SyntheticEvent, newValue: (string | SelectOption)[]) => {
      const ids = newValue.map(optionValue);
      setValue(ids);
      setTimeout(() => setTouched(true), 0);
    },
    [setValue, setTouched],
  );

  const handleRemove = useCallback(
    (removed: SelectOption) => {
      setValue(selectedValues.filter((v) => v !== String(removed.value)));
      setTimeout(() => setTouched(true), 0);
    },
    [selectedValues, setValue, setTouched],
  );

  return (
    <Stack spacing={0.5}>
      <Autocomplete
        multiple
        freeSolo={creatable}
        options={options}
        loading={loading}
        value={selectedOptions}
        onChange={handleChange}
        inputValue={inputValue}
        onInputChange={(_, v) => setInputValue(v)}
        onKeyDown={handleKeyDown}
        filterOptions={filterOptions}
        				disabled={isSubmitting || field.isReadOnly}
        				getOptionLabel={optionLabel}
        				isOptionEqualToValue={(o, v) => optionValue(o) === optionValue(v)}
        renderValue={() => null}
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
      {/* Selected options displayed as chips below the input */}
      {selectedOptions.length > 0 && (
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 0.5,
          }}
        >
          {selectedOptions.map((opt) => (
            <Chip
              key={String(opt.value)}
              label={opt.label}
              size="small"
              color="primary"
              variant="outlined"
              onDelete={field.isReadOnly ? undefined : () => handleRemove(opt)}
            />
          ))}
        </Box>
      )}
      {field.description && (
        <Typography variant="caption" color="text.secondary">
          {field.description}
        </Typography>
      )}
    </Stack>
  );
}
