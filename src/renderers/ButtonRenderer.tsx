"use client";

import { FormikContext, type FormikContextType } from "formik";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type ReactElement, useContext, useState } from "react";
import { useSWRConfig } from "swr";
import { ConfirmPrompt } from "../components/common/CopyableTitle";
import { Unicon } from "../components/common/icon/Unicon";
import { BaseDialog } from "../components/dialog/BaseDialog";
import { getApiClient } from "../deps";
import { useSnack } from "../hooks/useSnack";
import type { RendererProps } from "../types";
import { matchesCondition, type TActionCondition } from "./condition";
import { useRecordData } from "./RecordContext";

// ──────────────────────────────────────────────────────────────────
// ButtonRenderer — standalone Button component, rendered from the
// metadata tree (a Form's actions slot, a Layout's header toolbar, …).
//
// Dispatches on `config.action`:
//   submit  → native form submit inside Formik (spinner while submitting)
//   close   → onClose (dialog close)
//   navigate→ router.push(path) with {param} substitution
//   apiCall → fires the endpoint (with confirm / typed-title confirm),
//             reports the API's translated message, and revalidates
//             every SWR key so a status badge or `nextRunAt` updates.
//   button  → no-op button
//
// The apiCall path is what a detail page's lifecycle actions use (CRM-15:
// schedule / send now / pause / resume a campaign): `{}` is a valid body,
// `{param}` placeholders resolve from the screen's path params, and an
// error is shown as the API's translated message instead of a no-op.
// ──────────────────────────────────────────────────────────────────

/**
 * Read Formik's context without `useFormikContext()`.
 *
 * A toolbar button is often rendered outside a `<Formik>` (detail-page
 * lifecycle actions, dialog footers), and Formik's hook merely *warns* in that
 * case — it does not throw, so a `try/catch` never silenced the message.
 * Direct `useContext` gives `undefined` quietly; every caller below already
 * handles that as "not inside a form".
 */
function useOptionalFormikContext():
	| FormikContextType<Record<string, unknown>>
	| undefined {
	return useContext(FormikContext) as
		| FormikContextType<Record<string, unknown>>
		| undefined;
}

/**
 * Evaluate a metadata action `condition` against the detail page's record.
 *
 * The layout header used to render every lifecycle button it declared: a
 * campaign detail page showed Pause *and* Resume at the same time, because the
 * buttons had no row to test. With the record provided, the condition is the
 * same one the table's row menu uses.
 */
type TConfirmConfig = {
	title?: string;
	message?: string;
	/**
	 * A row-placeholder template (e.g. `"{title}"`). When it resolves, the
	 * dialog asks the admin to retype that value and the request posts
	 * `{ confirmTitle }` — the API re-validates it (CRM-13/15).
	 */
	confirmByTitle?: string;
	/**
	 * Fetch the dialog's message before opening it (CRM-24): the first
	 * confirmation states a live fact ("this goes to 12 customers"), not a static
	 * warning. `template` uses `{path}` tokens resolved against the response.
	 */
	messageFrom?: {
		endpoint: string;
		template: string;
	};
};

// ── Button skin ───────────────────────────────────────────────────
// MUI's Button defaults, expressed as utilities: 0.875rem/500/1.75,
// uppercase, 10px radius (the app's `shape.borderRadius * 2.5`), the
// contained/outlined/text variants and the palette's per-colour hover.
// The `disabled:` utilities mirror MUI's disabled palette.

type TButtonColor =
	| "primary"
	| "secondary"
	| "error"
	| "warning"
	| "info"
	| "success"
	| "inherit";

const CONTAINED: Record<TButtonColor, string> = {
	primary:
		"bg-primary text-primary-foreground hover:bg-primary-dark disabled:bg-muted disabled:text-border-default",
	secondary:
		"bg-secondary-main text-text-primary hover:bg-secondary-dark disabled:bg-muted disabled:text-border-default",
	error:
		"bg-destructive text-white hover:bg-error-dark disabled:bg-muted disabled:text-border-default",
	warning:
		"bg-warning-main text-white hover:bg-warning-dark disabled:bg-muted disabled:text-border-default",
	info: "bg-info-main text-white hover:bg-info-dark disabled:bg-muted disabled:text-border-default",
	success:
		"bg-success-main text-white hover:bg-success-dark disabled:bg-muted disabled:text-border-default",
	inherit:
		"bg-transparent text-inherit hover:bg-accent disabled:bg-muted disabled:text-border-default",
};

const OUTLINED: Record<TButtonColor, string> = {
	primary:
		"border border-primary/50 text-primary hover:border-primary hover:bg-primary/5 disabled:border-border-default disabled:bg-transparent disabled:text-border-default",
	secondary:
		"border border-border text-secondary-foreground hover:border-border-default hover:bg-accent disabled:border-border-default disabled:bg-transparent disabled:text-border-default",
	error:
		"border border-destructive/50 text-destructive hover:border-destructive hover:bg-destructive/5 disabled:border-border-default disabled:bg-transparent disabled:text-border-default",
	warning:
		"border border-warning-main/50 text-warning-main hover:border-warning-main hover:bg-warning-main/5 disabled:border-border-default disabled:bg-transparent disabled:text-border-default",
	info: "border border-info-main/50 text-info-main hover:border-info-main hover:bg-info-main/5 disabled:border-border-default disabled:bg-transparent disabled:text-border-default",
	success:
		"border border-success-main/50 text-success-main hover:border-success-main hover:bg-success-main/5 disabled:border-border-default disabled:bg-transparent disabled:text-border-default",
	inherit:
		"border border-border text-foreground hover:bg-accent disabled:border-border-default disabled:bg-transparent disabled:text-border-default",
};

const TEXT: Record<TButtonColor, string> = {
	primary:
		"text-primary hover:bg-primary/5 disabled:bg-transparent disabled:text-border-default",
	secondary:
		"text-secondary-foreground hover:bg-accent disabled:bg-transparent disabled:text-border-default",
	error:
		"text-destructive hover:bg-destructive/5 disabled:bg-transparent disabled:text-border-default",
	warning:
		"text-warning-main hover:bg-warning-main/5 disabled:bg-transparent disabled:text-border-default",
	info: "text-info-main hover:bg-info-main/5 disabled:bg-transparent disabled:text-border-default",
	success:
		"text-success-main hover:bg-success-main/5 disabled:bg-transparent disabled:text-border-default",
	inherit:
		"text-foreground hover:bg-accent disabled:bg-transparent disabled:text-border-default",
};

const BUTTON_BASE =
	"inline-flex min-w-16 items-center justify-center whitespace-nowrap rounded-[10px] text-sm font-medium uppercase leading-[1.75] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed";

function isButtonColor(value: string | undefined): value is TButtonColor {
	return (
		value === "primary" ||
		value === "secondary" ||
		value === "error" ||
		value === "warning" ||
		value === "info" ||
		value === "success" ||
		value === "inherit"
	);
}


export function ButtonRenderer({
	component,
	onClose,
	pathParams,
}: RendererProps): ReactElement {
	const router = useRouter();
	const t = useTranslations("");
	const snack = useSnack();
	const { mutate } = useSWRConfig();
	const config = (component.config ?? {}) as {
		label?: string;
		action?: string;
		variant?: "contained" | "outlined" | "text";
		color?: string;
		icon?: string;
		path?: string;
		endpoint?: string;
		method?: string;
		body?: Record<string, unknown>;
		successMessage?: string;
		onSuccess?: "refreshTable" | "refreshAll" | "closeDialog" | "navigate";
		successRedirect?: string;
		confirm?: TConfirmConfig;
		condition?: TActionCondition | TActionCondition[];
		/** Stretch to the container's width (a form's single submit). */
		fullWidth?: boolean;
	};

	const action = config.action ?? "button";
	const isSubmit = action === "submit";
	const formik = useOptionalFormikContext();
	const submitting = isSubmit && formik?.isSubmitting === true;
	// The authoring compiler stores Button icons on the component row's `icon`
	// column (identity key, stripped from config) — fall back to it.
	const icon = config.icon ?? component.icon ?? undefined;

	// ── Detail-page record (condition + title resolution) ─────────
	const record = useRecordData();

	// ── Confirmation + fire state (apiCall only) ──────────────────
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [confirmTyped, setConfirmTyped] = useState("");
	const [pending, setPending] = useState(false);
	/**
	 * The dialog's message when it has to state a **live** fact (CRM-24's first
	 * confirmation: "this goes to 12 customers"). `null` until fetched; the static
	 * `confirm.message` is the fallback.
	 */
	const [confirmMessage, setConfirmMessage] = useState<string | null>(null);

	/** `{id}` / `{title}` … resolved from the screen's path params, then the record. */
	const resolve = (template: string): string =>
		template.replace(/\{(\w+)\}/g, (_: string, key: string) => {
			if (pathParams && key in pathParams) return String(pathParams[key]);
			const fromRecord = record?.[key];
			if (fromRecord !== undefined && fromRecord !== null)
				return String(fromRecord);
			return `{${key}}`;
		});

	/** `{eligibleCount}` / `{excluded.optedOut}` against the fetched payload. */
	const interpolate = (template: string, data: unknown): string => {
		const read = (path: string): unknown => {
			let current: unknown = data;
			for (const key of path.split(".")) {
				if (current === null || current === undefined) return undefined;
				current = (current as Record<string, unknown>)[key];
			}
			return current;
		};

		return template.replace(/\{([\w.]+)\}/g, (whole, path: string) => {
			const value = read(path);
			return value === undefined || value === null ? whole : String(value);
		});
	};

	/**
	 * Fetch the live message for the confirmation dialog. A failure is not an
	 * error the admin should see: the static `message` still explains the action.
	 */
	const loadConfirmMessage = async (): Promise<string | null> => {
		const source = config.confirm?.messageFrom;
		if (!source) return null;

		try {
			const res = await getApiClient().request({
				url: resolve(source.endpoint),
				method: "get",
			});
			return interpolate(source.template, res.data?.data ?? res.data);
		} catch {
			return null;
		}
	};

	/**
	 * The typed-title guard: the expected value usually comes from the row /
	 * path params. A template that could not be resolved (the detail header has
	 * no row) still asks for the title, but the API decides whether it is right
	 * — `errors.message_confirm_mismatch` is the translated answer.
	 */
	const needsTypedTitle = !!config.confirm?.confirmByTitle;
	const resolvedTitle = needsTypedTitle
		? resolve(config.confirm?.confirmByTitle ?? "")
		: null;
	const expectedTitle =
		resolvedTitle !== null && !/\{\w+\}/.test(resolvedTitle)
			? resolvedTitle
			: null;

	const fire = async () => {
		if (!config.endpoint) return;

		setPending(true);
		try {
			const res = await getApiClient().request({
				url: resolve(config.endpoint),
				method: (config.method ?? "POST").toLowerCase(),
				data: {
					...(config.body ?? {}),
					...(needsTypedTitle ? { confirmTitle: confirmTyped.trim() } : {}),
				},
			});

			// The API answers with a translated `message` for every action.
			const message: string | undefined =
				res.data?.data?.message ?? res.data?.message ?? config.successMessage;
			if (message) await snack.success(message);

			// Every surface reads its own SWR key (list, detail form, the
			// campaign state block, the approvals count) — revalidate them all.
			if (config.onSuccess === "refreshAll" || !config.onSuccess) {
				await mutate(() => true);
			}

			if (config.successRedirect) router.push(resolve(config.successRedirect));
			if (config.onSuccess === "closeDialog") onClose?.();
			setConfirmOpen(false);
			setConfirmTyped("");
		} catch (error) {
			// 409/422 carry the translated reason (e.g. "only a draft can be
			// sent now") — show it instead of silently doing nothing.
			await snack.error(error, "Action failed");
		} finally {
			setPending(false);
		}
	};

	const onClick = () => {
		if (action === "close") {
			onClose?.();
			return;
		}
		if (action === "navigate" && config.path) {
			router.push(resolve(config.path));
			return;
		}
		if (action === "apiCall" && config.endpoint) {
			if (config.confirm) {
				setConfirmTyped("");
				// A confirmation that must state a live fact fetches it first; the
				// dialog opens either way (the static message is the fallback).
				if (config.confirm.messageFrom) {
					setConfirmMessage(null);
					setConfirmOpen(true);
					void loadConfirmMessage().then(setConfirmMessage);
					return;
				}
				setConfirmMessage(null);
				setConfirmOpen(true);
				return;
			}
			void fire();
		}
	};

	const confirmDisabled =
		pending ||
		(needsTypedTitle &&
			(expectedTitle === null
				? confirmTyped.trim().length === 0
				: confirmTyped.trim() !== expectedTitle));

	const typedTitleInvalid =
		expectedTitle !== null &&
		confirmTyped.length > 0 &&
		confirmTyped.trim() !== expectedTitle;

	const variant = config.variant ?? "contained";
	const color = isButtonColor(config.color) ? config.color : "primary";
	const variantClass =
		variant === "outlined"
			? OUTLINED[color]
			: variant === "text"
				? TEXT[color]
				: CONTAINED[color];
	const buttonClassName = [
		BUTTON_BASE,
		variant === "text" ? "px-2 py-1.5" : "px-4 py-1.5",
		variantClass,
		config.fullWidth === true ? "w-full" : undefined,
	]
		.filter(Boolean)
		.join(" ");

	/** The destructive confirmation names the record; make the name copyable. */

	// A lifecycle action that does not apply to this record is not rendered:
	// Pause and Resume must never appear together (CRM-29). While the detail
	// record is still loading the condition is unknown, so the button waits
	// rather than flashing both.
	if (config.condition) {
		if (!record) return <></>;
		if (!matchesCondition(record, config.condition)) return <></>;
	}

	return (
		<>
			<button
				type={isSubmit ? "submit" : "button"}
				className={buttonClassName}
				disabled={submitting || pending}
				onClick={onClick}
			>
				{submitting || pending ? (
					<span
						role="status"
						aria-label="Loading"
						className="inline-block size-5 animate-spin rounded-full border-2 border-current border-t-transparent"
					/>
				) : (
					icon && <Unicon name={icon as never} size={18} className="me-1" />
				)}
				{config.label ?? (component.displayName || component.name)}
			</button>

			{confirmOpen && config.confirm && (
				<BaseDialog
					isOpen
					title={config.confirm.title ?? "Confirm"}
					onClose={() => setConfirmOpen(false)}
					isPending={pending}
					onSubmit={() => void fire()}
					slotProps={{
						submitButton: {
							props: {
								children: "Confirm",
								disabled: confirmDisabled,
								// A destructive action's confirmation is coloured with the
								// error palette (UX-7); other actions keep the primary.
								...(config.color === "error"
									? { color: "error" as const }
									: {}),
							},
							// A disabled primary says why: the typed title is the
							// only thing missing.
							tooltip:
								confirmDisabled && needsTypedTitle
									? t("common.confirmTypeTitle", {
											title: expectedTitle ?? "",
										})
									: null,
						},
					}}
				>
					<div className="text-base leading-7">
						{/* The typed title sits inside the sentence (and copies on click);
						    a separate title box plus helper text made the user read the
						    instruction in one place and copy the value in another. */}
						<ConfirmPrompt
							message={
								needsTypedTitle
									? // ConfirmPrompt fills the token below, so the token itself is
										// passed as the value: next-intl refuses to format a message
										// whose placeholder has no argument and would return the key.
										`${config.confirm.message ?? ""} ${t("common.confirmTypeTitle", { title: "{title}" })}`.trim()
									: (confirmMessage ?? config.confirm.message ?? "")
							}
							title={expectedTitle}
						/>
					</div>
					{needsTypedTitle && (
						<label className="mt-4 block">
							<span className="mb-1 block text-sm font-medium text-foreground">
								Type the title to confirm
							</span>
							<input
								autoFocus
								aria-invalid={typedTitleInvalid || undefined}
								className={[
									"w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:ring-2",
									typedTitleInvalid
										? "border-destructive focus:border-destructive focus:ring-destructive/20"
										: "border-border focus:border-ring focus:ring-ring/20",
								].join(" ")}
								value={confirmTyped}
								onChange={(event) => setConfirmTyped(event.target.value)}
							/>
						</label>
					)}
				</BaseDialog>
			)}
		</>
	);
}
