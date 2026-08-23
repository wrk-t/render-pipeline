// ──────────────────────────────────────────────────────────────────
// Render pipeline types — shared across the pipeline, all renderers
// and the screen routing layer.
// ──────────────────────────────────────────────────────────────────

import type React from "react";

// ── Rendered metadata (mirrors the backend `include=render` contract) ──

export interface RenderedElement {
	id: number;
	slotName: string;
	elementType: "field" | "component_ref" | "renderer";
	fieldDefinitionId?: number | null;
	uiComponentId?: number | null;
	name?: string | null;
	type?: string | null;
	label?: string | null;
	overrides?: Record<string, unknown> | null;
	referencedComponent?: RenderedComponent | null;
	paramBindings?: Record<string, ParamBinding> | null;
	rendererBlueprintId?: number | null;
	rendererConfig?: Record<string, unknown> | null;
	grid?: {
		row?: number;
		col?: number;
		rowSpan?: number;
		colSpan?: number;
	} | null;
	displayOrder: number;
	isActive: boolean;
	meta?: Record<string, unknown> | null;
}

export interface RenderedComponent {
	id: number;
	blueprintId: number;
	blueprintName: string;
	name: string;
	displayName: string;
	description: string | null;
	icon: string | null;
	category: string | null;
	config: Record<string, unknown> | null;
	pathPattern: string | null;
	visibleToPermissions?: Array<{
		resource: string;
		action: string;
		scope?: "own" | "tenant" | "all";
	}> | null;
	slots: Array<{
		name: string;
		displayName?: string;
		accepts: string[];
		grid?: string;
		overridable?: string[];
	}>;
	overridable: string[] | null;
	contract: Record<string, unknown> | null;
	slotsFilled: Record<string, RenderedElement[]>;
	tenantId: string | null;
	isActive: boolean;
	isSystem: boolean;
	meta: Record<string, unknown> | null;
}

// ── Param bindings (element-level input resolution) ─────────────

/**
 * Sources for resolving a child component's input from `paramBindings`:
 * - `literal`        — hardcoded value
 * - `route_param`    — URL path pattern (e.g. `:id`)
 * - `query_param`    — URL query string
 * - `scope`          — auth context (tenantId, userId, role)
 * - `parent_context` — walk up the component tree
 * - `screen`         — legacy screen widget source (same semantics as route_param)
 */
export type ParamBindingSource =
	| "literal"
	| "route_param"
	| "query_param"
	| "scope"
	| "parent_context"
	| "screen";

export interface ParamBinding {
	source: ParamBindingSource;
	value?: string;
}

// ── Renderer contract ───────────────────────────────────────────

export interface FormReadyApi {
	submitForm: () => Promise<void>;
	submitLabel: string;
	closeLabel: string;
}

/**
 * The uniform prop bag every renderer receives from the pipeline.
 * Renderers destructure only what they need.
 */
export interface RendererProps {
	component: RenderedComponent;
	pathParams?: Record<string, string>;
	onSuccess?: (res: any) => void;
	onError?: (err: unknown) => void;
	context?: string;
	onClose?: () => void;
	recordId?: string;
	onFormReady?: (api: FormReadyApi) => void;
}

export type RendererComponent = React.ComponentType<RendererProps>;

// ── Pipeline entry props ────────────────────────────────────────

export interface AutoComponentProps {
	componentId: number;
	onSuccess?: (res: any) => void;
	onError?: (err: unknown) => void;
	context?: string;
	onClose?: () => void;
	recordId?: string;
	onFormReady?: (api: FormReadyApi) => void;
	pathParams?: Record<string, string>;
}
