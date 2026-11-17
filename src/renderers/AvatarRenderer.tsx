"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import AvatarEditor from "react-avatar-editor";
import useSWR from "swr";
import { Unicon } from "../components/common/icon/Unicon";
import { BaseDialog } from "../components/dialog/BaseDialog";
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

export function AvatarRenderer({
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

	const isCircle = shape === "circle";
	const shapeClasses = isCircle
		? "h-24 w-24 rounded-full"
		: "h-24 w-32 rounded-md";

	// Fetch user data using the datasource from metadata
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

	const [editorOpen, setEditorOpen] = useState(false);
	const [image, setImage] = useState<File | string | null>(null);
	const [scale, setScale] = useState(1);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const editorRef = useRef<any>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const rawAvatarUrl = getNestedValue(data, avatarField) as
		| string
		| undefined
		| null;
	const avatarUrl = useMemo(() => resolveUrl(rawAvatarUrl), [rawAvatarUrl]);

	const handleFileChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (file) {
				setImage(file);
				setScale(1);
				setEditorOpen(true);
			}
			e.target.value = "";
		},
		[],
	);

	const handleSave = useCallback(async () => {
		if (!editorRef.current) return;
		const canvas = editorRef.current.getImageScaledToCanvas();
		const blob: Blob = await new Promise((resolve) =>
			canvas.toBlob((b: Blob | null) => resolve(b!), "image/jpeg", 0.9),
		);
		const formData = new FormData();
		formData.append(uploadFieldName, blob, "avatar.jpg");

		try {
			await getApiClient().post(uploadEndpoint, formData, {
				headers: { "Content-Type": "multipart/form-data" },
			});
			await mutate();
			setEditorOpen(false);
		} catch {
			// ignore
		}
	}, [uploadEndpoint, mutate, uploadFieldName]);

	const handleRemove = useCallback(async () => {
		await getApiClient().patch(removeEndpoint, { avatarUrl: null });
		await mutate();
	}, [removeEndpoint, mutate]);

	if (isLoading) {
		return (
			<div
				className={`${shapeClasses} flex items-center justify-center bg-muted`}
			>
				<span
					role="status"
					aria-label="Loading"
					className="size-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary"
				/>
			</div>
		);
	}

	if (!data) {
		return (
			<div
				className={`${shapeClasses} flex items-center justify-center bg-muted`}
			>
				<Unicon name={isCircle ? "User" : "Upload"} size={40} />
			</div>
		);
	}

	return (
		<div className="flex flex-col items-center gap-2">
			<div className="relative">
				<button
					type="button"
					aria-label={avatarUrl ? "Change avatar" : "Upload avatar"}
					className={`${shapeClasses} relative flex cursor-pointer items-center justify-center overflow-hidden border border-border bg-muted transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background`}
					onClick={() => fileInputRef.current?.click()}
				>
					{avatarUrl ? (
						<img
							src={avatarUrl}
							alt="Avatar"
							className={
								isCircle ? "h-24 w-24 object-cover" : "h-24 w-32 object-contain"
							}
						/>
					) : (
						<Unicon name={isCircle ? "User" : "Upload"} size={40} />
					)}
				</button>
				<input
					ref={fileInputRef}
					type="file"
					accept="image/*"
					className="hidden"
					onChange={handleFileChange}
				/>
			</div>
			{removable &&
				(rawAvatarUrl ? (
					<button
						type="button"
						onClick={handleRemove}
						className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
					>
						Remove
					</button>
				) : (
					<button
						type="button"
						onClick={() => fileInputRef.current?.click()}
						className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
					>
						Add Photo
					</button>
				))}

			{editorOpen && image && (
				<BaseDialog
					isOpen
					title="Edit Avatar"
					onClose={() => setEditorOpen(false)}
					onSubmit={handleSave}
					slotProps={{ submitButton: { props: { children: "Save" } } }}
				>
					<div className="flex flex-col items-center gap-4">
						<AvatarEditor
							ref={editorRef}
							image={image}
							width={250}
							height={250}
							border={25}
							borderRadius={isCircle ? 125 : 12}
							scale={scale}
							rotate={0}
						/>
						<label className="w-full px-4">
							<span className="block text-start text-sm font-medium text-foreground">
								Zoom
							</span>
							<input
								type="range"
								min={1}
								max={3}
								step={0.1}
								value={scale}
								onChange={(e) => setScale(Number(e.target.value))}
								className="mt-1 w-full accent-primary"
							/>
						</label>
					</div>
				</BaseDialog>
			)}
		</div>
	);
}
