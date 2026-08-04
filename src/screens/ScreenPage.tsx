// ──────────────────────────────────────────────────────────────────
// ScreenPage — dashboard screen routing on top of the render pipeline.
//
// Resolves the URL segments to a screen (modules → screens →
// screen_widgets metadata) and renders every widget through
// AutoComponent. The legacy widget-type registry and the tab-widget
// flow were removed: all seed data uses `page` widgets backed by arch
// components, so the pipeline handles everything uniformly.
// ──────────────────────────────────────────────────────────────────

"use client";

import { useEffect, useState, type ReactElement } from "react";
import Stack from "@mui/material/Stack";
import Grid from "@mui/material/Grid";
import CircularProgress from "@mui/material/CircularProgress";
import { AutoComponent } from "../ComponentRenderer";
import { getQueryParams, resolveParamBindings } from "../resolveParams";
import { ScreenStateProvider } from "./ScreenState";
import { useScreen } from "./useScreenPreloader";
import type { ResolvedScreen, ScreenPageProps, Widget } from "./types";

function sizeHintToGrid(hint: string | undefined | null): number {
  switch (hint) {
    case "small":
      return 3;
    case "medium":
      return 4;
    case "large":
      return 6;
    case "full":
    default:
      return 12;
  }
}

// ── Helper: unwrap Next.js async params into module + segments ──

function useUnwrapParams(paramsPromise: ScreenPageProps["params"]): {
  module: string | null;
  segments: string[];
} {
  const [module, setModule] = useState<string | null>(null);
  const [segments, setSegments] = useState<string[]>([]);

  useEffect(() => {
    paramsPromise.then(({ module: m, screen }) => {
      setModule(m);
      setSegments(screen ?? []);
    });
  }, [paramsPromise]);

  return { module, segments };
}

export function ScreenPage({ params }: ScreenPageProps): ReactElement {
  const { module: moduleName, segments } = useUnwrapParams(params);
  const { resolved, loading } = useScreen(moduleName ?? "", segments ?? []);

  if (loading || !moduleName) {
    return (
      <Stack className="items-center justify-center py-8">
        <CircularProgress />
      </Stack>
    );
  }

  if (!resolved) return <></>;

  return <ScreenContent resolved={resolved} />;
}

function ScreenContent({ resolved }: { resolved: ResolvedScreen }): ReactElement {
  const { params: pathParams, widgets } = resolved;

  const contentWidgets = widgets
    .filter((w) => w.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <ScreenStateProvider>
      <Stack spacing={2}>
        <Grid container spacing={2}>
          {contentWidgets.map((widget) => (
            <Grid
              key={widget.id}
              size={{
                xs: 12,
                sm: sizeHintToGrid(widget.widgetOverrides?.sizeHint),
              }}
            >
              <WidgetRenderer widget={widget} pathParams={pathParams} />
            </Grid>
          ))}
        </Grid>
      </Stack>
    </ScreenStateProvider>
  );
}

function WidgetRenderer({
  widget,
  pathParams,
}: {
  widget: Widget;
  pathParams: Record<string, string>;
}): ReactElement {
  // Widgets point at an arch component via `resourceId`; the pipeline
  // fetches, gates and renders it. Legacy widget paramBindings resolve
  // through the same resolver as element bindings.
  const resolvedParams = {
    ...pathParams,
    ...resolveParamBindings(widget.paramBindings ?? null, {
      pathParams,
      queryParams: getQueryParams(),
    }),
  };

  const hasId = "id" in resolvedParams;

  return (
    <AutoComponent
      componentId={widget.resourceId ?? ""}
      pathParams={resolvedParams}
      {...(hasId ? { recordId: resolvedParams.id, context: "edit" as const } : {})}
    />
  );
}
