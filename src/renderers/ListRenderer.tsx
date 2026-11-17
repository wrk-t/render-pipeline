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

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
	type ReactElement,
	useCallback,
	useMemo,
	useRef,
	useState,
} from "react";
import useSWR, { useSWRConfig } from "swr";
import { useCan } from "../ability";
import { checkComponentPermission } from "../ability/checkComponentPermission";
import { AutoComponent } from "../ComponentRenderer";
import { BaseDialog } from "../components/dialog/BaseDialog";
import { deriveDialogTitle } from "../components/dialog/dialogTitle";
import type { DialogSize } from "../components/dialog/types";
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

/**
 * Action `color` names from the metadata contract → shadcn button skin.
 * Stock shadcn has no warning/info/success button variant, so those keep
 * their meaning through the default Tailwind palette's 600 shades.
 */
const TOOLBAR_COLOR_CLASSES: Record<string, string> = {
	primary: "bg-primary text-primary-foreground hover:bg-primary/90",
	secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
	inherit: "bg-primary text-primary-foreground hover:bg-primary/90",
	error: "bg-destructive text-white hover:bg-destructive/90",
	warning: "bg-amber-600 text-white hover:bg-amber-600/90",
	success: "bg-emerald-600 text-white hover:bg-emerald-600/90",
	info: "bg-sky-600 text-white hover:bg-sky-600/90",
};

/** Row-action icon button tones — shadcn's ghost icon button. */
const ICON_COLOR_CLASSES: Record<string, string> = {
	default: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
	primary: "text-primary hover:bg-accent hover:text-accent-foreground",
	secondary:
		"text-secondary-foreground hover:bg-accent hover:text-accent-foreground",
	inherit: "text-foreground hover:bg-accent hover:text-accent-foreground",
	error: "text-destructive hover:bg-destructive/10",
	warning: "text-amber-600 hover:bg-amber-600/10 dark:text-amber-500",
	success: "text-emerald-600 hover:bg-emerald-600/10 dark:text-emerald-500",
	info: "text-sky-600 hover:bg-sky-600/10 dark:text-sky-400",
};

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
	const tc = useTranslations("common");

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
	const [formComponentId, setFormComponentId] = useState<number | null>(null);
	const [formContext, setFormContext] = useState<"create" | "edit">("create");
	const [formRecordId, setFormRecordId] = useState<string | undefined>(
		undefined,
	);
	const [formDialogTitle, setFormDialogTitle] = useState("");
	/** Width hint: the action's `dialog.size`, else the form's suggestion. */
	const [formDialogSize, setFormDialogSize] = useState<DialogSize>("sm");
	/** Set when the ACTION declared a size — it outranks the form's suggestion. */
	const formSizeHintRef = useRef<DialogSize | undefined>(undefined);
	/** What each form asked for last time, so a reopen does not resize. */
	const formSizeMemoryRef = useRef<Record<string, DialogSize>>({});
	/** The footer's primary spins for the whole submit promise. */
	const [formSubmitting, setFormSubmitting] = useState(false);
	const [formPathParams, setFormPathParams] = useState<Record<string, string>>(
		{},
	);

	const formApiRef = useRef<{
		submitForm: () => Promise<void>;
		submitLabel: string;
		closeLabel: string;
	} | null>(null);
	const [, formForceUpdate] = useState(0);

	const handleFormClose = useCallback(() => {
		setShowFormDialog(false);
		setFormComponentId(null);
		setFormContext("create");
		setFormRecordId(undefined);
		setFormDialogTitle("");
		setFormDialogSize("sm");
		formSizeHintRef.current = undefined;
		setFormSubmitting(false);
		setFormPathParams({});
		formApiRef.current = null;
		mutate(() => true);
	}, [mutate]);

	const handleFormSuccess = useCallback(async () => {
		await mutate(() => true);
		handleFormClose();
	}, [mutate, handleFormClose]);

	/** Keep the footer's primary spinning for the whole submit promise. */
	const submitCurrentForm = useCallback(() => {
		setFormSubmitting(true);
		void Promise.resolve(formApiRef.current?.submitForm()).finally(() =>
			setFormSubmitting(false),
		);
	}, []);

	// ── Action dispatch ───────────────────────────────────────
	const openActionDialog = useCallback(
		(action: TableAction, row?: Record<string, unknown>) => {
			if (action.action === "openDialog") {
				const dialog = action.dialog as any;
				const context = dialog?.context ?? "edit";
				// The title names the ACTION: its own `dialog.title` ($trl_ key or
				// literal, `{rowField}`-resolved), then its label. Never the
				// pluralised list title (UX-7).
				const actionTitle = deriveDialogTitle({
					title: dialog?.title,
					label: action.label,
					params: { ...resolvedPathParams, ...(row ?? {}) },
				});
				setFormComponentId(
					(dialog?.componentId as string | undefined) ?? dialog?.formId ?? "",
				);
				setFormContext(context === "view" ? "edit" : context);
				setFormRecordId(
					context === "create" ? undefined : String(row?.id ?? ""),
				);
				setFormDialogTitle(
					actionTitle ??
						(context === "create"
							? tc("create")
							: context === "view"
								? "View"
								: "Edit"),
				);
				// The action's size hint outranks the form's own recommendation.
				formSizeHintRef.current = dialog?.size as DialogSize | undefined;
				const nextComponentId = String(
					(dialog?.componentId as string | undefined) ?? dialog?.formId ?? "",
				);
				setFormDialogSize(
					(dialog?.size as DialogSize | undefined) ??
						formSizeMemoryRef.current[nextComponentId] ??
						"sm",
				);
				setFormSubmitting(false);
				// In create context, copy selected row fields into the form's
				// pathParams so prefilled/hidden fields (e.g. the clicked
				// plan's id as planId) reach the form's initial values.
				const rowFieldsRaw = dialog?.rowFields as
					| string[]
					| Record<string, string>
					| undefined;
				const rowFieldPairs: Array<[string, string]> = Array.isArray(
					rowFieldsRaw,
				)
					? (rowFieldsRaw as string[]).map((k) => [k, k])
					: rowFieldsRaw
						? Object.entries(rowFieldsRaw)
						: [];
				const rowParams =
					context === "create" && row
						? Object.fromEntries(
								rowFieldPairs
									.filter(
										([, src]) => row[src] !== undefined && row[src] !== null,
									)
									.map(([dst, src]) => [dst, String(row[src])]),
							)
						: {};
				setFormPathParams({ ...resolvedPathParams, ...rowParams });
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
		[tc, resolvedPathParams, mutate, snack, router],
	);

	const title =
		typeof component.displayName === "string"
			? component.displayName.replace(/^\$trl_/, "")
			: "";
	const emptyMessage = settings.emptyMessage ?? "No items";
	const showTypeBadge = settings.showTypeBadge === true;
	// Field whose value is rendered as the card's value line (defaults to
	// "value" — override per component, e.g. "price" for plan cards).
	const valueField = settings.valueField ?? "value";

	return (
		<div>
			{/* ── Header + toolbar actions ── */}
			{(title || visibleToolbarActions.length > 0) && (
				<div className="mb-3 flex w-full flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
					{title && (
						<h2 className="min-w-0 break-words text-start text-lg font-semibold tracking-tight text-foreground">
							{title}
						</h2>
					)}
					{visibleToolbarActions.length > 0 && (
						<div className="flex w-full flex-col items-stretch gap-4 sm:w-auto sm:flex-row sm:items-center">
							{visibleToolbarActions.map((action) => (
								<button
									key={action.id}
									type="button"
									onClick={() => openActionDialog(action)}
									className={`inline-flex h-9 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 sm:w-auto ${
										TOOLBAR_COLOR_CLASSES[String(action.color ?? "primary")] ??
										TOOLBAR_COLOR_CLASSES.primary
									}`}
								>
									{action.icon ? <TableIcon name={action.icon} /> : null}
									{action.label}
								</button>
							))}
						</div>
					)}
				</div>
			)}

			{/* ── Body ── */}
			{isLoading ? (
				<div className="flex items-center justify-center py-8">
					<span
						role="status"
						aria-label="Loading"
						className="size-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary"
					/>
				</div>
			) : items.length === 0 ? (
				<p className="py-8 text-center text-sm text-muted-foreground">
					{emptyMessage}
				</p>
			) : (
				<ul className="flex flex-col gap-2">
					{items.map((item) => {
						const actions = visibleRowActions(item);
						const cardDialogAction =
							settings.openDialogOnCardClick === true
								? actions.find((a) => a.action === "openDialog")
								: undefined;
						return (
							<li
								key={String(item.id ?? "")}
								onClick={
									cardDialogAction
										? () => openActionDialog(cardDialogAction, item)
										: undefined
								}
								className={`w-full rounded-lg border border-border bg-card text-card-foreground shadow-sm ${
									cardDialogAction
										? "cursor-pointer transition-colors hover:bg-accent/50"
										: ""
								}`}
							>
								<div className="flex items-center justify-between gap-4 px-4 py-3">
									<div className="flex min-w-0 flex-1 flex-col gap-1">
										<div className="flex items-center gap-2">
											<h3 className="text-start font-mono text-sm font-medium text-foreground">
												{String(item.key ?? item.name ?? item.id ?? "")}
											</h3>
											{showTypeBadge && item.type ? (
												<span className="rounded-md border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
													{String(item.type)}
												</span>
											) : null}
										</div>
										{item.description ? (
											<p className="truncate text-start text-xs text-muted-foreground">
												{String(item.description)}
											</p>
										) : null}
										{item[valueField] !== undefined &&
										item[valueField] !== null ? (
											<p className="break-all text-start text-sm text-foreground">
												{String(item[valueField])}
											</p>
										) : null}
									</div>

									{actions.length > 0 && (
										<div className="flex items-center gap-1">
											{actions.map((action) => (
												<button
													key={action.id}
													type="button"
													title={action.label}
													aria-label={action.label}
													onClick={(e) => {
														e.stopPropagation();
														openActionDialog(action, item);
													}}
													className={`inline-flex size-9 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
														ICON_COLOR_CLASSES[
															String(action.color ?? "default")
														] ?? ICON_COLOR_CLASSES.default
													}`}
												>
													{action.icon ? (
														<TableIcon name={action.icon} size={18} />
													) : null}
												</button>
											))}
										</div>
									)}
								</div>
							</li>
						);
					})}
				</ul>
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
					<p className="text-start text-sm text-foreground">
						{confirmPayload.message}
					</p>
				</BaseDialog>
			)}

			{/* ── Create / Edit form dialog ── */}
			{showFormDialog && formComponentId && (
				<BaseDialog
					isOpen
					title={formDialogTitle}
					onClose={handleFormClose}
					isPending={formSubmitting}
					size={formDialogSize}
					onSubmit={submitCurrentForm}
					slotProps={{
						submitButton: {
							show: !!formApiRef.current,
							props: {
								children: formApiRef.current?.submitLabel,
							},
						},
						closeButton: {
							show: true,
							props: {
								children: formApiRef.current?.closeLabel,
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
						pathParams={formPathParams}
						onFormReady={(api) => {
							// A form that knows it is a line editor recommends a wider
							// dialog; an explicit action `dialog.size` already won.
							if (api.size) {
								formSizeMemoryRef.current[String(formComponentId)] = api.size;
							}
							if (!formSizeHintRef.current && api.size) {
								setFormDialogSize((previous) =>
									previous === api.size ? previous : (api.size as DialogSize),
								);
							}
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
		</div>
	);
}
