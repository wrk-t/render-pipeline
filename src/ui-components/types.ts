// ──────────────────────────────────────────────────────────────────
// UI component seed types.
//
// These definitions are the canonical contract between the backend's
// `ui_components` table (seeded from here) and the frontend renderers
// (UI_TYPE_MAP is derived from UI_COMPONENTS_SEED).
// ──────────────────────────────────────────────────────────────────

export interface UiComponentSeed {
	/** 24-char CUID (registered in the backend `uiComponents` namespace). */
	id: string;
	name: string;
	displayName: string;
	description: string;
	/** Discriminant used by the frontend to pick the field renderer. */
	componentType: string;
	/** Schema of the props this component accepts. */
	configProps: Record<string, unknown>;
	/** Which fieldDefinition types this component can render ([] = all). */
	compatibleFieldTypes: string[];
	displayOrder: number;
	category: string;
	tags: string[];
	isSystem: boolean;
	isActive: boolean;
}
