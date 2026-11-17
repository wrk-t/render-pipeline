"use client";

import { type ReactElement, useMemo } from "react";
import useSWR from "swr";
import { ComponentRenderer } from "../ComponentRenderer";
import { getApiClient } from "../deps";
import { formatDate, toDate } from "../formatting/date";
import {
	formatMoney,
	formatNumber,
	resolveMoneyCurrency,
} from "../formatting/money";
import { resolveReference } from "../formatting/reference";
import { useFeatures } from "../hooks/useFeatures";
import { useTenantCurrency } from "../hooks/useTenantCurrency";
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
 * Same formatters as the table cells: select/multiselect options turn
 * stored values into their labels (weekdays become names), dates use the
 * app locale, money uses the row's or the tenant's currency, a relation
 * object shows its label instead of a JSON dump (and never a CUID), and
 * long text stays readable.
 */
function formatInfoValue(
	el: RenderedElement,
	value: unknown,
	context: { tenantCurrency: string; record: Record<string, unknown> | null },
): { text: string; multiline: boolean } {
	const overrides = (el.overrides ?? {}) as Record<string, any>;
	const format = (overrides.format ?? {}) as {
		type?: string;
		props?: Record<string, any>;
	};
	const formatProps = (format.props ?? {}) as Record<string, any>;
	const formatType = format.type ?? el.type ?? undefined;

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
		const referenceList = el.type === "reference" || formatType === "reference";
		const referenceProps = {
			...formatProps,
			options: formatProps.options ?? options,
		};
		const text =
			value.length > 0
				? value
						.map((item) => {
							// A list of relations must read as names, not
							// "[object Object]" or a list of ids.
							if (referenceList) {
								return resolveReference(item, referenceProps).label ?? "—";
							}
							if (item && typeof item === "object") {
								return (
									resolveReference(item, referenceProps).label ??
									JSON.stringify(item)
								);
							}
							return labelFor(item);
						})
						.join(", ")
				: "—";
		return { text, multiline: false };
	}

	if (typeof value === "boolean") {
		return { text: value ? "Yes" : "No", multiline: false };
	}

	// A relation object (an expanded join) renders its label, not JSON.
	if (typeof value === "object" && value !== null) {
		const object = value as Record<string, unknown>;
		const isReference =
			el.type === "reference" ||
			formatType === "reference" ||
			("id" in object && "displayName" in object);
		if (isReference) {
			const resolved = resolveReference(value, {
				...formatProps,
				options: formatProps.options ?? options,
			});
			return { text: resolved.label ?? "—", multiline: false };
		}
		return { text: JSON.stringify(value, null, 2), multiline: true };
	}

	// Money is read with the same currency resolution as a money cell — a
	// stored numeric string keeps its grouping and currency symbol.
	if (formatType === "money" || el.type === "money") {
		const currency = resolveMoneyCurrency(
			formatProps,
			context.record,
			context.tenantCurrency,
		);
		const text = formatMoney(value, { ...formatProps, currency });
		if (text) return { text, multiline: false };
	}

	if (typeof value === "string") {
		// Date / date-time fields, and ISO strings that are visibly timestamps.
		const isDateField =
			el.type === "date" ||
			el.type === "datetime" ||
			formatType === "date" ||
			formatType === "datetime";
		const isIsoDate = /^\d{4}-\d{2}-\d{2}(T|$)/.test(value);
		if (value.trim() && (isDateField || isIsoDate)) {
			const parsed = toDate(value);
			if (parsed) {
				return {
					text:
						formatDate(parsed, {
							locale: formatProps.locale,
							timeZone: formatProps.timeZone,
							calendar: formatProps.calendar,
							showTime:
								formatProps.showTime ??
								(el.type === "datetime" ||
									formatType === "datetime" ||
									value.includes("T")),
						}) || value,
					multiline: false,
				};
			}
		}

		if (el.type === "reference" || formatType === "reference") {
			const resolved = resolveReference(value, {
				...formatProps,
				options: formatProps.options ?? options,
			});
			return { text: resolved.label ?? "—", multiline: false };
		}

		return {
			text: value,
			multiline: value.includes("\n") || value.length > 120,
		};
	}

	if (typeof value === "number") {
		if (formatType === "money") {
			return {
				text: formatMoney(value, {
					...formatProps,
					currency: resolveMoneyCurrency(
						formatProps,
						context.record,
						context.tenantCurrency,
					),
				}),
				multiline: false,
			};
		}
		if (el.type === "number" || formatType === "number") {
			return {
				text: formatNumber(value, { locale: formatProps.locale }),
				multiline: false,
			};
		}
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

	// Walk content elements
	const contentElements = (component.slotsFilled["content"] ?? [])
		.filter((e) => e.isActive)
		.sort((a, b) => a.displayOrder - b.displayOrder);

	// Only a block that shows a money field needs the tenant currency.
	const showsMoney = contentElements.some((el) => {
		const overrides = (el.overrides ?? {}) as Record<string, any>;
		return overrides.format?.type === "money" || el.type === "money";
	});
	const tenantCurrency = useTenantCurrency(showsMoney);

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

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-8">
				<span
					role="status"
					aria-label="Loading"
					className="h-10 w-10 animate-spin rounded-full border-2 border-muted border-t-primary"
				/>
			</div>
		);
	}

	if (error || !recordData) {
		return <p className="text-sm text-error-main">Failed to load data.</p>;
	}

	return (
		<div className="rounded-lg border border-border bg-card p-6">
			{component.displayName && (
				<div className="mb-5">
					<h2 className="text-start text-xl font-semibold text-foreground">
						{component.displayName}
					</h2>
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
					const formatted = formatInfoValue(el, value, {
						tenantCurrency,
						record:
							rootData && typeof rootData === "object"
								? (rootData as Record<string, unknown>)
								: null,
					});
					// Multi-line values (body, rule JSON) get the full row — a
					// message body squeezed into one third of the page is unreadable.
					const fullWidth = formatted.multiline || colSpan >= 12;

					return (
						<div
							key={el.id}
							className={`flex flex-col gap-1${
								fullWidth ? " col-span-full" : ""
							}`}
						>
							<span className="block text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">
								{displayName}
							</span>
							<p
								className={`text-start text-base text-foreground${
									formatted.multiline
										? " whitespace-pre-wrap break-words"
										: " break-words"
								}`}
							>
								{formatted.text}
							</p>
						</div>
					);
				})}
			</div>
		</div>
	);
}
