// ──────────────────────────────────────────────────────────────────
// Screen routing types — `modules → screens → root component`.
//
// A screen mounts ONE root component (screens.componentId) — the old
// screen_widgets indirection is gone. Everything on a screen is a
// component; the pipeline resolves the URL to a screen and renders its
// root through AutoComponent.
// ──────────────────────────────────────────────────────────────────

export interface Screen {
	id: number;
	name: string;
	description: string;
	displayName: string;
	pathPattern: string | null;
	parentScreenId: number | null;
	/** The root component this screen mounts (screens.componentId). */
	componentId: number | null;
	visibleToPermissions?: Array<{
		resource: string;
		action: string;
		scope?: "own" | "tenant" | "all";
	}> | null;
	meta?: Record<string, unknown> | null;
}

export interface ResolvedScreen {
	/** The matched screen */
	screen: Screen | null;
	/** The parent screen when the matched screen has a parentScreenId */
	parentScreen: Screen | null;
	/** Parameters extracted from the URL path pattern */
	params: Record<string, string>;
	/** The root component to render (screen.componentId). */
	rootComponentId: number | null;
}

/** Props of the Next.js dashboard screen route. */
export interface ScreenPageProps {
	params: Promise<{ locale: string; module: string; screen: string[] }>;
}
