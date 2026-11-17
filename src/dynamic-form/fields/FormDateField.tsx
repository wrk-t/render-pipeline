// ═══════════════════════════════════════════════════════════════
// FormDateField – Renders a calendar date picker field.
//
// The panel is react-multi-date-picker's Gregorian calendar (its
// default calendar/locale), styled with Tailwind; the trigger is a
// read-only native input so the field keeps a labelled, focusable
// control and the same Formik bindings as every other field.
// ═══════════════════════════════════════════════════════════════
"use client";

import { useField, useFormikContext } from "formik";
import { type ReactElement, useEffect, useId, useRef, useState } from "react";
import { Calendar, type DateObject } from "react-multi-date-picker";
import { Unicon } from "../../components/common/icon/Unicon";
import type { DateField } from "../types";

// A `date` field is a calendar date, not an instant: the API stores
// `YYYY-MM-DD` (`isDateOnly` in the backend) and combines it with a separate
// `time` field + timezone where it needs an instant (CRM-16 — a one-off
// campaign's `sendDate`). Serializing `toISOString()` here sent a UTC instant
// whose date can differ from the day the user picked, and the one-off save
// failed with `errors.message_schedule_send_date`.
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})/;

const pad2 = (value: number) => String(value).padStart(2, "0");

/** The calendar date the user sees, in their own timezone. */
const toDateOnly = (date: Date): string =>
	`${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

/**
 * Parse a stored value back to the date the picker shows. A `YYYY-MM-DD` string
 * is read as local midnight (not UTC) so it renders as the same calendar day in
 * every timezone; anything else (`null`, a legacy ISO instant) falls back to the
 * runtime parse.
 */
const fromStoredDate = (value: unknown): Date | null => {
	if (typeof value !== "string" || !value) return null;
	const match = DATE_ONLY.exec(value);
	if (match) {
		return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
	}
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * `behavior.min`/`behavior.max` are day bounds. Parse them exactly like the
 * previous picker did (`new Date(string)`), so bound handling is unchanged.
 */
const toBoundDate = (value?: string): Date | undefined => {
	if (!value) return undefined;
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

export function FormDateField({ field }: { field: DateField }): ReactElement {
	const [formikField, meta, helpers] = useField(field.name);
	const { setFieldValue } = useFormikContext<Record<string, unknown>>();
	const [open, setOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const inputId = useId();
	const panelId = `${inputId}-panel`;
	const errorId = `${inputId}-error`;
	const descriptionId = `${inputId}-description`;

	const isError = Boolean(meta.touched && meta.error);
	const description = field.fieldOverrides?.description;
	const describedBy =
		[isError ? errorId : undefined, description ? descriptionId : undefined]
			.filter(Boolean)
			.join(" ") || undefined;

	const value = fromStoredDate(meta.value);
	const displayValue = value ? toDateOnly(value) : "";

	const handleChange = (date: Date | null) => {
		const next = date ? toDateOnly(date) : null;
		setFieldValue(field.name, next);
		helpers.setValue(next);
	};

	const handleSelect = (dates: DateObject | DateObject[] | null) => {
		if (!dates) return;
		const picked = Array.isArray(dates) ? dates[0] : dates;
		if (!picked) return;
		// `toDate()` is the local calendar day the user clicked; storing it with
		// `toDateOnly` keeps the `YYYY-MM-DD` contract (no UTC conversion).
		handleChange(picked.toDate());
		setOpen(false);
	};

	// Close on outside pointer-down and Escape, like the previous popper.
	useEffect(() => {
		if (!open) return;
		const handlePointerDown = (event: PointerEvent) => {
			if (!containerRef.current?.contains(event.target as Node)) {
				setOpen(false);
			}
		};
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") setOpen(false);
		};
		document.addEventListener("pointerdown", handlePointerDown);
		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("pointerdown", handlePointerDown);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [open]);

	return (
		<div className="flex flex-col gap-0.5">
			<label htmlFor={inputId} className="text-sm font-medium text-foreground">
				{field.label}
				{field.isRequired ? (
					<span aria-hidden="true" className="ms-0.5 text-destructive">
						*
					</span>
				) : null}
			</label>
			<div ref={containerRef} className="relative">
				<input
					{...formikField}
					value={displayValue}
					id={inputId}
					type="text"
					readOnly
					placeholder={field.uiOverrides.behavior?.placeholder}
					required={field.isRequired}
					disabled={field.isReadOnly}
					aria-invalid={isError || undefined}
					aria-describedby={describedBy}
					aria-haspopup="dialog"
					onClick={() => {
						if (!field.isReadOnly) setOpen((previous) => !previous);
					}}
					onKeyDown={(event) => {
						if (field.isReadOnly) return;
						if (
							event.key === "Enter" ||
							event.key === " " ||
							event.key === "ArrowDown"
						) {
							event.preventDefault();
							setOpen(true);
						}
					}}
					className={`w-full cursor-pointer rounded-lg border bg-background px-3 py-2 pe-10 text-start text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${
						isError
							? "border-destructive focus:border-destructive focus:ring-destructive/20"
							: "border-border focus:border-ring focus:ring-ring/20"
					}`}
				/>
				<Unicon
					name="DateRange"
					size={18}
					className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground"
				/>
				{open ? (
					<div
						id={panelId}
						role="dialog"
						aria-label={field.label}
						className="absolute start-0 top-full z-50 mt-1 rounded-lg border border-border bg-card p-2 text-card-foreground shadow-lg"
					>
						<Calendar
							value={value}
							onChange={handleSelect}
							minDate={toBoundDate(field.uiOverrides.behavior?.min)}
							maxDate={toBoundDate(field.uiOverrides.behavior?.max)}
							highlightToday
							shadow={false}
						/>
					</div>
				) : null}
			</div>
			{isError ? (
				<p id={errorId} className="text-xs text-destructive">
					{meta.error}
				</p>
			) : null}
			{description ? (
				<p id={descriptionId} className="ps-3 text-xs text-muted-foreground">
					{description}
				</p>
			) : null}
		</div>
	);
}
