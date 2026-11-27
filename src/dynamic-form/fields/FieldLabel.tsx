"use client";

import { CircleHelp } from "lucide-react";
import type { ReactNode } from "react";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "../../ui/tooltip";

/**
 * A field label with an optional hover help icon.
 *
 * The description is shown in a tooltip instead of a paragraph under the
 * control, so long forms stay compact; the input still points at the
 * visually hidden description for screen readers.
 */
export function FieldHelp({ text }: { text: string }) {
	return (
		<TooltipProvider delayDuration={150}>
			<Tooltip>
				<TooltipTrigger asChild>
					<button
						type="button"
						aria-label={text}
						className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-primary/80 transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<CircleHelp className="size-3.5" aria-hidden="true" />
					</button>
				</TooltipTrigger>
				<TooltipContent side="top" sideOffset={4} className="max-w-64 leading-relaxed">
					{text}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

export function FieldLabel({
	htmlFor,
	label,
	required,
	isError,
	description,
}: {
	htmlFor: string;
	label: ReactNode;
	required?: boolean;
	isError?: boolean;
	description?: string | null;
}) {
	return (
		<div className="flex min-h-4 items-center gap-1.5">
			<label
				htmlFor={htmlFor}
				className={`text-sm font-medium leading-none ${
					isError ? "text-destructive" : "text-foreground"
				}`}
			>
				{label}
				{required ? (
					<span aria-hidden="true" className="ms-0.5 text-destructive">
						*
					</span>
				) : null}
			</label>
			{description ? <FieldHelp text={description} /> : null}
		</div>
	);
}
