"use client";

import { useTranslations } from "next-intl";
import type { FC } from "react";
import type { TDatePickerValue, TTimeUnit } from "../config";
import { CustomQuickValue, DateTimeParts } from "../config";

const TIME_UNITS = Object.keys(DateTimeParts) as TTimeUnit[];

const INPUT_CLASS =
	"h-9 rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

interface Props {
	value: TDatePickerValue | null;
	onChange: (v: TDatePickerValue | null) => void;
}

export const CustomQuickPanel: FC<Props> = ({ value, onChange }) => {
	const dp = useTranslations("datePicker");
	const isSelected = value instanceof CustomQuickValue;
	const cq = isSelected ? value : null;

	const handleToggle = () => {
		if (isSelected) {
			onChange(null);
		} else {
			onChange(new CustomQuickValue());
		}
	};

	return (
		<div className="flex flex-row items-center gap-3">
			<button
				type="button"
				aria-pressed={isSelected}
				onClick={handleToggle}
				className={`h-9 shrink-0 rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
					isSelected
						? "bg-primary text-primary-foreground shadow-sm"
						: "border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
				}`}
			>
				{dp("favoriteTime")}
			</button>

			{isSelected && cq && (
				<div className="flex flex-row items-center gap-2">
					<input
						type="text"
						inputMode="numeric"
						aria-label={dp("favoriteTime")}
						value={cq.label}
						onChange={(e) => {
							const num = Number(e.target.value);
							if (!Number.isNaN(num)) onChange(new CustomQuickValue(num));
						}}
						className={`w-20 text-center ${INPUT_CLASS}`}
					/>
					<select
						aria-label={dp("favoriteTime")}
						value={cq.unit}
						onChange={(e) => onChange(cq.withUnit(e.target.value as TTimeUnit))}
						className={`w-24 ${INPUT_CLASS}`}
					>
						{TIME_UNITS.map((unit) => (
							<option key={unit} value={unit}>
								{dp(`timeUnits.${unit}`)}
							</option>
						))}
					</select>
				</div>
			)}
		</div>
	);
};
