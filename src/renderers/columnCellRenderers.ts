// ──────────────────────────────────────────────────────────────────
// Column cell renderers — maps format type strings to cell
// renderer components for the DynamicTable.
// ──────────────────────────────────────────────────────────────────

import { BadgeCell } from "./BadgeCell";
import { BooleanCell } from "./BooleanCell";
import { DateCell } from "./DateCell";
import { LineChartCell } from "./LineChartCell";
import { ReferenceCell } from "./ReferenceCell";
import { TextCell } from "./TextCell";

export const columnCellRenderers: Record<string, React.ComponentType<any>> = {
	badge: BadgeCell,
	reference: ReferenceCell,
	date: DateCell,
	"line-chart": LineChartCell,
	boolean: BooleanCell,
	text: TextCell,
	// More format types can be added here as they're created:
	// "bar-chart": BarChartCell,
	// "pie-chart": PieChartCell,
};
