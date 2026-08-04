"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { defaultDatePickerConfig, type TDatePickerConfig } from "./config";

const DatePickerConfigContext = createContext<TDatePickerConfig>(defaultDatePickerConfig);

/**
 * Provide config to the component tree. Config is optional — merges with defaults.
 */
export function DatePickerConfigProvider({
  config,
  children,
}: {
  config?: Partial<TDatePickerConfig>;
  children: ReactNode;
}) {
  const merged = useMemo<TDatePickerConfig>(
    () => ({ ...defaultDatePickerConfig, ...config }),
    [config],
  );
  return (
    <DatePickerConfigContext.Provider value={merged}>
      {children}
    </DatePickerConfigContext.Provider>
  );
}

/** Read merged config: context defaults + optional prop overrides */
export function useDatePickerConfig(overrides?: Partial<TDatePickerConfig>) {
  const ctx = useContext(DatePickerConfigContext);
  return useMemo<TDatePickerConfig>(
    () => ({ ...ctx, ...overrides }),
    [ctx, overrides],
  );
}
