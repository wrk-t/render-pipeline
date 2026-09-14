// ═══════════════════════════════════════════════════════════════
// FormMapPickerField – Mapbox map picker.
//
// Click the map (or drag the marker) to set a point. The component
// writes TWO form values: `latField` (defaults to the field's own
// name) and `lngField` (defaults to "longitude").
//
// The access token / style come from `behavior` overrides, then the
// backend map config (`GET /api/v1/public/config/maps`), then
// `NEXT_PUBLIC_MAPBOX_TOKEN`.
// ═══════════════════════════════════════════════════════════════
"use client";

import { Box, Stack, Typography } from "@mui/material";
import { useField, useFormikContext } from "formik";
import type { Map as MapboxMap, Marker as MapboxMarker } from "mapbox-gl";
import { type ReactElement, useEffect, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import { getApiClient } from "../../deps";
import type { MapField } from "../types";

const DEFAULT_STYLE = "mapbox://styles/mapbox/streets-v12";
// Tehran — a sensible fallback when the record has no coordinates yet.
const DEFAULT_CENTER: [number, number] = [51.389, 35.6892];
const DEFAULT_ZOOM = 12;
const POINT_ZOOM = 15;

interface MapRuntimeConfig {
	accessToken?: string | null;
	styleUrl?: string | null;
	tilesUrl?: string | null;
}

let cachedMapConfig: MapRuntimeConfig | null = null;

async function loadMapConfig(): Promise<MapRuntimeConfig> {
	if (cachedMapConfig) return cachedMapConfig;
	try {
		const base = process.env.NEXT_PUBLIC_ENDPOINT ?? "";
		const res = await getApiClient().get(`${base}/api/v1/public/config/maps`);
		cachedMapConfig = (res.data?.data ?? {}) as MapRuntimeConfig;
	} catch {
		cachedMapConfig = {};
	}
	return cachedMapConfig;
}

function toNum(value: unknown): number | null {
	if (value === null || value === undefined || value === "") return null;
	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

function round6(n: number): number {
	return Math.round(n * 1e6) / 1e6;
}

export function FormMapPickerField({
	field,
}: {
	field: MapField;
}): ReactElement {
	const [{ value: latRaw }] = useField<number | string | null>(field.name);
	const { values, setFieldValue } = useFormikContext<Record<string, unknown>>();

	const behavior = ((field.fieldOverrides as { behavior?: unknown } | null)
		?.behavior ?? {}) as {
		latField?: string;
		lngField?: string;
		styleUrl?: string;
		accessToken?: string;
		zoom?: number;
	};
	const latField = behavior.latField ?? field.name;
	const lngField = behavior.lngField ?? "longitude";

	const lat = toNum(latRaw);
	const lng = toNum(values[lngField]);

	const containerRef = useRef<HTMLDivElement | null>(null);
	const mapRef = useRef<MapboxMap | null>(null);
	const markerRef = useRef<MapboxMarker | null>(null);
	const [error, setError] = useState<string | null>(null);

	// ── Init the map once ──────────────────────────────────────
	// biome-ignore lint/correctness/useExhaustiveDependencies: init-once
	useEffect(() => {
		let disposed = false;
		(async () => {
			const cfg = await loadMapConfig();
			const token =
				behavior.accessToken ??
				cfg.accessToken ??
				process.env.NEXT_PUBLIC_MAPBOX_TOKEN ??
				null;
			if (!token) {
				setError("Map is not configured (no access token).");
				return;
			}
			if (disposed || !containerRef.current || mapRef.current) return;

			const mapboxgl = (await import("mapbox-gl")).default;
			if (disposed || !containerRef.current || mapRef.current) return;

			const hasPoint = lat !== null && lng !== null;
			const center: [number, number] = hasPoint
				? [lng as number, lat as number]
				: DEFAULT_CENTER;

			const map = new mapboxgl.Map({
				container: containerRef.current,
				style: behavior.styleUrl ?? cfg.styleUrl ?? DEFAULT_STYLE,
				center,
				zoom: hasPoint ? (behavior.zoom ?? POINT_ZOOM) : DEFAULT_ZOOM,
				accessToken: token,
				interactive: !field.isReadOnly,
			});
			mapRef.current = map;

			const marker = new mapboxgl.Marker({
				draggable: !field.isReadOnly,
				color: "#7c3aed",
			})
				.setLngLat(center)
				.addTo(map);
			markerRef.current = marker;

			const applyPoint = (la: number, ln: number) => {
				void setFieldValue(latField, round6(la));
				void setFieldValue(lngField, round6(ln));
			};

			map.on("click", (e) => {
				if (field.isReadOnly) return;
				marker.setLngLat(e.lngLat);
				applyPoint(e.lngLat.lat, e.lngLat.lng);
			});
			marker.on("dragend", () => {
				const ll = marker.getLngLat();
				applyPoint(ll.lat, ll.lng);
			});

			// No stored point yet — seed the default so the form always
			// submits coordinates (the backend defaults the city/country).
			if (!hasPoint && !field.isReadOnly) {
				applyPoint(DEFAULT_CENTER[1], DEFAULT_CENTER[0]);
			}
		})();

		return () => {
			disposed = true;
			markerRef.current?.remove();
			markerRef.current = null;
			mapRef.current?.remove();
			mapRef.current = null;
		};
	}, []);

	// ── Keep the marker in sync when the form value changes ────
	useEffect(() => {
		const marker = markerRef.current;
		if (!marker || lat === null || lng === null) return;
		const cur = marker.getLngLat();
		if (Math.abs(cur.lat - lat) > 1e-6 || Math.abs(cur.lng - lng) > 1e-6) {
			marker.setLngLat([lng, lat]);
		}
	}, [lat, lng]);

	return (
		<Stack spacing={0.5}>
			<Typography variant="body1" component="label" className="font-medium">
				{field.label}
				{field.isRequired && <span className="text-error ml-0.5">*</span>}
			</Typography>

			<Box
				ref={containerRef}
				sx={{
					width: "100%",
					height: 320,
					borderRadius: 1,
					overflow: "hidden",
					border: "1px solid",
					borderColor: "divider",
					bgcolor: "action.hover",
				}}
			/>

			<Typography variant="caption" color="text.secondary">
				{lat !== null && lng !== null
					? `${lat.toFixed(6)}, ${lng.toFixed(6)}`
					: "Click the map to set the location."}
			</Typography>

			{error && (
				<Typography variant="caption" color="error">
					{error}
				</Typography>
			)}
		</Stack>
	);
}
