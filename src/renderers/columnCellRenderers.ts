// ──────────────────────────────────────────────────────────────────
// Column cell renderers — maps format type strings to cell
// renderer components for the DynamicTable.
//
// A seed opts in with `columnConfig.format.type`:
//   text | badge | reference | date | datetime | relative |
//   money | number | line-chart | boolean | image
//
// `money`, `number`, `relative` and `datetime` are shared across every
// table; the formatters live in `src/formatting/` so a detail block and
// a table cell cannot drift apart.
// ──────────────────────────────────────────────────────────────────

import { BadgeCell } from "./BadgeCell";
import { BooleanCell } from "./BooleanCell";
import { DateCell } from "./DateCell";
import { ImageCell } from "./ImageCell";
import { LineChartCell } from "./LineChartCell";
import { MoneyCell } from "./MoneyCell";
import { NumberCell } from "./NumberCell";
import { ReferenceCell } from "./ReferenceCell";
import { RelativeCell } from "./RelativeCell";
import { TextCell } from "./TextCell";

export const columnCellRenderers: Record<string, React.ComponentType<any>> = {
	badge: BadgeCell,
	reference: ReferenceCell,
	date: DateCell,
	// A datetime always shows the clock; DateCell reads `format.type`.
	datetime: DateCell,
	relative: RelativeCell,
	money: MoneyCell,
	number: NumberCell,
	"line-chart": LineChartCell,
	boolean: BooleanCell,
	image: ImageCell,
	text: TextCell,
	// More format types can be added here as they're created:
	// "bar-chart": BarChartCell,
	// "pie-chart": PieChartCell,
};
