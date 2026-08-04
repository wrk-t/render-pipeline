// ──────────────────────────────────────────────────────────────────
// Column cell renderers — maps format type strings to cell
// renderer components for the DynamicTable.
// ──────────────────────────────────────────────────────────────────

import { BadgeCell } from "./BadgeCell";
import { ReferenceCell } from "./ReferenceCell";
import { DateCell } from "./DateCell";
import { LineChartCell } from "./LineChartCell";
import { BooleanCell } from "./BooleanCell";

export const columnCellRenderers: Record<string, React.ComponentType<any>> = {
  badge: BadgeCell,
  reference: ReferenceCell,
  date: DateCell,
  "line-chart": LineChartCell,
  boolean: BooleanCell,
  // More format types can be added here as they're created:
  // "bar-chart": BarChartCell,
  // "pie-chart": PieChartCell,
};
