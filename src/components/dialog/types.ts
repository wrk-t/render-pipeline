import type { LoadingButtonProps } from "@mui/lab/LoadingButton";
import type { ButtonProps } from "@mui/material";
import type { DialogHTMLAttributes, PropsWithChildren } from "react";

/**
 * How much room a dialog asks for. `sm` is MUI's default broad enough for a
 * handful of fields; a line editor (repeatable item rows) needs `lg`.
 *
 * Declared by an action's `dialog.size` in the metadata, or suggested by the
 * form itself (line editors report `lg`) when the action gives no hint.
 */
export type DialogSize = "sm" | "md" | "lg" | "fullScreen";

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
	/** Width hint (default `sm`); phones are always full-screen. */
	size?: DialogSize;
	onSuccess?: VoidFunction;
}
