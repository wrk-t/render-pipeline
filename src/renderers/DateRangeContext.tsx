"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { Past24Hours, type TDatePickerValue } from "../components/common/fields/dateRangePicker/config";

export interface DateRange {
  from: number;
  to: number;
}

interface DateRangeContextValue {
  range: DateRange;
  setRange: (range: DateRange) => void;
  pickerValue: TDatePickerValue | null;
  setPickerValue: (v: TDatePickerValue | null) => void;
}

const DEFAULT_RANGE: DateRange = {
  // Past 24 hours
  from: Date.now() - 24 * 60 * 60 * 1000,
  to: Date.now(),
};

const DateRangeContext = createContext<DateRangeContextValue>({
  range: DEFAULT_RANGE,
  setRange: () => {},
  pickerValue: null,
  setPickerValue: () => {},
});

export function DateRangeProvider({ children }: { children: ReactNode }) {
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);
  const [pickerValue, setPickerValue] = useState<TDatePickerValue | null>(() => new Past24Hours());
  return (
    <DateRangeContext.Provider value={{ range, setRange, pickerValue, setPickerValue }}>
      {children}
    </DateRangeContext.Provider>
  );
}

export function useDateRange() {
  return useContext(DateRangeContext);
}
