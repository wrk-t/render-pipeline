// ──────────────────────────────────────────────────────────────────
// Permission check utility for component/element visibility
// ──────────────────────────────────────────────────────────────────

export interface PermissionRequirement {
  resource: string;
  action: string;
  scope?: "own" | "tenant" | "all";
}

export interface UserPermission {
  resource: string;
  scope?: string;
}

/**
 * True when the user's permission scope satisfies a required scope.
 * Scopes are hierarchical: "all" ⊇ "tenant" ⊇ "own".
 * A missing requirement scope means any scope is accepted.
 */
export function scopeSatisfies(
  userScope: string | undefined,
  required: string | undefined,
): boolean {
  if (!required) return true;
  if (userScope === "all") return true;
  if (required === "own") return true;
  if (required === "tenant") return userScope === "tenant";
  return userScope === required;
}

/**
 * Check if a user's permissions satisfy a set of component visibility
 * requirements. Returns true if ALL required permissions are met.
 *
 * Used both by screens (useModules / resolveScreen) and by
 * ComponentRenderer / FormRenderer for component/element visibility.
 */
export function checkComponentPermission(
  userPermissions: UserPermission[] | null | undefined,
  required: PermissionRequirement[] | null | undefined,
): boolean {
  if (!required || required.length === 0) return true;
  if (!userPermissions || userPermissions.length === 0) return false;
  return required.every((req) =>
    userPermissions.some(
      (p) =>
        p.resource === req.resource && scopeSatisfies(p.scope, req.scope),
    ),
  );
}
