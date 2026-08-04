// ═══════════════════════════════════════════════════════════════
// TableIcon – Renders an icon by name using the shared Unicon
// component. Maps names from table-action contracts to unicons.
//
// Usage:
//   <TableIcon name="Edit" />
//   <TableIcon name="Delete" />
//   <TableIcon name="Add" />
//   <TableIcon name="Refresh" />
//
// This is a thin re-export wrapper around <Unicon> that keeps
// the existing TableIcon API compatible. New code can use
// <Unicon> directly.
// ═══════════════════════════════════════════════════════════════
"use client";

import type { ReactElement } from "react";
import { ICON_EXPORT, Unicon } from "../components/common/icon/Unicon";

// ── Props ─────────────────────────────────────────────────────

export interface TableIconProps {
	/** Icon name matching the backend contract. */
	name: string;
	/** Optional size in px. Defaults to 24. */
	size?: number | string;
	/** Optional className. */
	className?: string;
}

// ── Component ─────────────────────────────────────────────────

export function TableIcon({
	name,
	size,
	className,
}: TableIconProps): ReactElement {
	const isValid = name in ICON_EXPORT;

	if (process.env.NODE_ENV === "development" && !isValid) {
		console.warn(
			`[TableIcon] Unknown icon "${name}". Add it to ICON_EXPORT in Unicon.tsx.`,
		);
	}

	return (
		<Unicon
			name={isValid ? (name as keyof typeof ICON_EXPORT) : null}
			size={size}
			className={className}
		/>
	);
}
