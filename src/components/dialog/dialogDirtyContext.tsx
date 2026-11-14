"use client";

import {
	createContext,
	type FC,
	type PropsWithChildren,
	useCallback,
	useContext,
	useEffect,
	useMemo,
} from "react";

// ════════════════════════════════════════════════════════════════
// Dialog dirty-state seam.
//
// BaseDialog owns the close guard (Escape, backdrop and the header X all
// ask "Discard changes?" when the dialog's content reports unsaved edits).
// The content reports through this context, so any form — a DSL Formik
// form or an app-owned dialog renderer — can opt in without the parent
// dialog knowing what is inside it.
//
//   const { dirty } = useFormikContext();
//   useDialogDirtyReporter(dirty);   // no-op outside a dialog
//
// The hook is exported from the package so an app-owned renderer (one
// that owns its own fields instead of using a DSL Form) can report its
// dirty state the same way.
// ════════════════════════════════════════════════════════════════

interface IDialogDirtyContext {
	setDirty: (dirty: boolean) => void;
}

const DialogDirtyContext = createContext<IDialogDirtyContext | null>(null);

export const DialogDirtyProvider: FC<
	PropsWithChildren<{ onDirtyChange: (dirty: boolean) => void }>
> = ({ onDirtyChange, children }) => {
	const setDirty = useCallback(
		(dirty: boolean) => onDirtyChange(dirty),
		[onDirtyChange],
	);
	const value = useMemo(() => ({ setDirty }), [setDirty]);

	return (
		<DialogDirtyContext.Provider value={value}>
			{children}
		</DialogDirtyContext.Provider>
	);
};

/**
 * Report whether the dialog's content has unsaved changes.
 *
 * Safe outside a dialog (the detail-page form mounts without a provider):
 * it simply does nothing there.
 */
export function useDialogDirtyReporter(dirty: boolean): void {
	const context = useContext(DialogDirtyContext);

	useEffect(() => {
		if (!context) return;
		context.setDirty(dirty);
		// A form that unmounts (dialog closed, another form opened) must not
		// leave the next dialog marked dirty.
		return () => context.setDirty(false);
	}, [context, dirty]);
}
