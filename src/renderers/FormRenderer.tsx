"use client";

import Box from "@mui/material/Box";
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
import type { FormAction } from "../dynamic-form/types";
import { useFeatures } from "../hooks/useFeatures";
import { useResolvedParams } from "../hooks/useResolvedParams";
import { useSnack } from "../hooks/useSnack";
import type { RenderedComponent, RenderedElement } from "../types";
import { adaptField, UI_TYPE_MAP } from "./FormFieldRenderer";
import { useStateContext } from "./StateContextRenderer";
import { AxiosError } from "axios";

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
			return [];
		case "switch":
			return false;
		default:
			return "";
	}
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
  }) => void;
  pathParams?: Record<string, string>;
}): ReactElement {
  const snack = useSnack();
  const router = useRouter();
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
  					walkElements(Object.values(el.referencedComponent.slotsFilled).flat());
  				}
  			}
  		};

  		walkElements(Object.values(component.slotsFilled).flat());
  		return fields;
  	}, [component, context, userPermissions]);

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

  	// Validation is built from ALL collected fields (ungrouped) — grouping
  	// is purely visual (Stack/Grid), so every field validates.
  	const validationSchema = useMemo(() => {
  		if (allFields.length === 0) return undefined;
  		return buildFormSchema({
  			sections: [],
  			ungroupedFields: allFields.map((f) =>
  				adaptField(f, isFieldReadOnly(f)),
  			) as any,
  		} as any);
  	}, [allFields]);

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
        Record<string, string> | undefined;
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
      validationSchema={validationSchema}
      onSubmit={handleSubmit}
      enableReinitialize
    >
	      {({ submitForm }) => {
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
            			  			context={context}
            			  		/>
            			  	</Box>
            			  ))}

	            {/* Actions slot — rendered from the metadata tree
	                (Button/Link components via their own renderers) */}
	            {!onFormReady &&
	              (component.slotsFilled["actions"] ?? []).some(
	                (el) =>
	                  el.isActive &&
	                  el.elementType === "component_ref" &&
	                  el.referencedComponent,
	              ) && (
	                <Stack direction="row" spacing={2} className="mt-6">
	                  {(component.slotsFilled["actions"] ?? [])
	                    .filter(
	                      (el) =>
	                        el.isActive &&
	                        el.elementType === "component_ref" &&
	                        el.referencedComponent,
	                    )
	                    .sort((a, b) => a.displayOrder - b.displayOrder)
	                    .map((el) => (
	                      <ComponentRenderer
	                        key={el.id}
	                        component={el.referencedComponent!}
	                        pathParams={pathParams}
	                        paramBindings={el.paramBindings}
	                        onClose={onClose}
	                      />
	                    ))}
	                </Stack>
	              )}
	          </Form>
        );
      }}
    </Formik>
  );
}
