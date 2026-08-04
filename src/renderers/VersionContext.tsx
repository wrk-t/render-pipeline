"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

export interface VersionInfo {
  id: string;
  version: string;
  stage: "draft" | "published" | "deprecated";
  releaseDate?: string | null;
}

interface VersionContextValue {
  /** Currently selected version (null = no version selected / default) */
  selected: VersionInfo | null;
  setSelected: (v: VersionInfo | null) => void;
  /** All available versions for the current package */
  versions: VersionInfo[];
  setVersions: (list: VersionInfo[]) => void;
}

const VersionContext = createContext<VersionContextValue>({
  selected: null,
  setSelected: () => {},
  versions: [],
  setVersions: () => {},
});

export function VersionProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<VersionInfo | null>(null);
  const [versions, setVersions] = useState<VersionInfo[]>([]);

  return (
    <VersionContext.Provider
      value={{ selected, setSelected, versions, setVersions }}
    >
      {children}
    </VersionContext.Provider>
  );
}

export function useVersion() {
  return useContext(VersionContext);
}
