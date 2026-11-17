"use client";

import { useTranslations } from "next-intl";
import type { FC } from "react";
import type { TDatePickerValue, TTimeUnit } from "../config";
import { CustomQuickValue, DateTimeParts } from "../config";

const TIME_UNITS = Object.keys(DateTimeParts) as TTimeUnit[];

const INPUT_CLASS =
	"rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50";

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
		<div className="flex flex-row items-center gap-4 px-4 pb-3 pt-2">
			<button
				type="button"
				aria-pressed={isSelected}
				onClick={handleToggle}
				className={`rounded-lg px-4 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 ${
					isSelected
						? "bg-primary text-primary-foreground shadow-sm"
						: "border border-border text-foreground hover:bg-muted"
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
						className={`w-[100px] ${INPUT_CLASS}`}
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
