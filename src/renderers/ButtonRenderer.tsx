"use client";

import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import { useFormikContext } from "formik";
import { useRouter } from "next/navigation";
import type { ReactElement } from "react";
import { Unicon } from "../components/common/icon/Unicon";
import type { RendererProps } from "../types";

// ──────────────────────────────────────────────────────────────────
// ButtonRenderer — standalone Button component, rendered from the
// metadata tree (e.g. a Form's actions slot).
//
// Dispatches on `config.action`:
//   submit  → native form submit inside Formik (spinner while submitting)
//   close   → onClose (dialog close)
//   navigate→ router.push(path) with {param} substitution
//   apiCall → fires the endpoint directly (with confirm when configured)
//   button  → no-op button
// ──────────────────────────────────────────────────────────────────

function useOptionalFormikContext() {
	try {
		return useFormikContext<Record<string, unknown>>();
	} catch {
		return undefined;
	}
}

export function ButtonRenderer({ component, onClose }: RendererProps): ReactElement {
	const router = useRouter();
	const config = (component.config ?? {}) as {
		label?: string;
		action?: string;
		variant?: "contained" | "outlined" | "text";
		color?: string;
		icon?: string;
		path?: string;
		endpoint?: string;
		method?: string;
		confirm?: { title?: string; message?: string };
	};

	const action = config.action ?? "button";
	const isSubmit = action === "submit";
	const formik = useOptionalFormikContext();
	const submitting = isSubmit && formik?.isSubmitting === true;
	// The authoring compiler stores Button icons on the component row's `icon`
	// column (identity key, stripped from config) — fall back to it.
	const icon = config.icon ?? component.icon ?? undefined;

	const onClick = () => {
		if (action === "close") {
			onClose?.();
			return;
		}
		if (action === "navigate" && config.path) {
			router.push(config.path);
			return;
		}
		if (action === "apiCall" && config.endpoint) {
			const fire = () => {
				void fetch(config.endpoint!, {
					method: config.method ?? "POST",
					headers: { "Content-Type": "application/json" },
					credentials: "include",
					body: JSON.stringify({}),
				});
			};
			if (config.confirm) {
				if (window.confirm(config.confirm.message ?? "Are you sure?")) fire();
			} else {
				fire();
			}
		}
	};

	return (
		<Button
			type={isSubmit ? "submit" : "button"}
			variant={config.variant ?? "contained"}
			color={config.color as any}
			disabled={submitting}
			onClick={onClick}
		>
			{submitting ? (
				<CircularProgress size={20} color="inherit" />
			) : (
				icon && <Unicon name={icon as any} size={18} className="mr-1" />
			)}
			{config.label ?? (component.displayName || component.name)}
		</Button>
	);
}
