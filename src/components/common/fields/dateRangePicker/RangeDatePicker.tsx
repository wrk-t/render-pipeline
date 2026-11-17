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
		<div
			ref={containerRef}
			className="relative flex h-full w-full max-w-xs cursor-pointer items-stretch rounded-lg bg-card"
		>
			<button
				type="button"
				aria-haspopup="dialog"
				aria-expanded={open}
				aria-controls={open ? panelId : undefined}
				onClick={() => setOpen(true)}
				className="flex min-h-10 w-full min-w-56 cursor-pointer items-center gap-2 rounded-lg px-4 text-start text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
			>
				<Unicon name="DateRange" size={22} className="shrink-0" />
				<span aria-hidden="true" className="h-8 w-px shrink-0 bg-border" />
				<span className="h-[1.15rem] w-full truncate">{label}</span>
			</button>

			{open ? (
				<div
					id={panelId}
					role="dialog"
					aria-label={dp("dateRange")}
					className="absolute start-0 top-full z-50 mt-1 flex w-72 min-w-96 flex-col items-center rounded-lg border border-border bg-card text-card-foreground shadow-lg lg:w-[540px]"
				>
					{showTabs && (
						<>
							<div
								role="tablist"
								aria-label={dp("dateRange")}
								className="flex w-full border-b border-border"
							>
								{!config.hideQuickSelectsTab && (
									<button
										type="button"
										role="tab"
										aria-selected={selectedTab === "quick"}
										onClick={() => setSelectedTab("quick")}
										className={`flex-1 px-4 py-2 text-sm transition-colors ${
											selectedTab === "quick"
												? "border-b-2 border-primary font-medium text-foreground"
												: "border-b-2 border-transparent text-muted-foreground hover:text-foreground"
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
										className={`flex-1 px-4 py-2 text-sm transition-colors ${
											selectedTab === "range"
												? "border-b-2 border-primary font-medium text-foreground"
												: "border-b-2 border-transparent text-muted-foreground hover:text-foreground"
										}`}
									>
										{dp("dateRange")}
									</button>
								)}
							</div>
							<div aria-hidden="true" className="h-px w-full bg-border" />
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
							<div className="flex w-full flex-col items-center justify-center py-1">
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
					<div className="flex w-full items-center justify-end gap-2 border-t border-border p-3">
						<button
							type="button"
							onClick={handleClose}
							className="min-w-[100px] rounded-lg border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
						>
							{dp("cancel")}
						</button>
						<button
							type="button"
							onClick={handleSubmit}
							disabled={draftValue === null}
							className="min-w-[100px] rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50"
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
