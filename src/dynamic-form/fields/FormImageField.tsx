// ═══════════════════════════════════════════════════════════════
// FormImageField – Renders an image upload field with drag‑and‑drop,
// preview, and file validation.
//
// The field value is stored as a raw File object (or a URL string
// when pre‑filled from the backend). This allows the submit
// handler to send the actual binary file as multipart/form-data.
// ═══════════════════════════════════════════════════════════════
"use client";

import { Box, IconButton, Stack, Typography } from "@mui/material";
import { useField } from "formik";
import {
	type ChangeEvent,
	type DragEvent,
	type ReactElement,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { Unicon } from "../../components/common/icon/Unicon";
import { getApiClient } from "../../deps";
import type { ImageField } from "../types";

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

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function FormImageField({ field }: { field: ImageField }): ReactElement {
	// Value can be:
	//   - File   → user selected a new file (binary)
	//   - string → URL from backend (pre‑filled, read‑only)
	//   - null   → nothing selected
	const [{ value }, , { setValue, setTouched }] = useField<
		File | string | null
	>(field.name);

	const inputRef = useRef<HTMLInputElement>(null);
	const objectUrlRef = useRef<string | null>(null);

	const [dragOver, setDragOver] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [uploading, setUploading] = useState(false);

	const accept = field.uiOverrides?.behavior?.accept ?? DEFAULT_ACCEPT;
	const maxSize = field.uiOverrides?.behavior?.maxSize ?? DEFAULT_MAX_SIZE;

	// When configured (e.g. `overrides.behavior.uploadEndpoint` on the
	// element), the file is uploaded to the backend on selection and the
	// returned URL becomes the field value (so the form can submit JSON).
	const uploadEndpoint = (field.fieldOverrides as any)?.behavior
		?.uploadEndpoint as string | undefined;

	// ── Preview source ─────────────────────────────────────────
	// Derived directly from value on every render.
	// File → ObjectURL; string → use as-is.
	const previewSrc: string | null = useMemo(
		() =>
			value instanceof File ? URL.createObjectURL(value) : (value ?? null),
		[value],
	);

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
				fd.append("file", file);
				const base = process.env.NEXT_PUBLIC_ENDPOINT ?? "";
				const res = await getApiClient().post(
					`${base}${uploadEndpoint}`,
					fd,
				);
				const url = res.data?.data?.url as string | undefined;
				if (!url) throw new Error("Upload response missing url");
				await setValue(url);
			} catch (err) {
				setError("Upload failed. Please try again.");
				console.error("[FormImageField] upload failed:", err);
			} finally {
				setUploading(false);
			}
		},
		[uploadEndpoint, setValue],
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
	const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		e.stopPropagation();
		setDragOver(true);
	}, []);

	const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		e.stopPropagation();
		setDragOver(false);
	}, []);

	const handleDrop = useCallback(
		async (e: DragEvent<HTMLDivElement>) => {
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
		<Stack spacing={0.2}>
			{/* Label */}
			<Typography variant="body1" component="label" className="font-medium">
				{field.label}
				{field.isRequired && <span className="text-error ml-0.5">*</span>}
			</Typography>

			{/* Hidden file input */}
			<input
				ref={inputRef}
				type="file"
				accept={accept}
				multiple={false}
				disabled={field.isReadOnly}
				style={{ display: "none" }}
				onChange={handleFileChange}
				onBlur={() => setTouched(true)}
			/>

			{/* Drop zone or preview */}
			{previewSrc ? (
				<Box
					className="p-4 relative w-full max-w-[320px] rounded-lg overflow-hidden border border-divider"
					style={{
						opacity: field.isReadOnly ? 0.7 : 1,
						pointerEvents: field.isReadOnly ? "none" : undefined,
					}}
				>
					{!field.isReadOnly && (
						<IconButton
							onClick={handleRemove}
							size="small"
							color="error"
							className="!absolute !top-1 !right-1"
							aria-label="Remove image"
						>
							<Unicon name="CloseOutlined" size={20} />
						</IconButton>
					)}
					<Box className="relative w-full h-60">
						<img
							src={previewSrc ?? ""}
							alt="Uploaded preview"
							style={{
								display: "block",
								width: "100%",
								height: "100%",
								objectFit: "contain",
							}}
							onError={(e) => {
								console.error(
									"[FormImageField] Failed to load image:",
									previewSrc,
									e,
								);
							}}
							onLoad={() => {
								console.log(
									"[FormImageField] Image loaded successfully:",
									previewSrc,
								);
							}}
						/>
					</Box>
				</Box>
			) : field.isReadOnly ? (
				<Box className="flex flex-col items-center justify-center gap-1 w-full max-w-[320px] min-h-[160px] border-2 border-dashed rounded-lg opacity-60">
					<Unicon
						name="CloudUploadOutlined"
						size={40}
						className="!text-text-secondary"
					/>
					<Typography
						variant="body2"
						color="text.secondary"
						className="text-center"
					>
						No image uploaded
					</Typography>
				</Box>
			) : (
				<Box
					onClick={handleClick}
					onDragOver={handleDragOver}
					onDragLeave={handleDragLeave}
					onDrop={handleDrop}
					className="flex flex-col items-center justify-center gap-1 w-full max-w-[320px] min-h-[160px] border-2 border-dashed rounded-lg cursor-pointer transition-[border-color,background-color] duration-200"
					style={{
						borderColor: dragOver
							? "var(--mui-palette-primary-main)"
							: undefined,
						backgroundColor: dragOver
							? "var(--mui-palette-action-hover)"
							: undefined,
					}}
				>
					<Unicon
						name="CloudUploadOutlined"
						size={40}
						className="!text-text-secondary"
					/>
					<Typography
						variant="body2"
						color="text.secondary"
						className="text-center"
					>
						{uploading
							? "Uploading…"
							: "Drag & drop an image here, or click to browse"}
					</Typography>
					<Typography variant="caption" color="text.disabled">
						Accepted: {accept} &middot; Max: {formatFileSize(maxSize)}
					</Typography>
				</Box>
			)}

			{/* Error message */}
			{error && (
				<Typography variant="caption" color="error">
					{error}
				</Typography>
			)}

			{/* Description */}
			{field.fieldOverrides?.description ? (
				<Typography variant="caption" color="text.secondary">
					{field.fieldOverrides.description}
				</Typography>
			) : null}
		</Stack>
	);
}
