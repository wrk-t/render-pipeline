"use client";

import { useLocale, useTranslations } from "next-intl";
import { type FC, useEffect, useId, useRef, useState } from "react";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import { Calendar, type DateObject } from "react-multi-date-picker";
import { Unicon } from "../../icon/Unicon";
import {
	AbsoluteDateValue,
	CustomQuickValue,
	QuickSelectValue,
	type TDatePickerConfig,
	type TDatePickerValue,
} from "./config";
import { DatePickerConfigProvider, useDatePickerConfig } from "./context";
import { CustomQuickPanel } from "./panels/CustomQuickPanel";
import { QuickSelectPanel } from "./panels/QuickSelectPanel";
import Times from "./times/Times";

// ─── Public props ─────────────────────────────────────────────

export interface RangeDatePickerProps {
	value?: TDatePickerValue | null;
	onValueChange?: (v: TDatePickerValue) => void;
	onSubmit?: (range: TDatePickerValue | null, value?: TDatePickerValue) => void;
	config?: Partial<TDatePickerConfig>;
}

// MUI's `useMediaQuery(theme.breakpoints.up("lg"))` was true from 1200px up.
const LG_QUERY = "(min-width: 1200px)";

// react-multi-date-picker injects its own base stylesheet, whose default skin
// is blue with round day pills. These utilities are scoped under the panel, so
// their specificity beats the injected rules and the calendar reads as shadcn
// (neutral today/selected/range states, muted weekdays) without global CSS.
const CALENDAR_CLASS = [
	"[&_.rmdp-wrapper]:rounded-md [&_.rmdp-wrapper]:bg-transparent [&_.rmdp-wrapper]:text-foreground",
	"[&_.rmdp-calendar]:bg-transparent",
	"[&_.rmdp-month-picker]:bg-popover [&_.rmdp-year-picker]:bg-popover",
	"[&_.rmdp-header-values]:text-sm [&_.rmdp-header-values]:font-medium",
	"[&_.rmdp-week-day]:text-xs [&_.rmdp-week-day]:font-normal [&_.rmdp-week-day]:text-muted-foreground",
	"[&_.rmdp-arrow]:border-foreground [&_.rmdp-arrow-container:hover]:bg-muted",
	"[&_.rmdp-day]:text-foreground",
	"[&_.rmdp-day_span]:rounded-md [&_.rmdp-day_span]:text-sm",
	"[&_.rmdp-wrapper_.rmdp-day_span:hover]:bg-muted [&_.rmdp-wrapper_.rmdp-day_span:hover]:text-foreground",
	"[&_.rmdp-wrapper_.rmdp-day.rmdp-today_span]:bg-muted [&_.rmdp-wrapper_.rmdp-day.rmdp-today_span]:text-foreground",
	"[&_.rmdp-wrapper_.rmdp-day.rmdp-selected_span]:bg-primary [&_.rmdp-wrapper_.rmdp-day.rmdp-selected_span]:text-primary-foreground [&_.rmdp-wrapper_.rmdp-day.rmdp-selected_span]:shadow-none",
	"[&_.rmdp-range]:bg-primary [&_.rmdp-range]:text-primary-foreground [&_.rmdp-range]:shadow-none",
	"[&_.rmdp-range-hover]:bg-muted [&_.rmdp-range-hover]:text-foreground",
].join(" ");

// shadcn/ui button metrics: `h-9 rounded-md px-4 text-sm font-medium`.
const BUTTON_CLASS =
	"h-9 min-w-20 rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

const TAB_CLASS =
	"flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

/** `false` on the server and the first client render (like MUI), then live. */
function useIsLargeScreen(): boolean {
	const [isLarge, setIsLarge] = useState(false);

	useEffect(() => {
		const query = window.matchMedia(LG_QUERY);
		const update = () => setIsLarge(query.matches);
		update();
		query.addEventListener("change", update);
		return () => query.removeEventListener("change", update);
	}, []);

	return isLarge;
}

// ─── Inner component (has access to config context) ──────────

const RangeDatePickerInner: FC<Omit<RangeDatePickerProps, "config">> = ({
	onSubmit,
	value,
}) => {
	const locale = useLocale();
	const t = useTranslations("common");
	const dp = useTranslations("datePicker");
	const isLg = useIsLargeScreen();
	const config = useDatePickerConfig();
	const [draftValue, setDraftValue] = useState<TDatePickerValue | null>(null);
	const [selectedTab, setSelectedTab] = useState<"quick" | "range">("quick");
	const [open, setOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const panelId = `${useId()}-date-range-panel`;

	const isFa = locale === "fa";

	// ── Handlers ──

	const handleValueChange = (next: TDatePickerValue | null) => {
		setDraftValue(next);
	};

	const handleSubmit = () => {
		onSubmit?.(draftValue, value ?? undefined);
		handleClose();
	};

	const handleCalendarChange = (dates: DateObject | DateObject[] | null) => {
		if (!dates) return;
		const arr = Array.isArray(dates) ? dates : [dates];
		if (arr.length === 0) return;

		const newDate = new AbsoluteDateValue(
			arr[0],
			arr[1] ?? arr[0],
			"00:00",
			"23:59",
		);
		setDraftValue(newDate);
	};

	const handleClose = () => {
		setDraftValue(null);
		setOpen(false);
	};

	// Close on outside pointer-down and Escape, like the previous popover.
	useEffect(() => {
		if (!open) return;
		const close = () => {
			setDraftValue(null);
			setOpen(false);
		};
		const handlePointerDown = (event: PointerEvent) => {
			if (!containerRef.current?.contains(event.target as Node)) {
				close();
			}
		};
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") close();
		};
		document.addEventListener("pointerdown", handlePointerDown);
		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("pointerdown", handlePointerDown);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [open]);

	const currentValue = draftValue ?? value ?? null;
	const showTabs = !(config.hideQuickSelectsTab && config.hideDateRangeTab);

	const label =
		currentValue instanceof QuickSelectValue
			? dp(`quickSelects.${currentValue.id}`)
			: currentValue instanceof AbsoluteDateValue
				? currentValue.getLabel(isFa)
				: currentValue instanceof CustomQuickValue
					? `${currentValue.label} ${dp(`timeUnits.${currentValue.unit}`)}`
					: "-";

	return (
		<div ref={containerRef} className="relative w-full max-w-xs cursor-pointer">
			<button
				type="button"
				aria-haspopup="dialog"
				aria-expanded={open}
				aria-controls={open ? panelId : undefined}
				onClick={() => setOpen(true)}
				className="flex h-9 w-full min-w-56 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-start text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			>
				<Unicon
					name="DateRange"
					size={16}
					className="size-4 shrink-0 text-muted-foreground"
				/>
				<span aria-hidden="true" className="h-4 w-px shrink-0 bg-border" />
				<span className="w-full truncate">{label}</span>
			</button>

			{open ? (
				<div
					id={panelId}
					role="dialog"
					aria-label={dp("dateRange")}
					className={`absolute start-0 top-full z-50 mt-1 flex w-72 min-w-96 flex-col rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-md lg:w-[540px] ${CALENDAR_CLASS}`}
				>
					{showTabs && (
						<>
							<div
								role="tablist"
								aria-label={dp("dateRange")}
								className="mb-3 flex w-full rounded-lg bg-muted p-1"
							>
								{!config.hideQuickSelectsTab && (
									<button
										type="button"
										role="tab"
										aria-selected={selectedTab === "quick"}
										onClick={() => setSelectedTab("quick")}
										className={`${TAB_CLASS} ${
											selectedTab === "quick"
												? "bg-background text-foreground shadow-sm"
												: "text-muted-foreground hover:text-foreground"
										}`}
									>
										{dp("quickSelect")}
									</button>
								)}
								{!config.hideDateRangeTab && (
									<button
										type="button"
										role="tab"
										aria-selected={selectedTab === "range"}
										onClick={() => setSelectedTab("range")}
										className={`${TAB_CLASS} ${
											selectedTab === "range"
												? "bg-background text-foreground shadow-sm"
												: "text-muted-foreground hover:text-foreground"
										}`}
									>
										{dp("dateRange")}
									</button>
								)}
							</div>
							<div aria-hidden="true" className="hidden" />
						</>
					)}

					{/* Panel content */}
					<div className="relative flex w-full flex-nowrap">
						{selectedTab === "quick" && (
							<div className="flex w-full flex-col gap-2">
								<QuickSelectPanel
									value={currentValue}
									onChange={handleValueChange}
								/>
								{!config.hideFavoriteTimeButton && (
									<>
										<div aria-hidden="true" className="h-px w-full bg-border" />
										<CustomQuickPanel
											value={currentValue}
											onChange={handleValueChange}
										/>
									</>
								)}
							</div>
						)}

						{selectedTab === "range" && (
							<div className="flex w-full flex-col items-center justify-center">
								<Calendar
									value={
										currentValue instanceof AbsoluteDateValue
											? currentValue.isSameDay()
												? [currentValue.fromDate]
												: [currentValue.fromDate, currentValue.toDate]
											: null
									}
									numberOfMonths={isLg ? 2 : 1}
									maxDate={new Date()}
									onChange={handleCalendarChange}
									range
									highlightToday
									shadow={false}
									{...(isFa ? { calendar: persian, locale: persian_fa } : {})}
								/>
								{selectedTab === "range" && (
									<Times value={currentValue} onChange={handleValueChange} />
								)}
							</div>
						)}
					</div>

					{/* Action buttons */}
					<div className="mt-3 flex w-full items-center justify-end gap-2">
						<button
							type="button"
							onClick={handleClose}
							className={`${BUTTON_CLASS} border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground`}
						>
							{dp("cancel")}
						</button>
						<button
							type="button"
							onClick={handleSubmit}
							disabled={draftValue === null}
							className={`${BUTTON_CLASS} bg-primary text-primary-foreground hover:bg-primary/90`}
						>
							{t("submit")}
						</button>
					</div>
				</div>
			) : null}
		</div>
	);
};

// ─── Public component ────────────────────────────────────────

const RangeDatePicker: FC<RangeDatePickerProps> = ({ config, ...props }) => (
	<DatePickerConfigProvider config={config}>
		<RangeDatePickerInner {...props} />
	</DatePickerConfigProvider>
);

export default RangeDatePicker;
