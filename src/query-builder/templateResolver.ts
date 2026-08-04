// ═══════════════════════════════════════════════════════════════
// Template Resolver — resolves {paramName} placeholders in URLs
//
// Examples:
//   resolveTemplate("/api/v1/users/{id}", { id: "123" })
//   → "/api/v1/users/123"
//
//   resolveTemplate("/api/v1/tenants/{tenantId}/contacts", { tenantId: "t1" })
//   → "/api/v1/tenants/t1/contacts"
//
//   resolveTemplate("/api/v1/tenant-contacts?tenantId={tenantId}", { tenantId: "t1" })
//   → "/api/v1/tenant-contacts?tenantId=t1"
// ═══════════════════════════════════════════════════════════════

/**
 * Replace {paramName} placeholders in a URL string with actual values.
 *
 * @param template   — The URL template, e.g. "/api/v1/users/{id}"
 * @param params     — Key-value map of params to inject, e.g. { id: "123" }
 * @returns          — The resolved URL with all placeholders replaced.
 */
export function resolveUrlTemplate(
	template: string,
	params?: Record<string, string>,
): string {
	if (!params || Object.keys(params).length === 0) {
		return template;
	}

	let resolved = template;

	for (const [key, value] of Object.entries(params)) {
		const placeholder = `{${key}}`;
		// Replace ALL occurrences of {key} in the template (path + query)
		resolved = resolved.replaceAll(placeholder, encodeURIComponent(value));
	}

	return resolved;
}

/**
 * Check whether a URL template still contains any unresolved {paramName}
 * placeholders. Useful for validation / debugging.
 */
export function hasUnresolvedParams(template: string): boolean {
	return /\{[^}]+\}/.test(template);
}

/**
 * Extract all {paramName} placeholder keys from a URL template.
 *
 * @example
 *   extractPlaceholders("/api/v1/tenants/{tenantId}/contacts/{id}")
 *   → ["tenantId", "id"]
 */
export function extractPlaceholders(template: string): string[] {
	const regex = /\{([^}]+)\}/g;
	const keys: string[] = [];
	let match: RegExpExecArray | null;

	while ((match = regex.exec(template)) !== null) {
		keys.push(match[1]);
	}

	return keys;
}
