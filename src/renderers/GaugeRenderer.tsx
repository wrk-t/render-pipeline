"use client";

import type { ReactElement } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { ChartWrapper } from "./ChartWrapper";
import type { RenderedComponent } from "../types";

// ──────────────────────────────────────────────────────────────────
// Data mapping — extract a single numeric value from API response
// ──────────────────────────────────────────────────────────────────

interface GaugeMapping {
  valuePath?: string;
  unit?: string;
}

function resolvePath(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  return path.split(".").reduce((acc: unknown, key: string) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

function mapGaugeData(response: unknown, mapping: Record<string, unknown>): number | null {
  const m = mapping as unknown as GaugeMapping;
  const path = m.valuePath ?? "value";
  const raw = resolvePath(response, path);
  if (raw === null || raw === undefined) return null;
  const num = Number(raw);
  return isNaN(num) ? null : num;
}

// ──────────────────────────────────────────────────────────────────
// GaugeRenderer — single aggregated value via ChartWrapper
// ──────────────────────────────────────────────────────────────────

export function GaugeRenderer({
  component,
  pathParams,
}: {
  component: RenderedComponent;
  pathParams?: Record<string, string>;
}): ReactElement {
  return (
    <ChartWrapper component={component} pathParams={pathParams} mapData={mapGaugeData}>
      {(chartData) => {
        const value = chartData as number | null;
        if (value === null) {
          return null; // ChartWrapper handles the empty state
        }

        const cfg = (component.config ?? {}) as Record<string, unknown>;
        const dm = (cfg.dataMapping ?? {}) as GaugeMapping;
        const unit = dm.unit ?? "";
        const rounded = Math.round(value * 100) / 100;
        const formatted = unit ? `${rounded} ${unit}` : String(rounded);

        return (
          <Box className="flex flex-col items-center justify-center py-8">
            <Typography variant="h3" className="font-bold" color="primary">
              {formatted}
            </Typography>
          </Box>
        );
      }}
    </ChartWrapper>
  );
}
