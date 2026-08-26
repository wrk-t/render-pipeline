// ──────────────────────────────────────────────────────────────────
// ComponentRenderer — the pipeline entry.
//
//   AutoComponent    Stage 1: fetch  (useComponentRender)
//                    Stage 2: gate   (permission check)
//   ComponentRenderer Stage 3: resolve (paramBindings → pathParams)
//                    Stage 4: dispatch (registry lookup + fallback)
//
// Every recursion into a child component flows back through
// ComponentRenderer, so gating, param resolution and the registry
// apply uniformly at any depth.
// ──────────────────────────────────────────────────────────────────

"use client";

import { type ReactElement, useMemo } from "react";
import { checkComponentPermission } from "./ability/checkComponentPermission";
import { useRenderUser } from "./deps";
import { ViewTenantContext } from "./hooks/useFeatures";
import { RenderBoundary, UnknownRenderer } from "./RenderBoundary";
import { rendererRegistry } from "./registry";
import {
	getQueryParams,
	ParentBindingsContext,
	resolveParamBindings,
	useParamScope,
	useParentBindings,
} from "./resolveParams";
import type { AutoComponentProps, ParamBinding, RendererProps } from "./types";
import { useComponentRender } from "./useComponentRender";

export interface ComponentRendererProps extends RendererProps {
	/** Element-level bindings that resolve the child's contract inputs. */
	paramBindings?: Record<string, ParamBinding> | null;
}

export function ComponentRenderer({
	component,
	onSuccess,
	onError,
	context,
	onClose,
	recordId,
	onFormReady,
	pathParams,
	paramBindings,
}: ComponentRendererProps): ReactElement | null {
	const { data: user } = useRenderUser();
	const parentBindings = useParentBindings();
	const scope = useParamScope();

	// ── Stage 3: resolve — merge element bindings into pathParams ──
	const resolvedParams = useMemo(() => {
		return {
			...(pathParams ?? {}),
			...resolveParamBindings(paramBindings, {
				pathParams: pathParams ?? {},
				queryParams: getQueryParams(),
				scope,
				parentBindings,
			}),
		};
	}, [paramBindings, pathParams, parentBindings, scope]);

	// ── Stage 2: gate — visibleToPermissions on the component ──
	const userPermissions = user?.permissions?.data ?? [];
	if (
		!checkComponentPermission(
			userPermissions,
			component.visibleToPermissions ?? null,
		)
	) {
		// Component is hidden due to insufficient permissions
		return null;
	}

	// ── Stage 4: dispatch — registry lookup with fallback ──
	const Renderer = rendererRegistry[component.blueprintName];

	return (
		<ViewTenantContext.Provider
			value={
				typeof resolvedParams.tenantId === "string"
					? resolvedParams.tenantId
					: undefined
			}
		>
			<ParentBindingsContext.Provider
				value={{ ...parentBindings, ...resolvedParams }}
			>
				{Renderer ? (
					<Renderer
						component={component}
						pathParams={resolvedParams}
						onSuccess={onSuccess}
						onError={onError}
						context={context}
						onClose={onClose}
						recordId={recordId}
						onFormReady={onFormReady}
					/>
				) : (
					<UnknownRenderer blueprintName={component.blueprintName} />
				)}
			</ParentBindingsContext.Provider>
		</ViewTenantContext.Provider>
	);
}

export function AutoComponent({
	componentId,
	onSuccess,
	onError,
	context,
	onClose,
	recordId,
	onFormReady,
	pathParams,
}: AutoComponentProps): ReactElement {
	const { data: component, isLoading, error } = useComponentRender(componentId);

	return (
		<RenderBoundary isLoading={isLoading} error={error}>
			{component ? (
				<ComponentRenderer
					component={component}
					onSuccess={onSuccess}
					onError={onError}
					context={context}
					onClose={onClose}
					recordId={recordId}
					onFormReady={onFormReady}
					pathParams={pathParams}
				/>
			) : null}
		</RenderBoundary>
	);
}
