// ═══════════════════════════════════════════════════════════════
// FormSwitchField – Renders a switch/toggle with plain boolean.
// ═══════════════════════════════════════════════════════════════
"use client";

import type { ReactElement } from "react";
import { useFormikContext } from "formik";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import type { SwitchField } from "../types";
import Typography from "@mui/material/Typography";

export function FormSwitchField({
  field,
}: {
  field: SwitchField;
}): ReactElement {
  const { values, setFieldValue } = useFormikContext<Record<string, unknown>>();
  const checked = Boolean(values[field.name]);

  return (
    <Stack spacing={0.2}>
      <FormControlLabel
        control={
          <Switch
            name={field.name}
            checked={checked}
            onChange={(_, c) => setFieldValue(field.name, c)}
            disabled={field.isReadOnly}
          />
        }
        label={field.label}
        className="ml-0!"
      />
      {field.fieldOverrides?.description ? (
        <Typography variant="caption" color="text.secondary" className="pl-3">
          {field.fieldOverrides.description}
        </Typography>
      ) : null}
    </Stack>
  );
}
