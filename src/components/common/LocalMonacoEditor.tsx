"use client";

// ═══════════════════════════════════════════════════════════════
// LocalMonacoEditor — Monaco wrapper that bundles the editor
// locally instead of loading it from the CDN.
//
// @monaco-editor/react loads monaco from cdn.jsdelivr.net by
// default, which is blocked/unstable in many networks and renders
// nothing. This wrapper:
//   1. dynamically imports the local `monaco-editor` package on the
//      client only (SSR-safe — module scope never touches the editor)
//   2. registers it with the shared loader (so every Editor instance
//      in the app uses the local build)
//   3. mounts the editor only after the loader is configured
// ═══════════════════════════════════════════════════════════════

import Editor from "@monaco-editor/react";
import { loader } from "@monaco-editor/react";
import Box from "@mui/material/Box";
import { useEffect, useState, type ReactElement } from "react";

// Monaco's stylesheet — imported statically so bundlers extract it;
// it contains no executable code and is SSR-safe.
// import "monaco-editor/min/vs/editor/editor.main.css";

let configPromise: Promise<void> | null = null;

function ensureMonacoConfig(): Promise<void> {
	if (typeof window === "undefined") {
		return Promise.resolve();
	}
	configPromise ??= import("monaco-editor")
		.then((monaco) => {
			loader.config({ monaco });
		})
		.catch((error) => {
			configPromise = null; // allow retry on next mount
			console.warn("[monaco] failed to load local monaco-editor:", error);
		});
	return configPromise;
}

export interface LocalMonacoEditorProps {
	height?: string | number;
	defaultLanguage?: string;
	value?: string;
	onChange?: (value: string | undefined) => void;
	theme?: string;
	options?: Record<string, unknown>;
}

export function LocalMonacoEditor(
	props: LocalMonacoEditorProps,
): ReactElement {
	const [ready, setReady] = useState(false);

	useEffect(() => {
		let cancelled = false;
		ensureMonacoConfig().then(() => {
			if (!cancelled) setReady(true);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	if (!ready) {
		// Reserve the editor's space until monaco is ready — avoids
		// layout jumps when the real editor appears.
		return <Box sx={{ height: props.height ?? 300 }} />;
	}

	return <Editor {...(props as any)} />;
}
