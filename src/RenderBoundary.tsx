// ──────────────────────────────────────────────────────────────────
// RenderBoundary — uniform loading / error / unknown-blueprint states
// for every component rendered through the pipeline.
// ──────────────────────────────────────────────────────────────────

"use client";

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
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
			<Box className="flex items-center justify-center py-12">
				<CircularProgress />
			</Box>
		);
	}
	if (error) {
		return (
			<Box className="flex items-center justify-center py-12">
				<Typography color="error" variant="body2">
					Failed to load component. Check the console for details.
				</Typography>
			</Box>
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
		<Typography color="error">Unknown blueprint: {blueprintName}</Typography>
	);
}
