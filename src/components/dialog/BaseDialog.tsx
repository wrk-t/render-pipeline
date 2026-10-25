import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Stack from "@mui/material/Stack";
import type { FC } from "react";
import { BaseDialogActions } from "./BaseDialogActions";
import { BaseDialogHeader } from "./BaseDialogHeader";
import type { IBaseDialogProps } from "./types";

export const BaseDialog: FC<IBaseDialogProps> = ({
	title,
	onSubmit,
	children,
	isPending,
	onClose,
	slotProps,
	isOpen = false,
	disabled = false,
}) => {
	return (
		<Dialog open={isOpen} fullWidth>
			<BaseDialogHeader title={title} disabled={isPending} onClose={onClose} />
			{/*
			 * The content scrolls, the header and the actions stay put (CRM-23).
			 * No `justify-center` on the child: a centred flex child that overflows
			 * pushes its *top* out of reach, which is why a long form looked like it
			 * "does not scroll" — the start of the form was simply un-scrollable.
			 */}
			<DialogContent className="min-h-24 flex max-h-[90vh] overflow-y-auto">
				<Stack className="flex-1">{children}</Stack>
			</DialogContent>
			<BaseDialogActions
				disabled={disabled}
				onClose={onClose}
				isPending={isPending}
				onSubmit={onSubmit}
				slotProps={{
					closeButton: slotProps?.closeButton,
					submitButton: slotProps?.submitButton,
				}}
			/>
		</Dialog>
	);
};
