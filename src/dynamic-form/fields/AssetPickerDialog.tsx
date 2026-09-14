// ═══════════════════════════════════════════════════════════════
// AssetPickerDialog – pick a previously uploaded file from the
// tenant's asset library.
//
// Backed by GET {endpoint} (the assets list endpoint). Selecting a
// tile calls `onSelect(asset.url)` so the caller can store the public
// `/uploads/...` URL as the field value.
// ═══════════════════════════════════════════════════════════════
"use client";

import {
	Box,
	Button,
	CircularProgress,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	TextField,
	Typography,
} from "@mui/material";
import {
	type ReactElement,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import { getApiClient } from "../../deps";

interface AssetRow {
	id: string;
	name: string;
	url: string;
	mimeType?: string | null;
}

export interface AssetPickerDialogProps {
	open: boolean;
	onClose: () => void;
	onSelect: (url: string) => void;
	/** Assets list endpoint (e.g. "/api/v1/assets"). */
	endpoint: string;
}

/** Resolve a stored `/uploads/...` path against the API base. */
function resolveAssetSrc(url: string): string {
	if (url.startsWith("/uploads/")) {
		const base = process.env.NEXT_PUBLIC_ENDPOINT ?? "";
		return `${base}${url}`;
	}
	return url;
}

export function AssetPickerDialog({
	open,
	onClose,
	onSelect,
	endpoint,
}: AssetPickerDialogProps): ReactElement {
	const [rows, setRows] = useState<AssetRow[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [search, setSearch] = useState("");

	useEffect(() => {
		if (!open) return;
		let cancelled = false;
		setLoading(true);
		setError(null);
		const base = process.env.NEXT_PUBLIC_ENDPOINT ?? "";
		getApiClient()
			.get(`${base}${endpoint}`, { params: { limit: 100 } })
			.then((res) => {
				if (cancelled) return;
				const list = (res.data?.data?.data ?? []) as AssetRow[];
				setRows(Array.isArray(list) ? list : []);
			})
			.catch((err) => {
				if (cancelled) return;
				console.error("[AssetPickerDialog] failed to load assets:", err);
				setError("Could not load files.");
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [open, endpoint]);

	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return rows;
		return rows.filter((r) => r.name.toLowerCase().includes(q));
	}, [rows, search]);

	const handleSelect = useCallback(
		(url: string) => {
			onSelect(url);
			onClose();
		},
		[onSelect, onClose],
	);

	return (
		<Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
			<DialogTitle>Choose a file</DialogTitle>
			<DialogContent dividers>
				<TextField
					size="small"
					fullWidth
					placeholder="Search files…"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					sx={{ mb: 2 }}
				/>

				{loading ? (
					<Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
						<CircularProgress size={28} />
					</Box>
				) : error ? (
					<Typography color="error" variant="body2">
						{error}
					</Typography>
				) : filtered.length === 0 ? (
					<Typography color="text.secondary" variant="body2">
						No files yet. Upload one first.
					</Typography>
				) : (
					<Box
						sx={{
							display: "grid",
							gridTemplateColumns: {
								xs: "repeat(2, 1fr)",
								sm: "repeat(3, 1fr)",
								md: "repeat(4, 1fr)",
							},
							gap: 1.5,
						}}
					>
						{filtered.map((asset) => (
							<Box
								component="button"
								type="button"
								key={asset.id}
								onClick={() => handleSelect(asset.url)}
								title={asset.name}
								sx={{
									display: "flex",
									flexDirection: "column",
									alignItems: "center",
									gap: 1,
									p: 1,
									borderRadius: 1,
									bgcolor: "background.paper",
									cursor: "pointer",
									border: "1px solid",
									borderColor: "divider",
									"&:hover": { borderColor: "primary.main" },
								}}
							>
								<Box
									sx={{
										width: "100%",
										height: 96,
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										overflow: "hidden",
										borderRadius: 1,
										bgcolor: "action.hover",
									}}
								>
									<Box
										component="img"
										src={resolveAssetSrc(asset.url)}
										alt={asset.name}
										sx={{
											maxWidth: "100%",
											maxHeight: "100%",
											objectFit: "contain",
										}}
									/>
								</Box>
								<Typography
									variant="caption"
									color="text.secondary"
									sx={{
										width: "100%",
										overflow: "hidden",
										textOverflow: "ellipsis",
										whiteSpace: "nowrap",
										textAlign: "center",
									}}
								>
									{asset.name}
								</Typography>
							</Box>
						))}
					</Box>
				)}
			</DialogContent>
			<DialogActions>
				<Button onClick={onClose}>Cancel</Button>
			</DialogActions>
		</Dialog>
	);
}
