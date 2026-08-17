"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useField, useFormikContext } from "formik";
import { useMemo, useState, type ReactElement } from "react";
import { ICON_EXPORT, Unicon } from "../../components/common/icon/Unicon";

// ════════════════════════════════════════════════════════════════
// IconPickerField — searchable grid of icons from the app's Unicon
// set. The field value is the icon NAME (an ICON_EXPORT key), e.g.
// "Warning" — exactly what <Unicon name="Warning" /> expects.
// ════════════════════════════════════════════════════════════════

const ALL_ICON_NAMES = Object.keys(ICON_EXPORT).sort();

export function IconPickerField({
	field,
}: {
	field: {
		name: string;
		label?: string;
		isRequired?: boolean;
		isReadOnly?: boolean;
	};
}): ReactElement {
	const [{ value }, meta, { setValue, setTouched }] = useField<string>(
		field.name,
	);
	const { isSubmitting } = useFormikContext();
	const [query, setQuery] = useState("");

	const selected = typeof value === "string" && value ? value : "";
	const disabled = isSubmitting || field.isReadOnly;

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return ALL_ICON_NAMES;
		return ALL_ICON_NAMES.filter((n) => n.toLowerCase().includes(q));
	}, [query]);

	return (
		<Stack spacing={1}>
			<Typography variant="body2">
				{field.label}
				{field.isRequired && (
					<Typography component="span" color="error">
						{" "}
						*
					</Typography>
				)}
			</Typography>

			<TextField
				size="small"
				placeholder="Search icons…"
				value={query}
				disabled={disabled}
				onChange={(e) => setQuery(e.target.value)}
				className="w-full"
			/>

			{selected && (
				<Stack direction="row" spacing={1} className="items-center">
					<Unicon name={selected as keyof typeof ICON_EXPORT} size={24} />
					<Typography variant="caption" color="textSecondary">
						{selected}
					</Typography>
				</Stack>
			)}

			<Box
				className="overflow-auto rounded-md border border-divider p-2"
				sx={{ maxHeight: 220 }}
			>
				{filtered.length === 0 ? (
					<Typography variant="caption" color="textSecondary">
						No icons match “{query}”
					</Typography>
				) : (
					<Box
						className="grid gap-1"
						sx={{
							gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))",
						}}
					>
						{filtered.map((name) => {
							const isSelected = name === selected;
							return (
								<Tooltip key={name} title={name} arrow>
									<Box
										role="button"
										tabIndex={0}
										onClick={() => {
											if (disabled) return;
											setValue(name);
											setTimeout(() => setTouched(true), 0);
										}}
										onKeyDown={(e) => {
											if (e.key === "Enter" && !disabled) {
												setValue(name);
												setTimeout(() => setTouched(true), 0);
											}
										}}
										className={`flex cursor-pointer items-center justify-center rounded-md p-1.5 transition-colors ${
											isSelected
												? "bg-primary-main text-white"
												: "hover:bg-action-hover"
										}`}
										sx={{
											...(disabled
												? { pointerEvents: "none", opacity: 0.6 }
												: {}),
										}}
									>
										<Unicon
											name={name as keyof typeof ICON_EXPORT}
											size={22}
										/>
									</Box>
								</Tooltip>
							);
						})}
					</Box>
				)}
			</Box>

			{meta.touched && meta.error && (
				<Typography variant="caption" color="error">
					{meta.error}
				</Typography>
			)}
		</Stack>
	);
}
