// ═══════════════════════════════════════════════════════════════
// VariableSuggestField — a text/textarea field that suggests message
// variables while the admin types.
//
// Message bodies are plain text with `{{namespace.key}}` tokens. Typing
// `{{` opens the whitelisted registry (`GET /api/v1/messaging/variables`);
// choosing an entry inserts `{{customer.firstName}}` at the caret. The list
// is the same one the renderer validates against, so a suggested token can
// never be rejected on save.
// ═══════════════════════════════════════════════════════════════
"use client";

import { useField } from "formik";
import {
	type ChangeEvent,
	type KeyboardEvent,
	type MouseEvent,
	type ReactElement,
	type SyntheticEvent,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import useSWR from "swr";
import { getApiClient } from "../../deps";

interface IVariableOption {
	key: string;
	namespace: string;
	label: string;
	example: string;
}

/** A `$trl_` label is resolved by the metadata layer; show the key instead. */
function displayLabel(variable: IVariableOption): string {
	return variable.label?.startsWith("$trl_") ? variable.key : variable.label;
}

/**
 * The partial token before the caret, when the caret sits inside `{{…`.
 * Returns `null` when the admin is not typing a token.
 */
function partialToken(
	value: string,
	caret: number,
): { start: number; query: string } | null {
	const before = value.slice(0, caret);
	const match = /{{([a-zA-Z0-9_.]*)$/.exec(before);
	if (!match) return null;
	return { start: before.length - match[0].length, query: match[1] };
}

const FIELD_CLASS =
	"w-full rounded-lg border bg-background px-3 py-2 text-start text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60";

export function VariableSuggestField({
	field,
	multiline = false,
}: {
	// biome-ignore lint/suspicious/noExplicitAny: RenderField union shared with the form renderer
	field: any;
	multiline?: boolean;
}): ReactElement {
	const [{ value }, meta, { setValue, setTouched }] = useField<string>(
		field.name,
	);
	const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
	const inputId = useId();
	const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
	const [token, setToken] = useState<{ start: number; query: string } | null>(
		null,
	);
	const [activeIndex, setActiveIndex] = useState(0);

	const endpoint = `${process.env.NEXT_PUBLIC_ENDPOINT ?? ""}/api/v1/messaging/variables`;
	const { data: variables, isLoading } = useSWR<IVariableOption[]>(
		endpoint,
		async (url: string) => {
			const res = await getApiClient().get(url);
			const body = res.data?.data ?? res.data ?? [];
			return Array.isArray(body) ? body : [];
		},
	);

	const matches = useMemo(() => {
		if (!token) return [];
		const query = token.query.toLowerCase();
		const list = variables ?? [];
		if (!query) return list;
		return list.filter(
			(variable) =>
				variable.key.toLowerCase().includes(query) ||
				variable.namespace.toLowerCase().includes(query),
		);
	}, [token, variables]);

	const open = token !== null && !!anchorEl;
	const isError = Boolean(meta.touched && meta.error);

	const syncToken = (
		nextValue: string,
		caret: number,
		element: HTMLInputElement | HTMLTextAreaElement,
	) => {
		const found = partialToken(nextValue, caret);
		setAnchorEl(element);
		setToken(found);
		setActiveIndex(0);
	};

	const handleChange = (
		event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
	) => {
		const next = event.target.value;
		setValue(next);
		syncToken(next, event.target.selectionStart ?? next.length, event.target);
	};

	const handleSelect = (variable: IVariableOption) => {
		if (!token) return;
		const current = value ?? "";
		const caret = inputRef.current?.selectionStart ?? current.length;
		const next = `${current.slice(0, token.start)}{{${variable.key}}}${current.slice(caret)}`;
		const nextCaret = token.start + variable.key.length + 4;
		setValue(next);
		setToken(null);
		setTouched(true, false);
		requestAnimationFrame(() => {
			inputRef.current?.focus();
			inputRef.current?.setSelectionRange(nextCaret, nextCaret);
		});
	};

	const handleKeyDown = (
		event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
	) => {
		if (!open || matches.length === 0) return;
		if (event.key === "ArrowDown") {
			event.preventDefault();
			setActiveIndex((index) => (index + 1) % matches.length);
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			setActiveIndex((index) => (index - 1 + matches.length) % matches.length);
		} else if (event.key === "Enter" || event.key === "Tab") {
			event.preventDefault();
			handleSelect(matches[activeIndex]);
		} else if (event.key === "Escape") {
			event.preventDefault();
			setToken(null);
		}
	};

	const handleBlur = (_: SyntheticEvent) => {
		// The click on a suggestion lands after blur; give it a tick.
		setTimeout(() => setToken(null), 150);
		setTouched(true);
	};

	const handleClick = (
		event: MouseEvent<HTMLInputElement | HTMLTextAreaElement>,
	) => {
		const target = event.currentTarget;
		if (
			typeof target.value === "string" &&
			typeof target.selectionStart === "number"
		) {
			syncToken(target.value, target.selectionStart, target);
		}
	};

	const sharedProps = {
		id: inputId,
		name: field.name,
		value: value ?? "",
		onChange: handleChange,
		onKeyDown: handleKeyDown,
		onBlur: handleBlur,
		onClick: handleClick,
		placeholder: field.uiOverrides?.behavior?.placeholder,
		required: field.isRequired,
		disabled: field.isReadOnly,
		"aria-invalid": isError || undefined,
		className: `${FIELD_CLASS} ${
			isError
				? "border-destructive focus:border-destructive focus:ring-destructive/20"
				: "border-border focus:border-ring focus:ring-ring/20"
		}`,
	};

	return (
		<div className="flex flex-col gap-0.5">
			<label htmlFor={inputId} className="text-sm font-medium text-foreground">
				{field.label}
				{field.isRequired ? (
					<span className="ms-0.5 text-destructive" aria-hidden="true">
						*
					</span>
				) : null}
			</label>
			<div className="relative">
				{multiline ? (
					<textarea
						{...sharedProps}
						ref={(element) => {
							inputRef.current = element;
						}}
						rows={field.uiOverrides?.behavior?.rows ?? 10}
					/>
				) : (
					<input
						{...sharedProps}
						ref={(element) => {
							inputRef.current = element;
						}}
						type="text"
					/>
				)}
				{open && (
					<div
						// Anchored under the input, like the old popper: the input's
						// own width, opening downward.
						className="absolute inset-x-0 top-full z-50 mt-1 max-h-72 overflow-auto rounded-lg border border-border bg-card p-1 shadow-lg"
					>
						{isLoading ? (
							<div className="flex items-center justify-center p-3">
								<span
									role="status"
									aria-label="Loading"
									className="size-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary"
								/>
							</div>
						) : matches.length === 0 ? (
							<p className="block p-3 text-xs text-muted-foreground">
								No variables match
							</p>
						) : (
							<div>
								{matches.map((variable, index) => (
									<button
										key={variable.key}
										type="button"
										onMouseDown={(event) => event.preventDefault()}
										onClick={() => handleSelect(variable)}
										className={`flex w-full flex-col items-start rounded-md px-3 py-1.5 text-start transition-colors ${
											index === activeIndex
												? "bg-muted text-foreground"
												: "text-foreground hover:bg-muted"
										}`}
									>
										<span className="font-mono text-xs">{`{{${variable.key}}}`}</span>
										<span className="text-xs text-muted-foreground">
											{displayLabel(variable)}
										</span>
									</button>
								))}
							</div>
						)}
					</div>
				)}
			</div>
			{isError ? (
				<p className="text-xs text-destructive">{meta.error}</p>
			) : null}
			<p className="ps-1 text-xs text-muted-foreground">
				Type {"{{"} to insert a variable
				{field.fieldOverrides?.description
					? ` — ${field.fieldOverrides.description}`
					: ""}
			</p>
		</div>
	);
}
