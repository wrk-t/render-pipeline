// ═══════════════════════════════════════════════════════════════
// FormSelectField – Renders a select dropdown field.
//
// Supports both static options and service datasources (including
// resolved entity datasources). When a service datasource is
// present, options are fetched once on mount via SWR.
//
// CONTROLLED value: uses `useField` and always passes `value ?? ""`
// to the MUI Select. The previous formik-mui `FastSelect` wrapper
// passed `value={undefined}` on first render (MUI warns + misbehaves
// when a Select switches uncontrolled→controlled) and its `onClose`
// read `e.target.dataset` — an event shape MUI v9 no longer provides,
// so closing the dropdown threw during the Select's internal sync and
// froze the page (the Style tab).
// ═══════════════════════════════════════════════════════════════
"use client";

import {
	FormControl,
	InputLabel,
	MenuItem,
	Select,
	Stack,
	Typography,
} from "@mui/material";
import { useField } from "formik";
import type { ReactElement } from "react";
import useSWR from "swr";
import { checkComponentPermission } from "../../ability/checkComponentPermission";
import { getApiClient, useRenderUser } from "../../deps";
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
	const { data: user } = useRenderUser();
	const userPermissions: Array<{ resource: string; scope?: string }> =
		user?.permissions?.data ?? [];

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

	// Filter out options gated by visibleToPermissions (e.g. the scope
	// "all" option is only offered to users whose own create ceiling
	// is "all").
	const visibleOptions = options.filter(
		(opt) =>
			!opt.visibleToPermissions ||
			opt.visibleToPermissions.length === 0 ||
			checkComponentPermission(userPermissions, opt.visibleToPermissions),
	);

	// ── Controlled value (never undefined — see header comment) ──
	const [{ value }, meta, { setValue, setTouched }] = useField<string>(
		field.name,
	);
	const isError = Boolean(meta.touched && meta.error);

	return (
		<Stack spacing={0.2}>
			<FormControl
				fullWidth
				size="small"
				error={isError}
				required={field.isRequired}
				disabled={field.isReadOnly}
			>
				<InputLabel id={`field-select-${field.name}`}>{field.label}</InputLabel>
				<Select
					labelId={`field-select-${field.name}`}
					label={field.label}
					value={value ?? ""}
					onChange={(e) => {
						setValue(e.target.value as string);
						setTouched(true);
					}}
					onBlur={() => setTouched(true)}
				>
					{visibleOptions.map((opt) => (
						<MenuItem key={String(opt.value)} value={opt.value as string}>
							{opt.label}
						</MenuItem>
					))}
				</Select>
			</FormControl>
			{field.fieldOverrides?.description ? (
				<Typography variant="caption" color="text.secondary" className="pl-3">
					{field.fieldOverrides.description}
				</Typography>
			) : null}
		</Stack>
	);
}
