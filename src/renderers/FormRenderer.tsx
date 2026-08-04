"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Form, Formik, type FormikHelpers } from "formik";
import { useRouter } from "next/navigation";
import { type ReactElement, useEffect, useMemo, useRef } from "react";
import useSWR from "swr";
import { checkComponentPermission } from "../ability/checkComponentPermission";
import { ComponentRenderer } from "../ComponentRenderer";
import { getApiClient, useRenderUser } from "../deps";
import { buildFormSchema } from "../dynamic-form/buildValidationSchema";
import type { FormAction, FormRenderSection } from "../dynamic-form/types";
import { useResolvedParams } from "../hooks/useResolvedParams";
import { useSnack } from "../hooks/useSnack";
import type { RenderedComponent, RenderedElement } from "../types";
import { adaptField } from "./FormFieldRenderer";
import { useStateContext } from "./StateContextRenderer";

// ──────────────────────────────────────────────────────────────────
// Field adapter imported from FormFieldRenderer (shared location)
// ──────────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────────
// FormRenderer
// ──────────────────────────────────────────────────────────────────

export function FormRenderer({
	component,
	onSuccess,
	onError,
	context,
	onClose,
	recordId,
	onFormReady,
	pathParams,
}: {
	component: RenderedComponent;
	onSuccess?: (res: any) => void;
	onError?: (err: unknown) => void;
	context?: string;
	onClose?: () => void;
	recordId?: string;
	onFormReady?: (api: {
		submitForm: () => Promise<void>;
		submitLabel: string;
		closeLabel: string;
	}) => void;
	pathParams?: Record<string, string>;
}): ReactElement {
	const snack = useSnack();
	const router = useRouter();
	const { data: user } = useRenderUser();
	const userPermissions: Array<{ resource: string; scope?: string }> =
		(user as any)?.permissions?.data ?? [];
	// Route params + the current user's tenant (for {tenantId} templates).
	const resolvedPathParams = useResolvedParams(pathParams);

	// ── Check visibleToPermissions on a referenced component ──
	const isComponentVisible = (
		ref: RenderedComponent | null | undefined,
	): boolean => {
		if (!ref) return true;
		return checkComponentPermission(
			userPermissions,
			ref.visibleToPermissions?.length
				? (ref.visibleToPermissions as any)
				: null,
		);
	};

	// ── Check visibleWhen condition ──
	const isVisible = (el: RenderedElement): boolean => {
		if (!el.isActive) return false;
		const vw = (el.overrides as any)?.visibleWhen;
		if (vw?.context && Array.isArray(vw.context)) {
			if (!(context && vw.context.includes(context))) return false;
		}
		// Permission-gated fields (e.g. tenant owner/status — only for
		// users with the all-scope permission). Hidden fields must also
		// stay out of validation/initialValues so they don't block submit.
		const vp = (el.overrides as any)?.visibleToPermissions;
		if (vp?.length && !checkComponentPermission(userPermissions, vp)) {
			return false;
		}
		return true;
	};

	// ── Check readOnlyWhen condition ──
	const isFieldReadOnly = (el: RenderedElement): boolean => {
		const rw = (el.overrides as any)?.readOnlyWhen;
		if (!rw) return (el.overrides as any)?.isReadOnly ?? false;
		if (rw.context && Array.isArray(rw.context)) {
			if (context && rw.context.includes(context)) return true;
		}
		return (el.overrides as any)?.isReadOnly ?? false;
	};

	const contentElements = useMemo(
		() => (component.slotsFilled["content"] ?? []).filter((e) => e.isActive),
		[component.slotsFilled],
	);

	const { allFields, sections } = useMemo(() => {
		const fields: RenderedElement[] = [];
		const secs: FormRenderSection[] = [];

		const walkElements = (els: RenderedElement[]) => {
			for (const el of els) {
				if (!isVisible(el)) continue;

				// ── Check referenced component's visibleToPermissions ──
				if (
					el.elementType === "component_ref" &&
					el.referencedComponent &&
					!isComponentVisible(el.referencedComponent)
				) {
					continue;
				}

				if (el.elementType === "field") {
					fields.push(el);
				} else if (
					el.elementType === "component_ref" &&
					el.referencedComponent
				) {
					const ref = el.referencedComponent;
					if (ref.blueprintName === "section") {
						const sectionFields: RenderedElement[] = [];
						for (const slotEls of Object.values(ref.slotsFilled)) {
							for (const slotEl of slotEls) {
								if (slotEl.elementType === "field" && isVisible(slotEl)) {
									sectionFields.push(slotEl);
									fields.push(slotEl);
								}
							}
						}
						secs.push({
							id: ref.id,
							name: ref.name,
							displayName: ref.displayName,
							description: ref.description,
							collapsible: (ref.config as any)?.collapsible ?? false,
							collapsedByDefault:
								(ref.config as any)?.collapsedByDefault ?? false,
							displayOrder: el.displayOrder,
							fields: sectionFields.map((f) =>
								adaptField(f, isFieldReadOnly(f)),
							) as any,
						} as FormRenderSection);
					} else {
						for (const slotEls of Object.values(ref.slotsFilled)) {
							walkElements(slotEls);
						}
					}
				}
			}
		};

		walkElements(Object.values(component.slotsFilled).flat());
		return { allFields: fields, sections: secs };
	}, [component, context, userPermissions]);

	const actions: FormAction[] =
		(component.config?.actions as FormAction[]) ?? [];

	// ── Fetch record data for edit mode ──
	const editEndpoint = useMemo(() => {
		const editAction = actions.find(
			(a: any) => a.context === "edit" && a.action === "apiCall",
		) as any;
		return editAction?.endpoint ?? null;
	}, [actions]);
	const needsRecordId = editEndpoint ? /\{id\}/.test(editEndpoint) : false;

	// Derive effective context from actions if not explicitly provided.
	const effectiveContext = useMemo(() => {
		if (context) return context;
		const editAction = actions.find(
			(a: any) => a.context === "edit" && a.action === "apiCall",
		) as any;
		if (editAction) return "edit";
		const createAction = actions.find(
			(a: any) => a.context === "create" && a.action === "apiCall",
		) as any;
		if (createAction) return "create";
		return context ?? "create";
	}, [context, actions]);

	const { data: recordData } = useSWR(
		effectiveContext === "edit" &&
			editEndpoint &&
			(!needsRecordId ||
				!!recordId ||
				!!(
					resolvedPathParams &&
					"id" in (resolvedPathParams as Record<string, unknown>)
				))
			? editEndpoint.replace(/\{(\w+)\}/g, (_: string, key: string) => {
					if (key === "id" && recordId) return recordId;
					if (resolvedPathParams && key in resolvedPathParams)
						return String(resolvedPathParams[key] ?? "");
					return `{${key}}`;
				})
			: null,
		async (url: string) => {
			try {
				const r = await getApiClient().get(url);
				return r.data?.data ?? r.data ?? null;
			} catch {
				return null;
			}
		},
	);

	const initialValues = useMemo(() => {
		const values: Record<string, unknown> = {};
		// First, apply default values from overrides
		for (const field of allFields) {
			const name = field.name ?? "";
			if (name) values[name] = (field.overrides as any)?.defaultValue ?? "";
		}
		// Then, overlay pathParams for matching field names
		if (pathParams) {
			for (const [key, value] of Object.entries(pathParams)) {
				if (key in values) values[key] = value;
			}
		}
		// Then, overlay record data for edit mode
		if (recordData && effectiveContext === "edit") {
			for (const key of Object.keys(recordData as Record<string, unknown>)) {
				if (key in values) values[key] = (recordData as any)[key] ?? "";
			}
		}
		return values;
	}, [allFields, recordData, effectiveContext, pathParams]);

	const validationSchema = useMemo(() => {
		if (sections.length === 0) return undefined;
		return buildFormSchema({ sections, ungroupedFields: [] } as any);
	}, [sections]);

	// Filter actions by context if provided (exclude GET-only "fetch" actions from submit buttons)
	const visibleApiActions = useMemo(
		() =>
			actions.filter(
				(a: any) =>
					(a.action === "apiCall" || a.type === "submit") &&
					(!(effectiveContext && a.context) ||
						a.context === effectiveContext) &&
					a.method !== "GET",
			),
		[actions, effectiveContext],
	);

	const stateCtx = useStateContext();

	const handleSubmit = async (
		values: Record<string, unknown>,
		helpers: FormikHelpers<Record<string, unknown>>,
	) => {
		const submitAction = visibleApiActions[0] as any;
		if (!submitAction) return;
		try {
			const endpoint = submitAction.endpoint.replace(
				/\{(\w+)\}/g,
				(_: string, key: string) => {
					if (key === "id" && recordId) return recordId;
					if (resolvedPathParams && key in resolvedPathParams)
						return String(resolvedPathParams[key] ?? "");
					return `{${key}}`;
				},
			);

			// If the action references a state context, use the context values as payload
			const contextName = (submitAction as any).stateContext;
			let payload =
				contextName && stateCtx
					? {
							operationIds:
								(stateCtx.getValue("selectedIds") as string[]) ?? [],
						}
					: values;

			// Apply fieldMap: rename payload keys (e.g. tenantId → ownerTenantId)
			const fieldMap = (submitAction as any).fieldMap as
				| Record<string, string>
				| undefined;
			if (fieldMap && typeof payload === "object" && payload !== null) {
				const mapped: Record<string, unknown> = {
					...(payload as Record<string, unknown>),
				};
				for (const [from, to] of Object.entries(fieldMap)) {
					if (from in mapped) {
						mapped[to] = mapped[from];
						delete mapped[from];
					}
				}
				payload = mapped;
			}

			const res = await getApiClient().request({
				url: endpoint,
				method: (submitAction.method ?? "POST").toLowerCase(),
				data: payload,
			});
			if (onSuccess) onSuccess(res.data);
			if (submitAction.successMessage)
				snack.success(submitAction.successMessage);
			if (submitAction.successRedirect)
				router.push(submitAction.successRedirect);
		} catch (err) {
			if (onError) onError(err);
			else snack.error(undefined, "An error occurred");
		} finally {
			helpers.setSubmitting(false);
		}
	};

	// Close actions (non-submit buttons)
	const closeActions = actions.filter((a: any) => a.action === "close");

	const linkActions = actions.filter(
		(a: any) => a.action === "link" || a.action === "navigate",
	);

	// Resolve action labels for the dialog footer
	const submitLabel = (visibleApiActions[0] as any)?.label ?? "Submit";
	const closeLabel = (closeActions[0] as any)?.label ?? "Close";

	// Ref to hold Formik's submitForm for the parent dialog
	const submitFormRef = useRef<(() => Promise<void>) | null>(null);

	// Notify parent dialog when form is ready (only if there are submit actions)
	useEffect(() => {
		if (onFormReady && submitFormRef.current && visibleApiActions.length > 0) {
			onFormReady({
				submitForm: () => submitFormRef.current!(),
				submitLabel,
				closeLabel,
			});
		}
	}, [onFormReady, submitLabel, closeLabel, visibleApiActions.length]);

	// ── No form fields — render content directly (e.g. table inside form dialog) ──
	const hasNoFields = allFields.length === 0;

	if (hasNoFields) {
		return (
			<Box>
				{!onFormReady && component.displayName && (
					<Typography variant="h5" className="mb-4 font-bold">
						{component.displayName}
					</Typography>
				)}
				{/* Render non-field content (tables, state-context, etc.) */}
				{contentElements
					.filter(
						(el) =>
							el.elementType === "component_ref" && el.referencedComponent,
					)
					.sort((a, b) => a.displayOrder - b.displayOrder)
					.map((el) => (
						<Box key={el.id}>
							<ComponentRenderer
								component={el.referencedComponent!}
								pathParams={pathParams}
								paramBindings={el.paramBindings}
							/>
						</Box>
					))}
			</Box>
		);
	}

	return (
		<Formik
			initialValues={initialValues}
			validationSchema={validationSchema}
			onSubmit={handleSubmit}
			enableReinitialize
		>
			{({ isSubmitting, submitForm }) => {
				submitFormRef.current = submitForm as unknown as () => Promise<void>;
				return (
					<Form>
						{!onFormReady && component.displayName && (
							<Box className="mb-6">
								<Typography variant="h5" className="font-bold">
									{component.displayName}
								</Typography>
								{component.description && (
									<Typography
										variant="body2"
										color="text.secondary"
										className="mt-1"
									>
										{component.description}
									</Typography>
								)}
							</Box>
						)}

						{/* Render all content elements through ComponentRenderer */}
						{contentElements
							.filter(
								(el) =>
									el.elementType === "component_ref" &&
									el.referencedComponent &&
									isVisible(el) &&
									isComponentVisible(el.referencedComponent),
							)
							.sort((a, b) => a.displayOrder - b.displayOrder)
							.map((el) => (
								<Box key={el.id}>
									<ComponentRenderer
										component={el.referencedComponent!}
										pathParams={pathParams}
										paramBindings={el.paramBindings}
									/>
								</Box>
							))}

						{/* Standalone buttons (when not wrapped in a dialog) */}
						{!onFormReady &&
							(visibleApiActions.length > 0 ||
								closeActions.length > 0 ||
								linkActions.length > 0) && (
								<Stack direction="row" spacing={2} className="mt-6">
									{closeActions.map((a: any) => (
										<Button
											key={a.label}
											variant="text"
											color="inherit"
											disabled={isSubmitting}
											onClick={onClose}
										>
											{a.label}
										</Button>
									))}
									{visibleApiActions.map((a: any) => (
										<Button
											key={a.label}
											type="submit"
											variant="contained"
											disabled={isSubmitting}
										>
											{isSubmitting ? (
												<CircularProgress size={20} color="inherit" />
											) : (
												a.label
											)}
										</Button>
									))}
									{linkActions.map((a: any) => (
										<Button
											key={a.label}
											variant="text"
											onClick={() => {
												const resolved = a.path.replace(
													/\{(\w+)\}/g,
													(_: string, key: string) =>
														pathParams && key in pathParams
															? String(pathParams[key])
															: `{${key}}`,
												);
												router.push(resolved);
											}}
										>
											{a.label}
										</Button>
									))}
								</Stack>
							)}
					</Form>
				);
			}}
		</Formik>
	);
}
