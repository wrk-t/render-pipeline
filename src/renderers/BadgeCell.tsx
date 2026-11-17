"use client";

import type { ReactElement } from "react";

interface Props {
	cell: any;
	columnDef: any;
}

/**
 * The DSL's `variantMap` carries MUI palette names (`success`, `error`, …)
 * because that is what the metadata contract stores. They are mapped onto
 * shadcn badge variants: stock shadcn has no success/warning/info badge, so
 * positive states take the solid primary fill, neutral ones the secondary or
 * outline treatment, and destructive ones the destructive fill.
 */
const VARIANT_CLASSES: Record<string, string> = {
	default: "border-border text-muted-foreground",
	primary: "border-transparent bg-primary text-primary-foreground",
	secondary: "border-transparent bg-secondary text-secondary-foreground",
	success: "border-transparent bg-primary text-primary-foreground",
	warning: "border-border text-foreground",
	info: "border-transparent bg-secondary text-secondary-foreground",
	error: "border-transparent bg-destructive text-white",
	danger: "border-transparent bg-destructive text-white",
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
			className={`inline-flex max-w-full items-center rounded-md border px-2 py-0.5 text-xs font-medium ${variantClass}`}
		>
			<span className="truncate">{label}</span>
		</span>
	);
}
