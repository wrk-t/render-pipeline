// ═══════════════════════════════════════════════════════════════
// FormColorField – Color picker (native swatch + hex text input).
// ═══════════════════════════════════════════════════════════════
"use client";

import type { ReactElement } from "react";
import { useField } from "formik";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function FormColorField({
  field,
}: {
  field: {
    name: string;
    label?: string;
    isRequired?: boolean;
    isReadOnly?: boolean;
  };
}): ReactElement {
  const [formikField, meta, helpers] = useField(field.name);

  const rawValue = typeof formikField.value === "string" ? formikField.value : "";
  // Native color inputs only accept valid hex — fall back for display.
  const swatchValue = HEX_RE.test(rawValue) ? rawValue : "#000000";

  return (
    <Stack spacing={0.5}>
      {field.label && (
        <Typography variant="body2" className="mb-0.5">
          {field.label}
          {field.isRequired && (
            <Typography component="span" color="error">
              {" "}
              *
            </Typography>
          )}
        </Typography>
      )}
      <Stack direction="row" spacing={1} className="items-center">
        <input
          type="color"
          value={swatchValue}
          disabled={field.isReadOnly}
          onChange={(e) => helpers.setValue(e.target.value)}
          className="w-10 h-10 rounded-md cursor-pointer border border-divider disabled:opacity-60 disabled:cursor-default"
          aria-label={field.label ?? "color"}
        />
        <TextField
          size="small"
          value={rawValue}
          disabled={field.isReadOnly}
          onChange={(e) => helpers.setValue(e.target.value)}
          placeholder="#4F46E5"
          error={meta.touched && !!meta.error}
          helperText={meta.touched ? meta.error : undefined}
          className="flex-1"
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </Stack>
    </Stack>
  );
}
