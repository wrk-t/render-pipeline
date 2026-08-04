"use client";

import { useSearchParams } from "next/navigation";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";

/**
 * Screen-level shared state for parameter passing between widgets.
 *
 * A DateRangePicker widget writes `{ from, to }` here.
 * Chart widgets read those values via `useScreenState()`.
 *
 * Initializes from URL search params on page load for bookmarkability.
 * Does NOT sync back to URL.
 */
type ScreenState = Record<string, unknown>;

const ScreenStateContext = createContext<{
	state: ScreenState;
	setState: (key: string, value: unknown) => void;
}>({
	state: {},
	setState: () => {},
});

export function ScreenStateProvider({ children }: { children: ReactNode }) {
	const searchParams = useSearchParams();

	const [state, setInternalState] = useState<ScreenState>(() => {
		const initial: ScreenState = {};
		const from = searchParams.get("from");
		const to = searchParams.get("to");
		if (from) initial["dateRange.from"] = Number(from);
		if (to) initial["dateRange.to"] = Number(to);
		return initial;
	});

	const setState = useCallback((key: string, value: unknown) => {
		setInternalState((prev) => ({ ...prev, [key]: value }));
	}, []);

	const value = useMemo(() => ({ state, setState }), [state, setState]);

	return (
		<ScreenStateContext.Provider value={value}>
			{children}
		</ScreenStateContext.Provider>
	);
}

export function useScreenState() {
	return useContext(ScreenStateContext);
}
