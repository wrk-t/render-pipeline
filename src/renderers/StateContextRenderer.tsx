"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import {
	createContext,
	type ReactElement,
	useCallback,
	useContext,
	useState,
} from "react";
import { ComponentRenderer } from "../ComponentRenderer";
import type { RenderedComponent } from "../types";

// ──────────────────────────────────────────────────────────────────
// React context for shared state between sibling components
// ──────────────────────────────────────────────────────────────────

interface StateContextValue {
	values: Record<string, unknown>;
	setValue: (key: string, value: unknown) => void;
	getValue: (key: string) => unknown;
}

const StateContext = createContext<StateContextValue | null>(null);

export function useStateContext(): StateContextValue | null {
	return useContext(StateContext);
}

// ──────────────────────────────────────────────────────────────────
// Renderer
// ──────────────────────────────────────────────────────────────────

export function StateContextRenderer({
	component,
	pathParams,
}: {
	component: RenderedComponent;
	pathParams?: Record<string, string>;
}): ReactElement {
	const name = (component.config as any)?.name ?? "default";
	const [values, setValues] = useState<Record<string, unknown>>({});

	const setValue = useCallback((key: string, value: unknown) => {
		setValues((prev) => ({ ...prev, [key]: value }));
	}, []);

	const getValue = useCallback((key: string) => values[key], [values]);

	const ctxValue: StateContextValue = { values, setValue, getValue };

	const contentElements = (component.slotsFilled["content"] ?? [])
		.filter((e) => e.isActive)
		.sort((a, b) => a.displayOrder - b.displayOrder);

	return (
		<StateContext.Provider value={ctxValue}>
			<Stack spacing={2}>
				{contentElements.map((el) => {
					if (el.elementType === "component_ref" && el.referencedComponent) {
						return (
							<Box key={el.id}>
								<ComponentRenderer
									component={el.referencedComponent}
									pathParams={pathParams}
									paramBindings={el.paramBindings}
								/>
							</Box>
						);
					}
					return null;
				})}
			</Stack>
		</StateContext.Provider>
	);
}
