"use client";

import Tooltip from "@mui/material/Tooltip";
import { useTranslations } from "next-intl";
import type { ReactElement } from "react";
import { useSnack } from "../../hooks/useSnack";

/**
 * A value the user has to retype, rendered as a clickable "link".
 *
 * The typed-title confirmations (send now, delete, schedule) ask the person to
 * reproduce a title. Before this, the title sat in its own box with a copy
 * button, and the sentence above it said "type the message title" — so the eye
 * had to jump between the instruction, the box and the input. Inlining the title
 * in the sentence, as a dotted link that copies on click, keeps the instruction
 * and the value in one place (and the toast confirms the copy).
 */
export function CopyableTitle({ value }: { value: string }): ReactElement {
	const t = useTranslations("");
	const snack = useSnack();

	const copy = () => {
		navigator.clipboard
			.writeText(value)
			.then(() => snack.success(t("common.copied")))
			.catch(() => {
				// Clipboard can be unavailable (permissions, insecure context); the
				// text is still selectable, so nothing is lost.
			});
	};

	return (
		<Tooltip title={t("common.copyToClipboard")} placement="top">
			{/* Inline styles, not utilities: this package sits outside the app's
			    Tailwind source root, so a utility class only exists when the app
			    happens to use the same one somewhere. The dotted underline is the
			    affordance — it has to render everywhere. */}
			<button
				type="button"
				onClick={copy}
				style={{
					display: "inline",
					padding: 0,
					border: "none",
					background: "transparent",
					cursor: "pointer",
					font: "inherit",
					fontWeight: 600,
					color: "inherit",
					textDecorationLine: "underline",
					textDecorationStyle: "dotted",
					textUnderlineOffset: "4px",
				}}
			>
				{value}
			</button>
		</Tooltip>
	);
}

/**
 * A confirmation sentence whose `{title}` token is replaced by the copyable
 * title. Translations own the token position, so the sentence still reads
 * naturally in every language; without the token the title is appended.
 */
export function ConfirmPrompt({
	message,
	title,
}: {
	message: string;
	title?: string | null;
}): ReactElement {
	if (!title) return <>{message}</>;

	const tokenIndex = message.indexOf("{title}");
	const before =
		tokenIndex === -1 ? `${message} ` : message.slice(0, tokenIndex);
	const after = tokenIndex === -1 ? "" : message.slice(tokenIndex + 7);

	return (
		<>
			{before}
			<CopyableTitle value={title} />
			{after}
		</>
	);
}
