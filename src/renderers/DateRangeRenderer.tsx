"use client";

import { type ReactElement, useCallback } from "react";
import { RangeDatePicker } from "../components/common/fields/dateRangePicker";
import type { TDatePickerValue } from "../components/common/fields/dateRangePicker/config";
import type { RenderedComponent } from "../types";
import { useDateRange } from "./DateRangeContext";

export function DateRangeRenderer({
  component,
  pathParams: _pathParams,
}: {
  component: RenderedComponent;
  pathParams?: Record<string, string>;
}): ReactElement {
  const { setRange, pickerValue, setPickerValue } = useDateRange();

  const handleSubmit = useCallback(
    (draftValue: TDatePickerValue | null) => {
      if (draftValue) {
        setPickerValue(draftValue);
        const resolved = draftValue.resolve();
        if (resolved?.from && resolved?.to) {
          setRange({ from: resolved.from, to: resolved.to });
        }
      }
    },
    [setRange, setPickerValue],
  );

  return <RangeDatePicker value={pickerValue} onSubmit={handleSubmit} />;
}
