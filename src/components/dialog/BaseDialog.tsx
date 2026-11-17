"use client";

import { useTranslations } from "next-intl";
import type { DialogHTMLAttributes, FC, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { BaseDialogActions } from "./BaseDialogActions";
import { BaseDialogHeader } from "./BaseDialogHeader";
import { DialogDirtyProvider } from "./dialogDirtyContext";
import type { DialogSize, IBaseDialogProps } from "./types";

/** Tailwind max-width per size. `fullScreen` owns the viewport instead. */
const MAX_WIDTH: Record<Exclude<DialogSize, "fullScreen">, string> = {
	sm: "max-w-[600px]",
	md: "max-w-[900px]",
	lg: "max-w-[1200px]",
};

/** MUI's `sm` breakpoint: every DSL dialog is full-screen on a phone. */
const PHONE_QUERY = "(max-width: 639.98px)";

/**
 * Native replacement for MUI's `useMediaQuery(theme.breakpoints.down("sm"))`.
 * Starts `false` on the server and on the first client paint (same as MUI's
 * default `noSsr: false`), then tracks the media query.
 */
const usePhoneLayout = (): boolean => {
	const [isPhone, setIsPhone] = useState(false);

	useEffect(() => {
		if (typeof window === "undefined" || !window.matchMedia) return;
		const query = window.matchMedia(PHONE_QUERY);
		const update = () => setIsPhone(query.matches);
		update();
		if (typeof query.addEventListener !== "function") return;
		query.addEventListener("change", update);
		return () => query.removeEventListener("change", update);
	}, []);

	return isPhone;
};

// The dialog is the fixed, full-viewport overlay (its `::backdrop` is the
// scrim); the panel inside it is the card. `bg-transparent` / `border-0` /
// `p-0` strip the UA dialog chrome so only the panel paints.
const DIALOG_BASE =
	"fixed inset-0 z-50 m-0 h-full max-h-none w-full max-w-none border-0 bg-transparent p-0 text-foreground [&::backdrop]:bg-black/50";
const DIALOG_CENTERED = `${DIALOG_BASE} open:flex items-center justify-center p-4`;

interface INativeDialogProps {
	open: boolean;
	/** A close *request*: the dirty guard decides whether it really closes. */
	onCloseRequest: () => void;
	className: string;
	ariaLabel?: string;
	dialogProps?: DialogHTMLAttributes<HTMLDialogElement>;
	children: ReactNode;
}

const openModal = (dialog: HTMLDialogElement) => {
	// Already shown (StrictMode's double effect, or a re-render after open).
	if (dialog.open) return;
	if (typeof dialog.showModal !== "function") {
		// jsdom / older engines do not implement the top layer.
		dialog.setAttribute("open", "");
		return;
	}
	try {
		dialog.showModal();
	} catch {
		dialog.setAttribute("open", "");
	}
};

const closeModal = (dialog: HTMLDialogElement) => {
	if (!dialog.open) return;
	if (typeof dialog.close === "function") dialog.close();
	else dialog.removeAttribute("open");
};

/**
 * Thin wrapper around the native `<dialog>`: React state drives
 * `showModal()`/`close()`, Escape and a backdrop click are reported back as
 * close requests instead of closing natively.
 */
const NativeDialog: FC<INativeDialogProps> = ({
	open,
	onCloseRequest,
	className,
	ariaLabel,
	dialogProps,
	children,
}) => {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const closeRequestRef = useRef(onCloseRequest);
	closeRequestRef.current = onCloseRequest;

	// `open` is the source of truth. The element itself stays mounted so a
	// false transition can run `close()` and restore focus.
	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) return;
		if (open) openModal(dialog);
		else closeModal(dialog);
	}, [open]);

	// Escape must never close the element behind React's back: prevent the
	// native cancel and turn it into a close request (the dirty guard then
	// decides). A backdrop click is the same request: because the dialog fills
	// the viewport, a click whose target *is* the dialog came from the
	// `::backdrop` area (clicks inside the panel target a child). Both are
	// native listeners so the host's own `slotProps.dialog.onClick` is kept.
	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) return;
		const onCancel = (event: Event) => {
			event.preventDefault();
			closeRequestRef.current();
		};
		const onClick = (event: MouseEvent) => {
			if (event.target === dialog) closeRequestRef.current();
		};
		dialog.addEventListener("cancel", onCancel);
		dialog.addEventListener("click", onClick);
		return () => {
			dialog.removeEventListener("cancel", onCancel);
			dialog.removeEventListener("click", onClick);
		};
	}, []);

	const mergedClassName = dialogProps?.className
		? `${className} ${dialogProps.className}`
		: className;

	return (
		<dialog
			{...dialogProps}
			ref={dialogRef}
			className={mergedClassName}
			aria-label={ariaLabel ?? dialogProps?.["aria-label"]}
		>
			{/*
			 * MUI's Dialog unmounted its content while closed (`keepMounted`
			 * defaults to false), and callers rely on that: a closed dialog must
			 * not keep a form (or a second dirty reporter) alive. The <dialog>
			 * element itself stays mounted so `close()` can run and restore focus.
			 */}
			{open ? children : null}
		</dialog>
	);
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
	// Every DSL dialog is full-screen on a phone (below Tailwind's `sm`) and a
	// centred modal from `sm` up. A phone has no room for a 600px panel with a
	// footer: the form scrolls behind a sticky header and a reachable footer.
	const phoneLayout = usePhoneLayout();
	const t = useTranslations();

	// ── Unsaved-changes guard (UX-7) ────────────────────────────
	// Escape, a backdrop click and the header X are the same close request
	// here (MUI reported the first two through `Dialog.onClose`). When the
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

	const fullScreenDialog = phoneLayout || size === "fullScreen";

	const panelClassName = fullScreenDialog
		? "flex h-[100dvh] max-h-none w-full max-w-none flex-col overflow-hidden rounded-none border-0 bg-card text-foreground"
		: `flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-lg border border-border bg-card text-foreground shadow-lg ${MAX_WIDTH[size]}`;

	return (
		<DialogDirtyProvider onDirtyChange={setDirty}>
			<NativeDialog
				open={isOpen}
				onCloseRequest={requestClose}
				className={fullScreenDialog ? DIALOG_BASE : DIALOG_CENTERED}
				ariaLabel={title}
				dialogProps={slotProps?.dialog}
			>
				<div className={panelClassName}>
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
					<div className="min-h-24 flex-1 overflow-y-auto px-6 py-5">
						<div className="flex w-full flex-1 flex-col">{children}</div>
					</div>
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
				</div>
			</NativeDialog>

			{/*
			 * The guard itself. A plain dialog (not a second BaseDialog) so it
			 * never inherits this dialog's dirty state; it is only about one
			 * decision.
			 */}
			<NativeDialog
				open={confirmDiscard}
				onCloseRequest={() => setConfirmDiscard(false)}
				className={DIALOG_CENTERED}
				ariaLabel={discardTitle}
			>
				<div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-[444px] flex-col overflow-hidden rounded-lg border border-border bg-card text-foreground shadow-lg">
					<BaseDialogHeader
						title={discardTitle}
						onClose={() => setConfirmDiscard(false)}
					/>
					<div className="min-h-24 flex-1 overflow-y-auto px-6 py-5">
						<p className="text-sm text-muted-foreground">{discardMessage}</p>
					</div>
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
				</div>
			</NativeDialog>
		</DialogDirtyProvider>
	);
};
