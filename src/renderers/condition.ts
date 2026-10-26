import type { TRecordData } from "./RecordContext";

export type TActionCondition = {
	field: string;
	operator?: string;
	value?: unknown;
};

/** Read a dotted path (`audienceParams.groupId`) from a record. */
function readPath(record: Record<string, unknown>, path: string): unknown {
	return path
		.split(".")
		.reduce<unknown>(
			(current, key) =>
				current === null || current === undefined
					? undefined
					: (current as Record<string, unknown>)[key],
			record,
		);
}

/**
 * Evaluate a metadata action `condition` against a row/record.
 *
 * Shared by the table's row actions, the table's toolbar (gated by the detail
 * page's record) and a layout header's action buttons — so "Pause only on
 * active, Resume only on paused" has one implementation.
 */
export function matchesCondition(
	record: Record<string, unknown> | TRecordData,
	condition: TActionCondition | TActionCondition[],
): boolean {
	if (!record) return true;
	const conditions = Array.isArray(condition) ? condition : [condition];
	return conditions.every(({ field, operator, value }) => {
		const fieldValue = readPath(record, field);
		switch (operator ?? "eq") {
			case "eq":
				return fieldValue === value;
			case "ne":
				return fieldValue !== value;
			case "in":
				return Array.isArray(value) && value.includes(fieldValue);
			case "isEmpty":
				return (
					fieldValue === undefined || fieldValue === null || fieldValue === ""
				);
			case "notEmpty":
				return (
					fieldValue !== undefined && fieldValue !== null && fieldValue !== ""
				);
			default:
				return true;
		}
	});
}
