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
	<div className="flex shrink-0 items-center justify-between gap-4 px-6 py-3">
		<h2
			id="customized-dialog-title"
			className="min-w-0 truncate text-lg font-semibold text-foreground capitalize"
		>
			{title}
		</h2>

		{showCloseButton ? (
			<button
				type="button"
				aria-label="close"
				disabled={disabled}
				onClick={onClose}
				// The button's own padding line is pulled back so the glyph
				// lands on the content's 24px padding line on both sides.
				className="-me-2 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
			>
				<Unicon name="CloseRounded" />
			</button>
		) : null}
	</div>
);
