"use client";

import { Button, DialogActions, Tooltip } from "@mui/material";
import { useTranslations } from "next-intl";
import type { FC } from "react";
import { useCallback, useEffect, useRef } from "react";
import type { IBaseDialogActionsProps } from "./types";

export const BaseDialogActions: FC<IBaseDialogActionsProps> = ({
	isPending,
	onSubmit,
	onClose,
	slotProps,
	disabled = false,
}) => {
	const t = useTranslations();
	// The footer's secondary action is always a Cancel (UX-7), even when the
	// form's metadata only declares a generic `close` button. A host that ships
	// `common.cancel` gets its translation; otherwise the English fallback still
	// reads as one convention.
	const cancelLabel = t.has("common.cancel") ? t("common.cancel") : "Cancel";
	const submitButtonRef = useRef<HTMLButtonElement>(null);
	const actionsRef = useRef<HTMLDivElement>(null);

	const submit = useCallback(
		(e: KeyboardEvent) => {
			if (disabled) return;

			// Only the dialog this footer belongs to. A global listener used to
			// fire the outermost form's submit while a nested confirmation (the
			// discard guard, "Send now") had focus, POSTing behind the prompt.
			const paper = actionsRef.current?.closest('[role="dialog"]');
			if (!(paper && e.target instanceof Node && paper.contains(e.target)))
				return;

			const target = e.target as HTMLElement;
			const isTyping =
				target.tagName === "INPUT" ||
				target.tagName === "TEXTAREA" ||
				target.isContentEditable;

			if (isTyping) {
				if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
					e.preventDefault();
					submitButtonRef.current?.click();
				}
			} else if (e.key === "Enter") {
				e.preventDefault();
				submitButtonRef.current?.click();
			}
		},
		[disabled],
	);

	useEffect(() => {
		document.addEventListener("keydown", submit);

		return () => document.removeEventListener("keydown", submit);
	}, [submit]);

	return (
		<DialogActions
			ref={actionsRef}
			sx={{
				px: 3,
				py: 2,
				// One footer everywhere (UX-7): secondary Cancel to the LEFT of
				// the primary action, the pair right-aligned. Phones stack the
				// footer and give every action a full-width tap target; sm+
				// keeps the conventional right-aligned row. These are sx (not
				// Tailwind): the front's Tailwind build does not scan this
				// package, so package-only utilities are dead.
				justifyContent: "flex-end",
				flexWrap: "wrap",
				gap: 2,
				"& > span": { width: "100%" },
				"& .MuiButton-root": { width: "100%" },
				"@media (min-width:600px)": {
					"& > span": { width: "auto" },
					"& .MuiButton-root": { width: "auto" },
				},
			}}
		>
			{slotProps?.closeButton?.show === false ? null : (
				<Tooltip title={slotProps?.closeButton?.tooltip}>
					<span>
						<Button
							onClick={onClose}
							variant="text"
							color="inherit"
							disabled={disabled || isPending}
							{...slotProps?.closeButton?.props}
						>
							{slotProps?.closeButton?.props?.children
								? slotProps?.closeButton?.props?.children
								: cancelLabel}
						</Button>
					</span>
				</Tooltip>
			)}

			{slotProps?.submitNowButton?.show !== false &&
			slotProps?.submitNowButton ? (
				<Tooltip title={slotProps.submitNowButton.tooltip}>
					<span>
						<Button
							variant="outlined"
							color="primary"
							disabled={disabled || isPending}
							{...slotProps.submitNowButton.props}
						>
							{slotProps.submitNowButton.props?.children}
						</Button>
					</span>
				</Tooltip>
			) : null}

			{slotProps?.submitButton?.show === false ? null : (
				<Tooltip title={slotProps?.submitButton?.tooltip}>
					<span>
						<Button
							ref={submitButtonRef}
							type={onSubmit ? "button" : "submit"}
							variant="contained"
							disableElevation
							disabled={disabled}
							loading={isPending}
							onClick={onSubmit}
							{...slotProps?.submitButton?.props}
						>
							{slotProps?.submitButton?.props?.children
								? slotProps?.submitButton?.props?.children
								: t("common.submit")}
						</Button>
					</span>
				</Tooltip>
			)}
		</DialogActions>
	);
};
