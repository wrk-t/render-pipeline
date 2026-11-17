"use client";

import { useTranslations } from "next-intl";
import type { FC } from "react";
import { QuickSelectValue, type TDatePickerValue } from "../config";
import { useDatePickerConfig } from "../context";

interface Props {
	value: TDatePickerValue | null;
	onChange: (v: TDatePickerValue) => void;
}

export const QuickSelectPanel: FC<Props> = ({ value, onChange }) => {
	const { quickSelects } = useDatePickerConfig();
	const dp = useTranslations("datePicker");

	const activeId = value instanceof QuickSelectValue ? value.id : null;

	return (
		<div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
			{quickSelects.map((item) => {
				const isActive = activeId === item.id;
				return (
					<button
						key={item.id}
						type="button"
						aria-pressed={isActive}
						onClick={() => onChange(item)}
						className={`h-9 w-full rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
							isActive
								? "bg-primary text-primary-foreground shadow-sm"
								: "border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
						}`}
					>
						{dp(`quickSelects.${item.id}`)}
					</button>
				);
			})}
		</div>
	);
};
