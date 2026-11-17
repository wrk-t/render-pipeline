"use client";

import { useTranslations } from "next-intl";
import type { CSSProperties, FC, ReactNode } from "react";
import { useCallback, useEffect, useRef } from "react";
import type { IBaseDialogActionsProps } from "./types";

// ════════════════════════════════════════════════════════════════
// Footer actions — native buttons + Tailwind.
//
// The public `slotProps` shape still speaks MUI (the package's callers
// pass `color: "error"`, `startIcon`, `variant`, …), so we keep accepting
// those props but only forward the attributes a native <button> knows.
// MUI-only styling props are translated to Tailwind classes:
//
//   color: "error"            → bg-destructive (Submit)
//   variant: "text"           → ghost        (Cancel)
//   variant: "outlined"       → outline      (Send now)
//   variant: "contained"      → solid        (Submit)
//   startIcon / endIcon       → rendered beside the label
//   loading                   → spinner + disabled
// ════════════════════════════════════════════════════════════════

/** Native button attributes we forward from the MUI-shaped slot props. */
interface INativeButtonAttrs {
	"aria-describedby"?: string;
	"aria-label"?: string;
	autoFocus?: boolean;
	disabled?: boolean;
	form?: string;
	id?: string;
	name?: string;
	style?: CSSProperties;
	tabIndex?: number;
	type?: "button" | "submit" | "reset";
	value?: string | number | readonly string[];
}

// MUI types `type` as a plain string, so the source cannot extend the native
// attribute type; `nativeButtonAttrs` narrows it below.
interface ISlotButtonSource extends Omit<INativeButtonAttrs, "type"> {
	children?: ReactNode;
	className?: string;
	title?: string;
	type?: string;
}

/**
 * Copy only the native attributes that were actually provided. Spreading the
 * raw MUI props onto a `<button>` would put invalid DOM attributes
 * (`color`, `startIcon`, `loading`, `sx`, …) in the markup.
 */
const nativeButtonAttrs = (
	props: ISlotButtonSource | undefined,
): INativeButtonAttrs => {
	const attrs: INativeButtonAttrs = {};
	if (!props) return attrs;
	if (props["aria-describedby"] !== undefined)
		attrs["aria-describedby"] = props["aria-describedby"];
	if (props["aria-label"] !== undefined)
		attrs["aria-label"] = props["aria-label"];
	if (props.autoFocus !== undefined) attrs.autoFocus = props.autoFocus;
	if (props.disabled !== undefined) attrs.disabled = props.disabled;
	if (props.form !== undefined) attrs.form = props.form;
	if (props.id !== undefined) attrs.id = props.id;
	if (props.name !== undefined) attrs.name = props.name;
	if (props.style !== undefined) attrs.style = props.style;
	if (props.tabIndex !== undefined) attrs.tabIndex = props.tabIndex;
	if (props.type !== undefined) {
		attrs.type =
			props.type === "submit" || props.type === "reset" ? props.type : "button";
	}
	if (props.value !== undefined) attrs.value = props.value;
	return attrs;
};

// shadcn/ui button metrics: `h-9 rounded-md px-4 text-sm font-medium`, with
// the footer's three roles mapped to shadcn's default / outline / ghost
// treatments. Stock shadcn has no tertiary footer button, so the outlined
// secondary action keeps the same focus ring and disabled behaviour.
const BUTTON_BASE =
	"inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 max-sm:w-full";
const BUTTON_GHOST =
	"border-transparent text-foreground hover:bg-accent hover:text-accent-foreground";
const BUTTON_OUTLINE =
	"border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground";
const BUTTON_PRIMARY =
	"border-transparent bg-primary text-primary-foreground hover:bg-primary/90";
const BUTTON_DESTRUCTIVE =
	"border-transparent bg-destructive text-white hover:bg-destructive/90";

const buttonClassName = (variantClasses: string, className?: string) =>
	className
		? `${BUTTON_BASE} ${variantClasses} ${className}`
		: `${BUTTON_BASE} ${variantClasses}`;

const Spinner: FC = () => (
	<span
		role="status"
		aria-label="Loading"
		className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
	/>
);

const IconSlot: FC<{ children?: ReactNode }> = ({ children }) =>
	children ? (
		<span className="inline-flex shrink-0 items-center [&>svg]:size-[18px]">
			{children}
		</span>
	) : null;

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
			// Native <dialog> elements are not portaled, so a nested dialog is a
			// DOM descendant of the outer one: compare the *nearest* enclosing
			// dialog rather than mere containment.
			if (!(e.target instanceof Element)) return;
			const paper = actionsRef.current?.closest('dialog, [role="dialog"]');
			const targetPaper = e.target.closest('dialog, [role="dialog"]');
			if (!paper || paper !== targetPaper) return;

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

	const closeProps = slotProps?.closeButton?.props;
	const submitNowProps = slotProps?.submitNowButton?.props;
	const submitProps = slotProps?.submitButton?.props;
	const isLoading = submitProps?.loading ?? isPending;
	// MUI Button takes the caller's `disabled` over the dialog's base flag, and
	// LoadingButton stays disabled while `loading` — keep both rules.
	const submitDisabled = (submitProps?.disabled ?? disabled) || isLoading;

	return (
		<div
			ref={actionsRef}
			// One footer everywhere (UX-7): secondary Cancel next to the
			// primary action, the pair right-aligned (`justify-end` is already
			// direction-aware in RTL). Phones stack the footer — the primary
			// action first — and give every action a full-width tap target.
			className="flex shrink-0 flex-col-reverse gap-2 px-6 pb-6 pt-2 sm:flex-row sm:justify-end"
		>
			{slotProps?.closeButton?.show === false ? null : (
				<button
					type="button"
					onClick={onClose}
					disabled={disabled || isPending}
					{...nativeButtonAttrs(closeProps)}
					title={
						closeProps?.title ?? slotProps?.closeButton?.tooltip ?? undefined
					}
					className={buttonClassName(BUTTON_GHOST, closeProps?.className)}
				>
					{closeProps?.children ? closeProps.children : cancelLabel}
				</button>
			)}

			{slotProps?.submitNowButton?.show !== false &&
			slotProps?.submitNowButton ? (
				<button
					type="button"
					disabled={disabled || isPending}
					{...nativeButtonAttrs(submitNowProps)}
					onClick={submitNowProps?.onClick}
					title={
						submitNowProps?.title ??
						slotProps.submitNowButton.tooltip ??
						undefined
					}
					className={buttonClassName(BUTTON_OUTLINE, submitNowProps?.className)}
				>
					<IconSlot>{submitNowProps?.startIcon}</IconSlot>
					{submitNowProps?.children}
					<IconSlot>{submitNowProps?.endIcon}</IconSlot>
				</button>
			) : null}

			{slotProps?.submitButton?.show === false ? null : (
				<button
					ref={submitButtonRef}
					type={onSubmit ? "button" : "submit"}
					{...nativeButtonAttrs(submitProps)}
					disabled={submitDisabled}
					onClick={onSubmit}
					title={
						submitProps?.title ?? slotProps?.submitButton?.tooltip ?? undefined
					}
					className={buttonClassName(
						submitProps?.color === "error"
							? BUTTON_DESTRUCTIVE
							: BUTTON_PRIMARY,
						submitProps?.className,
					)}
				>
					{isLoading ? <Spinner /> : null}
					<IconSlot>{submitProps?.startIcon}</IconSlot>
					{submitProps?.children ? submitProps.children : t("common.submit")}
					<IconSlot>{submitProps?.endIcon}</IconSlot>
				</button>
			)}
		</div>
	);
};
