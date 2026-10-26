import type { LoadingButtonProps } from "@mui/lab/LoadingButton";
import type { ButtonProps } from "@mui/material";
import type { DialogHTMLAttributes, PropsWithChildren } from "react";

export interface IBaseDialogActionsProps {
	disabled?: boolean;
	onClose?: VoidFunction;
	onSubmit?: VoidFunction;
	isPending?: boolean;
	slotProps?: {
		closeButton?: {
			show?: boolean;
			tooltip?: string | null;
			props?: Omit<ButtonProps, "onClick">;
		};
		submitButton?: {
			show?: boolean;
			tooltip?: string | null;
			props?: Omit<LoadingButtonProps, "onClick">;
		};
		/**
		 * A secondary action next to Submit — the message builder's
		 * "Send now" (save the draft, confirm, send).
		 */
		submitNowButton?: {
			show?: boolean;
			tooltip?: string | null;
			props?: Omit<ButtonProps, "variant"> & {
				onClick?: () => void;
			};
		};
	};
}

export interface IBaseDialogProps extends PropsWithChildren {
	slotProps?: {
		dialog?: DialogHTMLAttributes<HTMLDialogElement>;
	} & IBaseDialogActionsProps["slotProps"];
	title?: string;
	isPending?: boolean;
	onSubmit?: (() => void) | (() => Promise<void>);
	onClose?: VoidFunction;
	isOpen?: boolean;
	disabled?: boolean;
	onSuccess?: VoidFunction;
}
