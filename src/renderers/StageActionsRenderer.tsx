"use client";

import {
	type ReactElement,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import useSWR from "swr";
import { getApiClient } from "../deps";
import type { RenderedComponent } from "../types";
import { useVersion, type VersionInfo } from "./VersionContext";

const STAGE_BADGE: Record<string, string> = {
	draft: "border-warning-main/50 bg-warning-main/10 text-warning-main",
	published: "border-success-main/50 bg-success-main/10 text-success-main",
	deprecated: "border-error-main/50 bg-error-main/10 text-error-main",
};

const NEXT_STAGE: Record<string, { label: string; target: string } | null> = {
	draft: { label: "Publish", target: "published" },
	published: { label: "Deprecate", target: "deprecated" },
	deprecated: null,
};

/** Format an ISO date as YYYY-MM-DD (or return "—" when missing). */
function formatDate(value: string | null | undefined): string {
	if (!value) return "—";
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return value;
	return d.toISOString().slice(0, 10);
}

/** Raw version row as returned by the by-package endpoint. */
interface RawVersion {
	id?: string;
	version?: string;
	name?: string;
	stage?: string;
	releaseDate?: string | null;
	sunsetDate?: string | null;
}

/** Extract the version list from the by-package response envelope. */
function extractList(payload: unknown): unknown {
	if (Array.isArray(payload)) return payload;
	if (payload && typeof payload === "object" && "data" in payload) {
		return payload.data;
	}
	return [];
}

function toVersions(payload: unknown): VersionInfo[] {
	const list = extractList(payload);
	if (!Array.isArray(list)) return [];
	return (list as RawVersion[])
		.filter((v) => v?.id)
		.map((v) => ({
			id: v.id as string,
			version: v.version ?? v.name ?? "",
			stage: (v.stage ?? "draft") as VersionInfo["stage"],
			releaseDate: v.releaseDate ?? null,
			sunsetDate: v.sunsetDate ?? null,
		}));
}

/**
 * Renders the current version stage badge + a transition button
 * inside a ScreenLayout page body slot.
 *
 * The selected version normally comes from the version tabs (which only
 * render when `package_versioning` is enabled). When the tabs are hidden
 * (versioning off, staging on) or the user lands directly on the page,
 * the current version is resolved from the package's own version list
 * (`/api/v1/package-versions/by-package/:id`) and defaulted to the first.
 *
 * Blueprint: "stage-actions"
 */
/**
 * Resolve the package's current version, preferring the version selected
 * by the version tabs when it belongs to this package (the VersionContext
 * is app-wide, so a stale selection from a previous package is ignored).
 */
function usePackageVersion(packageId?: string) {
	const { selected, setSelected } = useVersion();

	const { data: fetched, isLoading } = useSWR(
		packageId ? `/api/v1/package-versions/by-package/${packageId}` : null,
		async (url: string) => {
			const res = await getApiClient().get(url);
			return toVersions(res.data?.data ?? res.data);
		},
	);

	const fetchedVersions: VersionInfo[] = useMemo(
		() => (fetched ?? []).filter((v) => v.id),
		[fetched],
	);

	const version = useMemo(() => {
		if (selected && fetchedVersions.some((v) => v.id === selected.id)) {
			return selected;
		}
		return fetchedVersions[0] ?? null;
	}, [selected, fetchedVersions]);

	// Seed the app-wide context so the rest of the page (e.g. `versionId`
	// path param) sees a valid version for this package.
	useEffect(() => {
		if (fetchedVersions.length === 0) return;
		const currentIsValid =
			selected && fetchedVersions.some((v) => v.id === selected.id);
		if (!currentIsValid) {
			setSelected(fetchedVersions[0]);
		}
	}, [fetchedVersions, selected, setSelected]);

	return { version, isLoading };
}

/**
 * Resolve a single version by id (version-scoped detail pages where the
 * route already carries `versionId` — e.g. /packages/:id/version/:versionId).
 */
function useVersionById(versionId?: string) {
	const { data: version, isLoading } = useSWR(
		versionId ? `/api/v1/package-versions/${versionId}` : null,
		async (url: string) => {
			const res = await getApiClient().get(url);
			return toVersions([res.data?.data ?? res.data])[0] ?? null;
		},
	);
	return { version, isLoading };
}

/** Release/sunset date line shown under the stage bar. */
function LifecycleDates({
	version,
}: {
	version: VersionInfo;
}): ReactElement | null {
	if (!(version.releaseDate || version.sunsetDate)) return null;
	return (
		<p className="text-start text-xs text-muted-foreground">
			{version.releaseDate && `Released: ${formatDate(version.releaseDate)}`}
			{version.releaseDate && version.sunsetDate ? " · " : ""}
			{version.sunsetDate && `Sunset: ${formatDate(version.sunsetDate)}`}
		</p>
	);
}

export function StageActionsRenderer({
	component,
	pathParams,
}: {
	component: RenderedComponent;
	pathParams?: Record<string, string>;
}): ReactElement {
	const [transitioning, setTransitioning] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const packageId = pathParams?.id ?? pathParams?.packageId;
	const versionId = pathParams?.versionId;
	const { version: byIdVersion, isLoading: versionLoading } =
		useVersionById(versionId);
	const { version: byPackageVersion, isLoading: packageLoading } =
		usePackageVersion(versionId ? undefined : packageId);

	const version = byIdVersion ?? byPackageVersion;
	const isLoading = versionLoading || packageLoading;

	const stage = version?.stage ?? "published";
	const nextAction = NEXT_STAGE[stage];

	const handleTransition = useCallback(async () => {
		if (!(version?.id && nextAction)) return;
		setTransitioning(true);
		setError(null);
		try {
			await getApiClient().post(
				`/api/v1/package-versions/${version.id}/transition`,
				{ stage: nextAction.target },
			);
			// Refresh the page to reflect new stage
			window.location.reload();
		} catch (e) {
			const errorData = e as {
				response?: { data?: { message?: string } };
				message?: string;
			};
			setError(
				errorData?.response?.data?.message ??
					errorData?.message ??
					"Transition failed",
			);
		} finally {
			setTransitioning(false);
		}
	}, [version, nextAction]);

	if (isLoading) {
		return (
			<div className="flex items-center gap-2">
				<span
					role="status"
					aria-label="Loading"
					className="inline-block size-4 animate-spin rounded-full border-2 border-muted border-t-primary"
				/>
			</div>
		);
	}

	if (!version) {
		return (
			<p className="text-start text-sm text-muted-foreground">
				No versions yet
			</p>
		);
	}

	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-wrap items-center gap-2">
				<span className="text-sm text-muted-foreground">
					{component.displayName || "Stage"}:
				</span>
				{version.version && (
					<span className="text-sm text-foreground">{version.version}</span>
				)}
				<span
					className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
						STAGE_BADGE[stage] ?? "border-border text-muted-foreground"
					}`}
				>
					{stage}
				</span>
				{nextAction && (
					<button
						type="button"
						onClick={handleTransition}
						disabled={transitioning}
						className={`inline-flex min-w-16 items-center justify-center gap-2 whitespace-nowrap rounded-lg border px-3 py-1 text-sm font-medium uppercase tracking-[0.02857em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
							nextAction.target === "published"
								? "border-success-main/50 text-success-main hover:border-success-main hover:bg-success-main/5"
								: "border-warning-main/50 text-warning-main hover:border-warning-main hover:bg-warning-main/5"
						}`}
					>
						{transitioning ? (
							<span
								role="status"
								aria-label="Loading"
								className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
							/>
						) : (
							nextAction.label
						)}
					</button>
				)}
				{error && (
					<span role="alert" className="text-xs text-error-main">
						{error}
					</span>
				)}
			</div>
			<LifecycleDates version={version} />
		</div>
	);
}
