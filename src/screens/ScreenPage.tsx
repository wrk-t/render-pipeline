// ──────────────────────────────────────────────────────────────────
// ScreenPage — dashboard screen routing on top of the render pipeline.
//
// Resolves the URL segments to a screen (modules → screens metadata)
// and renders the screen's ROOT component (screens.componentId)
// through AutoComponent. Everything on a screen is a component — the
// old widget registry / screen_widgets flow is gone.
// ──────────────────────────────────────────────────────────────────

"use client";

import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import { type ReactElement, useEffect, useState } from "react";
import { AutoComponent } from "../ComponentRenderer";
import { ScreenStateProvider } from "./ScreenState";
import type { ResolvedScreen, ScreenPageProps } from "./types";
import { useScreen } from "./useScreenPreloader";

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

function ScreenContent({
	resolved,
}: {
	resolved: ResolvedScreen;
}): ReactElement {
	const { params: pathParams, rootComponentId } = resolved;

	// No root component (screen not fully seeded) — render nothing.
	if (rootComponentId == null) return <></>;

	// Detail screens carry `:id` in their path pattern — resolve the
	// record context so forms open in edit mode.
	const resolvedParams = { ...pathParams };
	const hasId = "id" in resolvedParams;

	return (
		<ScreenStateProvider>
			<AutoComponent
				componentId={rootComponentId}
				pathParams={resolvedParams}
				{...(hasId
					? { recordId: resolvedParams.id, context: "edit" as const }
					: {})}
			/>
		</ScreenStateProvider>
	);
}
