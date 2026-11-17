// ═══════════════════════════════════════════════════════════════
// ColorPickerInput + FormColorField – color picker (popover swatch +
// hex text input).
//
// `ColorPickerInput` is the CONTROLLED UI: the swatch button shows the
// current color; clicking it opens a small popover with the
// @uiw/react-color-colorful picker. The alpha channel is disabled so
// the stored value stays a `#rrggbb` hex string (the field's contract
// — validated by HEX_RE).
//
// `FormColorField` binds it to Formik via `useField` (the dynamic-form
// renderer). Standalone screens that keep their own state — e.g. the
// QR style dialog — use `ColorPickerInput` directly.
// ═══════════════════════════════════════════════════════════════
"use client";

import Colorful from "@uiw/react-color-colorful";
import { useField } from "formik";
import {
	type ReactElement,
	useCallback,
	useEffect,
	useId,
	useRef,
	useState,
} from "react";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

// Size of the Colorful picker (200 × 186) plus the popover's padding and
// border. Used to flip the popover above the swatch near the viewport edge.
const POPOVER_WIDTH = 220;
const POPOVER_HEIGHT = 206;
const POPOVER_GAP = 8;

/** Anchor a `position: fixed` popover to the swatch, kept inside the viewport. */
function popoverPosition(rect: DOMRect): { top: number; left: number } {
	const viewportWidth = window.innerWidth;
	const viewportHeight = window.innerHeight;
	const left = Math.max(
		POPOVER_GAP,
		Math.min(rect.left, viewportWidth - POPOVER_WIDTH - POPOVER_GAP),
	);
	const below = rect.bottom + POPOVER_GAP;
	const top =
		below + POPOVER_HEIGHT <= viewportHeight
			? below
			: Math.max(POPOVER_GAP, rect.top - POPOVER_HEIGHT - POPOVER_GAP);
	return { top, left };
}

/** Controlled color input: swatch button → popover Colorful picker + hex field. */
export function ColorPickerInput({
	label,
	value,
	onChange,
	isRequired,
	isReadOnly,
	error,
	helperText,
}: {
	label?: string;
	value: string;
	onChange: (value: string) => void;
	isRequired?: boolean;
	isReadOnly?: boolean;
	error?: boolean;
	helperText?: string;
}): ReactElement {
	const [open, setOpen] = useState(false);
	const [position, setPosition] = useState<{
		top: number;
		left: number;
	} | null>(null);
	const rootRef = useRef<HTMLDivElement | null>(null);
	const triggerRef = useRef<HTMLButtonElement | null>(null);
	const inputId = useId();
	const popoverId = useId();

	const rawValue = typeof value === "string" ? value : "";
	// The picker + swatch only accept valid hex — fall back for display.
	const swatchValue = HEX_RE.test(rawValue) ? rawValue : "#000000";

	const closePopover = useCallback((refocusTrigger: boolean) => {
		setOpen(false);
		if (refocusTrigger) triggerRef.current?.focus();
	}, []);

	const togglePopover = useCallback(() => {
		if (open) {
			setOpen(false);
			return;
		}
		const rect = triggerRef.current?.getBoundingClientRect();
		if (!rect) return;
		setPosition(popoverPosition(rect));
		setOpen(true);
	}, [open]);

	// Popover behaviour: close on outside pointer-down and on Escape
	// (Escape returns focus to the swatch, like the old MUI Popover), and
	// keep the fixed-position panel glued to the swatch while scrolling.
	useEffect(() => {
		if (!open) return;

		const handlePointerDown = (event: PointerEvent) => {
			if (!rootRef.current?.contains(event.target as Node)) {
				setOpen(false);
			}
		};
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.stopPropagation();
				closePopover(true);
			}
		};
		const reposition = () => {
			const rect = triggerRef.current?.getBoundingClientRect();
			if (rect) setPosition(popoverPosition(rect));
		};

		document.addEventListener("pointerdown", handlePointerDown);
		document.addEventListener("keydown", handleKeyDown);
		window.addEventListener("scroll", reposition, true);
		window.addEventListener("resize", reposition);
		return () => {
			document.removeEventListener("pointerdown", handlePointerDown);
			document.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("scroll", reposition, true);
			window.removeEventListener("resize", reposition);
		};
	}, [open, closePopover]);

	return (
		<div ref={rootRef} className="flex flex-col gap-1.5">
			{label && (
				<label
					htmlFor={inputId}
					className="text-sm font-medium text-foreground"
				>
					{label}
				</label>
			)}
			<div
				className={`flex items-center gap-2 rounded-lg border bg-background px-2 py-1.5 transition-colors focus-within:ring-2 focus-within:ring-ring/30 ${
					error
						? "border-destructive focus-within:border-destructive"
						: "border-border focus-within:border-primary"
				} ${isReadOnly ? "bg-muted" : ""}`}
			>
				<button
					ref={triggerRef}
					type="button"
					disabled={isReadOnly}
					aria-label={label ?? "color"}
					title={label ?? "color"}
					aria-haspopup="dialog"
					aria-expanded={open}
					aria-controls={open ? popoverId : undefined}
					onClick={togglePopover}
					className="size-6 shrink-0 rounded-md border border-border shadow-sm transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
					style={{ backgroundColor: swatchValue }}
				/>
				<input
					id={inputId}
					type="text"
					value={rawValue}
					disabled={isReadOnly}
					onChange={(event) => onChange(event.target.value)}
					placeholder="#4F46E5"
					aria-required={isRequired || undefined}
					className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
				/>
			</div>
			{helperText && (
				<p
					className={`text-xs ${
						error ? "text-destructive" : "text-muted-foreground"
					}`}
				>
					{helperText}
				</p>
			)}
			{open && position && (
				<div
					id={popoverId}
					role="dialog"
					aria-label={label ?? "color"}
					className="fixed z-50 w-max rounded-lg border border-border bg-card p-2 shadow-sm"
					style={{ top: position.top, left: position.left }}
				>
					<Colorful
						color={swatchValue}
						disableAlpha
						onChange={(color) => onChange(color.hex)}
					/>
				</div>
			)}
		</div>
	);
}

/** Formik-bound color field — used by the dynamic-form renderer. */
export function FormColorField({
	field,
}: {
	field: {
		name: string;
		label?: string;
		isRequired?: boolean;
		isReadOnly?: boolean;
	};
}): ReactElement {
	const [formikField, meta, helpers] = useField(field.name);
	const rawValue =
		typeof formikField.value === "string" ? formikField.value : "";

	return (
		<ColorPickerInput
			label={field.label}
			isRequired={field.isRequired}
			isReadOnly={field.isReadOnly}
			value={rawValue}
			onChange={(v) => helpers.setValue(v)}
			error={meta.touched && !!meta.error}
			helperText={meta.touched ? meta.error : undefined}
		/>
	);
}
