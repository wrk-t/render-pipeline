// ──────────────────────────────────────────────────────────────────
// RenderBoundary — uniform loading / error / unknown-blueprint states
// for every component rendered through the pipeline.
// ──────────────────────────────────────────────────────────────────

"use client";

import type { ReactElement, ReactNode } from "react";

export function RenderBoundary({
	isLoading,
	error,
	children,
}: {
	isLoading?: boolean;
	error?: unknown;
	children: ReactNode;
}): ReactElement {
	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<span
					role="status"
					aria-label="Loading"
					className="size-10 animate-spin rounded-full border-2 border-current border-t-transparent text-primary"
				/>
			</div>
		);
	}
	if (error) {
		return (
			<div className="flex items-center justify-center py-12">
				<p className="text-sm text-destructive">
					Failed to load component. Check the console for details.
				</p>
			</div>
		);
	}
	return <>{children}</>;
}

/** Fallback for blueprint names that have no registered renderer. */
export function UnknownRenderer({
	blueprintName,
}: {
	blueprintName: string;
}): ReactElement {
	return (
		<p className="text-base text-destructive">
			Unknown blueprint: {blueprintName}
		</p>
	);
}
