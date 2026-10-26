"use client";

import { createContext, useContext } from "react";

/**
 * The record a **detail screen** is about.
 *
 * A Layout may declare a `datasource` (`GET /api/v1/…/{id}`); the renderer
 * fetches it once and provides it here, so the header's action buttons can
 * evaluate `condition` (Pause only on an `active` campaign, Resume only on a
 * `paused` one) and resolve `{title}`-style placeholders without each button
 * fetching the row again.
 */
export type TRecordData = Record<string, unknown> | null;

const RecordContext = createContext<TRecordData>(null);

export const RecordProvider = RecordContext.Provider;

export function useRecordData(): TRecordData {
	return useContext(RecordContext);
}

/** Read a dotted path from the record (`contentSnapshot.body`). */
export function readRecordPath(record: TRecordData, path: string): unknown {
	if (!record) return undefined;
	let current: unknown = record;
	for (const key of path.split(".")) {
		if (current === null || current === undefined) return undefined;
		current = (current as Record<string, unknown>)[key];
	}
	return current;
}
