"use client";

import Box from "@mui/material/Box";
import type { ReactElement } from "react";

interface Props {
	cell: any;
	columnDef?: any;
}

/**
 * Renders an image value as a small rounded thumbnail inside a table cell.
 * Format config: { type: "image" }
 *
 * Backend-served uploads (`/uploads/…`) are prefixed with the API
 * endpoint; front static paths (`/images/…`) and absolute URLs are
 * used as-is. The cell is a full-width flex container so the
 * thumbnail stays centered regardless of the column's text-align.
 */
function resolveImageUrl(url: string): string {
	if (url.startsWith("/uploads/")) {
		const base = process.env.NEXT_PUBLIC_ENDPOINT ?? "";
		return `${base}${url}`;
	}
	return url;
}

export function ImageCell({ cell }: Props): ReactElement {
	const value = cell.getValue() as string | null | undefined;

	if (!value) {
		return (
			<Box
				sx={{
					width: 40,
					height: 40,
					borderRadius: 1,
					bgcolor: "action.hover",
					mx: "auto",
				}}
			/>
		);
	}

	return (
		<Box sx={{ display: "flex", justifyContent: "center" }}>
			<Box
				component="img"
				src={resolveImageUrl(value)}
				alt=""
				sx={{
					width: 40,
					height: 40,
					objectFit: "cover",
					borderRadius: 1,
					display: "block",
				}}
			/>
		</Box>
	);
}
