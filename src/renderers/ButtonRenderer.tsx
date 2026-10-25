"use client";

import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useFormikContext } from "formik";
import { useRouter } from "next/navigation";
import { type ReactElement, useState } from "react";
import { useSWRConfig } from "swr";
import { BaseDialog } from "../components/dialog/BaseDialog";
import { Unicon } from "../components/common/icon/Unicon";
import { getApiClient } from "../deps";
import { useSnack } from "../hooks/useSnack";
import type { RendererProps } from "../types";

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

type TConfirmConfig = {
	title?: string;
	message?: string;
	/**
	 * A row-placeholder template (e.g. `"{title}"`). When it resolves, the
	 * dialog asks the admin to retype that value and the request posts
	 * `{ confirmTitle }` — the API re-validates it (CRM-13/15).
	 */
	confirmByTitle?: string;
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
	};

	const action = config.action ?? "button";
	const isSubmit = action === "submit";
	const formik = useOptionalFormikContext();
	const submitting = isSubmit && formik?.isSubmitting === true;
	// The authoring compiler stores Button icons on the component row's `icon`
	// column (identity key, stripped from config) — fall back to it.
	const icon = config.icon ?? component.icon ?? undefined;

	// ── Confirmation + fire state (apiCall only) ──────────────────
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [confirmTyped, setConfirmTyped] = useState("");
	const [pending, setPending] = useState(false);

	/** `{id}` / `{tenantId}` … resolved from the screen's path params. */
	const resolve = (template: string): string =>
		template.replace(
			/\{(\w+)\}/g,
			(_: string, key: string) =>
				pathParams && key in pathParams ? String(pathParams[key]) : `{${key}}`,
		);

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
				res.data?.data?.message ??
				res.data?.message ??
				config.successMessage;
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
					<Typography>{config.confirm.message}</Typography>
					{needsTypedTitle && (
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
					)}
				</BaseDialog>
			)}
		</>
	);
}
