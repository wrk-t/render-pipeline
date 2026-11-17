"use client";

import { useField, useFormikContext } from "formik";
import { type ReactElement, useId } from "react";
import { Unicon } from "../../components/common/icon/Unicon";

// ════════════════════════════════════════════════════════════════
// VariantEditorField — inline repeater for item variants
// (e.g. Small / Medium / Large with price deltas).
//
// Formik value: Array<{ label: string; priceDelta: number; isDefault: boolean }>
// ════════════════════════════════════════════════════════════════

export interface VariantRow {
	label: string;
	priceDelta: number;
	isDefault: boolean;
}

const INPUT_CLASS =
	"flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm text-start shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const LABEL_CLASS = "text-sm font-medium leading-none text-foreground";

const GHOST_BUTTON_CLASS =
	"inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

const REMOVE_BUTTON_CLASS =
	"inline-flex size-9 shrink-0 items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

export function VariantEditorField({
	field,
}: {
	field: {
		name: string;
		label?: string;
		isRequired?: boolean;
		isReadOnly?: boolean;
	};
}): ReactElement {
	const [{ value }, meta, { setValue }] = useField<VariantRow[]>(field.name);
	const { isSubmitting } = useFormikContext();
	const baseId = useId();

	const rows: VariantRow[] = Array.isArray(value) ? value : [];

	const updateRow = (index: number, patch: Partial<VariantRow>) => {
		const next = rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
		setValue(next);
	};

	const removeRow = (index: number) => {
		setValue(rows.filter((_, i) => i !== index));
	};

	const addRow = () => {
		setValue([...rows, { label: "", priceDelta: 0, isDefault: false }]);
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
					No variants — the item's base price is used.
				</p>
			)}

			{rows.map((row, i) => (
				<div key={i} className="flex flex-wrap items-end gap-2">
					<div className="flex min-w-40 flex-1 flex-col gap-2">
						<label htmlFor={`${baseId}-label-${i}`} className={LABEL_CLASS}>
							Label
						</label>
						<input
							id={`${baseId}-label-${i}`}
							type="text"
							value={row.label}
							disabled={disabled}
							onChange={(e) => updateRow(i, { label: e.target.value })}
							className={INPUT_CLASS}
						/>
					</div>
					<div className="flex w-24 flex-col gap-2">
						<label htmlFor={`${baseId}-price-${i}`} className={LABEL_CLASS}>
							Price +
						</label>
						<input
							id={`${baseId}-price-${i}`}
							type="number"
							value={row.priceDelta}
							disabled={disabled}
							onChange={(e) =>
								updateRow(i, { priceDelta: Number(e.target.value) || 0 })
							}
							className={INPUT_CLASS}
						/>
					</div>
					<label className="inline-flex h-9 items-center gap-2 text-sm font-medium leading-none text-foreground">
						<input
							type="checkbox"
							checked={row.isDefault}
							disabled={disabled}
							onChange={(e) => updateRow(i, { isDefault: e.target.checked })}
							className="size-4 rounded border-input accent-primary disabled:cursor-not-allowed disabled:opacity-50"
						/>
						Default
					</label>
					<button
						type="button"
						disabled={disabled}
						onClick={() => removeRow(i)}
						aria-label="Remove variant"
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
					Add variant
				</button>
			</div>
			{meta.touched && meta.error && (
				<p className="text-sm text-destructive">{meta.error}</p>
			)}
		</div>
	);
}
