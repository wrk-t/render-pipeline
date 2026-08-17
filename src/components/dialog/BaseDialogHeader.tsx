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
	<Box className="rounded-tl-sm rounded-tr-sm pl-6 pr-4 py-3">
		<Stack direction="row" className="justify-between p-0 items-center">
			<DialogTitle id="customized-dialog-title" className="p-0!">
				<Typography className="capitalize">{title}</Typography>
			</DialogTitle>

			{showCloseButton ? (
				<IconButton
					aria-label="close"
					disabled={disabled}
					onClick={onClose ?? onClose}
					sx={{margin: "0px 24px"}}
					size="small"
				>
					<Unicon name="CloseRounded" />
				</IconButton>
			) : null}
		</Stack>
	</Box>
);
