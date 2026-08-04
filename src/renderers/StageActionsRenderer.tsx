"use client";

import { useState, useCallback, type ReactElement } from "react";
import useSWR from "swr";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import { useVersion, type VersionInfo } from "./VersionContext";
import { getApiClient } from "../deps";
import type { RenderedComponent } from "../types";

const STAGE_COLORS: Record<string, "default" | "warning" | "success" | "error"> = {
  draft: "warning",
  published: "success",
  deprecated: "error",
};

const NEXT_STAGE: Record<string, { label: string; target: string } | null> = {
  draft: { label: "Publish", target: "published" },
  published: { label: "Deprecate", target: "deprecated" },
  deprecated: null,
};

/**
 * Renders the current version stage badge + a transition button
 * inside a ScreenLayout page body slot.
 *
 * Blueprint: "stage-actions" (to register, add to blueprints.ts + ComponentRenderer)
 */
export function StageActionsRenderer({
  component,
  pathParams,
}: {
  component: RenderedComponent;
  pathParams?: Record<string, string>;
}): ReactElement {
  const { selected } = useVersion();
  const [transitioning, setTransitioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stage = selected?.stage ?? "published";
  const nextAction = NEXT_STAGE[stage];
  const config = (component.config ?? {}) as Record<string, any>;

  const handleTransition = useCallback(async () => {
    if (!selected?.id || !nextAction) return;
    setTransitioning(true);
    setError(null);
    try {
      await getApiClient().post(
        `/api/v1/package-versions/${selected.id}/transition`,
        { stage: nextAction.target },
      );
      // Refresh the page to reflect new stage
      window.location.reload();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Transition failed");
    } finally {
      setTransitioning(false);
    }
  }, [selected, nextAction]);

  if (!selected) {
    return (
      <Typography variant="body2" color="text.secondary">
        No version selected
      </Typography>
    );
  }

  return (
    <Stack direction="row" spacing={1} className="items-center">
      <Typography variant="body2" color="text.secondary">
        {component.displayName || "Stage"}:
      </Typography>
      <Chip
        label={stage}
        size="small"
        color={STAGE_COLORS[stage] ?? "default"}
      />
      {nextAction && (
        <Button
          size="small"
          variant="outlined"
          color={
            nextAction.target === "published" ? "success" : "warning"
          }
          onClick={handleTransition}
          disabled={transitioning}
        >
          {transitioning ? (
            <CircularProgress size={16} />
          ) : (
            nextAction.label
          )}
        </Button>
      )}
      {error && (
        <Typography variant="caption" color="error">
          {error}
        </Typography>
      )}
    </Stack>
  );
}
