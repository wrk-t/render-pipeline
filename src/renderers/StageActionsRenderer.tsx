"use client";

import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
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

const STAGE_COLORS: Record<
	string,
	"default" | "warning" | "success" | "error"
> = {
	draft: "warning",
	published: "success",
	deprecated: "error",
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
		<Typography variant="caption" color="text.secondary">
			{version.releaseDate && `Released: ${formatDate(version.releaseDate)}`}
			{version.releaseDate && version.sunsetDate ? " · " : ""}
			{version.sunsetDate && `Sunset: ${formatDate(version.sunsetDate)}`}
		</Typography>
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
			<Stack direction="row" spacing={1} className="items-center">
				<CircularProgress size={16} />
			</Stack>
		);
	}

	if (!version) {
		return (
			<Typography variant="body2" color="text.secondary">
				No versions yet
			</Typography>
		);
	}

	return (
		<Stack spacing={1}>
			<Stack direction="row" spacing={1} className="items-center">
				<Typography variant="body2" color="text.secondary">
					{component.displayName || "Stage"}:
				</Typography>
				{version.version && (
					<Typography variant="body2" color="text.primary">
						{version.version}
					</Typography>
				)}
				<Chip
					label={stage}
					size="small"
					color={STAGE_COLORS[stage] ?? "default"}
				/>
				{nextAction && (
					<Button
						size="small"
						variant="outlined"
						color={nextAction.target === "published" ? "success" : "warning"}
						onClick={handleTransition}
						disabled={transitioning}
					>
						{transitioning ? <CircularProgress size={16} /> : nextAction.label}
					</Button>
				)}
				{error && (
					<Typography variant="caption" color="error">
						{error}
					</Typography>
				)}
			</Stack>
			<LifecycleDates version={version} />
		</Stack>
	);
}
