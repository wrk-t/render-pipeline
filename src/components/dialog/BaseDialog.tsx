"use client";

import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Stack from "@mui/material/Stack";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTranslations } from "next-intl";
import { type FC, useCallback, useEffect, useState } from "react";
import { BaseDialogActions } from "./BaseDialogActions";
import { BaseDialogHeader } from "./BaseDialogHeader";
import { DialogDirtyProvider } from "./dialogDirtyContext";
import type { DialogSize, IBaseDialogProps } from "./types";

/** `fullScreen` maps to MUI's boolean; the rest are MUI `maxWidth` tiers. */
const MAX_WIDTH: Record<
	Exclude<DialogSize, "fullScreen">,
	"sm" | "md" | "lg"
> = {
	sm: "sm",
	md: "md",
	lg: "lg",
};

export const BaseDialog: FC<IBaseDialogProps> = ({
	title,
	onSubmit,
	children,
	isPending,
	onClose,
	slotProps,
	isOpen = false,
	disabled = false,
	size = "sm",
}) => {
	// Every DSL dialog is full-screen on a phone (below MUI's `sm`) and a
	// centred modal from `sm` up. A phone has no room for a 600px paper with
	// a footer: the form scrolls behind a sticky header and a reachable footer.
	const theme = useTheme();
	const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
	const t = useTranslations();

	// ── Unsaved-changes guard (UX-7) ────────────────────────────
	// Escape, a backdrop click and the header X are the same close request
	// here (MUI reports the first two through `Dialog.onClose`). When the
	// content reported unsaved edits, ask before dropping them.
	const [dirty, setDirty] = useState(false);
	const [confirmDiscard, setConfirmDiscard] = useState(false);

	// A dialog that is closing/reopening starts clean: the previous form may
	// still be mounted during the exit animation.
	useEffect(() => {
		if (!isOpen) {
			setConfirmDiscard(false);
			setDirty(false);
		}
	}, [isOpen]);

	const requestClose = useCallback(() => {
		// Never yank the dialog away mid-submit: the request is in flight.
		if (isPending || disabled) return;
		if (dirty) {
			setConfirmDiscard(true);
			return;
		}
		onClose?.();
	}, [dirty, disabled, isPending, onClose]);

	const discard = useCallback(() => {
		setConfirmDiscard(false);
		setDirty(false);
		onClose?.();
	}, [onClose]);

	const discardTitle = t.has("common.discardChanges")
		? t("common.discardChanges")
		: "Discard changes?";
	const discardMessage = t.has("common.discardMessage")
		? t("common.discardMessage")
		: "You have unsaved changes. Closing now will lose them.";
	const discardAction = t.has("common.discard")
		? t("common.discard")
		: "Discard";

	const fullScreenDialog = fullScreen || size === "fullScreen";

	return (
		<DialogDirtyProvider onDirtyChange={setDirty}>
			<Dialog
				open={isOpen}
				fullWidth
				fullScreen={fullScreenDialog}
				maxWidth={size === "fullScreen" ? "sm" : MAX_WIDTH[size]}
				onClose={requestClose}
			>
				<BaseDialogHeader
					title={title}
					disabled={isPending}
					onClose={requestClose}
				/>
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
						...(fullScreenDialog ? { flex: 1 } : { maxHeight: "90vh" }),
						overflowY: "auto",
					}}
				>
					<Stack sx={{ flex: 1, width: "100%" }}>{children}</Stack>
				</DialogContent>
				<BaseDialogActions
					disabled={disabled}
					onClose={requestClose}
					isPending={isPending}
					onSubmit={onSubmit}
					slotProps={{
						closeButton: slotProps?.closeButton,
						submitButton: slotProps?.submitButton,
						submitNowButton: slotProps?.submitNowButton,
					}}
				/>
			</Dialog>

			{/*
			 * The guard itself. A plain Dialog (not a second BaseDialog) so it
			 * never inherits this dialog's dirty state; it is only about one
			 * decision.
			 */}
			<Dialog
				open={confirmDiscard}
				onClose={() => setConfirmDiscard(false)}
				fullWidth
				maxWidth="xs"
			>
				<BaseDialogHeader
					title={discardTitle}
					onClose={() => setConfirmDiscard(false)}
				/>
				<DialogContent>
					<Stack sx={{ width: "100%" }}>{discardMessage}</Stack>
				</DialogContent>
				<BaseDialogActions
					onClose={() => setConfirmDiscard(false)}
					onSubmit={discard}
					slotProps={{
						closeButton: {
							props: {
								children: t.has("common.cancel")
									? t("common.cancel")
									: "Cancel",
							},
						},
						submitButton: {
							props: { children: discardAction, color: "error" as const },
						},
					}}
				/>
			</Dialog>
		</DialogDirtyProvider>
	);
};
