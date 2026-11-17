// ═══════════════════════════════════════════════════════════════
// FormImageField – Renders an image upload field with drag‑and‑drop,
// preview, and file validation.
//
// The field value is stored as a raw File object (or a URL string
// when pre‑filled from the backend). This allows the submit
// handler to send the actual binary file as multipart/form-data.
// ═══════════════════════════════════════════════════════════════
"use client";

import { useField } from "formik";
import {
	type ChangeEvent,
	type DragEvent,
	type ReactElement,
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import { Unicon } from "../../components/common/icon/Unicon";
import { getApiClient } from "../../deps";
import { useResolvedParams } from "../../hooks/useResolvedParams";
import type { ImageField } from "../types";
import { AssetPickerDialog } from "./AssetPickerDialog";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const DEFAULT_ACCEPT = "image/*";
const DEFAULT_MAX_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Format byte size into a human‑readable string.
 */
function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Backend uploads are served at `/uploads/...`. Resolve both the relative
 * value the API returns now and absolute URLs written by older versions
 * against the API origin, so a dev instance never tries to load the
 * production host.
 */
function resolveUploadPreview(value: string): string {
	const base = process.env.NEXT_PUBLIC_ENDPOINT ?? "";
	try {
		const url = new URL(value, "http://uploads.local");
		if (!url.pathname.startsWith("/uploads/")) return value;
		return `${base}${url.pathname}${url.search}`;
	} catch {
		return value;
	}
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function FormImageField({ field }: { field: ImageField }): ReactElement {
	// The user's tenant (if any) resolves `{tenantId}` in upload endpoints
	// (e.g. the tenant branding logo upload).
	const resolvedParams = useResolvedParams();

	// Value can be:
	//   - File   → user selected a new file (binary)
	//   - string → URL from backend (pre‑filled, read‑only)
	//   - null   → nothing selected
	const [{ value }, meta, { setValue, setTouched }] = useField<
		File | string | null
	>(field.name);

	const inputRef = useRef<HTMLInputElement>(null);
	const objectUrlRef = useRef<string | null>(null);
	const inputId = useId();

	const [dragOver, setDragOver] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [uploading, setUploading] = useState(false);
	const [pickerOpen, setPickerOpen] = useState(false);

	const accept = field.uiOverrides?.behavior?.accept ?? DEFAULT_ACCEPT;
	const maxSize = field.uiOverrides?.behavior?.maxSize ?? DEFAULT_MAX_SIZE;

	// When configured (e.g. `overrides.behavior.uploadEndpoint` on the
	// element), the file is uploaded to the backend on selection and the
	// returned value becomes the field value (so the form can submit JSON).
	const behavior = (field.fieldOverrides as any)?.behavior as
		| Record<string, unknown>
		| undefined;
	const uploadEndpoint = behavior?.uploadEndpoint as string | undefined;
	// Multipart field name the upload endpoint expects (default "file").
	const uploadFieldName =
		(behavior?.uploadFieldName as string | undefined) ?? "file";
	// Dot-path of the upload response value inside `res.data.data` (default "url").
	const valuePath = (behavior?.valuePath as string | undefined) ?? "url";
	// Resolve `{tenantId}` (and other path params) in the upload endpoint.
	const resolvedUploadEndpoint = uploadEndpoint
		? uploadEndpoint.replace(/\{(\w+)\}/g, (_: string, key: string) =>
				key in resolvedParams ? String(resolvedParams[key]) : `{${key}}`,
			)
		: undefined;

	// When set, the field also offers "Choose from library" — a dialog
	// listing the tenant's uploaded files (e.g. "/api/v1/assets").
	const libraryEndpointRaw = behavior?.libraryEndpoint as string | undefined;
	const resolvedLibraryEndpoint = libraryEndpointRaw
		? libraryEndpointRaw.replace(/\{(\w+)\}/g, (_: string, key: string) =>
				key in resolvedParams ? String(resolvedParams[key]) : `{${key}}`,
			)
		: undefined;

	// ── Preview source ─────────────────────────────────────────
	// Derived directly from value on every render.
	// File → ObjectURL; string → resolved against the API base so
	// backend-served uploads (`/uploads/…`) load in the admin app
	// (the front origin does not serve them).
	const previewSrc: string | null = useMemo(() => {
		if (value instanceof File) return URL.createObjectURL(value);
		if (typeof value === "string") return resolveUploadPreview(value);
		return value ?? null;
	}, [value]);

	// ── Revoke stale ObjectURL when value changes ──────────────
	useEffect(() => {
		const prevUrl = objectUrlRef.current;
		const currentUrl =
			value instanceof File ? URL.createObjectURL(value) : null;

		// If we switched from a File to something else, revoke the old URL
		if (prevUrl && prevUrl !== currentUrl) {
			URL.revokeObjectURL(prevUrl);
		}

		objectUrlRef.current = currentUrl;

		return () => {
			if (objectUrlRef.current) {
				URL.revokeObjectURL(objectUrlRef.current);
			}
		};
	}, [value]);

	// ── Validate and process a single file ──────────────────────
	const processFile = useCallback(
		async (file: File) => {
			if (!file.type.startsWith("image/")) {
				setError("Selected file is not an image.");
				return;
			}

			if (file.size > maxSize) {
				setError(
					`Image exceeds maximum size of ${formatFileSize(maxSize)} ` +
						`(selected: ${formatFileSize(file.size)}).`,
				);
				return;
			}

			// Revoke previous ObjectURL
			if (objectUrlRef.current) {
				URL.revokeObjectURL(objectUrlRef.current);
				objectUrlRef.current = null;
			}

			setError(null);
			await setValue(file);
		},
		[maxSize, setValue],
	);

	/**
	 * Upload a File to the configured endpoint and store the returned
	 * URL as the field value.
	 */
	const uploadAndSetValue = useCallback(
		async (file: File) => {
			setUploading(true);
			setError(null);
			try {
				const fd = new FormData();
				fd.append(uploadFieldName, file);
				const base = process.env.NEXT_PUBLIC_ENDPOINT ?? "";
				const res = await getApiClient().post(
					`${base}${resolvedUploadEndpoint}`,
					fd,
				);
				const value = (res.data?.data as Record<string, unknown> | undefined)?.[
					valuePath
				] as string | undefined;
				if (!value) throw new Error("Upload response missing value");
				await setValue(value);
			} catch (err) {
				setError("Upload failed. Please try again.");
				console.error("[FormImageField] upload failed:", err);
			} finally {
				setUploading(false);
			}
		},
		[resolvedUploadEndpoint, setValue, uploadFieldName, valuePath],
	);

	// ── Handle file input change ───────────────────────────────
	const handleFileChange = useCallback(
		async (e: ChangeEvent<HTMLInputElement>) => {
			const files = e.target.files;
			if (!files || files.length === 0) return;

			if (uploadEndpoint) {
				await uploadAndSetValue(files[0]);
			} else {
				await processFile(files[0]);
			}
			e.target.value = "";
		},
		[processFile, uploadAndSetValue, uploadEndpoint],
	);

	// ── Drag & drop handlers ───────────────────────────────────
	const handleDragOver = useCallback((e: DragEvent<HTMLElement>) => {
		e.preventDefault();
		e.stopPropagation();
		setDragOver(true);
	}, []);

	const handleDragLeave = useCallback((e: DragEvent<HTMLElement>) => {
		e.preventDefault();
		e.stopPropagation();
		setDragOver(false);
	}, []);

	const handleDrop = useCallback(
		async (e: DragEvent<HTMLElement>) => {
			e.preventDefault();
			e.stopPropagation();
			setDragOver(false);

			const files = e.dataTransfer.files;
			if (!files || files.length === 0) return;

			if (uploadEndpoint) {
				await uploadAndSetValue(files[0]);
			} else {
				await processFile(files[0]);
			}
		},
		[processFile, uploadAndSetValue, uploadEndpoint],
	);

	// ── Remove / clear ─────────────────────────────────────────
	const handleRemove = useCallback(async () => {
		if (objectUrlRef.current) {
			URL.revokeObjectURL(objectUrlRef.current);
			objectUrlRef.current = null;
		}

		setError(null);
		await setValue(null);
		await setTouched(true);
	}, [setValue, setTouched]);

	// ── Click to open file picker ──────────────────────────────
	const handleClick = useCallback(() => {
		inputRef.current?.click();
	}, []);

	// ── Render ─────────────────────────────────────────────────
	return (
		<div className="flex flex-col gap-1">
			{/* Label */}
			<label htmlFor={inputId} className="text-sm font-medium text-foreground">
				{field.label}
				{field.isRequired && (
					<span aria-hidden="true" className="ms-0.5 text-destructive">
						*
					</span>
				)}
			</label>

			{/* Hidden file input */}
			<input
				ref={inputRef}
				id={inputId}
				type="file"
				accept={accept}
				multiple={false}
				disabled={field.isReadOnly}
				className="hidden"
				onChange={handleFileChange}
				onBlur={() => setTouched(true)}
			/>

			{/* Drop zone or preview */}
			{previewSrc ? (
				<div
					className="relative min-h-[160px] w-full max-w-[320px] overflow-hidden rounded-lg border border-dashed border-border p-4"
					style={{
						opacity: field.isReadOnly ? 0.7 : 1,
						pointerEvents: field.isReadOnly ? "none" : undefined,
					}}
				>
					{!field.isReadOnly && (
						<button
							type="button"
							onClick={handleRemove}
							aria-label="Remove image"
							className="absolute end-1 top-1 inline-flex size-7 items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>
							<Unicon name="CloseOutlined" size={20} />
						</button>
					)}
					<div className="relative h-60 w-full">
						<img
							src={previewSrc ?? ""}
							alt="Uploaded preview"
							className="block h-full max-h-40 w-full object-contain"
							onError={(e) => {
								// A broken image URL is a data problem, not an application
								// crash; `warn` avoids the Next dev error overlay.
								console.warn(
									"[FormImageField] Failed to load image:",
									previewSrc,
									e,
								);
							}}
						/>
					</div>
				</div>
			) : field.isReadOnly ? (
				<div className="flex min-h-[160px] w-full max-w-[320px] flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border opacity-60">
					<Unicon
						name="CloudUploadOutlined"
						size={40}
						className="text-muted-foreground"
					/>
					<p className="text-center text-sm text-muted-foreground">
						No image uploaded
					</p>
				</div>
			) : (
				<button
					type="button"
					onClick={handleClick}
					onDragOver={handleDragOver}
					onDragLeave={handleDragLeave}
					onDrop={handleDrop}
					className={`flex min-h-[160px] w-full max-w-[320px] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed p-4 transition-[border-color,background-color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
						dragOver ? "border-primary bg-muted" : "border-border bg-background"
					}`}
				>
					<Unicon
						name="CloudUploadOutlined"
						size={40}
						className="text-muted-foreground"
					/>
					<span className="text-center text-sm text-muted-foreground">
						{uploading
							? "Uploading…"
							: "Drag & drop an image here, or click to browse"}
					</span>
					<span className="text-xs text-muted-foreground">
						Accepted: {accept} &middot; Max: {formatFileSize(maxSize)}
					</span>
				</button>
			)}

			{/* Library picker — choose an already-uploaded file */}
			{resolvedLibraryEndpoint && !field.isReadOnly ? (
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => setPickerOpen(true)}
						className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						Choose from library
					</button>
				</div>
			) : null}

			{/* Error message — upload failure first, then the form's own rule
          (e.g. a required image) so a red field never appears unexplained. */}
			{error && <p className="text-xs text-destructive">{error}</p>}
			{!error && meta.touched && meta.error && (
				<p className="text-xs text-destructive">{meta.error}</p>
			)}

			{/* Description */}
			{field.fieldOverrides?.description ? (
				<p className="text-xs text-muted-foreground">
					{field.fieldOverrides.description}
				</p>
			) : null}

			{resolvedLibraryEndpoint ? (
				<AssetPickerDialog
					open={pickerOpen}
					onClose={() => setPickerOpen(false)}
					onSelect={(url) => {
						void setValue(url);
						void setTouched(true);
					}}
					endpoint={resolvedLibraryEndpoint}
				/>
			) : null}
		</div>
	);
}
