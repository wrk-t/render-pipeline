import type { FC } from "react";
import DialogContent from "@mui/material/DialogContent";
import Dialog from "@mui/material/Dialog";
import { BaseDialogHeader } from "./BaseDialogHeader";
import { BaseDialogActions } from "./BaseDialogActions";
import type { IBaseDialogProps } from "./types";
import Stack from "@mui/material/Stack";

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
			<DialogContent className="min-h-24 flex max-h-[70vh] overflow-auto">
				<Stack className="flex-1 justify-center">{children}</Stack>
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
