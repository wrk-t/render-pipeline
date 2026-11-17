"use client";

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

	const handleToggle = (checked: boolean) => {
		if (!checked) {
			onChangeAutoRefresh(null);
			return;
		}
		const first = autoRefreshItems[0];
		if (first) onChangeAutoRefresh(first.id);
	};

	return (
		<div className="mt-auto w-full border-t border-border p-3">
			<div className="flex flex-wrap items-center gap-4">
				<div className="w-full lg:w-1/3">
					<label className="flex items-center gap-2 text-sm font-medium leading-none text-foreground">
						<span className="relative inline-flex h-5 w-9 shrink-0">
							<input
								type="checkbox"
								role="switch"
								checked={isActive}
								aria-checked={isActive}
								aria-label={dp("autoRefresh")}
								onChange={(event) => handleToggle(event.target.checked)}
								className="peer h-5 w-9 cursor-pointer appearance-none rounded-full border border-transparent bg-input transition-colors checked:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
							/>
							<span
								aria-hidden="true"
								className="pointer-events-none absolute start-0.5 top-0.5 size-4 rounded-full bg-background shadow-sm transition-all duration-200 peer-checked:start-[18px]"
							/>
						</span>
						{dp("autoRefresh")}
					</label>
				</div>
				{isActive && (
					<div className="w-full lg:w-2/3">
						<select
							aria-label={dp("autoRefresh")}
							value={selectedItem?.id ?? ""}
							onChange={(e) => onChangeAutoRefresh(e.target.value)}
							className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
						>
							{autoRefreshItems.map((item) => (
								<option key={item.id} value={item.id}>
									{item.label}
								</option>
							))}
						</select>
					</div>
				)}
			</div>
		</div>
	);
};
