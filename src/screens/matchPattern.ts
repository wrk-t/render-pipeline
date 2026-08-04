export function matchPattern(
	segments: string[],
	pattern: string | null,
): Record<string, string> | null {
	if (!pattern) return null;
	const parts = pattern.split("/");
	if (parts.length !== segments.length) return null;
	const params: Record<string, string> = {};
	for (let i = 0; i < parts.length; i++) {
		if (parts[i].startsWith(":")) {
			params[parts[i].slice(1)] = segments[i];
		} else if (parts[i] !== segments[i]) {
			return null;
		}
	}
	return params;
}
