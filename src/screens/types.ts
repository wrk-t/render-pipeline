// ──────────────────────────────────────────────────────────────────
// Screen routing types — legacy `modules → screens → screen_widgets`
// metadata that routes URLs to arch components.
// ──────────────────────────────────────────────────────────────────

import type { ParamBinding } from "../types";

export interface Widget {
	id: string;
	widgetType:
		| "table"
		| "form"
		| "chart"
		| "info"
		| "tabs"
		| "editor"
		| "swagger"
		| "test"
		| "page";
	resourceId: string | null;
	displayOrder: number;
	widgetOverrides: { title?: string; sizeHint?: string } | null;
	config: Record<string, unknown> | null;
	paramBindings?: Record<string, ParamBinding> | null;
	isActive: boolean;
}

export interface Screen {
	id: string;
	name: string;
	description: string;
	displayName: string;
	pathPattern: string | null;
	parentScreenId: string | null;
	visibleToPermissions?: Array<{
		resource: string;
		action: string;
		scope?: "own" | "tenant" | "all";
	}> | null;
	meta?: Record<string, unknown> | null;
}

export interface ResolvedScreen {
	/** The matched child screen (e.g. the active tab) */
	screen: Screen | null;
	/** The parent screen when the matched screen has a parentScreenId */
	parentScreen: Screen | null;
	/** Widgets belonging to the parent screen (contains the TabWidget) */
	parentWidgets: Widget[];
	/** Parameters extracted from the URL path pattern */
	params: Record<string, string>;
	/** Widgets belonging to the matched screen */
	widgets: Widget[];
}

/** Props of the Next.js dashboard screen route. */
export interface ScreenPageProps {
	params: Promise<{ locale: string; module: string; screen: string[] }>;
}
