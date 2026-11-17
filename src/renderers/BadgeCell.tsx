"use client";

import type { ReactElement } from "react";

interface Props {
	cell: any;
	columnDef: any;
}

/**
 * MUI palette name → outlined badge classes. The format's `variantMap`
 * values are MUI colour names (`success`, `error`, …); anything unknown
 * falls back to the neutral outline.
 */
const VARIANT_CLASSES: Record<string, string> = {
	default: "border-border text-muted-foreground",
	primary: "border-primary/40 text-primary",
	secondary: "border-border text-secondary-foreground",
	success: "border-success-main/40 text-success-main",
	warning: "border-warning-main/40 text-warning-main",
	info: "border-info-main/40 text-info-main",
	error: "border-destructive/40 text-destructive",
};

/**
 * Renders a badge chip inside a table cell.
 * Format config: { type: "badge", props: { variantMap: { "active": "success", ... } } }
 */
export function BadgeCell({ cell }: Props): ReactElement {
	const value = cell.getValue();
	const label = String(value ?? "");
	const fmt = cell?.column?.columnDef?.columnFormat ?? {};
	const variantMap = (fmt.props as any)?.variantMap ?? {};
	const color = variantMap[String(value)] ?? variantMap[label] ?? "default";
	const variantClass = VARIANT_CLASSES[color] ?? VARIANT_CLASSES.default;

	return (
		<span
			className={`inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-xs font-medium ${variantClass}`}
		>
			<span className="truncate">{label}</span>
		</span>
	);
}
