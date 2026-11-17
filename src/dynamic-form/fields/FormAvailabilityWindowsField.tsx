"use client";

import { useField, useFormikContext } from "formik";
import { type ReactElement, useId } from "react";
import { Unicon } from "../../components/common/icon/Unicon";

// ════════════════════════════════════════════════════════════════
// FormAvailabilityWindowsField — inline repeater for item
// time-window availability (feature `item-availability`).
//
// Formik value: Array<{ dayOfWeek: number; openTime: string | null;
// closeTime: string | null }> — dayOfWeek 0=Saturday … 6=Friday
// (availability_windows convention). The backend persists these rows
// (targetType "item") and the public render hides items outside their
// windows.
// ════════════════════════════════════════════════════════════════

export interface AvailabilityWindowRow {
	dayOfWeek: number;
	openTime: string | null;
	closeTime: string | null;
}

const DAY_OPTIONS = [
	{ value: 0, label: "Saturday" },
	{ value: 1, label: "Sunday" },
	{ value: 2, label: "Monday" },
	{ value: 3, label: "Tuesday" },
	{ value: 4, label: "Wednesday" },
	{ value: 5, label: "Thursday" },
	{ value: 6, label: "Friday" },
];

const INPUT_CLASS =
	"flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm text-start shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const LABEL_CLASS = "text-sm font-medium leading-none text-foreground";

const GHOST_BUTTON_CLASS =
	"inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

const REMOVE_BUTTON_CLASS =
	"inline-flex size-9 shrink-0 items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

export function FormAvailabilityWindowsField({
	field,
}: {
	field: {
		name: string;
		label?: string;
		isRequired?: boolean;
		isReadOnly?: boolean;
	};
}): ReactElement {
	const [{ value }, meta, { setValue }] = useField<AvailabilityWindowRow[]>(
		field.name,
	);
	const { isSubmitting } = useFormikContext();
	const baseId = useId();

	const rows: AvailabilityWindowRow[] = Array.isArray(value) ? value : [];

	const updateRow = (index: number, patch: Partial<AvailabilityWindowRow>) => {
		const next = rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
		setValue(next);
	};

	const removeRow = (index: number) => {
		setValue(rows.filter((_, i) => i !== index));
	};

	const addRow = () => {
		setValue([...rows, { dayOfWeek: 0, openTime: "", closeTime: "" }]);
	};

	const disabled = isSubmitting || field.isReadOnly;

	return (
		<div className="flex flex-col gap-2">
			<span className="text-sm font-medium leading-none text-foreground">
				{field.label}
				{field.isRequired && (
					<span className="ms-0.5 text-destructive" aria-hidden="true">
						*
					</span>
				)}
			</span>

			{rows.length === 0 && (
				<p className="text-sm text-muted-foreground">
					No windows — the item is always available.
				</p>
			)}

			{rows.map((row, i) => (
				<div key={i} className="flex flex-wrap items-end gap-2">
					<div className="flex w-32 flex-col gap-2">
						<label htmlFor={`${baseId}-day-${i}`} className={LABEL_CLASS}>
							Day
						</label>
						<select
							id={`${baseId}-day-${i}`}
							value={row.dayOfWeek}
							disabled={disabled}
							onChange={(e) =>
								updateRow(i, { dayOfWeek: Number(e.target.value) })
							}
							className={INPUT_CLASS}
						>
							{DAY_OPTIONS.map((d) => (
								<option key={d.value} value={d.value}>
									{d.label}
								</option>
							))}
						</select>
					</div>
					<div className="flex w-28 flex-col gap-2">
						<label htmlFor={`${baseId}-open-${i}`} className={LABEL_CLASS}>
							Open
						</label>
						<input
							id={`${baseId}-open-${i}`}
							type="time"
							value={row.openTime ?? ""}
							disabled={disabled}
							onChange={(e) => updateRow(i, { openTime: e.target.value })}
							className={INPUT_CLASS}
						/>
					</div>
					<div className="flex w-28 flex-col gap-2">
						<label htmlFor={`${baseId}-close-${i}`} className={LABEL_CLASS}>
							Close
						</label>
						<input
							id={`${baseId}-close-${i}`}
							type="time"
							value={row.closeTime ?? ""}
							disabled={disabled}
							onChange={(e) => updateRow(i, { closeTime: e.target.value })}
							className={INPUT_CLASS}
						/>
					</div>
					<button
						type="button"
						disabled={disabled}
						onClick={() => removeRow(i)}
						aria-label="Remove window"
						className={REMOVE_BUTTON_CLASS}
					>
						<Unicon name="Close" size={18} />
					</button>
				</div>
			))}

			<div>
				<button
					type="button"
					onClick={addRow}
					disabled={disabled}
					className={GHOST_BUTTON_CLASS}
				>
					<Unicon name="Add" size={18} />
					Add window
				</button>
			</div>
			{meta.touched && meta.error && (
				<p className="text-sm text-destructive">{meta.error}</p>
			)}
		</div>
	);
}
