"use client";

import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { AxiosError } from "axios";
import {
	Form,
	Formik,
	type FormikHelpers,
	useFormikContext,
	yupToFormErrors,
} from "formik";
import { usePathname, useRouter } from "next/navigation";
import { type ReactElement, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { checkComponentPermission } from "../ability/checkComponentPermission";
import { ComponentRenderer } from "../ComponentRenderer";
import { Unicon } from "../components/common/icon/Unicon";
import { BaseDialog } from "../components/dialog/BaseDialog";
import { getApiClient, useRenderUser } from "../deps";
import { buildFormSchema } from "../dynamic-form/buildValidationSchema";
import {
	allConditionsMatch,
	anyConditionMatches,
} from "../dynamic-form/fieldHelpers";
import type { FormAction } from "../dynamic-form/types";
import { useFeatures } from "../hooks/useFeatures";
import { useResolvedParams } from "../hooks/useResolvedParams";
import { useSnack } from "../hooks/useSnack";
import type { RenderedComponent, RenderedElement } from "../types";
import { adaptField, UI_TYPE_MAP } from "./FormFieldRenderer";
import { useStateContext } from "./StateContextRenderer";

// ──────────────────────────────────────────────────────────────────
// Field adapter imported from FormFieldRenderer (shared location)
// ──────────────────────────────────────────────────────────────────

/**
 * Type-appropriate Formik initial value, used when a field element
 * declares no explicit `defaultValue` override. Untouched fields are
 * submitted as-is, so array/boolean fields must not default to `""`
 * (the backend DTOs validate them as arrays/booleans).
 */
function defaultInitialValue(el: RenderedElement): unknown {
	const resolvedType = el.uiComponentId
		? (UI_TYPE_MAP[el.uiComponentId] ?? el.type ?? "text")
		: (el.type ?? "text");
	switch (resolvedType) {
		case "variants":
		case "multiselect":
		case "order-items":
			return [];
		case "switch":
			return false;
		default:
			return "";
	}
}

// ──────────────────────────────────────────────────────────────────
// Dotted-name helpers — template extras live in the `data` jsonb, so
// form fields are named "data.winePairing" etc. These set/read the
// NESTED values Formik produces/consumes for such names.
// ──────────────────────────────────────────────────────────────────

function setDottedValue(
	values: Record<string, unknown>,
	dottedName: string,
	value: unknown,
): void {
	const parts = dottedName.split(".");
	if (parts.length === 1) {
		values[parts[0]] = value;
		return;
	}
	let node = values;
	for (const part of parts.slice(0, -1)) {
		if (
			node[part] === null ||
			typeof node[part] !== "object" ||
			Array.isArray(node[part])
		) {
			node[part] = {};
		}
		node = node[part] as Record<string, unknown>;
	}
	node[parts[parts.length - 1]] = value;
}

function getDottedValue(
	obj: Record<string, unknown>,
	dottedName: string,
): unknown {
	let node: unknown = obj;
	for (const part of dottedName.split(".")) {
		if (node === null || typeof node !== "object") return undefined;
		node = (node as Record<string, unknown>)[part];
	}
	return node;
}

// ──────────────────────────────────────────────────────────────────
// FormSideEffects — metadata-declared field resets.
//
// A field may declare `clearFieldsOnChange: ["a", "b"]`; whenever its value
// changes (from the second render on, so an edit-form prefill does not wipe the
// loaded record), the listed fields return to their initial values. The message
// form uses it to clear the template/subject/body when the channel changes.
// ──────────────────────────────────────────────────────────────────

function FormSideEffects({
	specs,
}: {
	specs: Array<{ watch: string; clear: string[] }>;
}): null {
	const { values, initialValues, setFieldValue } =
		useFormikContext<Record<string, unknown>>();
	const previous = useRef<Record<string, unknown>>({});
	const firstRun = useRef(true);

	useEffect(() => {
		if (firstRun.current) {
			firstRun.current = false;
			for (const spec of specs) {
				previous.current[spec.watch] = getDottedValue(values, spec.watch);
			}
			return;
		}

		for (const spec of specs) {
			const current = getDottedValue(values, spec.watch);
			if (current === previous.current[spec.watch]) continue;
			previous.current[spec.watch] = current;
			for (const name of spec.clear) {
				const fallback = getDottedValue(initialValues, name);
				setFieldValue(
					name,
					Array.isArray(fallback) ? [] : (fallback ?? ""),
					false,
				);
			}
		}
	}, [values, initialValues, setFieldValue, specs]);

	return null;
}

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
		/** A `sendNow` submit: save the record, then confirm and send it. */
		submitNow?: { label: string; onClick: () => Promise<void> };
	}) => void;
	pathParams?: Record<string, string>;
}): ReactElement {
	const snack = useSnack();
	const router = useRouter();
	const pathname = usePathname();
	const { data: user } = useRenderUser();
	const { features } = useFeatures();
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
		// Additional context gate for fields that ALSO carry value conditions
		// (visibleWhen cannot express both shapes at once).
		const vic = (el.overrides as any)?.visibleInContexts;
		if (
			Array.isArray(vic) &&
			vic.length > 0 &&
			!(context && vic.includes(context))
		) {
			return false;
		}
		// Permission-gated fields (e.g. tenant owner/status — only for
		// users with the all-scope permission). Hidden fields must also
		// stay out of validation/initialValues so they don't block submit.
		const vp = (el.overrides as any)?.visibleToPermissions;
		if (vp?.length && !checkComponentPermission(userPermissions, vp)) {
			return false;
		}
		// Feature-gated fields: `requiresFeature` shows only when the flag is
		// ON; `hiddenWhenFeature` hides when the flag is ON (e.g. version-level
		// fields on the package form, which belong to the versions screen).
		const rf = (el.overrides as any)?.requiresFeature;
		if (rf && !features[rf]) {
			return false;
		}
		const hwf = (el.overrides as any)?.hiddenWhenFeature;
		if (hwf && features[hwf]) {
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

	const allFields = useMemo(() => {
		const fields: RenderedElement[] = [];

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
					// Recurse into any component (Stack/Grid/Box/…) — fields
					// are collected generically, no section special-case.
					walkElements(
						Object.values(el.referencedComponent.slotsFilled).flat(),
					);
				}
			}
		};

		walkElements(Object.values(component.slotsFilled).flat());
		return fields;
	}, [component, context, userPermissions]);

	/**
	 * Field-to-field side effects declared by the metadata: a controlling field
	 * (`channel`) lists the fields it invalidates (`clearFieldsOnChange`). When
	 * its value changes, those fields reset to their own defaults — a channel
	 * switch must not keep an SMS template/body on an email message.
	 */
	const resetSpecs = useMemo(
		() =>
			allFields.flatMap((el) => {
				const clear = (el.overrides as any)?.clearFieldsOnChange;
				if (!Array.isArray(clear) || clear.length === 0 || !el.name) return [];
				return [{ watch: el.name, clear: clear.map(String) }];
			}),
		[allFields],
	);

	// Submission config lives on the FORM (config.submit) — the submit
	// button is just a Button with action: "submit". Legacy seeds that
	// carried it on the button still work via the cfg.* fallbacks.
	const submitCfg = (component.config as any)?.submit as
		| {
				endpoint?: string;
				method?: string;
				context?: "create" | "edit";
				successMessage?: string;
				successRedirect?: string;
				stateContext?: string;
				fieldMap?: Record<string, string>;
		  }
		| undefined;

	// Actions live in the "actions" slot as Button/Link components — map
	// them back to the FormAction shape the footer + handleSubmit consume.
	const actions = useMemo<FormAction[]>(() => {
		const out: FormAction[] = [];
		for (const el of component.slotsFilled["actions"] ?? []) {
			const ref =
				el.elementType === "component_ref" ? el.referencedComponent : null;
			if (!ref) continue;
			const cfg = (ref.config ?? {}) as {
				label?: string;
				action?: string;
				path?: string;
				endpoint?: string;
				method?: "POST" | "PUT" | "PATCH";
				context?: "create" | "edit";
				successMessage?: string;
				successRedirect?: string;
				stateContext?: string;
				fieldMap?: Record<string, string>;
				/** Save then send (message builder's "Send now"). */
				sendNow?: boolean;
				confirm?: { title?: string; message?: string };
			};
			const label = cfg.label ?? ref.displayName;
			if (ref.blueprintName === "link") {
				out.push({ action: "link", label, path: cfg.path ?? "/" });
			} else if (ref.blueprintName === "button") {
				if (cfg.action === "submit") {
					out.push({
						action: "apiCall",
						label,
						endpoint: submitCfg?.endpoint ?? cfg.endpoint ?? "",
						method: (submitCfg?.method ?? cfg.method ?? "POST") as any,
						context: submitCfg?.context ?? cfg.context,
						successMessage: submitCfg?.successMessage ?? cfg.successMessage,
						successRedirect: submitCfg?.successRedirect ?? cfg.successRedirect,
						...(cfg.sendNow ? { sendNow: true } : {}),
						...(cfg.confirm ? { confirm: cfg.confirm } : {}),
						...(submitCfg?.stateContext || cfg.stateContext
							? { stateContext: submitCfg?.stateContext ?? cfg.stateContext }
							: {}),
						...(submitCfg?.fieldMap || cfg.fieldMap
							? { fieldMap: submitCfg?.fieldMap ?? cfg.fieldMap }
							: {}),
					} as any);
				} else if (cfg.action === "close") {
					out.push({ action: "cancel", label });
				}
			}
		}
		return out;
	}, [component.slotsFilled, submitCfg]);

	// ── Fetch record data for edit mode ──
	const editEndpoint = useMemo(() => {
		const editAction = actions.find(
			(a: any) => a.context === "edit" && a.action === "apiCall",
		) as any;
		// A form mounted by an id-less screen (Settings → Messaging) has no
		// `edit` context, but still edits one record: its GET action is the
		// record fetch even without the context marker.
		const fetchAction =
			editAction ??
			(actions.find(
				(a: any) =>
					a.action === "apiCall" && String(a.method).toUpperCase() === "GET",
			) as any);
		return fetchAction?.endpoint ?? null;
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
		// First, apply default values from overrides. An untouched switch must be
		// a BOOLEAN, not the `""` scalar fallback: a SwitchField with no configured
		// default submitted `isActive: ""`, which the API rejects as a 400 (CRM-29 —
		// creating a customer group failed exactly this way).
		for (const field of allFields) {
			const name = field.name ?? "";
			if (name) {
				const configured = (field.overrides as any)?.defaultValue;
				setDottedValue(
					values,
					name,
					configured !== undefined && configured !== null
						? configured
						: defaultInitialValue(field),
				);
			}
		}
		// Then, overlay pathParams for matching field names. A **dotted** key
		// (`audienceParams.groupId`) prefills a nested value, which is how a row
		// action opens the campaign form with its audience already chosen (CRM-27).
		if (pathParams) {
			for (const [key, value] of Object.entries(pathParams)) {
				if (key.includes(".")) setDottedValue(values, key, value);
				else if (key in values) values[key] = value;
			}
		}
		// Then, overlay record data for edit mode (dotted names resolve
		// nested values, e.g. "data.winePairing" ← record.data.winePairing).
		// The fetch only runs when there is an edit/GET action to read, so a form
		// mounted on an id-less screen (Settings → Messaging) also opens prefilled.
		if (recordData) {
			const src = recordData as Record<string, unknown>;
			for (const field of allFields) {
				const name = field.name ?? "";
				if (!name) continue;
				const v = getDottedValue(src, name);
				if (v !== undefined && v !== null) setDottedValue(values, name, v);
			}
		}
		return values;
	}, [allFields, recordData, effectiveContext, pathParams]);

	// Validation is built per submit from the fields that are actually visible
	// for the current values — a conditional field that is hidden must not
	// block the form with its `Required` rule (`audienceParams.groupId` is
	// required only for a group audience, `schedule.weekdays` only weekly…).
	const validateForm = (values: Record<string, unknown>) => {
		const fields = allFields
			.filter((field) => {
				const conditions = (field.overrides as any)?.visibleWhen;
				if (!Array.isArray(conditions) || conditions.length === 0) return true;
				return allConditionsMatch(conditions, values);
			})
			.map((field) => {
				const adapted = adaptField(field, isFieldReadOnly(field)) as any;
				const requiredWhen = (field.overrides as any)?.requiredWhen;
				const requiredNow =
					adapted.isRequired ||
					(Array.isArray(requiredWhen) &&
						anyConditionMatches(requiredWhen, values));
				return { ...adapted, isRequired: requiredNow };
			});

		if (fields.length === 0) return {};
		const schema = buildFormSchema({
			sections: [],
			ungroupedFields: fields,
		} as any);
		try {
			schema.validateSync(values, { abortEarly: false });
			return {};
		} catch (error) {
			if ((error as { name?: string })?.name === "ValidationError") {
				return yupToFormErrors(error);
			}
			throw error;
		}
	};

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

	/**
	 * The dialog's primary submit is "Save draft"; a `sendNow` submit is the
	 * secondary footer action. Keeping them apart means the footer never POSTs
	 * a send when the admin only wanted to save.
	 */
	const primaryApiActions = useMemo(
		() => visibleApiActions.filter((a: any) => !a.sendNow),
		[visibleApiActions],
	);
	const sendNowAction = useMemo(
		() => visibleApiActions.find((a: any) => a.sendNow) as any,
		[visibleApiActions],
	);

	/**
	 * Does an action-button belong to the form's current context?
	 *
	 * A shared create+edit form declares one submit per context. The submit path
	 * already picked the right one, but the **buttons** were rendered unfiltered —
	 * so a detail page showed CREATE *and* UPDATE, and clicking the first one
	 * POSTed instead of saving the edit (CRM-28: the Active switch "did not
	 * persist" because the click never reached the PATCH). A button with no
	 * `context` is always shown.
	 */
	const actionInContext = (button: RenderedComponent | null | undefined) => {
		const actionContext = (button?.config as { context?: string } | null)
			?.context;
		if (!(actionContext && effectiveContext)) return true;
		return actionContext === effectiveContext;
	};

	/**
	 * A **record fetch** is an `apiCall` + `GET` action: the form reads the row it is
	 * editing from it and must not render it as a button. The submit path already
	 * ignores GET actions; the actions row leaked them until now (CRM-25: the edit
	 * form opened blank because it had no fetch action, and adding one would have
	 * shown a stray button on a detail layout).
	 */
	const isRecordFetch = (button: RenderedComponent | null | undefined) => {
		const config = button?.config as
			| { action?: string; type?: string; method?: string }
			| null
			| undefined;
		return (
			(config?.action === "apiCall" || config?.type === "submit") &&
			String(config?.method ?? "").toUpperCase() === "GET"
		);
	};

	const stateCtx = useStateContext();

	/**
	 * A form mounted by a **detail page** (not a dialog) renders its own action
	 * row, including the metadata's `close` button. That button had no handler
	 * there — `onClose` is only provided by dialogs — so "Close" did nothing on
	 * the page. Fall back to the parent route (the list the detail page was
	 * opened from), which is where a close should land.
	 */
	const closeTarget = useMemo(() => {
		if (!pathname) return null;
		const parent = pathname.replace(/\/[^/]+\/?$/, "");
		return parent && parent !== pathname ? parent : null;
	}, [pathname]);

	const handleClose = onClose
		? onClose
		: () => {
				if (closeTarget) router.push(closeTarget);
				else router.back();
			};

	// ── "Save then send" (the message builder's Send now) ─────────
	// The submitted action picks its own mode through this ref: Formik's
	// submitForm is the only entry point the dialog footer has, so the secondary
	// button sets the mode and then submits.
	const submitModeRef = useRef<"submit" | "sendNow">("submit");
	const [pendingSend, setPendingSend] = useState<null | {
		endpoint: string;
		title: string;
		dialogTitle: string;
		message: string;
	}>(null);
	const [sendTyped, setSendTyped] = useState("");
	const [sending, setSending] = useState(false);

	const handleSubmit = async (
		values: Record<string, unknown>,
		helpers: FormikHelpers<Record<string, unknown>>,
	) => {
		const mode = submitModeRef.current;
		submitModeRef.current = "submit";
		const submitAction = (
			mode === "sendNow" ? sendNowAction : primaryApiActions[0]
		) as any;
		if (!submitAction) {
			console.warn(
				"[FormRenderer] submit pressed but no submit action found — actions slot:",
				component.slotsFilled["actions"] ?? [],
			);
			return;
		}
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

			// "Send now": the POST saved a draft, so the send is one confirmation
			// away — with the title retyped, exactly like the list's row action.
			if (mode === "sendNow") {
				const createdId = res.data?.data?.id ?? res.data?.id;
				if (createdId) {
					setSendTyped("");
					setPendingSend({
						endpoint: `${String(endpoint).replace(/\/+$/, "")}/${createdId}/send`,
						title: String(
							(values as Record<string, unknown>).title ?? "",
						).trim(),
						dialogTitle: submitAction.confirm?.title ?? "Send now",
						message: submitAction.confirm?.message ?? "",
					});
					return;
				}
			}

			if (onSuccess) onSuccess(res.data);
			if (submitAction.successMessage)
				snack.success(submitAction.successMessage);
			if (submitAction.successRedirect)
				router.push(
					submitAction.successRedirect.replace(
						/\{(\w+)\}/g,
						(_: string, key: string) => {
							if (key === "id" && recordId) return recordId;
							if (resolvedPathParams && key in resolvedPathParams)
								return String(resolvedPathParams[key] ?? "");
							return `{${key}}`;
						},
					),
				);
		} catch (err) {
			console.log({ err });
			if (onError) onError(err);
			snack.error(err);
		} finally {
			helpers.setSubmitting(false);
		}
	};

	// Close actions (non-submit buttons)
	const closeActions = actions.filter(
		(a: any) => a.action === "close" || a.action === "cancel",
	);

	// Resolve action labels for the dialog footer
	const submitLabel = (primaryApiActions[0] as any)?.label ?? "Submit";
	const closeLabel = (closeActions[0] as any)?.label ?? "Close";

	// Ref to hold Formik's submitForm for the parent dialog
	const submitFormRef = useRef<(() => Promise<void>) | null>(null);

	/** Confirm the draft that was just saved and send it now. */
	const confirmSendNow = async () => {
		if (!pendingSend) return;
		setSending(true);
		try {
			const res = await getApiClient().request({
				url: pendingSend.endpoint,
				method: "post",
				data: { confirmTitle: sendTyped.trim() },
			});
			const message: string =
				res.data?.data?.message ??
				res.data?.message ??
				"Message is being prepared";
			await snack.success(message);
			setPendingSend(null);
			if (onSuccess) onSuccess(res.data);
		} catch (error) {
			await snack.error(error, "Send failed");
		} finally {
			setSending(false);
		}
	};

	// Notify parent dialog when form is ready (only if there are submit actions)
	useEffect(() => {
		if (onFormReady && submitFormRef.current && primaryApiActions.length > 0) {
			onFormReady({
				submitForm: () => submitFormRef.current!(),
				submitLabel,
				closeLabel,
				...(sendNowAction
					? {
							submitNow: {
								label: sendNowAction.label ?? "Send now",
								onClick: async () => {
									submitModeRef.current = "sendNow";
									await submitFormRef.current!();
								},
							},
						}
					: {}),
			});
		}
	}, [
		onFormReady,
		submitLabel,
		closeLabel,
		primaryApiActions.length,
		sendNowAction,
	]);

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
								context={context}
							/>
						</Box>
					))}
			</Box>
		);
	}

	return (
		<Formik
			initialValues={initialValues}
			validate={validateForm}
			onSubmit={handleSubmit}
			enableReinitialize
		>
			{({ submitForm }) => {
				submitFormRef.current = submitForm as unknown as () => Promise<void>;
				return (
					<>
						<Form>
							<FormSideEffects specs={resetSpecs} />
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

							{/* Render all content elements through ComponentRenderer.
							    They are the form's sections, so the stack is what keeps
							    one section's title from sitting on the previous field —
							    the gap belongs to the form, not to each section. It is
							    wider than a section's inner spacing (3) so a title reads
							    as a new group, not as another field. */}
							<Stack spacing={4}>
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
												context={context}
											/>
										</Box>
									))}
							</Stack>

							{/* Actions slot — rendered from the metadata tree
	                (Button/Link components via their own renderers). Only the
	                current context's buttons: a create+edit form must not offer
	                both (CRM-28). */}
							{!onFormReady &&
								(component.slotsFilled["actions"] ?? []).some(
									(el) =>
										el.isActive &&
										el.elementType === "component_ref" &&
										el.referencedComponent &&
										!(el.referencedComponent.config as any)?.sendNow &&
										actionInContext(el.referencedComponent) &&
										!isRecordFetch(el.referencedComponent),
								) && (
									<Stack direction="row" spacing={2} className="mt-6">
										{(component.slotsFilled["actions"] ?? [])
											.filter(
												(el) =>
													el.isActive &&
													el.elementType === "component_ref" &&
													el.referencedComponent &&
													!(el.referencedComponent.config as any)?.sendNow &&
													actionInContext(el.referencedComponent) &&
													!isRecordFetch(el.referencedComponent),
											)
											.sort((a, b) => a.displayOrder - b.displayOrder)
											.map((el) => (
												<ComponentRenderer
													key={el.id}
													component={el.referencedComponent!}
													pathParams={pathParams}
													paramBindings={el.paramBindings}
													onClose={handleClose}
												/>
											))}
									</Stack>
								)}
						</Form>
						{pendingSend && (
							<BaseDialog
								isOpen
								title={pendingSend.dialogTitle}
								onClose={() => setPendingSend(null)}
								isPending={sending}
								onSubmit={() => void confirmSendNow()}
								slotProps={{
									submitButton: {
										props: {
											children: "Send now",
											disabled: sendTyped.trim() !== pendingSend.title,
										},
									},
								}}
							>
								<Typography>{pendingSend.message}</Typography>
								{pendingSend.title && (
									<Box className="mt-3 flex items-center gap-2 rounded border border-solid border-gray-300 bg-gray-50 px-3 py-2">
										<Box className="flex-1">
											<Typography variant="caption" color="text.secondary">
												Message title
											</Typography>
											<Typography
												variant="body2"
												className="select-all font-semibold"
											>
												{pendingSend.title}
											</Typography>
										</Box>
										<Tooltip title="Copy">
											<IconButton
												size="small"
												aria-label="Copy title"
												onClick={async () => {
													try {
														await navigator.clipboard.writeText(
															pendingSend.title,
														);
														await snack.success("Copied");
													} catch {
														/* the text is still selectable */
													}
												}}
											>
												<Unicon name="Copy" size={16} />
											</IconButton>
										</Tooltip>
									</Box>
								)}
								<TextField
									fullWidth
									autoFocus
									className="mt-4"
									label="Type the title to confirm"
									value={sendTyped}
									onChange={(event) => setSendTyped(event.target.value)}
									error={
										sendTyped.length > 0 &&
										sendTyped.trim() !== pendingSend.title
									}
									helperText={pendingSend.title}
								/>
							</BaseDialog>
						)}
					</>
				);
			}}
		</Formik>
	);
}
