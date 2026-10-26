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

import {
	CircularProgress,
	List,
	ListItemButton,
	ListItemText,
	Paper,
	Popper,
	Stack,
	TextField,
	Typography,
} from "@mui/material";
import { useField } from "formik";
import {
	type ChangeEvent,
	type KeyboardEvent,
	type ReactElement,
	type SyntheticEvent,
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

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
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

	const hasValue = value !== undefined && value !== "";

	return (
		<Stack spacing={0.2}>
			<TextField
				inputRef={inputRef}
				name={field.name}
				label={field.label}
				value={value ?? ""}
				onChange={handleChange}
				onKeyDown={handleKeyDown}
				onBlur={handleBlur}
				onClick={(event) => {
					const target = event.target as HTMLInputElement;
					if (
						typeof target.value === "string" &&
						typeof target.selectionStart === "number"
					) {
						syncToken(target.value, target.selectionStart, target);
					}
				}}
				placeholder={field.uiOverrides?.behavior?.placeholder}
				required={field.isRequired}
				disabled={field.isReadOnly}
				error={meta.touched && Boolean(meta.error)}
				helperText={meta.touched && meta.error ? meta.error : undefined}
				multiline={multiline}
				rows={multiline ? (field.uiOverrides?.behavior?.rows ?? 10) : undefined}
				size="small"
				fullWidth
				slotProps={{
					inputLabel: { shrink: hasValue || undefined },
				}}
			/>
			<Typography variant="caption" color="text.secondary" className="pl-1">
				Type {"{{"} to insert a variable
				{field.fieldOverrides?.description
					? ` — ${field.fieldOverrides.description}`
					: ""}
			</Typography>
			<Popper
				open={open}
				anchorEl={anchorEl}
				placement="bottom-start"
				style={{ zIndex: 1500, width: anchorEl?.clientWidth }}
			>
				<Paper elevation={6} className="max-h-72 overflow-auto">
					{isLoading ? (
						<Stack className="items-center p-3">
							<CircularProgress size={18} />
						</Stack>
					) : matches.length === 0 ? (
						<Typography variant="caption" className="block p-3">
							No variables match
						</Typography>
					) : (
						<List dense>
							{matches.map((variable, index) => (
								<ListItemButton
									key={variable.key}
									selected={index === activeIndex}
									onMouseDown={(event) => event.preventDefault()}
									onClick={() => handleSelect(variable)}
								>
									<ListItemText
										primary={`{{${variable.key}}}`}
										secondary={displayLabel(variable)}
									/>
								</ListItemButton>
							))}
						</List>
					)}
				</Paper>
			</Popper>
		</Stack>
	);
}
