"use client";

import { Box, FormControlLabel, MenuItem, Select, Switch } from "@mui/material";
import { useTranslations } from "next-intl";
import { type FC, useMemo } from "react";
import { useDatePickerConfig } from "../context";

interface Props {
	activeAutoRefreshId: string | null;
	onChangeAutoRefresh: (id: string | null) => void;
}

export const AutoRefreshPanel: FC<Props> = ({
	activeAutoRefreshId,
	onChangeAutoRefresh,
}) => {
	const dp = useTranslations("datePicker");
	const { autoRefreshItems } = useDatePickerConfig();

	const isActive = !!activeAutoRefreshId;

	const selectedItem = useMemo(
		() => autoRefreshItems.find((i) => i.id === activeAutoRefreshId),
		[autoRefreshItems, activeAutoRefreshId],
	);

	const handleToggle = (_: unknown, checked: boolean) => {
		if (!checked) {
			onChangeAutoRefresh(null);
			return;
		}
		const first = autoRefreshItems[0];
		if (first) onChangeAutoRefresh(first.id);
	};

	return (
		<Box
			sx={{
				mt: "auto",
				width: "100%",
				borderTop: 1,
				borderColor: "divider",
				p: 1.5,
			}}
		>
			<div className="flex flex-wrap items-center gap-4">
				<div className="w-full lg:w-1/3">
					<FormControlLabel
						control={<Switch checked={isActive} onChange={handleToggle} />}
						label={dp("autoRefresh")}
					/>
				</div>
				{isActive && (
					<div className="w-full lg:w-2/3">
						<Select
							value={selectedItem?.id ?? ""}
							onChange={(e) => onChangeAutoRefresh(e.target.value)}
							size="small"
							fullWidth
						>
							{autoRefreshItems.map((item) => (
								<MenuItem key={item.id} value={item.id}>
									{item.label}
								</MenuItem>
							))}
						</Select>
					</div>
				)}
			</div>
		</Box>
	);
};
