"use client";

import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Stack from "@mui/material/Stack";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import type { FC } from "react";
import { BaseDialogActions } from "./BaseDialogActions";
import { BaseDialogHeader } from "./BaseDialogHeader";
import type { IBaseDialogProps } from "./types";

export const BaseDialog: FC<IBaseDialogProps> = ({
	title,
	onSubmit,
	children,
	isPending,
	onClose,
	slotProps,
	isOpen = false,
	disabled = false,
}) => {
	// Every DSL dialog is full-screen on a phone (below MUI's `sm`) and a
	// centred modal from `sm` up. A phone has no room for a 600px paper with
	// a footer: the form scrolls behind a sticky header and a reachable footer.
	const theme = useTheme();
	const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

	return (
		<Dialog open={isOpen} fullWidth fullScreen={fullScreen}>
			<BaseDialogHeader title={title} disabled={isPending} onClose={onClose} />
			{/*
			 * The content scrolls, the header and the actions stay put (CRM-23).
			 * No `justify-center` on the child: a centred flex child that overflows
			 * pushes its *top* out of reach, which is why a long form looked like it
			 * "does not scroll" — the start of the form was simply un-scrollable.
			 *
			 * Full-screen: the content owns the remaining height instead of a
			 * fixed 90vh cap, so the footer stays at the bottom of the screen.
			 */}
			<DialogContent
				sx={{
					minHeight: 96,
					// Full-screen: the content owns the remaining height instead of
					// a fixed 90vh cap, so the footer stays at the bottom of the
					// screen. `sx` rather than Tailwind: the front's Tailwind build
					// does not scan this package, so package-only utilities are dead.
					...(fullScreen ? { flex: 1 } : { maxHeight: "90vh" }),
					overflowY: "auto",
				}}
			>
				<Stack sx={{ flex: 1, width: "100%" }}>{children}</Stack>
			</DialogContent>
			<BaseDialogActions
				disabled={disabled}
				onClose={onClose}
				isPending={isPending}
				onSubmit={onSubmit}
				slotProps={{
					closeButton: slotProps?.closeButton,
					submitButton: slotProps?.submitButton,
					submitNowButton: slotProps?.submitNowButton,
				}}
			/>
		</Dialog>
	);
};
