import type { MongoQuery, Subject } from "@casl/ability";
import { AbilityBuilder, mongoQueryMatcher, PureAbility } from "@casl/ability";

/**
 * The shape of a permission coming from the backend.
 */
export interface RawPermission {
	resource: string;
	action: "create" | "read" | "update" | "delete";
	scope?: "own" | "tenant" | "all";
}

/**
 * Define what an "action" and "subject" (resource) mean in our app.
 * Extend this type when you add custom resources.
 */
export type AppAction = "create" | "read" | "update" | "delete";
export type AppSubject =
	| "permissions"
	| "rolePermissions"
	| "roles"
	| "users"
	| "tenants"
	| "userProfile"
	| "userSessions"
	| "userSettings"
	| "tenantSettings"
	| "tenantContacts"
	| "tenantBranding"
	| "systems"
	| "services"
	| "serviceVersions"
	| "operations"
	| "serviceDocuments"
	| "serviceTemplates"
	| "membership"
	| "locales"
	| "translations"
	| "forms"
	| "tables"
	| "fieldDefinitions"
	| "uiComponents"
	| "modules"
	| "screens"
	| "screenWidgets"
	| "all";

/**
 * The CASL Ability type used throughout the app.
 *
 * Usage:
 *   ability.can("create", "users")
 *   ability.can("read", "tenants")
 */
export type AppAbility = PureAbility<[AppAction, AppSubject], MongoQuery>;

/**
 * Build a PureAbility from a list of raw backend permissions.
 *
 * @param permissions - Array of { resource, action } objects.
 * @returns A ready-to-use AppAbility instance.
 *
 * @example
 *   const ability = buildAbility([
 *     { resource: "users",   action: "create" },
 *     { resource: "users",   action: "read"   },
 *     { resource: "tenants", action: "update" },
 *   ]);
 *
 *   ability.can("create", "users")   // → true
 *   ability.can("delete", "reports") // → false
 */
export function buildAbility(
	permissions: RawPermission[] | null | undefined,
	tenantId?: string | null,
): AppAbility {
	const { can, build } = new AbilityBuilder<AppAbility>(PureAbility);

	if (!permissions) {
		return build({ conditionsMatcher: mongoQueryMatcher });
	}

	for (const perm of permissions) {
		// Always register the base permission (works with string subjects)
		can(perm.action, perm.resource as AppSubject);

		// Tenant-scoped: also register with condition for object-subject checks
		if (perm.scope === "tenant" && tenantId) {
			can(
				perm.action,
				perm.resource as AppSubject,
				{
					tenantId,
				} as any,
			);
		}
	}

	return build({ conditionsMatcher: mongoQueryMatcher });
}
