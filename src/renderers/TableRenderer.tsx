"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import {
	type ReactElement,
	useCallback,
	useMemo,
	useRef,
	useState,
} from "react";
import useSWR, { useSWRConfig } from "swr";
import { checkComponentPermission } from "../ability/checkComponentPermission";
import { AutoComponent } from "../ComponentRenderer";
import { BaseDialog } from "../components/dialog/BaseDialog";
import { getApiClient, useRenderUser } from "../deps";
import type { TableAction } from "../dynamic-form/types";
import type { DynamicTableColumn } from "../dynamic-table";
import { DynamicTable } from "../dynamic-table";
import { useSnack } from "../hooks/useSnack";
import { resolveUrlTemplate } from "../query-builder";
import type { RenderedComponent } from "../types";

// State-context + table IDs for the link-operations dialog
const LINK_OPS_STATE_CTX_ID = "evjeix5v91ytlcmj5tz9ak4t";
const LINK_OPS_TABLE_ID = "ut1zfkikcc4ce0j9gnampl3t";

export function TableRenderer({
	component,
	pathParams,
	onClose,
}: {
	component: RenderedComponent;
	pathParams?: Record<string, string>;
	onClose?: () => void;
}): ReactElement {
	const columnEls = component.slotsFilled["columns"] ?? [];
	const { mutate } = useSWRConfig();
	const snack = useSnack();

	// ── Confirm dialog state ──
	const [showConfirmDialog, setShowConfirmDialog] = useState(false);
	const [confirmPayload, setConfirmPayload] = useState<{
		endpoint: string;
		method: string;
		title: string;
		message: string;
	} | null>(null);
	const [confirmExtra, setConfirmExtra] = useState("");
	const [confirmPending, setConfirmPending] = useState(false);

	const handleConfirmClose = useCallback(() => {
		setShowConfirmDialog(false);
		setConfirmPayload(null);
		setConfirmExtra("");
		mutate(() => true);
	}, [mutate]);

	// ── Delete / Recover dialog state ──
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);
	const [deleteInfo, setDeleteInfo] = useState<{
		id: string;
		action: TableAction;
		isDelete: boolean;
	} | null>(null);
	const [deleteExtra, setDeleteExtra] = useState("");

	const handleDeleteClose = useCallback(() => {
		setShowDeleteDialog(false);
		setDeleteInfo(null);
		setDeleteExtra("");
		mutate(() => true);
	}, [mutate]);

	// ── Create / Edit form dialog state ──
	const [showFormDialog, setShowFormDialog] = useState(false);
	const [formComponentId, setFormComponentId] = useState("");
	const [formContext, setFormContext] = useState<"create" | "edit">("create");
	const [formRecordId, setFormRecordId] = useState<string | undefined>(
		undefined,
	);
	const [formDialogTitle, setFormDialogTitle] = useState("");
	const [formExtra, setFormExtra] = useState("");

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
		setFormExtra("");
		formApiRef.current = null;
		mutate(() => true);
	}, [mutate]);

	const handleFormSuccess = useCallback(async () => {
		await mutate(() => true);
		handleFormClose();
	}, [mutate, handleFormClose]);

	// ── New link-operations dialog (state-context + submit button) ──
	const [showLinkOpsDialog, setShowLinkOpsDialog] = useState(false);
	const [linkOpsTitle, setLinkOpsTitle] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [selectedIds, setSelectedIds] = useState<string[]>([]);

	const handleLinkOpsClose = useCallback(() => {
		setShowLinkOpsDialog(false);
		setSelectedIds([]);
		mutate(() => true);
	}, [mutate]);

	const handleLinkOpsSubmit = useCallback(async () => {
		if (selectedIds.length === 0) return;
		setSubmitting(true);
		try {
			const baseUrl = process.env.NEXT_PUBLIC_ENDPOINT ?? "";
			const endpoint = resolveUrlTemplate(
				"/api/v1/packages/{id}/operations",
				pathParams,
			);
			await getApiClient().request({
				url: `${baseUrl}${endpoint}`,
				method: "POST",
				data: { operationIds: selectedIds },
			});
			handleLinkOpsClose();
		} catch (err) {
			console.error("Submit failed:", err);
		} finally {
			setSubmitting(false);
		}
	}, [selectedIds, pathParams, handleLinkOpsClose]);

	// ── Column & metadata adapters (must precede handleDialogChange) ──
	const { data: user } = useRenderUser();
	const userPermissions: Array<{ resource: string; scope?: string }> =
		(user as any)?.permissions?.data ?? [];
	// Current workspace tenant — resolves {tenantId} templates on tenant
	// screens whose route doesn't carry the tenant (e.g. settings).
	const currentTenantId = (user as any)?.tenant?.id as string | undefined;
	const tenantParam: Record<string, string> = currentTenantId
		? { tenantId: currentTenantId }
		: {};

	const columns: DynamicTableColumn[] = useMemo(
		() =>
			columnEls
				.filter((c) => c.isActive)
				.filter((c) => {
					const visPerms = (c.overrides as any)?.visibleToPermissions;
					if (!visPerms || visPerms.length === 0) return true;
					return checkComponentPermission(userPermissions, visPerms);
				})
				.sort((a, b) => a.displayOrder - b.displayOrder)
				.map((c) => ({
					id: c.id,
					name: c.name ?? c.fieldDefinitionId ?? "",
					fieldOverrides: {
						name: (c.overrides as any)?.name ?? undefined,
						displayName:
							(c.overrides as any)?.displayName ?? c.label ?? undefined,
					},
					columnConfig: (c.overrides as any)?.columnConfig ?? undefined,
					isActive: c.isActive,
					displayOrder: c.displayOrder,
				})),
		[columnEls, userPermissions],
	);

	const tableMetadata = useMemo(
		() => ({
			...(component.config as any),
			name: component.name,
			title: component.displayName,
			description: component.description,
		}),
		[component],
	);

	// ── Route dialog to appropriate handler ──
	const handleDialogChange = useCallback(
		(d: string | null, id: string, formId: string, extra: string) => {
			if (!d) {
				handleConfirmClose();
				handleDeleteClose();
				handleFormClose();
				return;
			}

			let parsed: Record<string, unknown> = {};
			try {
				parsed = JSON.parse(extra);
			} catch {
				/* ignore */
			}

			const allActions = [
				...(tableMetadata.toolbarActions ?? []),
				...(tableMetadata.rowActions ?? []),
				...(tableMetadata.selection?.actions ?? []),
			] as TableAction[];

			const actionId = parsed._actionId as string | undefined;
			let action: TableAction | undefined;
			if (actionId) {
				action = allActions.find((a: any) => a.id === actionId);
			}

			const compId = (action as any)?.dialog?.componentId || formId;

			// Link-operations dialog (state-context based)
			if (compId === LINK_OPS_TABLE_ID) {
				setShowLinkOpsDialog(true);
				setLinkOpsTitle((action as any)?.label || component.displayName);
				return;
			}

			// Confirm dialog
			if (d === "confirm") {
				setConfirmPayload({
					endpoint: (parsed.endpoint as string) ?? "",
					method: (parsed.method as string) ?? "PATCH",
					title: (parsed.title as string) ?? "Confirm",
					message: (parsed.message as string) ?? "Are you sure?",
				});
				setConfirmExtra(extra);
				setShowConfirmDialog(true);
				return;
			}

			// Delete / Recover dialog
			if (d === "remove" || d === "recover") {
				const isDelete = d === "remove";
				if (!action) {
					if (isDelete) {
						action = allActions.find(
							(a: any) =>
								(a.action === "openDialog" && a.dialog?.context === "delete") ||
								a.redirect?.includes("dialog=remove") ||
								a.action === "delete",
						);
					} else {
						action = allActions.find(
							(a: any) =>
								(a.action === "openDialog" &&
									a.dialog?.context === "recover") ||
								a.redirect?.includes("dialog=recover"),
						);
					}
				}
				if (action) {
					setDeleteInfo({ id, action, isDelete });
					setDeleteExtra(extra);
					setShowDeleteDialog(true);
				}
				return;
			}

			// Create / Edit / View form dialog
			if (d === "create" || d === "edit" || d === "view") {
				const isCreate = d === "create";
				const isView = d === "view";
				if (!action) {
					if (isCreate) {
						action = allActions.find(
							(a: any) =>
								a.action === "openDialog" && a.dialog?.context === "create",
						);
					} else if (isView) {
						action = allActions.find(
							(a: any) =>
								a.action === "openDialog" && a.dialog?.context === "view",
						);
					} else {
						action = allActions.find(
							(a: any) =>
								a.action === "openDialog" && a.dialog?.context === "edit",
						);
					}
				}
				const componentId = (action as any)?.dialog?.componentId || formId;
				if (componentId) {
					const t =
						typeof tableMetadata.title === "string"
							? tableMetadata.title.replace(/^\$trl_/, "")
							: "Record";
					setFormComponentId(componentId);
					// Use "edit" context for actual form rendering so FormRenderer can
					// find edit actions (GET endpoints) to fetch record data.
					setFormContext(isView ? "edit" : isCreate ? "create" : "edit");
					setFormRecordId(isCreate ? undefined : id);
					setFormDialogTitle(
						isCreate ? `Create ${t}` : isView ? `View ${t}` : `Edit ${t}`,
					);
					setFormExtra(extra);
					setShowFormDialog(true);
				}
				return;
			}
		},
		[
			tableMetadata,
			component.displayName,
			handleConfirmClose,
			handleDeleteClose,
			handleFormClose,
		],
	);

	// ── Fetch state-context for link-ops dialog ──
	const { data: stateCtxComp } = useSWR<RenderedComponent | null>(
		showLinkOpsDialog
			? `/api/v1/components/${LINK_OPS_STATE_CTX_ID}?include=render`
			: null,
		async (url: string) => {
			const r = await getApiClient().get(url);
			return r.data?.data?.component ?? null;
		},
	);

	return (
		<>
			<DynamicTable
				tableMetadata={tableMetadata}
				columns={columns}
				onDialogChange={handleDialogChange}
				onClose={onClose}
				otherParams={{ pathParams }}
			/>
			{/* Confirm dialog */}
			{showConfirmDialog && confirmPayload && (
				<BaseDialog
					isOpen
					title={confirmPayload.title}
					onClose={handleConfirmClose}
					isPending={confirmPending}
					onSubmit={async () => {
						setConfirmPending(true);
						try {
							let extras: Record<string, string> = {};
							try {
								extras = JSON.parse(confirmExtra);
							} catch {
								/* ignore */
							}
							const mergedPathParams = {
								...extras,
								...pathParams,
								...tenantParam,
							};
							const baseUrl = process.env.NEXT_PUBLIC_ENDPOINT ?? "";
							const endpoint = resolveUrlTemplate(
								confirmPayload.endpoint,
								mergedPathParams,
							);
							await getApiClient().request({
								url: `${baseUrl}${endpoint}`,
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

			{/* Delete / Recover dialog */}
			{showDeleteDialog && deleteInfo && (
				<>
					{(() => {
						const { id: delId, action: delAction, isDelete } = deleteInfo;
						let extras: Record<string, string> = {};
						try {
							extras = JSON.parse(deleteExtra);
						} catch {
							/* ignore */
						}
						const mergedPathParams = {
							...extras,
							...pathParams,
							...tenantParam,
						};
						const t =
							typeof tableMetadata.title === "string"
								? tableMetadata.title.replace(/^\$trl_/, "")
								: "Record";
						const dialogTitle = isDelete ? `Delete ${t}` : `Recover ${t}`;
						const confirmMessage =
							(delAction as any).confirm?.message ?? "Are you sure?";
						const confirmTitle = (delAction as any).confirm?.title ?? "Confirm";

						return (
							<BaseDialog
								isOpen
								title={dialogTitle}
								onClose={handleDeleteClose}
								onSubmit={async () => {
									try {
										const baseUrl = process.env.NEXT_PUBLIC_ENDPOINT ?? "";
										const baseEndpoint =
											(delAction as any).endpoint ??
											tableMetadata.datasource.endpoint;
										const url = `${baseUrl}${resolveUrlTemplate(baseEndpoint, { id: delId, ...mergedPathParams })}`;
										const method = (delAction as any).method ?? "PATCH";
										const res = await getApiClient().request({
											url,
											method,
											data: {},
										});
										await snack.success(
											res.data?.data?.message ??
												res.data?.message ??
												`${isDelete ? "Deleted" : "Recovered"} successfully`,
										);
										await mutate(() => true);
									} catch (error) {
										await snack.error(
											error,
											`${isDelete ? "Delete" : "Recover"} failed`,
										);
									}
									handleDeleteClose();
								}}
								slotProps={{
									submitButton: {
										props: {
											children: confirmTitle,
											color: (isDelete ? "error" : "primary") as
												| "error"
												| "primary",
										},
									},
								}}
							>
								<Typography>{confirmMessage}</Typography>
							</BaseDialog>
						);
					})()}
				</>
			)}

			{/* Create / Edit form dialog */}
			{showFormDialog && formComponentId && (
				<>
					{(() => {
						let extras: Record<string, string> = {};
						try {
							extras = JSON.parse(formExtra);
						} catch {
							/* ignore */
						}
						const mergedPathParams = {
							...extras,
							...pathParams,
							...tenantParam,
						};

						return (
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
									pathParams={
										Object.keys(mergedPathParams).length > 0
											? mergedPathParams
											: undefined
									}
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
						);
					})()}
				</>
			)}
			{/* New link-operations dialog */}
			{showLinkOpsDialog && stateCtxComp && (
				<BaseDialog
					isOpen
					title={linkOpsTitle || component.displayName}
					onClose={handleLinkOpsClose}
					onSubmit={handleLinkOpsSubmit}
					isPending={submitting}
					slotProps={{
						submitButton: {
							show: true,
							props: {
								children: "Link Selected",
								disabled: selectedIds.length === 0,
							},
						},
						closeButton: { show: true, props: { children: "Close" } },
					}}
				>
					<Box>
						{stateCtxComp.slotsFilled["content"]
							?.filter((el) => el.isActive && el.referencedComponent)
							.sort((a, b) => a.displayOrder - b.displayOrder)
							.map((el) =>
								el.referencedComponent ? (
									<InnerTableWrapper
										key={el.id}
										component={el.referencedComponent}
										pathParams={pathParams}
										onSelectionChange={setSelectedIds}
									/>
								) : null,
							)}
					</Box>
				</BaseDialog>
			)}
		</>
	);
}

function InnerTableWrapper({
	component,
	pathParams,
	onSelectionChange,
}: {
	component: RenderedComponent;
	pathParams?: Record<string, string>;
	onSelectionChange: (ids: string[]) => void;
}) {
	const { data: user } = useRenderUser();
	const userPermissions: Array<{ resource: string; scope?: string }> =
		(user as any)?.permissions?.data ?? [];

	const columns: DynamicTableColumn[] = useMemo(
		() =>
			(component.slotsFilled["columns"] ?? [])
				.filter((c) => c.isActive)
				.filter((c) => {
					const visPerms = (c.overrides as any)?.visibleToPermissions;
					if (!visPerms || visPerms.length === 0) return true;
					return checkComponentPermission(userPermissions, visPerms);
				})
				.sort((a, b) => a.displayOrder - b.displayOrder)
				.map((c) => ({
					id: c.id,
					name: c.name ?? c.fieldDefinitionId ?? "",
					fieldOverrides: {
						name: (c.overrides as any)?.name ?? undefined,
						displayName:
							(c.overrides as any)?.displayName ?? c.label ?? undefined,
					},
					columnConfig: (c.overrides as any)?.columnConfig ?? undefined,
					isActive: c.isActive,
					displayOrder: c.displayOrder,
				})),
		[component, userPermissions],
	);

	const tableMetadata = useMemo(
		() => ({
			...(component.config as any),
			name: component.name,
			title: component.displayName,
			description: component.description,
		}),
		[component],
	);

	return (
		<DynamicTable
			tableMetadata={tableMetadata}
			columns={columns}
			onSelectionChange={onSelectionChange}
			otherParams={{ pathParams }}
		/>
	);
}
