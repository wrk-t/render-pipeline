"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { AppAbility } from "./buildAbility";

interface AbilityContextValue {
  ability: AppAbility;
}

const AbilityContext = createContext<AbilityContextValue | null>(null);

interface AbilityProviderProps {
  ability: AppAbility;
  children: ReactNode;
}

export function AbilityProvider({ ability, children }: AbilityProviderProps) {
  return (
    <AbilityContext.Provider value={{ ability }}>
      {children}
    </AbilityContext.Provider>
  );
}

/**
 * Hook to access the CASL ability instance.
 *
 * @example
 *   const ability = useAbility();
 *   ability.can("create", "users") // → boolean
 */
export function useAbility(): AppAbility {
  const ctx = useContext(AbilityContext);
  if (!ctx) {
    throw new Error(
      "useAbility must be used within an <AbilityProvider>",
    );
  }
  return ctx.ability;
}

/**
 * Convenience hook that returns a `can` checker function.
 * Useful for inline checks or passing to callbacks.
 *
 * @example
 *   const can = useCan();
 *   can("update", "tenants") // → boolean
 */
export function useCan() {
  const ability = useAbility();
  return (action: string, resource: string) =>
    ability.can(action as any, resource as any);
}
