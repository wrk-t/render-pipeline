"use client";

import type { FC } from "react";
import { Stack, Button, TextField, MenuItem } from "@mui/material";
import { useTranslations } from "next-intl";
import { CustomQuickValue, DateTimeParts } from "../config";
import type { TDatePickerValue, TTimeUnit } from "../config";

const TIME_UNITS = Object.keys(DateTimeParts) as TTimeUnit[];

interface Props {
  value: TDatePickerValue | null;
  onChange: (v: TDatePickerValue | null) => void;
}

export const CustomQuickPanel: FC<Props> = ({ value, onChange }) => {
  const dp = useTranslations("datePicker");
  const isSelected = value instanceof CustomQuickValue;
  const cq = isSelected ? value : null;

  const handleToggle = () => {
    if (!isSelected) {
      onChange(new CustomQuickValue());
    } else {
      onChange(null);
    }
  };

  return (
    <Stack spacing={2} direction="row" className="items-center px-4 pb-3 pt-2">
      <Button variant={isSelected ? "contained" : "outlined"} onClick={handleToggle}>
        {dp("favoriteTime")}
      </Button>

      {isSelected && cq && (
        <Stack direction="row" spacing={1} className="items-center">
          <TextField
            value={cq.label}
            onChange={(e) => {
              const num = Number(e.target.value);
              if (!Number.isNaN(num)) onChange(new CustomQuickValue(num));
            }}
            size="small"
            sx={{ width: 80 }}
            slotProps={{ htmlInput: { inputMode: "numeric", style: { textAlign: "center" } } }}
          />
          <TextField
            select
            value={cq.unit}
            onChange={(e) => onChange(cq.withUnit(e.target.value as TTimeUnit))}
            size="small"
            sx={{ width: 100 }}
          >
            {TIME_UNITS.map((unit) => (
              <MenuItem key={unit} value={unit}>
                {dp(`timeUnits.${unit}`)}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      )}
    </Stack>
  );
};
