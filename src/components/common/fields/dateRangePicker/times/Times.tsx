"use client";

import { useTranslations } from "next-intl";
import { type FC, useMemo } from "react";
import { DateObject } from "react-multi-date-picker";
import {
	AbsoluteDateValue,
	ExactTimes,
	type TDatePickerValue,
} from "../config";

interface Props {
	value: TDatePickerValue | null;
	onChange: (v: TDatePickerValue) => void;
}

const TIME_SELECT_CLASS =
	"h-9 min-w-24 rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const TIME_LABEL_CLASS = "flex flex-col gap-1.5";

const TIME_LABEL_TEXT_CLASS =
	"text-sm font-medium leading-none text-foreground";

const Times: FC<Props> = ({ value, onChange }) => {
	const dp = useTranslations("datePicker");

	const sameDay = useMemo(() => {
		if (value instanceof AbsoluteDateValue) {
			return (
				value.fromDate.format("YYYY-MM-DD") ===
				value.toDate.format("YYYY-MM-DD")
			);
		}
		return false;
	}, [value]);

	const nowOption = useMemo(() => {
		if (value instanceof AbsoluteDateValue) {
			const toFmt = value.toDate.format("YYYY-MM-DD");
			const today = new DateObject().format("YYYY-MM-DD");
			if (toFmt === today) {
				return [{ label: dp("now"), value: "now" }];
			}
		}
		return [];
	}, [value, dp]);

	const isDisabled = (time: string, isFrom: boolean): boolean => {
		if (value instanceof AbsoluteDateValue) {
			if (!sameDay) return false;
			const [h, m] = time.split(":").map(Number);
			const otherTime = isFrom ? value.toTime : value.fromTime;
			const [otherH, otherM] = otherTime.split(":").map(Number);
			if (isFrom) {
				if (h > otherH || (h === otherH && m >= otherM)) return true;
			} else if (otherH > h || (otherH === h && otherM >= m)) return true;
			const now = new DateObject();
			const date = isFrom ? value.fromDate : value.toDate;
			if (date.format("YYYY-MM-DD") !== now.format("YYYY-MM-DD")) return false;
			const nowH = Number(now.format("HH"));
			const nowM = Number(now.format("mm"));
			return h > nowH || (h === nowH && m > nowM);
		}
		return false;
	};

	if (!(value instanceof AbsoluteDateValue)) return null;

	return (
		<div className="flex flex-row items-start gap-3 pt-2">
			<label className={TIME_LABEL_CLASS}>
				<span className={TIME_LABEL_TEXT_CLASS}>{dp("from")}</span>
				<select
					value={value.fromTime}
					onChange={(e) => onChange(value.withFromTime(e.target.value))}
					className={TIME_SELECT_CLASS}
				>
					{ExactTimes.map((t) => (
						<option key={t} value={t} disabled={isDisabled(t, true)}>
							{t}
						</option>
					))}
				</select>
			</label>

			<label className={TIME_LABEL_CLASS}>
				<span className={TIME_LABEL_TEXT_CLASS}>{dp("to")}</span>
				<select
					value={value.toTime}
					onChange={(e) => {
						const raw = e.target.value;
						const time = raw === "now" ? new DateObject().format("HH:mm") : raw;
						onChange(value.withToTime(time));
					}}
					className={TIME_SELECT_CLASS}
				>
					{nowOption.map((o) => (
						<option key="now" value="now">
							{o.label}
						</option>
					))}
					{ExactTimes.map((t) => (
						<option key={t} value={t} disabled={isDisabled(t, false)}>
							{t}
						</option>
					))}
				</select>
			</label>
		</div>
	);
};

export default Times;
