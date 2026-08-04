// ═══════════════════════════════════════════════════════════════
// FormSelectField – Renders a select dropdown field.
//
// Supports both static options and service datasources (including
// resolved entity datasources). When a service datasource is
// present, options are fetched once on mount via SWR.
// ═══════════════════════════════════════════════════════════════
"use client";

import { MenuItem, Stack, Typography } from "@mui/material";
import { FastSelect } from "@smartpath/typed-formik-mui";
import type { ReactElement } from "react";
import useSWR from "swr";
import { getApiClient } from "../../deps";
import type {
	EntityMeta,
	FieldDatasource,
	SelectField,
	SelectOption,
} from "../types";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function toSelectOption(item: unknown, entityMeta?: EntityMeta): SelectOption {
	if (item === null || item === undefined) return { label: "", value: "" };
	const obj = item as Record<string, unknown>;
	if ("label" in obj && "value" in obj) {
		return { label: String(obj.label ?? ""), value: obj.value };
	}
	const displayField = entityMeta?.displayField;
	const valueField = entityMeta?.valueField ?? "id";
	return {
		label: String(
			obj[displayField ?? "displayName"] ??
				obj.displayName ??
				obj.name ??
				obj.label ??
				"",
		),
		value: obj[valueField] ?? obj.id ?? obj.value,
	};
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function FormSelectField({
	field,
}: {
	field: SelectField;
}): ReactElement {
	// ── Resolve datasource ─────────────────────────────────────
	const ds = field.fieldOverrides?.datasource as FieldDatasource | undefined;
	const isService = ds?.type === "service";
	const isStatic = ds?.type === "static";

	const serviceDs = isService
		? (ds as Extract<FieldDatasource, { type: "service" }>)
		: null;

	const staticOptions: SelectOption[] =
		isStatic && "options" in ds
			? (ds.options as SelectOption[])
			: (field.options ?? []);

	const entityMeta = serviceDs?.entityMeta;

	// ── Fetch service data once on mount ───────────────────────
	const { data: serviceData } = useSWR(
		serviceDs ? [serviceDs.endpoint, "selectOptions"] : null,
		async () => {
			if (!serviceDs) return [];
			const baseUrl = process.env.NEXT_PUBLIC_ENDPOINT ?? "";

			const params = new URLSearchParams();
			// Request a larger page size for select dropdowns (all options)
			params.set("limit", "1000");

			if (entityMeta?.filter) {
				// Filter params are passed directly (e.g. ?status=active),
				// matching the backend's filterableFields per entity.
				params.set(entityMeta.filter.field, String(entityMeta.filter.value));
			}
			if (entityMeta?.orderBy) {
				params.set("sortBy", entityMeta.orderBy.field);
				params.set("sortOrder", entityMeta.orderBy.direction);
			}

			const qs = params.toString();
			const url = `${baseUrl}${serviceDs.endpoint}${qs ? `?${qs}` : ""}`;

			const res = await getApiClient().request({
				url,
				method: serviceDs.method ?? "GET",
			});
			const body = res.data?.data;
			if (Array.isArray(body)) return body;
			if (body && Array.isArray(body.data)) return body.data;
			return [];
		},
	);

	// ── Build final options ────────────────────────────────────
	const options: SelectOption[] = serviceDs
		? Array.isArray(serviceData)
			? serviceData.map((item: unknown) => toSelectOption(item, entityMeta))
			: []
		: staticOptions;

	return (
		<Stack spacing={0.2}>
			<FastSelect
				name={field.name}
				label={field.label}
				required={field.isRequired}
				disabled={field.isReadOnly}
			>
				{options.map((opt) => (
					<MenuItem key={String(opt.value)} value={opt.value as string}>
						{opt.label}
					</MenuItem>
				))}
			</FastSelect>
			{field.fieldOverrides?.description ? (
				<Typography variant="caption" color="text.secondary" className="pl-3">
					{field.fieldOverrides.description}
				</Typography>
			) : null}
		</Stack>
	);
}
