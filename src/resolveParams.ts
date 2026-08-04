// ──────────────────────────────────────────────────────────────────
// Param resolution — resolves element `paramBindings` into concrete
// values for child components.
//
// Sources: literal | route_param | query_param | scope | parent_context
// (plus legacy "screen", which behaves like route_param).
//
// `parent_context` walks up the component tree: every rendered
// ComponentRenderer accumulates its resolved bindings into
// ParentBindingsContext, so a child can look up any key its
// ancestors produced.
// ──────────────────────────────────────────────────────────────────

"use client";

import { createContext, useMemo, useContext } from "react";
import { useRenderUser } from "./deps";
import type { ParamBinding } from "./types";

/** Bindings accumulated by ancestor renders — the `parent_context` source. */
export const ParentBindingsContext = createContext<Record<string, string>>({});

export interface ParamScope {
  tenantId?: string;
  userId?: string;
  role?: string;
}

export interface ParamResolveContext {
  pathParams: Record<string, string>;
  queryParams?: Record<string, string>;
  scope?: ParamScope;
  parentBindings?: Record<string, string>;
}

export function resolveParamBindings(
  bindings: Record<string, ParamBinding> | null | undefined,
  ctx: ParamResolveContext,
): Record<string, string> {
  if (!bindings) return {};
  const out: Record<string, string> = {};
  for (const [key, binding] of Object.entries(bindings)) {
    if (!binding) continue;
    const value = binding.value;
    switch (binding.source) {
      case "literal":
        if (value !== undefined) out[key] = value;
        break;
      case "route_param":
      case "screen":
        if (value && ctx.pathParams[value] !== undefined) {
          out[key] = ctx.pathParams[value];
        }
        break;
      case "query_param":
        if (value && ctx.queryParams?.[value] !== undefined) {
          out[key] = ctx.queryParams[value];
        }
        break;
      case "scope":
        if (value === "tenantId" && ctx.scope?.tenantId) {
          out[key] = ctx.scope.tenantId;
        } else if (value === "userId" && ctx.scope?.userId) {
          out[key] = ctx.scope.userId;
        } else if (value === "role" && ctx.scope?.role) {
          out[key] = ctx.scope.role;
        }
        break;
      case "parent_context":
        if (value && ctx.parentBindings?.[value] !== undefined) {
          out[key] = ctx.parentBindings[value];
        }
        break;
    }
  }
  return out;
}

/** Read the current URL query string (client-only). */
export function getQueryParams(): Record<string, string> {
  if (typeof window === "undefined") return {};
  return Object.fromEntries(new URLSearchParams(window.location.search));
}

/**
 * Build the auth-scope values for `scope`-sourced bindings from the
 * current user.
 */
export function useParamScope(): ParamScope {
  const { data: user } = useRenderUser();
  return useMemo(
    () => ({
      tenantId: (user as any)?.tenant?.id as string | undefined,
      userId: (user as any)?.id as string | undefined,
      role:
        ((user as any)?.role as string | undefined) ??
        ((user as any)?.roleName as string | undefined),
    }),
    [user],
  );
}

export function useParentBindings(): Record<string, string> {
  return useContext(ParentBindingsContext);
}
