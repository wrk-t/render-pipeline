"use client";

import type { ReactElement } from "react";
import {
	type ReferenceFormatOptions,
	referenceHref,
	referenceId,
	referenceLabelFromValue,
	rowReferenceLabel,
} from "../formatting/reference";
import { referenceRowLabel, useReferenceRows } from "../hooks/useReferenceRows";

interface Props {
	cell: any;
	columnDef: any;
}

/**
 * Renders a relation as its human label — never its CUID.
 *
 * Format config:
 *   { type: "reference" }
 *   { type: "reference", props: { displayField: "displayName" } }
 *   { type: "reference", props: { endpoint: "/api/v1/users", labelField: "email" } }
 *
 * Resolution order:
 *   1. an expanded object from the backend (`{ id, displayName }`)
 *   2. a static option list on the format/field datasource
 *   3. a label carried by a sibling row field (`customerName`, `customer.name`)
 *   4. the field's service datasource, fetched once per table
 *
 * The id is kept on the cell (`data-reference-id`) for actions, and a
 * `href` template can turn the label into a link. When nothing resolves,
 * the cell shows "—" — it never falls back to the raw id.
 */
export function ReferenceCell({ cell }: Props): ReactElement {
	const value = cell.getValue();
	const fmt = cell?.column?.columnDef?.columnFormat ?? {};
	const props = {
		...(fmt?.props ?? {}),
		// Legacy shape: displayField lived at the top level of `format`.
		displayField: fmt?.props?.displayField ?? fmt?.displayField,
	} as ReferenceFormatOptions;

	const row = (cell?.row?.original ?? null) as Record<string, unknown> | null;
	const fieldName =
		cell?.column?.id ??
		cell?.column?.columnDef?.accessorKey ??
		cell?.column?.columnDef?.id ??
		null;

	const id = referenceId(value, props);
	const localLabel =
		referenceLabelFromValue(value, props) ??
		rowReferenceLabel(row, fieldName, props);

	const canLookup = Boolean(
		id && !localLabel && (props.endpoint || props.datasource?.endpoint),
	);
	const rows = useReferenceRows(canLookup ? props : null);
	const label = localLabel ?? referenceRowLabel(rows, id, props);

	const href = referenceHref(props, id);

	if (!label) {
		return (
			<span
				className="text-gray-400"
				data-reference-id={id ?? undefined}
				title={undefined}
			>
				{props.emptyLabel ?? "—"}
			</span>
		);
	}

	return (
		<span data-reference-id={id ?? undefined} title={label}>
			{href ? (
				<a
					href={href}
					className="underline decoration-dotted underline-offset-2"
					onClick={(event) => event.stopPropagation()}
				>
					{label}
				</a>
			) : (
				label
			)}
		</span>
	);
}
