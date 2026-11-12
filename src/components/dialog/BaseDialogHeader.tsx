import { Box, DialogTitle, IconButton, Stack, Typography } from "@mui/material";
import type { FC } from "react";
import { Unicon } from "../common/icon/Unicon";

interface IDialogHeaderProps {
	title?: string;
	onClose?: () => void;
	disabled?: boolean;
	showCloseButton?: boolean;
}

export const BaseDialogHeader: FC<IDialogHeaderProps> = ({
	onClose,
	title,
	disabled,
	showCloseButton = true,
}) => (
	<Box sx={{ px: 3, py: 1.5 }} className="rounded-tl-sm rounded-tr-sm">
		<Stack
			direction="row"
			sx={{ alignItems: "center", justifyContent: "space-between" }}
		>
			<DialogTitle id="customized-dialog-title" sx={{ p: 0 }}>
				<Typography sx={{ textTransform: "capitalize" }}>{title}</Typography>
			</DialogTitle>

			{showCloseButton ? (
				<IconButton
					aria-label="close"
					disabled={disabled}
					onClick={onClose ?? onClose}
					// The button has 8px of its own padding; pull it back so the
					// glyph lands on the content's 24px padding line on both sides.
					sx={{ marginInlineEnd: "-8px" }}
					size="small"
				>
					<Unicon name="CloseRounded" />
				</IconButton>
			) : null}
		</Stack>
	</Box>
);
