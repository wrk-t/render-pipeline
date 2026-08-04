"use client";

import Chip from "@mui/material/Chip";
import type { ReactElement } from "react";

interface Props {
  cell: any;
  columnDef: any;
}

/**
 * Renders a badge chip inside a table cell.
 * Format config: { type: "badge", props: { variantMap: { "active": "success", ... } } }
 */
export function BadgeCell({ cell }: Props): ReactElement {
  const value = cell.getValue();
  const label = String(value ?? "");
  const fmt = cell?.column?.columnDef?.columnFormat ?? {};
  const variantMap = (fmt.props as any)?.variantMap ?? {};
  const color = variantMap[String(value)] ?? variantMap[label] ?? "default";

  return (
    <Chip label={label} color={color as any} size="small" variant="outlined" />
  );
}
