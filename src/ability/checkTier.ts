// ──────────────────────────────────────────────────────────────────
// Tier check utility — gates UI elements by the current workspace
// tier (solo < team < enterprise). Mirrors the backend TierGuard:
// elements declared with `requiredTier: "team"` are hidden in solo
// workspaces.
// ──────────────────────────────────────────────────────────────────

export type WorkspaceTier = "solo" | "team" | "enterprise";

export const TIER_ORDER: Record<WorkspaceTier, number> = {
	solo: 0,
	team: 1,
	enterprise: 2,
};

/**
 * True when the current tier satisfies the requirement.
 * No requirement → always visible. Unknown current tier (no tenant
 * context, i.e. personal workspace) counts as "solo".
 */
export function checkTier(
	required: WorkspaceTier | null | undefined,
	current: WorkspaceTier | null | undefined,
): boolean {
	if (!required) return true;
	const effective = current ?? "solo";
	return TIER_ORDER[effective] >= TIER_ORDER[required];
}

/** Resolve the current workspace tier from the render user. */
export function resolveTier(user?: {
	tenant?: { tier?: WorkspaceTier } | null;
} | null): WorkspaceTier {
	return user?.tenant?.tier ?? "solo";
}
