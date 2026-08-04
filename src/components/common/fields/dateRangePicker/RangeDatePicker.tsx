"use client";

import {
	Box,
	Button,
	Divider,
	Popover,
	Stack,
	Tab,
	Tabs,
	Typography,
	useMediaQuery,
	useTheme,
} from "@mui/material";
import { useLocale, useTranslations } from "next-intl";
import { type FC, useState } from "react";
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

// ─── Inner component (has access to config context) ──────────

const RangeDatePickerInner: FC<Omit<RangeDatePickerProps, "config">> = ({
	onSubmit,
	value,
}) => {
	const locale = useLocale();
	const t = useTranslations("common");
	const dp = useTranslations("datePicker");
	const theme = useTheme();
	const isLg = useMediaQuery(theme.breakpoints.up("lg"));
	const config = useDatePickerConfig();
	const [draftValue, setDraftValue] = useState<TDatePickerValue | null>(null);
	const [selectedTab, setSelectedTab] = useState<"quick" | "range">("quick");
	const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

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

	const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
		setAnchorEl(event.currentTarget);
	};

	const handleClose = () => {
		setDraftValue(null);
		setAnchorEl(null);
	};

	const open = Boolean(anchorEl);
	const id = open ? "date-range-picker-popover" : undefined;
	const currentValue = draftValue ?? value ?? null;
	const showTabs = !(config.hideQuickSelectsTab && config.hideDateRangeTab);

	return (
		<Box className="flex h-full w-full cursor-pointer items-stretch border bg-white rounded-lg max-w-xs">
			<Button
				aria-describedby={id}
				type="button"
				variant="text"
				color="inherit"
				size="small"
				fullWidth
				className="min-h-10 min-w-56 px-4"
				onClick={handleClick}
			>
				<Stack direction="row" className="w-full items-center">
					<Unicon name="DateRange" size={22} />
					<Divider orientation="vertical" className="h-8" />
					<Typography
						component="p"
						variant="button"
						className="h-[1.15rem] w-full"
					>
						{currentValue instanceof QuickSelectValue
							? dp(`quickSelects.${currentValue.id}`)
							: currentValue instanceof AbsoluteDateValue
								? currentValue.getLabel(isFa)
								: currentValue instanceof CustomQuickValue
									? `${currentValue.label} ${dp(`timeUnits.${currentValue.unit}`)}`
									: "-"}
					</Typography>
				</Stack>
			</Button>

			<Popover
				id={id}
				open={open}
				anchorEl={anchorEl}
				onClose={handleClose}
				anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
				transformOrigin={{ vertical: "top", horizontal: "left" }}
				className="mt-1"
			>
				<Stack className="w-72 min-w-96 items-center rounded-lg lg:w-[540px] border">
					{showTabs && (
						<>
							<Tabs
								value={selectedTab}
								onChange={(_, v) => setSelectedTab(v as "quick" | "range")}
								variant="fullWidth"
								sx={{ width: "100%" }}
							>
								{!config.hideQuickSelectsTab && (
									<Tab value="quick" label={dp("quickSelect")} />
								)}
								{!config.hideDateRangeTab && (
									<Tab value="range" label={dp("dateRange")} />
								)}
							</Tabs>
							<Divider className="w-full" />
						</>
					)}

					{/* Panel content */}
					<Box className="relative flex flex-nowrap w-full">
						{selectedTab === "quick" && (
							<Stack spacing={1} className="w-full">
								<QuickSelectPanel
									value={currentValue}
									onChange={handleValueChange}
								/>
								{!config.hideFavoriteTimeButton && (
									<>
										<Divider />
										<CustomQuickPanel
											value={currentValue}
											onChange={handleValueChange}
										/>
									</>
								)}
							</Stack>
						)}

						{selectedTab === "range" && (
							<Stack className="justify-center py-1 w-full">
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
									onChange={handleCalendarChange as any}
									range
									highlightToday
									shadow={false}
									{...(isFa ? { calendar: persian, locale: persian_fa } : {})}
								/>
								{selectedTab === "range" && (
									<Times value={currentValue} onChange={handleValueChange} />
								)}
							</Stack>
						)}
					</Box>

					{/* Action buttons */}
					<div className="flex w-full items-center justify-end gap-2 border-t border-neutral-100 p-3">
						<Button
							variant="outlined"
							color="inherit"
							onClick={handleClose}
							sx={{ minWidth: 100 }}
						>
							{dp("cancel")}
						</Button>
						<Button
							variant="contained"
							color="primary"
							onClick={handleSubmit}
							disabled={draftValue === null}
							sx={{ minWidth: 100 }}
						>
							{t("submit")}
						</Button>
					</div>
				</Stack>
			</Popover>
		</Box>
	);
};

// ─── Public component ────────────────────────────────────────

const RangeDatePicker: FC<RangeDatePickerProps> = ({ config, ...props }) => (
	<DatePickerConfigProvider config={config}>
		<RangeDatePickerInner {...props} />
	</DatePickerConfigProvider>
);

export default RangeDatePicker;
