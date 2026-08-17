"use client";

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useRef, useState } from "react";
import { getApiClient } from "../../deps";
import { useSnack } from "../../hooks/useSnack";
import { Unicon } from "../common/icon/Unicon";
import { BaseDialog } from "../dialog/BaseDialog";

// ════════════════════════════════════════════════════════════════
// QR PREVIEW DIALOG — opened from a table row action (viewQr).
//
// Fetches the QR SVG from the backend (authed via the app's axios
// client) and renders it. The submit button downloads the PNG.
// ════════════════════════════════════════════════════════════════

export interface QrPreviewDialogProps {
	open: boolean;
	/** QR code row id. */
	id: string;
	/** QR code label (used as the download filename). */
	label: string;
	onClose: () => void;
}

/** Encode a string as a base64 data-URL payload (unicode-safe). */
const toBase64 = (input: string): string => {
	const bytes = new TextEncoder().encode(input);
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
};

export const QrPreviewDialog: React.FC<QrPreviewDialogProps> = ({
	open,
	id,
	label,
	onClose,
}) => {
	const snack = useSnack();
	// useSnack() returns a fresh object every render — keep it in a ref so
	// the fetch effect below can depend on stable values only ([open, id]).
	const snackRef = useRef(snack);
	snackRef.current = snack;

	const [svgUrl, setSvgUrl] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [downloading, setDownloading] = useState(false);

	useEffect(() => {
		if (!open || !id) return;
		let cancelled = false;
		setLoading(true);
		setSvgUrl(null);

		const base = process.env.NEXT_PUBLIC_ENDPOINT ?? "";
		// `ts` cache-buster: the QR style can change, so never reuse a
		// browser-cached SVG from a previous style.
		getApiClient()
			.get(
				`${base}/api/v1/qr-codes/${id}/qr.svg?ts=${Date.now()}`,
				{
					responseType: "text",
				},
			)
			.then((res) => {
				if (cancelled) return;
				const svg = typeof res.data === "string" ? res.data : "";
				setSvgUrl(`data:image/svg+xml;base64,${toBase64(svg)}`);
			})
			.catch((err: unknown) => {
				if (!cancelled) {
					void snackRef.current.error(err, "Failed to load QR code");
				}
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [open, id]);

	const handleDownload = useCallback(async () => {
		if (!id) return;
		setDownloading(true);
		try {
			const base = process.env.NEXT_PUBLIC_ENDPOINT ?? "";
			const res = await getApiClient().get(
				`${base}/api/v1/qr-codes/${id}/qr.png?ts=${Date.now()}`,
				{ responseType: "blob" },
			);
			const blob =
				res.data instanceof Blob ? res.data : new Blob([res.data]);
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `${label || "qr-code"}.png`;
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(url);
		} catch (err) {
			await snack.error(err, "Download failed");
		} finally {
			setDownloading(false);
		}
	}, [id, label, snack]);

	return (
		<BaseDialog
			isOpen={open}
			title={label}
			onClose={onClose}
			onSubmit={handleDownload}
			isPending={downloading}
			slotProps={{
				submitButton: {
					show: !!svgUrl,
					props: {
						children: "Download",
						color: "primary",
						startIcon: <Unicon name="Download" size={18} />,
					},
				},
				closeButton: { show: true, props: { children: "Close" } },
			}}
		>
			<Box
				className="flex flex-col items-center gap-4 py-2"
				data-testid="qr-preview"
			>
				{loading && !svgUrl && <CircularProgress size={32} />}
				{svgUrl && (
					<img
						src={svgUrl}
						alt={`QR code — ${label}`}
						className="h-64 w-64"
						style={{ imageRendering: "pixelated" }}
					/>
				)}
				{!loading && !svgUrl && (
					<Typography color="textSecondary">
						Could not load QR code
					</Typography>
				)}
			</Box>
		</BaseDialog>
	);
};
