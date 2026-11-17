"use client";

import { useRouter } from "next/navigation";
import type { ReactElement } from "react";
import { Unicon } from "../components/common/icon/Unicon";
import type { RendererProps } from "../types";

// ──────────────────────────────────────────────────────────────────
// LinkRenderer — a real anchor (not a button). Navigates with router.push
// (SPA) and supports {param} substitution.
// ──────────────────────────────────────────────────────────────────

export function LinkRenderer({
	component,
	pathParams,
}: RendererProps): ReactElement {
	const router = useRouter();
	const config = (component.config ?? {}) as {
		label?: string;
		path?: string;
		variant?: "text" | "button";
		icon?: string;
	};

	const path = config.path?.replace(/\{(\w+)\}/g, (_: string, key: string) =>
		pathParams && key in pathParams ? String(pathParams[key]) : `{${key}}`,
	);
	// The authoring compiler stores icon on the component row's `icon` column
	// (identity key, stripped from config) — fall back to it.
	const icon = config.icon ?? component.icon ?? undefined;

	const className = [
		"inline-flex items-center gap-2 text-primary underline-offset-4 hover:underline",
		// `button` links read as shadcn's inline action link; plain links
		// inherit the surrounding text size like a shadcn prose link.
		config.variant === "button" ? "text-sm font-medium" : undefined,
	]
		.filter(Boolean)
		.join(" ");

	return (
		<a
			href={path ?? "/"}
			className={className}
			onClick={(e) => {
				// SPA navigation — keep the URL in the address bar in sync
				e.preventDefault();
				router.push(path ?? "/");
			}}
		>
			{icon && <Unicon name={icon as never} size={16} />}
			{config.label ?? (component.displayName || component.name)}
		</a>
	);
}
