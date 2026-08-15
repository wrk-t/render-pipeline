// ═══════════════════════════════════════════════════════════════
// LogoUploaderRenderer – Renders a brand-logo uploader (blueprint
// "logo-uploader").
//
// Based on AvatarRenderer, but without the crop/edit step: picking
// a file uploads it immediately (multipart POST to uploadEndpoint).
// Also renders `component.displayName` as the section title.
//
// config:
//   datasource:     { endpoint }          → GET current logo value
//   uploadEndpoint: multipart upload URL   → POST { uploadFieldName: file }
//   avatarField:    dot-path to the logo value in the datasource response
//   uploadFieldName: multipart field name (default "file")
//   shape:          "circle" | "square"
//   removable:      whether the remove action is available
// ═══════════════════════════════════════════════════════════════
"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useCallback, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { Unicon } from "../components/common/icon/Unicon";
import { getApiClient } from "../deps";
import { useResolvedParams } from "../hooks/useResolvedParams";
import { resolveUrlTemplate } from "../query-builder";
import type { RenderedComponent } from "../types";

/**
 * Get a nested value from an object using a dot-path string.
 * e.g. getNestedValue(obj, "user.profile.avatarUrl")
 */
function getNestedValue(obj: any, path: string): any {
	return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

/**
 * Resolve a relative URL (starting with /) to an absolute URL
 * using the backend base URL.
 */
function resolveUrl(url: string | undefined | null): string | undefined {
	if (!url) return undefined;
	if (
		url.startsWith("http://") ||
		url.startsWith("https://") ||
		url.startsWith("data:")
	) {
		return url;
	}
	const base =
		(getApiClient().defaults.baseURL as string) ??
		process.env.NEXT_PUBLIC_ENDPOINT ??
		"";
	// Join with exactly one slash — stored paths may lack the leading "/".
	return `${base.replace(/\/$/, "")}/${url.replace(/^\//, "")}`;
}

export function LogoUploaderRenderer({
	component,
	pathParams,
}: {
	component: RenderedComponent;
	pathParams?: Record<string, string>;
}) {
	const config = (component.config ?? {}) as Record<string, any>;
	const resolvedParams = useResolvedParams(pathParams);

	// Read endpoints from metadata config
	const datasourceEndpoint: string = resolveUrlTemplate(
		config?.datasource?.endpoint ?? "/api/v1/users/me",
		resolvedParams,
	);
	const uploadEndpoint: string = resolveUrlTemplate(
		config?.uploadEndpoint ?? "/api/v1/user-profiles/me/avatar",
		resolvedParams,
	);
	const removeEndpoint: string = resolveUrlTemplate(
		config?.removeEndpoint ?? "/api/v1/user-profiles/me",
		resolvedParams,
	);
	const avatarField: string = config?.avatarField ?? "user.profile.avatarUrl";
	// Multipart field name the upload endpoint expects ("file" for avatars,
	// "logo" for tenant branding).
	const uploadFieldName: string = config?.uploadFieldName ?? "file";
	// "circle" (avatar) or "square" (e.g. brand logo).
	const shape: "circle" | "square" = config?.shape ?? "circle";
	// Whether the remove action is available (no remove endpoint → false).
	const removable: boolean = config?.removable ?? true;
	// Section title rendered above the uploader (e.g. "$trl_brand_logo").
	const title =
		typeof component.displayName === "string"
			? component.displayName.replace(/^\$trl_/, "")
			: "";

	const isCircle = shape === "circle";

	// Fetch current logo from the datasource
	const { data, mutate, isLoading } = useSWR(
		datasourceEndpoint,
		async (url: string) => {
			try {
				const r = await getApiClient().get(url);
				return r.data?.data ?? r.data ?? null;
			} catch {
				return null;
			}
		},
	);

	const [uploading, setUploading] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const rawLogoUrl = getNestedValue(data, avatarField) as
		| string
		| undefined
		| null;
	const logoUrl = useMemo(() => resolveUrl(rawLogoUrl), [rawLogoUrl]);

	// Picking a file uploads it immediately — no crop/edit step.
	const handleFileChange = useCallback(
		async (e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			e.target.value = "";
			if (!file) return;

			setUploading(true);
			try {
				const formData = new FormData();
				formData.append(uploadFieldName, file, file.name);
				await getApiClient().post(uploadEndpoint, formData, {
					headers: { "Content-Type": "multipart/form-data" },
				});
				await mutate();
			} catch {
				// ignore
			} finally {
				setUploading(false);
			}
		},
		[uploadEndpoint, mutate, uploadFieldName],
	);

	const handleRemove = useCallback(async () => {
		await getApiClient().patch(removeEndpoint, { avatarUrl: null });
		await mutate();
	}, [removeEndpoint, mutate]);

	const boxClass = `${isCircle ? "w-24 h-24 rounded-full" : "w-32 h-24 rounded-[10px]"} bg-gray-200 flex items-center justify-center`;

	return (
		<Stack spacing={1}>
			{title && (
				<Typography variant="subtitle1" className="font-semibold">
					{title}
				</Typography>
			)}

			{isLoading || uploading ? (
				<Box className={`${boxClass} overflow-hidden border-2 border-gray-300`}>
					<CircularProgress size={24} />
				</Box>
			) : (
				<Stack spacing={1} className="items-start">
					<Box className="relative">
						<Box
							className={`${boxClass} overflow-hidden border-2 border-gray-300 cursor-pointer hover:border-primary-main transition-colors`}
							onClick={() => fileInputRef.current?.click()}
						>
							{logoUrl ? (
								<img
									src={logoUrl}
									alt="Logo"
									className={`${isCircle ? "w-24 h-24 object-cover" : "w-32 h-24 object-contain"}`}
								/>
							) : (
								<Unicon name="Upload" size={40} />
							)}
						</Box>
						<input
							ref={fileInputRef}
							type="file"
							accept="image/*"
							className="hidden"
							onChange={handleFileChange}
						/>
					</Box>
					{removable && logoUrl ? (
						<Button
							size="small"
							variant="text"
							color="error"
							onClick={handleRemove}
						>
							Remove
						</Button>
					) : null}
				</Stack>
			)}
		</Stack>
	);
}
