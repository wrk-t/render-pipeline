"use client";

import Link from "@mui/material/Link";
import { useRouter } from "next/navigation";
import type { ReactElement } from "react";
import { Unicon } from "../components/common/icon/Unicon";
import type { RendererProps } from "../types";

// ──────────────────────────────────────────────────────────────────
// LinkRenderer — MUI Link rendered as a real anchor (not a button).
// Navigates with router.push (SPA) and supports {param} substitution.
// ──────────────────────────────────────────────────────────────────

export function LinkRenderer({ component, pathParams }: RendererProps): ReactElement {
	const router = useRouter();
	const config = (component.config ?? {}) as {
		label?: string;
		path?: string;
		variant?: "text" | "button";
		icon?: string;
	};

	const path = config.path?.replace(
		/\{(\w+)\}/g,
		(_: string, key: string) =>
			pathParams && key in pathParams ? String(pathParams[key]) : `{${key}}`,
	);

	return (
		<Link
			href={path ?? "/"}
			variant={config.variant === "button" ? "button" : "body1"}
			underline="hover"
			onClick={(e) => {
				// SPA navigation — keep the URL in the address bar in sync
				e.preventDefault();
				router.push(path ?? "/");
			}}
		>
			{config.icon && <Unicon name={config.icon as any} size={16} className="mr-1" />}
			{config.label ?? (component.displayName || component.name)}
		</Link>
	);
}
