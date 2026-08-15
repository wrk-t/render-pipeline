import { checkComponentPermission } from "../ability/checkComponentPermission";
import { getApiClient, getUserSnapshot } from "../deps";
import { matchPattern } from "./matchPattern";
import type { ResolvedScreen, Screen, Widget } from "./types";

function filterScreensByPermissions(screens: Screen[]): Screen[] {
	const user = getUserSnapshot();
	const permissions: Array<{ resource: string; scope?: string }> =
		(user as any)?.permissions?.data ?? [];

	// Don't filter until user data is loaded
	if (!user) return screens;

	// Users with the `tenants` permission at scope "all" are platform super
	// admins — tenant-specific screens marked hideForSuperAdmin are hidden.
	const isTenantScopeAll = permissions.some(
		(p) => p.resource === "tenants" && p.scope === "all",
	);

	return screens.filter(
		(s) =>
			!((s.meta as any)?.hideForSuperAdmin && isTenantScopeAll) &&
			checkComponentPermission(permissions, s.visibleToPermissions as any),
	);
}

export async function resolveScreen(
	moduleName: string,
	segments: string[],
): Promise<ResolvedScreen> {
	const baseUrl = process.env.NEXT_PUBLIC_ENDPOINT ?? "";
	const empty: ResolvedScreen = {
		screen: null,
		parentScreen: null,
		parentWidgets: [],
		params: {},
		widgets: [],
	};

	const modRes = await getApiClient().get(
		`${baseUrl}/api/v1/modules?search=${moduleName}&limit=1`,
	);
	const module = modRes.data?.data?.data?.[0];
	if (!module) return empty;

	// Fetch all screens for this module
	const screensRes = await getApiClient().get(
		`${baseUrl}/api/v1/screens?moduleId=${module.id}&limit=100`,
	);
	const allScreens: Screen[] = filterScreensByPermissions(
		screensRes.data?.data?.data ?? [],
	);

	// Sort by pathPattern specificity (more segments first)
	const sorted = [...allScreens].sort((a, b) => {
		const aLen = a.pathPattern?.split("/").length ?? 0;
		const bLen = b.pathPattern?.split("/").length ?? 0;
		return bLen - aLen;
	});

	// 1. Try exact screen name match first (last URL segment = screen name)
	//    This prevents greedy pathPatterns like ":tenantId" from hijacking
	//    navigation URLs like /dashboard/tenants/tenants
	const lastSegment = segments[segments.length - 1];
	if (lastSegment) {
		const nameMatch = allScreens.find((s: Screen) => s.name === lastSegment);
		if (nameMatch) {
			// If this is a tab child, extract path params from the parent's pattern
			let params: Record<string, string> = {};
			if (nameMatch.parentScreenId) {
				const parent = allScreens.find(
					(s: Screen) => s.id === nameMatch.parentScreenId,
				);
				if (parent?.pathPattern && parent.pathPattern !== "/") {
					const parentSegments = segments.slice(0, -1);
					const extracted = matchPattern(parentSegments, parent.pathPattern);
					if (extracted) {
						params = extracted;
					} else if (
						nameMatch.pathPattern &&
						nameMatch.pathPattern !== "/" &&
						nameMatch.pathPattern !== null
					) {
						// Parent pattern didn't match (e.g. multi-level nesting) — use child's own pattern
						const childExtracted = matchPattern(
							segments,
							nameMatch.pathPattern,
						);
						if (childExtracted) params = childExtracted;
					}
				} else if (
					nameMatch.pathPattern &&
					nameMatch.pathPattern !== "/" &&
					nameMatch.pathPattern !== null
				) {
					// Parent has no pattern — use child's own pattern
					const extracted = matchPattern(segments, nameMatch.pathPattern);
					if (extracted) params = extracted;
				}
			} else if (
				nameMatch.pathPattern &&
				nameMatch.pathPattern !== "/" &&
				nameMatch.pathPattern !== null
			) {
				// Extract path params from the screen's own pattern using all segments
				const extracted = matchPattern(segments, nameMatch.pathPattern);
				if (extracted) params = extracted;
			}
			return buildResult(baseUrl, nameMatch, params, allScreens);
		}
	}

	// 2. Try pathPattern matching
	for (const screen of sorted) {
		const pattern = screen.pathPattern === "/" ? null : screen.pathPattern;
		const params = matchPattern(segments, pattern);
		if (params) {
			return buildResult(baseUrl, screen, params, allScreens);
		}
	}

	// 3. Last resort: no segments → return the first top-level screen
	if (segments.length === 0) {
		const defaultScreen = allScreens.find(
			(s: Screen) =>
				!s.parentScreenId && (!s.pathPattern || s.pathPattern === "/"),
		);
		if (defaultScreen) {
			return buildResult(baseUrl, defaultScreen, {}, allScreens);
		}
	}

	return empty;
}

async function buildResult(
	baseUrl: string,
	screen: Screen,
	params: Record<string, string>,
	allScreens: Screen[],
): Promise<ResolvedScreen> {
	const screenId = screen.id;

	// Fetch the matched screen's own widgets
	const widgetsRes = await getApiClient().get(
		`${baseUrl}/api/v1/screen-widgets?screenId=${screenId}&sortBy=displayOrder&limit=100`,
	);
	const widgets: Widget[] = widgetsRes.data?.data?.data ?? [];

	// Check if this screen has a parent (tab child)
	const parentId = screen.parentScreenId;
	if (parentId) {
		const parent = allScreens.find((s: Screen) => s.id === parentId);
		if (parent) {
			// Fetch parent's widgets (contains the TabWidget)
			const parentWidgetsRes = await getApiClient().get(
				`${baseUrl}/api/v1/screen-widgets?screenId=${parent.id}&sortBy=displayOrder&limit=100`,
			);
			return {
				screen,
				parentScreen: parent,
				parentWidgets: parentWidgetsRes.data?.data?.data ?? [],
				params,
				widgets,
			};
		}
	}

	return {
		screen,
		parentScreen: null,
		parentWidgets: [],
		params,
		widgets,
	};
}
