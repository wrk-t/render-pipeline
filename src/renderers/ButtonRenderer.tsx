"use client";

import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import { useFormikContext } from "formik";
import { useRouter } from "next/navigation";
import { type ReactElement, useState } from "react";
import { useSWRConfig } from "swr";
import { BaseDialog } from "../components/dialog/BaseDialog";
import { Unicon } from "../components/common/icon/Unicon";
import { getApiClient } from "../deps";
import { useSnack } from "../hooks/useSnack";
import type { RendererProps } from "../types";
import { useRecordData } from "./RecordContext";
import { matchesCondition, type TActionCondition } from "./condition";

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

function useOptionalFormikContext() {
	try {
		return useFormikContext<Record<string, unknown>>();
	} catch {
		return undefined;
	}
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

export function ButtonRenderer({
	component,
	onClose,
	pathParams,
}: RendererProps): ReactElement {
	const router = useRouter();
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
			(expectedTitle !== null
				? confirmTyped.trim() !== expectedTitle
				: confirmTyped.trim().length === 0));

	/** The destructive confirmation names the record; make the name copyable. */
	const copyExpectedTitle = async () => {
		if (!expectedTitle) return;
		try {
			await navigator.clipboard.writeText(expectedTitle);
			await snack.success("Copied");
		} catch {
			/* clipboard unavailable — the text is still selectable */
		}
	};

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
			<Button
				type={isSubmit ? "submit" : "button"}
				variant={config.variant ?? "contained"}
				color={config.color as never}
				disabled={submitting || pending}
				onClick={onClick}
			>
				{submitting || pending ? (
					<CircularProgress size={20} color="inherit" />
				) : (
					icon && <Unicon name={icon as never} size={18} className="mr-1" />
				)}
				{config.label ?? (component.displayName || component.name)}
			</Button>

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
							},
						},
					}}
				>
					<Typography>{confirmMessage ?? config.confirm.message}</Typography>
					{needsTypedTitle && (
						<>
							{expectedTitle && (
								<Box className="mt-3 flex items-center gap-2 rounded border border-solid border-gray-300 bg-gray-50 px-3 py-2">
									<Typography
										variant="body2"
										className="select-all font-semibold"
									>
										{expectedTitle}
									</Typography>
									<Tooltip title="Copy">
										<IconButton
											size="small"
											aria-label="Copy title"
											onClick={() => void copyExpectedTitle()}
										>
											<Unicon name="Copy" size={16} />
										</IconButton>
									</Tooltip>
								</Box>
							)}
							<TextField
								fullWidth
								autoFocus
								className="mt-4"
								label="Type the title to confirm"
								value={confirmTyped}
								onChange={(event) => setConfirmTyped(event.target.value)}
								error={
									expectedTitle !== null &&
									confirmTyped.length > 0 &&
									confirmTyped.trim() !== expectedTitle
								}
								helperText={expectedTitle ?? undefined}
							/>
						</>
					)}
				</BaseDialog>
			)}
		</>
	);
}
