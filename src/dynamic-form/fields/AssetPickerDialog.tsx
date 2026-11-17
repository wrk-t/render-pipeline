// ═══════════════════════════════════════════════════════════════
// AssetPickerDialog – pick a previously uploaded file from the
// tenant's asset library.
//
// Backed by GET {endpoint} (the assets list endpoint). Selecting a
// tile calls `onSelect(asset.url)` so the caller can store the public
// `/uploads/...` URL as the field value.
//
// The chrome is a native `<dialog>` opened with `showModal()`: the
// browser provides the focus trap, the Backdrop (`::backdrop`) and
// Escape-to-close (the resulting `close` event reports back through
// `onClose`).
// ═══════════════════════════════════════════════════════════════
"use client";

import {
	type ReactElement,
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
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
	const dialogRef = useRef<HTMLDialogElement | null>(null);
	const searchRef = useRef<HTMLInputElement | null>(null);
	const titleId = useId();

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

	// ── Show / hide the modal dialog ──────────────────────────
	// `showModal()` gives the focus trap + `::backdrop`; Escape fires
	// `cancel`/`close` natively. Focusing the search box on open keeps
	// the first keystroke useful (the dialog is a picker).
	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) return;

		if (open && !dialog.open) {
			dialog.showModal();
			searchRef.current?.focus();
		} else if (!open && dialog.open) {
			dialog.close();
		}
	}, [open]);

	// Native closes (Escape, form method="dialog", `close()` above) all
	// end up here, so the parent state always follows the DOM.
	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) return;
		const handleClose = () => onClose();
		dialog.addEventListener("close", handleClose);
		return () => dialog.removeEventListener("close", handleClose);
	}, [onClose]);

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
		<dialog
			ref={dialogRef}
			aria-labelledby={titleId}
			onClick={(event) => {
				// A click on the dialog box itself (not its content) is a
				// backdrop click — the old MUI Dialog closed on it too.
				if (event.target === event.currentTarget) onClose();
			}}
			onKeyDown={(event) => {
				// The native `cancel` default already closes on Escape; closing
				// explicitly documents it and still works if something upstream
				// swallows the default action. `close` reports back via onClose.
				if (event.key === "Escape") dialogRef.current?.close();
			}}
			className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl overflow-hidden rounded-lg border border-border bg-card p-0 text-foreground shadow-sm backdrop:bg-black/50 max-sm:m-0 max-sm:h-dvh max-sm:max-h-none max-sm:w-full max-sm:max-w-none max-sm:rounded-none"
		>
			<div className="flex max-h-[calc(100dvh-2rem)] flex-col max-sm:h-full max-sm:max-h-none">
				<div className="border-b border-border px-4 py-3">
					<h2 id={titleId} className="text-base font-medium text-foreground">
						Choose a file
					</h2>
				</div>

				<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-3">
					<input
						ref={searchRef}
						type="search"
						placeholder="Search files…"
						aria-label="Search files"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
					/>

					{loading ? (
						<div
							role="status"
							aria-label="Loading files"
							className="flex justify-center py-10"
						>
							<span className="size-7 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
						</div>
					) : error ? (
						<p className="text-sm text-destructive">{error}</p>
					) : filtered.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							No files yet. Upload one first.
						</p>
					) : (
						<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
							{filtered.map((asset) => (
								<button
									type="button"
									key={asset.id}
									onClick={() => handleSelect(asset.url)}
									title={asset.name}
									className="flex flex-col items-center gap-2 rounded-lg border border-border bg-background p-2 transition-colors hover:border-primary focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								>
									<span className="flex h-24 w-full items-center justify-center overflow-hidden rounded-md bg-muted">
										<img
											src={resolveAssetSrc(asset.url)}
											alt={asset.name}
											className="max-h-full max-w-full object-contain"
										/>
									</span>
									<span className="w-full truncate text-center text-xs text-muted-foreground">
										{asset.name}
									</span>
								</button>
							))}
						</div>
					)}
				</div>

				<div className="flex justify-end gap-2 border-t border-border px-4 py-3">
					<button
						type="button"
						onClick={onClose}
						className="inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						Cancel
					</button>
				</div>
			</div>
		</dialog>
	);
}
