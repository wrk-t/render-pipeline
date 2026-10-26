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
	const submitButtonRef = useRef<HTMLButtonElement>(null);

	const submit = useCallback(
		(e: KeyboardEvent) => {
			if (disabled) return;

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
		<DialogActions className="p-4!">
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
								: t("common.close")}
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
