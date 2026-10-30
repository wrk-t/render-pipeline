"use client";

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { type ReactElement, useMemo } from "react";
import useSWR from "swr";
import { ComponentRenderer } from "../ComponentRenderer";
import { getApiClient } from "../deps";
import { useFeatures } from "../hooks/useFeatures";
import type { RenderedComponent, RenderedElement } from "../types";
import { isFieldFeatureVisible } from "./FormFieldRenderer";

function getNestedValue(obj: any, path: string): any {
	return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

/** Human ISO weekday names, used when a detail block shows `schedule.weekdays`. */
const ISO_WEEKDAY_LABELS = [
	"",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
	"Sunday",
];

/**
 * The value a detail field should read, formatted for a human.
 *
 * The old block printed `String(value)`, so a weekly schedule read
 * `1,2,3` and an ISO timestamp read `2026-10-26T13:02:19.000Z`. Here:
 * static select/multiselect options turn stored values into their labels
 * (weekdays become names), dates are formatted, booleans become Yes/No,
 * and long text stays readable.
 */
function formatInfoValue(
	el: RenderedElement,
	value: unknown,
): { text: string; multiline: boolean } {
	const overrides = (el.overrides ?? {}) as Record<string, any>;

	if (value === null || value === undefined || value === "") {
		return { text: "—", multiline: false };
	}

	const options: Array<{ label: string; value: unknown }> =
		overrides.datasource?.type === "static"
			? (overrides.datasource.options ?? [])
			: (overrides.options ?? []);

	const labelFor = (raw: unknown): string => {
		const option = options.find(
			(candidate) => String(candidate.value) === String(raw),
		);
		if (option) return option.label;
		if (overrides.format?.props?.labelMap) {
			const mapped = overrides.format.props.labelMap[String(raw)];
			if (mapped) return mapped;
		}
		// A weekday list is stored as ISO numbers (Mon = 1 … Sun = 7); without
		// an explicit options list it still reads as a name, not "1,2".
		if (Array.isArray(value) && /weekday/i.test(el.name ?? "")) {
			const day = ISO_WEEKDAY_LABELS[Number(raw)];
			if (day) return day;
		}
		return String(raw);
	};

	if (Array.isArray(value)) {
		return {
			text: value.length > 0 ? value.map(labelFor).join(", ") : "—",
			multiline: false,
		};
	}

	if (typeof value === "boolean") {
		return { text: value ? "Yes" : "No", multiline: false };
	}

	if (typeof value === "string") {
		// Date / date-time fields, and ISO strings that are visibly timestamps.
		const isDateField = el.type === "date" || el.type === "datetime";
		const isIsoDate = /^\d{4}-\d{2}-\d{2}(T|$)/.test(value);
		if (value.trim() && (isDateField || isIsoDate)) {
			const parsed = new Date(value);
			if (!Number.isNaN(parsed.getTime())) {
				try {
					return {
						text: new Intl.DateTimeFormat("en-GB", {
							dateStyle: "medium",
							...(value.includes("T") ? { timeStyle: "short" } : {}),
						}).format(parsed),
						multiline: false,
					};
				} catch {
					/* fall through to the raw value */
				}
			}
		}
		return {
			text: value,
			multiline: value.includes("\n") || value.length > 120,
		};
	}

	if (typeof value === "object") {
		return { text: JSON.stringify(value, null, 2), multiline: true };
	}

	return { text: String(value), multiline: false };
}

/**
 * InfoRenderer — a read-only record summary (a detail page's state block).
 *
 * A responsive definition grid instead of one cramped row: labels above their
 * values, generous gaps, and long text (a message body, a rule) on its own full
 * width. That is what makes the run/log detail pages readable.
 */
export function InfoRenderer({
	component,
	pathParams,
}: {
	component: RenderedComponent;
	pathParams?: Record<string, string>;
}): ReactElement {
	const config = (component.config ?? {}) as Record<string, any>;
	const datasource = config?.datasource;
	const dataRoot: string = config?.dataRoot ?? "";
	const { features } = useFeatures();

	const endpoint = useMemo(() => {
		if (!datasource?.endpoint) return null;
		return datasource.endpoint.replace(
			/\{(\w+)\}/g,
			(_: string, key: string) =>
				pathParams && key in pathParams ? String(pathParams[key]) : `{${key}}`,
		);
	}, [datasource?.endpoint, pathParams]);

	const {
		data: recordData,
		isLoading,
		error,
	} = useSWR(endpoint, async (url: string) => {
		const r = await getApiClient().get(url);
		return r.data?.data ?? r.data ?? null;
	});

	// Resolve the root object for field lookups
	const rootData = dataRoot ? getNestedValue(recordData, dataRoot) : recordData;

	// Walk content elements
	const contentElements = (component.slotsFilled["content"] ?? [])
		.filter((e) => e.isActive)
		.sort((a, b) => a.displayOrder - b.displayOrder);

	if (isLoading) {
		return (
			<Box className="flex items-center justify-center py-8">
				<CircularProgress />
			</Box>
		);
	}

	if (error || !recordData) {
		return (
			<Typography variant="body2" color="error">
				Failed to load data.
			</Typography>
		);
	}

	return (
		<Box className="rounded-lg border border-solid border-gray-200 bg-white p-6">
			{component.displayName && (
				// The margin lives on a plain wrapper, not on the Typography:
				// MUI's own stylesheet sets `margin: 0` on every Typography, and
				// Tailwind v4 utilities sit in a cascade layer — an unlayered MUI
				// rule always wins, so `mb-5` on the Typography did nothing and the
				// title collided with the fields.
				<div className="mb-5">
					<Typography variant="h6" className="font-semibold">
						{component.displayName}
					</Typography>
				</div>
			)}
			<div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2 lg:grid-cols-3">
				{contentElements.map((el) => {
					if (el.elementType === "component_ref" && el.referencedComponent) {
						return (
							<div key={el.id} className="col-span-full">
								<ComponentRenderer
									component={el.referencedComponent}
									pathParams={pathParams}
									paramBindings={el.paramBindings}
								/>
							</div>
						);
					}
					if (el.elementType !== "field") return null;
					// Feature-gated fields never render (e.g. the MI selector
					// behind `multi_mi_instance`).
					if (!isFieldFeatureVisible(el.overrides, features)) return null;

					const name =
						(el.overrides as any)?.name ??
						el.name ??
						el.fieldDefinitionId ??
						"";
					const value = name ? getNestedValue(rootData, name) : undefined;
					const displayName =
						(el.overrides as any)?.displayName ?? el.label ?? name;
					const colSpan = (el.overrides as any)?.colSpan ?? 4;
					const formatted = formatInfoValue(el, value);
					// Multi-line values (body, rule JSON) get the full row — a
					// message body squeezed into one third of the page is unreadable.
					const fullWidth = formatted.multiline || colSpan >= 12;

					return (
						<div
							key={el.id}
							// The label→value gap is the cell's own flex gap: a Tailwind
							// margin on the value Typography would lose to MUI's reset,
							// exactly like the heading margin above.
							className={`flex flex-col gap-1${
								fullWidth ? " col-span-full" : ""
							}`}
						>
							<Typography
								variant="caption"
								className="block font-semibold uppercase tracking-wide text-gray-500"
							>
								{displayName}
							</Typography>
							<Typography
								variant="body1"
								className={
									formatted.multiline
										? "whitespace-pre-wrap break-words"
										: "break-words"
								}
							>
								{formatted.text}
							</Typography>
						</div>
					);
				})}
			</div>
		</Box>
	);
}
