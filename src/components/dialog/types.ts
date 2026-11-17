import type {
	CSSProperties,
	DialogHTMLAttributes,
	MouseEvent as ReactMouseEvent,
	PropsWithChildren,
	ReactNode,
} from "react";

/**
 * How much room a dialog asks for. `sm` is MUI's default broad enough for a
 * handful of fields; a line editor (repeatable item rows) needs `lg`.
 *
 * Declared by an action's `dialog.size` in the metadata, or suggested by the
 * form itself (line editors report `lg`) when the action gives no hint.
 */
export type DialogSize = "sm" | "md" | "lg" | "fullScreen";

/**
 * The MUI palette names the host app still passes in `slotProps`. The footer
 * translates them to Tailwind tokens (`error` → `bg-destructive`, …).
 */
export type DialogButtonColor =
	| "primary"
	| "secondary"
	| "error"
	| "warning"
	| "info"
	| "success"
	| "inherit";

export type DialogButtonVariant = "text" | "outlined" | "contained";

export type DialogButtonSize = "small" | "medium" | "large";

/**
 * The slot-button surface the host keeps using after the Tailwind migration.
 *
 * The footer renders semantic `<button>`s now, so it only forwards the native
 * attributes; the MUI-shaped props (`color`, `variant`, `startIcon`, `loading`,
 * …) are translated to classes. Declaring them locally (instead of importing
 * MUI's `ButtonProps`/`LoadingButtonProps`) keeps every existing caller
 * compiling while dropping the MUI type dependency from this package.
 */
export interface IDialogButtonProps {
	children?: ReactNode;
	/** MUI palette token → Tailwind variant/colour in `BaseDialogActions`. */
	color?: DialogButtonColor;
	/** `contained` (solid) / `outlined` / `text` (ghost). */
	variant?: DialogButtonVariant;
	size?: DialogButtonSize;
	disabled?: boolean;
	/** LoadingButton's spinner state (renders a spinner and disables). */
	loading?: boolean;
	fullWidth?: boolean;
	startIcon?: ReactNode;
	endIcon?: ReactNode;
	onClick?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
	type?: "button" | "submit" | "reset";
	tooltip?: string | null;
	className?: string;
	title?: string;
	autoFocus?: boolean;
	form?: string;
	id?: string;
	name?: string;
	style?: CSSProperties;
	tabIndex?: number;
	value?: string | number | readonly string[];
	"aria-label"?: string;
	"aria-describedby"?: string;
}

export interface IBaseDialogActionsProps {
	disabled?: boolean;
	onClose?: VoidFunction;
	onSubmit?: VoidFunction;
	isPending?: boolean;
	slotProps?: {
		closeButton?: {
			show?: boolean;
			tooltip?: string | null;
			props?: Omit<IDialogButtonProps, "onClick">;
		};
		submitButton?: {
			show?: boolean;
			tooltip?: string | null;
			props?: Omit<IDialogButtonProps, "onClick">;
		};
		/**
		 * A secondary action next to Submit — the message builder's
		 * "Send now" (save the draft, confirm, send).
		 */
		submitNowButton?: {
			show?: boolean;
			tooltip?: string | null;
			props?: Omit<IDialogButtonProps, "variant" | "onClick"> & {
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
