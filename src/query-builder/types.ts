// ═══════════════════════════════════════════════════════════════
// Query Builder — types
//
// Defines the shape of query/path parameters that flow from the
// page context into DynamicTable and the table renderer.
// ═══════════════════════════════════════════════════════════════

/**
 * Runtime query parameters that are injected into API calls.
 *
 * - `pathParams`   → resolved inside endpoint URL templates  e.g. {tenantId}
 * - `queryParams`  → appended as URL search params            e.g. ?tenantId=xxx
 * - `bodyParams`   → merged into the request body (create/update payloads)
 */
export interface QueryParams {
	pathParams?: Record<string, string>;
	queryParams?: Record<string, string>;
	bodyParams?: Record<string, unknown>;
}

/**
 * Shape returned by the usePageQueryParams hook.
 */
export interface PageQueryParams {
	/** Resolved params ready to be passed to DynamicTable / table renderer. */
	params: QueryParams;

	/** The raw URL path params from the Next.js route. */
	routeParams: Record<string, string>;

	/** The raw URL search params from the page. */
	searchParams: URLSearchParams;

	/**
	 * Merge additional params at the call site.
	 * Useful when a page needs to add something on top of what the hook already built.
	 */
	merge: (extra: QueryParams) => QueryParams;
}
