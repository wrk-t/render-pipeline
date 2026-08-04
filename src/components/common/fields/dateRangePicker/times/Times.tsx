"use client";

import { useMemo, type FC } from "react";
import { Stack, MenuItem, TextField } from "@mui/material";
import { DateObject } from "react-multi-date-picker";
import { useTranslations } from "next-intl";
import { ExactTimes } from "../config";
import { AbsoluteDateValue, type TDatePickerValue } from "../config";

interface Props {
  value: TDatePickerValue | null;
  onChange: (v: TDatePickerValue) => void;
}

const Times: FC<Props> = ({ value, onChange }) => {
  const dp = useTranslations("datePicker");

  const sameDay = useMemo(() => {
    if (value instanceof AbsoluteDateValue) {
      return (
        value.fromDate.format("YYYY-MM-DD") === value.toDate.format("YYYY-MM-DD")
      );
    }
    return false;
  }, [value]);

  const nowOption = useMemo(() => {
    if (value instanceof AbsoluteDateValue) {
      const toFmt = value.toDate.format("YYYY-MM-DD");
      const today = new DateObject().format("YYYY-MM-DD");
      if (toFmt === today) {
        return [{ label: dp("now"), value: "now" }];
      }
    }
    return [];
  }, [value, dp]);

  const isDisabled = (time: string, isFrom: boolean): boolean => {
    if (value instanceof AbsoluteDateValue) {
      if (!sameDay) return false;
      const [h, m] = time.split(":").map(Number);
      const otherTime = isFrom ? value.toTime : value.fromTime;
      const [otherH, otherM] = otherTime.split(":").map(Number);
      if (isFrom) {
        if (h > otherH || (h === otherH && m >= otherM)) return true;
      } else {
        if (otherH > h || (otherH === h && otherM >= m)) return true;
      }
      const now = new DateObject();
      const date = isFrom ? value.fromDate : value.toDate;
      if (date.format("YYYY-MM-DD") !== now.format("YYYY-MM-DD")) return false;
      const nowH = Number(now.format("HH"));
      const nowM = Number(now.format("mm"));
      return h > nowH || (h === nowH && m > nowM);
    }
    return false;
  };

  if (!(value instanceof AbsoluteDateValue)) return null;

  return (
    <Stack direction="row" spacing={2} className="px-4 pb-3 pt-2">
      <TextField
        select
        label={dp("from")}
        value={value.fromTime}
        onChange={(e) => onChange(value.withFromTime(e.target.value))}
        size="small"
        sx={{ minWidth: 100 }}
        slotProps={{
          select: {
            MenuProps: { slotProps: { paper: { sx: { maxHeight: 250 } } } },
          },
        }}
      >
        {ExactTimes.map((t) => (
          <MenuItem key={t} value={t} disabled={isDisabled(t, true)}>
            {t}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        select
        label={dp("to")}
        value={value.toTime}
        onChange={(e) => {
          const raw = e.target.value;
          const time =
            raw === "now" ? new DateObject().format("HH:mm") : raw;
          onChange(value.withToTime(time));
        }}
        size="small"
        sx={{ minWidth: 100 }}
        slotProps={{
          select: {
            MenuProps: { slotProps: { paper: { sx: { maxHeight: 250 } } } },
          },
        }}
      >
        {nowOption.map((o) => (
          <MenuItem key="now" value="now">
            {o.label}
          </MenuItem>
        ))}
        {ExactTimes.map((t) => (
          <MenuItem key={t} value={t} disabled={isDisabled(t, false)}>
            {t}
          </MenuItem>
        ))}
      </TextField>
    </Stack>
  );
};

export default Times;
