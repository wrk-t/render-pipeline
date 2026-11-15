// ──────────────────────────────────────────────────────────────────
// Column cell renderers — maps format type strings to cell
// renderer components for the DynamicTable.
//
// A seed opts in with `columnConfig.format.type`:
//   text | badge | reference | date | datetime | relative |
//   money | number | line-chart | boolean | switch | chips | image
//
// `money`, `number`, `relative` and `datetime` are shared across every
// table; the formatters live in `src/formatting/` so a detail block and
// a table cell cannot drift apart.
// `switch` is the writable boolean (inline, optimistic) and `chips` the
// list-of-names presentation (categories / tags / allergens).
// ──────────────────────────────────────────────────────────────────

import { BadgeCell } from "./BadgeCell";
import { BooleanCell } from "./BooleanCell";
import { ChipsCell } from "./ChipsCell";
import { DateCell } from "./DateCell";
import { ImageCell } from "./ImageCell";
import { LineChartCell } from "./LineChartCell";
import { MoneyCell } from "./MoneyCell";
import { NumberCell } from "./NumberCell";
import { ReferenceCell } from "./ReferenceCell";
import { RelativeCell } from "./RelativeCell";
import { SwitchCell } from "./SwitchCell";
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
	// Writable boolean — the cell PATCHes the row (optimistic, rollback).
	switch: SwitchCell,
	// A list of names (categories / tags / allergens) as small chips.
	chips: ChipsCell,
	image: ImageCell,
	text: TextCell,
	// More format types can be added here as they're created:
	// "bar-chart": BarChartCell,
	// "pie-chart": PieChartCell,
};
