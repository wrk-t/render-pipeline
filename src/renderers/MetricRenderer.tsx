"use client";

import type { ReactElement } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { ChartWrapper } from "./ChartWrapper";
import type { RenderedComponent } from "../types";

// ──────────────────────────────────────────────────────────────────
// Data mapping
// ──────────────────────────────────────────────────────────────────

interface MetricMapping {
  /** Dot-path to the value in the API response */
  valuePath: string;
  /** Optional multiplier (e.g. 100 to convert decimal to percentage) */
  multiplier?: number;
  /** Unit label (e.g. "ms", "%", "req/s") */
  unit?: string;
  /** Number of decimal places */
  precision?: number;
}

function resolvePath(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  return path.split(".").reduce((acc: unknown, key: string) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

interface MetricData {
  value: number;
  formatted: string;
}

function mapMetricData(response: unknown, mapping: Record<string, unknown>): MetricData | null {
  const m = mapping as unknown as MetricMapping;
  const raw = resolvePath(response, m.valuePath);
  if (raw == null) return null;

  const rawNum = Number(raw);
  if (isNaN(rawNum)) return null;

  const multiplier = m.multiplier ?? 1;
  const value = rawNum * multiplier;
  const precision = m.precision ?? (multiplier !== 1 ? 1 : 0);
  const formatted = `${value.toFixed(precision)}${m.unit ? ` ${m.unit}` : ""}`;

  return { value, formatted };
}

// ──────────────────────────────────────────────────────────────────
// MetricRenderer
// ──────────────────────────────────────────────────────────────────

export function MetricRenderer({
  component,
  pathParams,
}: {
  component: RenderedComponent;
  pathParams?: Record<string, string>;
}): ReactElement {
  return (
    <ChartWrapper
      component={component}
      pathParams={pathParams}
      mapData={mapMetricData}
    >
      {(chartData) => {
        const metric = chartData as MetricData | null;
        if (!metric || metric.value == null) {
          return (
            <Box className="flex items-center justify-center min-h-[120px]">
              <Typography variant="body2" color="text.secondary">
                No data
              </Typography>
            </Box>
          );
        }

        return (
          <Box className="flex flex-col items-center justify-center min-h-[120px]">
            <Typography variant="h3" className="font-bold">
              {metric.formatted}
            </Typography>
          </Box>
        );
      }}
    </ChartWrapper>
  );
}
