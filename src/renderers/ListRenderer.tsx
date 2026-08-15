// ═══════════════════════════════════════════════════════════════
// ListRenderer – Renders a metadata-driven list (blueprint "list").
//
// config:
//   datasource:   { type: "rest", endpoint, method, params }
//   settings:     { showTypeBadge, emptyMessage }
//   toolbarActions: TableAction[]   (e.g. create → openDialog)
//   rowActions:    TableAction[]    (edit/delete/recover …)
//
// Actions are permission-gated via `action.permissions` (["resource_action"])
// and `action.condition` (evaluated against the row), mirroring the
// DynamicTable contract.
// ═══════════════════════════════════════════════════════════════
"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import {
	type ReactElement,
	useCallback,
	useMemo,
	useRef,
	useState,
} from "react";
import useSWR, { useSWRConfig } from "swr";
import { checkComponentPermission } from "../ability/checkComponentPermission";
import { useCan } from "../ability";
import { AutoComponent } from "../ComponentRenderer";
import { BaseDialog } from "../components/dialog/BaseDialog";
import { getApiClient, useRenderUser } from "../deps";
import type { TableAction } from "../dynamic-form/types";
import { TableIcon } from "../dynamic-table";
import { useResolvedParams } from "../hooks/useResolvedParams";
import { useSnack } from "../hooks/useSnack";
import { resolveUrlTemplate } from "../query-builder";
import type { RenderedComponent } from "../types";

// ── Helpers ────────────────────────────────────────────────────

function checkPermission(
	can: (action: string, resource: string) => boolean,
	permission: string,
): boolean {
	const idx = permission.lastIndexOf("_");
	if (idx < 0) return false;
	const resource = permission.slice(0, idx);
	const action = permission.slice(idx + 1);
	return can(action, resource);
}

function evalCondition(
	row: Record<string, unknown>,
	condition?: TableAction["condition"],
): boolean {
	if (!condition) return true;
	const conditions = Array.isArray(condition) ? condition : [condition];
	return conditions.every(({ field, operator, value }) => {
		const fieldValue = row[field];
		switch (operator) {
			case "eq":
				return fieldValue === value;
			case "ne":
				return fieldValue !== value;
			case "isEmpty":
				return (
					fieldValue === undefined || fieldValue === null || fieldValue === ""
				);
			case "notEmpty":
				return (
					fieldValue !== undefined && fieldValue !== null && fieldValue !== ""
				);
			default:
				return true;
		}
	});
}

function resolvePlaceholders(
	template: string,
	row: Record<string, unknown> | undefined,
	pathParams: Record<string, string>,
): string {
	return template.replace(/\{(\w+)\}/g, (_: string, key: string) => {
		if (row && key in row) return String(row[key] ?? "");
		if (key in pathParams) return String(pathParams[key] ?? "");
		return `{${key}}`;
	});
}

// ── Component ──────────────────────────────────────────────────

export function ListRenderer({
	component,
	pathParams,
}: {
	component: RenderedComponent;
	pathParams?: Record<string, string>;
}): ReactElement {
	const router = useRouter();
	const snack = useSnack();
	const { mutate } = useSWRConfig();
	const can = useCan();

	const config = (component.config ?? {}) as Record<string, any>;
	const datasource = config.datasource ?? {};
	const settings = config.settings ?? {};
	const toolbarActions: TableAction[] = config.toolbarActions ?? [];
	const rowActions: TableAction[] = config.rowActions ?? [];

	const resolvedPathParams = useResolvedParams(pathParams);

	// ── Data fetching ─────────────────────────────────────────
	const endpoint = useMemo(() => {
		const base = resolveUrlTemplate(
			datasource.endpoint ?? "",
			resolvedPathParams,
		);
		const params = datasource.params as Record<string, string> | undefined;
		if (!params || Object.keys(params).length === 0) return base;
		const qs = new URLSearchParams(params).toString();
		return base.includes("?") ? `${base}&${qs}` : `${base}?${qs}`;
	}, [datasource.endpoint, datasource.params, resolvedPathParams]);

	const { data, isLoading } = useSWR(
		endpoint ? [endpoint] : null,
		async ([url]: [string]) => {
			const res = await getApiClient().get(url);
			const body = res.data?.data ?? res.data ?? null;
			// Paginated envelope: { data: { data: [...], total } } — unwrap once.
			const items = body?.data ?? body;
			return Array.isArray(items) ? items : [];
		},
	);

	const items: Record<string, unknown>[] = useMemo(
		() => (Array.isArray(data) ? data : []),
		[data],
	);

	// ── Permission gating for actions ─────────────────────────
	const { data: user } = useRenderUser();
	const userPermissions: Array<{ resource: string; scope?: string }> =
		(user as any)?.permissions?.data ?? [];

	const isActionAllowed = useCallback(
		(action: TableAction) => {
			if (
				action.permissions?.length &&
				!action.permissions.some((p) => checkPermission(can, p))
			) {
				return false;
			}
			if (
				(action as any).visibleToPermissions?.length &&
				!checkComponentPermission(
					userPermissions,
					(action as any).visibleToPermissions,
				)
			) {
				return false;
			}
			return true;
		},
		[can, userPermissions],
	);

	const visibleToolbarActions = useMemo(
		() => toolbarActions.filter(isActionAllowed),
		[toolbarActions, isActionAllowed],
	);

	const visibleRowActions = useCallback(
		(row: Record<string, unknown>) =>
			rowActions.filter(
				(a) => isActionAllowed(a) && evalCondition(row, a.condition),
			),
		[rowActions, isActionAllowed],
	);

	// ── Confirm dialog state ──────────────────────────────────
	const [showConfirmDialog, setShowConfirmDialog] = useState(false);
	const [confirmPayload, setConfirmPayload] = useState<{
		endpoint: string;
		method: string;
		title: string;
		message: string;
	} | null>(null);
	const [confirmPending, setConfirmPending] = useState(false);

	const handleConfirmClose = useCallback(() => {
		setShowConfirmDialog(false);
		setConfirmPayload(null);
		mutate(() => true);
	}, [mutate]);

	// ── Create / Edit form dialog state ───────────────────────
	const [showFormDialog, setShowFormDialog] = useState(false);
	const [formComponentId, setFormComponentId] = useState("");
	const [formContext, setFormContext] = useState<"create" | "edit">("create");
	const [formRecordId, setFormRecordId] = useState<string | undefined>(
		undefined,
	);
	const [formDialogTitle, setFormDialogTitle] = useState("");

	const formApiRef = useRef<{
		submitForm: () => Promise<void>;
		submitLabel: string;
		closeLabel: string;
	} | null>(null);
	const [, formForceUpdate] = useState(0);

	const handleFormClose = useCallback(() => {
		setShowFormDialog(false);
		setFormComponentId("");
		setFormContext("create");
		setFormRecordId(undefined);
		setFormDialogTitle("");
		formApiRef.current = null;
		mutate(() => true);
	}, [mutate]);

	const handleFormSuccess = useCallback(async () => {
		await mutate(() => true);
		handleFormClose();
	}, [mutate, handleFormClose]);

	// ── Action dispatch ───────────────────────────────────────
	const openActionDialog = useCallback(
		(action: TableAction, row?: Record<string, unknown>) => {
			if (action.action === "openDialog") {
				const context = action.dialog?.context ?? "edit";
				const title =
					typeof component.displayName === "string"
						? component.displayName.replace(/^\$trl_/, "")
						: "Record";
				setFormComponentId(
					((action.dialog as any)?.componentId as string | undefined) ??
						action.dialog?.formId ??
						"",
				);
				setFormContext(context === "view" ? "edit" : context);
				setFormRecordId(
					context === "create" ? undefined : String(row?.id ?? ""),
				);
				setFormDialogTitle(
					context === "create"
						? `Create ${title}`
						: context === "view"
							? `View ${title}`
							: `Edit ${title}`,
				);
				setShowFormDialog(true);
				return;
			}

			if (action.action === "apiCall" && action.confirm) {
				const payload = {
					endpoint: resolvePlaceholders(
						action.endpoint ?? "",
						row,
						resolvedPathParams,
					),
					method: action.method ?? "PATCH",
					title: action.confirm.title ?? "Confirm",
					message: action.confirm.message ?? "Are you sure?",
				};
				setConfirmPayload(payload);
				setShowConfirmDialog(true);
				return;
			}

			if (action.action === "apiCall") {
				void (async () => {
					try {
						const baseUrl = process.env.NEXT_PUBLIC_ENDPOINT ?? "";
						const url = `${baseUrl}${resolvePlaceholders(
							action.endpoint ?? "",
							row,
							resolvedPathParams,
						)}`;
						await getApiClient().request({
							url,
							method: (action.method ?? "PATCH").toLowerCase(),
							data: row ?? {},
						});
						await mutate(() => true);
						if (action.onSuccess === "closeDialog") setShowFormDialog(false);
					} catch (err) {
						snack.error(err, "Action failed");
					}
				})();
				return;
			}

			if (action.action === "navigate") {
				const resolved = resolvePlaceholders(
					action.path ?? "",
					row,
					resolvedPathParams,
				).replace(/^~\//, "/");
				router.push(resolved);
			}
		},
		[component.displayName, resolvedPathParams, mutate, snack, router],
	);

	const title =
		typeof component.displayName === "string"
			? component.displayName.replace(/^\$trl_/, "")
			: "";
	const emptyMessage = settings.emptyMessage ?? "No items";
	const showTypeBadge = settings.showTypeBadge === true;

	return (
		<Box>
			{/* ── Header + toolbar actions ── */}
			{(title || visibleToolbarActions.length > 0) && (
				<Stack
					direction="row"
					className="mb-3 w-full items-center justify-between"
				>
					{title && (
						<Typography variant="h6" className="font-bold">
							{title}
						</Typography>
					)}
					{visibleToolbarActions.length > 0 && (
						<Stack direction="row" spacing={1}>
							{visibleToolbarActions.map((action) => (
								<Button
									key={action.id}
									variant="contained"
									size="small"
									color={(action.color as any) ?? "primary"}
									startIcon={
										action.icon ? <TableIcon name={action.icon} /> : undefined
									}
									onClick={() => openActionDialog(action)}
								>
									{action.label}
								</Button>
							))}
						</Stack>
					)}
				</Stack>
			)}

			{/* ── Body ── */}
			{isLoading ? (
				<Stack className="items-center py-8">
					<CircularProgress size={24} />
				</Stack>
			) : items.length === 0 ? (
				<Typography
					variant="body2"
					color="text.secondary"
					className="py-8 text-center"
				>
					{emptyMessage}
				</Typography>
			) : (
				<Stack spacing={1}>
					{items.map((item) => {
						const actions = visibleRowActions(item);
						return (
							<Card
								key={String(item.id ?? "")}
								variant="outlined"
								className="w-full"
							>
								<Stack
									direction="row"
									spacing={2}
									className="items-center justify-between px-3 py-2"
								>
									<Stack spacing={0.25} className="min-w-0 flex-1">
										<Stack direction="row" spacing={1} className="items-center">
											<Typography
												variant="subtitle2"
												className="font-bold"
												sx={{ fontFamily: "monospace" }}
											>
												{String(item.key ?? item.name ?? item.id ?? "")}
											</Typography>
											{showTypeBadge && item.type ? (
												<Chip
													label={String(item.type)}
													size="small"
													variant="outlined"
													sx={{ height: 18, fontSize: "0.65rem" }}
												/>
											) : null}
										</Stack>
										{item.description ? (
											<Typography
												variant="caption"
												color="text.secondary"
												className="truncate"
											>
												{String(item.description)}
											</Typography>
										) : null}
										{item.value !== undefined && item.value !== null ? (
											<Typography variant="body2" className="break-all">
												{String(item.value)}
											</Typography>
										) : null}
									</Stack>

									{actions.length > 0 && (
										<Stack direction="row" spacing={0.5}>
											{actions.map((action) => (
												<Tooltip key={action.id} title={action.label}>
													<IconButton
														size="small"
														color={(action.color as any) ?? "default"}
														onClick={() => openActionDialog(action, item)}
													>
														{action.icon ? (
															<TableIcon name={action.icon} size={18} />
														) : null}
													</IconButton>
												</Tooltip>
											))}
										</Stack>
									)}
								</Stack>
							</Card>
						);
					})}
				</Stack>
			)}

			{/* ── Confirm dialog (apiCall + confirm) ── */}
			{showConfirmDialog && confirmPayload && (
				<BaseDialog
					isOpen
					title={confirmPayload.title}
					onClose={handleConfirmClose}
					isPending={confirmPending}
					onSubmit={async () => {
						setConfirmPending(true);
						try {
							const baseUrl = process.env.NEXT_PUBLIC_ENDPOINT ?? "";
							await getApiClient().request({
								url: `${baseUrl}${confirmPayload.endpoint}`,
								method: (confirmPayload.method || "PATCH").toLowerCase(),
								data: {},
							});
							await mutate(() => true);
							handleConfirmClose();
						} catch (error) {
							await snack.error(error, "Action failed");
						} finally {
							setConfirmPending(false);
						}
					}}
					slotProps={{
						submitButton: {
							props: { children: "Confirm", color: "error" as const },
						},
					}}
				>
					<Typography>{confirmPayload.message}</Typography>
				</BaseDialog>
			)}

			{/* ── Create / Edit form dialog ── */}
			{showFormDialog && formComponentId && (
				<BaseDialog
					isOpen
					title={formDialogTitle}
					onClose={handleFormClose}
					isPending={false}
					onSubmit={formApiRef.current?.submitForm}
					slotProps={{
						submitButton: {
							show: !!formApiRef.current,
							props: {
								children: formApiRef.current?.submitLabel ?? "Submit",
							},
						},
						closeButton: {
							show: true,
							props: {
								children: formApiRef.current?.closeLabel ?? "Close",
							},
						},
					}}
				>
					<AutoComponent
						componentId={formComponentId}
						context={formContext}
						recordId={formRecordId}
						onSuccess={handleFormSuccess}
						onClose={handleFormClose}
						pathParams={resolvedPathParams}
						onFormReady={(api) => {
							const cur = formApiRef.current;
							if (
								!cur ||
								cur.submitLabel !== api.submitLabel ||
								cur.closeLabel !== api.closeLabel
							) {
								formApiRef.current = api;
								formForceUpdate((n) => n + 1);
							}
						}}
					/>
				</BaseDialog>
			)}
		</Box>
	);
}
