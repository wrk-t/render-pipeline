"use client";

import type { FC } from "react";
import { Button, Typography } from "@mui/material";
import { useTranslations } from "next-intl";
import { QuickSelectValue, type TDatePickerValue } from "../config";
import { useDatePickerConfig } from "../context";

interface Props {
  value: TDatePickerValue | null;
  onChange: (v: TDatePickerValue) => void;
}

export const QuickSelectPanel: FC<Props> = ({ value, onChange }) => {
  const { quickSelects } = useDatePickerConfig();
  const dp = useTranslations("datePicker");

  const activeId = value instanceof QuickSelectValue ? value.id : null;

  return (
    <div className="grid grid-cols-2 gap-2 p-4 lg:grid-cols-3">
      {quickSelects.map((item) => (
        <Button
          key={item.id}
          fullWidth
          disableElevation={activeId !== item.id}
          variant={activeId === item.id ? "contained" : "text"}
          color={activeId === item.id ? "primary" : "inherit"}
          onClick={() => onChange(item)}
        >
          <Typography variant="body2">{dp(`quickSelects.${item.id}`)}</Typography>
        </Button>
      ))}
    </div>
  );
};
