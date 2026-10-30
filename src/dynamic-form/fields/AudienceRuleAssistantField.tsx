// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// AudienceRuleAssistantField â€” the AI rule builder for a group's
// "Define a rule" audience mode.
//
// The manager describes who should be in the group in words; the
// `ai/rule-authoring` assistant drafts a rule, the backend validates it with
// the same engine that stores it, and the canonical rule is written to the
// form's `conditions` field (a JSON string the group API already accepts).
//
// The summary is **ours** (generated from the canonical rule), so it can never
// disagree with what will be saved. The raw JSON is shown only to a platform
// super admin â€” a tenant sees the summary and the conversation.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
"use client";

import {
	Alert,
	Box,
	Button,
	Chip,
	CircularProgress,
	Divider,
	MenuItem,
	Stack,
	TextField,
	Typography,
} from "@mui/material";
import { useField } from "formik";
import {
	type KeyboardEvent,
	type ReactElement,
	useEffect,
	useState,
} from "react";
import { getApiClient, useRenderUser } from "../../deps";

interface IChatTurn {
	role: "user" | "assistant";
	content: string;
}

interface IRuleDraft {
	summary: string;
	lines: string[];
	rule?: unknown;
	valid: boolean;
	errors: Array<{ message: string }>;
}

interface IChatResult {
	reply: string;
	draft: IRuleDraft | null;
	needsConfirmation: boolean;
	done: boolean;
}

/** Parse the form's `conditions` JSON string; `null` when it is empty/invalid. */
function parseConditions(raw: unknown): Record<string, unknown> | null {
	if (typeof raw !== "string" || !raw.trim()) return null;
	try {
		const parsed = JSON.parse(raw) as unknown;
		return parsed && typeof parsed === "object"
			? (parsed as Record<string, unknown>)
			: null;
	} catch {
		return null;
	}
}

// â”€â”€ Manual rule builder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// The assistant is optional (AI_ENDPOINT/AI_API_KEY); without it a tenant
// still needs a way to define an audience. These are the aggregates the rule
// engine supports (see customerSegments.ts) and its operators, together with
// the qualifiers each field accepts â€” a product filter and the look-back
// window are what make "ordered tea in the last 3 months" expressible.

type TManualField =
	| "totalSpent"
	| "orderCount"
	| "lastOrderDaysAgo"
	| "firstOrderDaysAgo"
	| "averageOrderValue"
	| "orderedItemCount"
	| "orderedCategoryCount";
type TManualOp = "eq" | "neq" | "gt" | "gte" | "lt" | "lte";

interface IManualCondition {
	field: TManualField;
	op: TManualOp;
	value: number;
	/** Product the rule counts, for `orderedItemCount`. */
	menuItemId?: string;
	/** Category the rule counts, for `orderedCategoryCount`. */
	menuCategoryId?: string;
	/** Only orders inside the last N days count. */
	withinDays?: number;
}

interface IManualRule {
	match: "all" | "any";
	rules: IManualCondition[];
}

/**
 * Which qualifier a field takes â€” mirrors `CUSTOMER_SEGMENT_FIELD_QUALIFIERS`
 * on the server. The server is the authority; this map only decides which
 * inputs the builder shows.
 */
const MANUAL_QUALIFIERS: Record<
	TManualField,
	{ menuItem: boolean; menuCategory: boolean; withinDays: boolean }
> = {
	totalSpent: { menuItem: false, menuCategory: false, withinDays: true },
	orderCount: { menuItem: false, menuCategory: false, withinDays: true },
	lastOrderDaysAgo: { menuItem: false, menuCategory: false, withinDays: false },
	firstOrderDaysAgo: {
		menuItem: false,
		menuCategory: false,
		withinDays: false,
	},
	averageOrderValue: { menuItem: false, menuCategory: false, withinDays: true },
	orderedItemCount: { menuItem: true, menuCategory: false, withinDays: true },
	orderedCategoryCount: {
		menuItem: false,
		menuCategory: true,
		withinDays: true,
	},
};

const MANUAL_FIELDS: Array<{ value: TManualField; label: string }> = [
	{ value: "totalSpent", label: "Total spent" },
	{ value: "orderCount", label: "Number of orders" },
	{ value: "lastOrderDaysAgo", label: "Days since last order" },
	{ value: "firstOrderDaysAgo", label: "Days since first order" },
	{ value: "averageOrderValue", label: "Average order value" },
	{ value: "orderedItemCount", label: "Orders containing a product" },
	{ value: "orderedCategoryCount", label: "Orders containing a category" },
];

const MANUAL_OPS: Array<{ value: TManualOp; label: string }> = [
	{ value: "eq", label: "=" },
	{ value: "neq", label: "â‰ " },
	{ value: "gt", label: ">" },
	{ value: "gte", label: "â‰¥" },
	{ value: "lt", label: "<" },
	{ value: "lte", label: "â‰¤" },
];

/**
 * Copy the qualifiers a field accepts off a stored rule.
 *
 * Qualifiers the field does not take are dropped, so switching a product rule
 * back to `orderCount` cannot leave a stale id behind (the engine would reject
 * it, and ignoring it would silently change the meaning).
 */
function withQualifiers(
	source: Record<string, unknown>,
	base: IManualCondition,
): IManualCondition {
	const qualifiers = MANUAL_QUALIFIERS[base.field];
	const next: IManualCondition = { ...base };

	if (qualifiers.menuItem && typeof source.menuItemId === "string") {
		next.menuItemId = source.menuItemId;
	}
	if (qualifiers.menuCategory && typeof source.menuCategoryId === "string") {
		next.menuCategoryId = source.menuCategoryId;
	}
	if (qualifiers.withinDays && typeof source.withinDays === "number") {
		next.withinDays = source.withinDays;
	}

	return next;
}

function parseManual(raw: unknown): IManualRule {
	const parsed = parseConditions(raw);
	const match = parsed?.match === "any" ? "any" : "all";
	const rawRules = Array.isArray(parsed?.rules) ? parsed.rules : [];
	const rules = rawRules
		.filter(
			(rule): rule is Record<string, unknown> =>
				rule !== null && typeof rule === "object" && !Array.isArray(rule),
		)
		.map((rule) => {
			const field = (
				MANUAL_FIELDS.some((entry) => entry.value === rule.field)
					? rule.field
					: "orderCount"
			) as TManualField;

			return withQualifiers(rule, {
				field,
				op: (MANUAL_OPS.some((entry) => entry.value === rule.op)
					? rule.op
					: "gte") as TManualOp,
				value:
					typeof rule.value === "number" && Number.isFinite(rule.value)
						? rule.value
						: 0,
			});
		});
	return { match, rules };
}

/** The same rule on another aggregate, keeping only the qualifiers it takes. */
function switchField(
	rule: IManualCondition,
	field: TManualField,
): IManualCondition {
	return withQualifiers(rule as unknown as Record<string, unknown>, {
		field,
		op: rule.op,
		value: rule.value,
	});
}

/**
 * The shop's products and categories, for the picker.
 *
 * A rule stores ids (so renaming a product keeps it meaningful), so the builder
 * needs the catalog to let a manager choose. Bounded like the assistant's read.
 */
async function loadCatalog(): Promise<{
	items: Array<{ id: string; name: string }>;
	categories: Array<{ id: string; name: string }>;
}> {
	const pick = (payload: unknown) =>
		((payload as { data?: { data?: unknown } })?.data?.data ?? []) as Array<{
			id: string;
			name: string;
		}>;

	const [items, categories] = await Promise.all([
		getApiClient().get("/api/v1/menu-items", { params: { limit: 200 } }),
		getApiClient().get("/api/v1/menu-categories", { params: { limit: 100 } }),
	]);

	return { items: pick(items.data), categories: pick(categories.data) };
}

export function AudienceRuleAssistantField({
	field,
}: {
	// biome-ignore lint/suspicious/noExplicitAny: RenderField union shared with the form renderer
	field: any;
}): ReactElement {
	const [{ value }, , { setValue, setTouched }] = useField<string>(field.name);
	const { data: user } = useRenderUser();
	const permissions = (user as any)?.permissions?.data ?? [];
	const isSuperAdmin = permissions.some(
		(permission: { resource: string; scope?: string }) =>
			permission.resource === "tenants" && permission.scope === "all",
	);

	const [turns, setTurns] = useState<IChatTurn[]>([]);
	const [input, setInput] = useState("");
	const [sending, setSending] = useState(false);
	const [draft, setDraft] = useState<IRuleDraft | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);
	const [manual, setManual] = useState(false);

	// Ask once whether this deployment has a provider. If it does not, show the
	// manual builder instead of letting the first message fail with a 503.
	useEffect(() => {
		let cancelled = false;
		void (async () => {
			try {
				const res = await getApiClient().get(
					"/api/v1/ai/rule-authoring/status",
				);
				if (!cancelled) setAiEnabled(res.data?.data?.enabled === true);
			} catch {
				// Older backend without the status route: keep the chat as-is.
				if (!cancelled) setAiEnabled(null);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	const stored = parseConditions(value);
	const storedJson = stored ? JSON.stringify(stored, null, 2) : "";
	const manualRule = parseManual(value);
	const showManual = aiEnabled === false || manual;

	// The product picker needs the shop's own catalog: a rule stores a menu id,
	// never a name. Read it once, only when a rule actually asks for a product.
	const needsCatalog = manualRule.rules.some((rule) => {
		const qualifiers = MANUAL_QUALIFIERS[rule.field];
		return qualifiers.menuItem || qualifiers.menuCategory;
	});
	const [catalog, setCatalog] = useState<{
		items: Array<{ id: string; name: string }>;
		categories: Array<{ id: string; name: string }>;
	} | null>(null);

	useEffect(() => {
		if (!needsCatalog || catalog !== null) return;
		let cancelled = false;
		loadCatalog()
			.then((next) => {
				if (!cancelled) setCatalog(next);
			})
			.catch(() => {
				// Without the catalog the picker is empty; the assistant path (which
				// receives the catalog server-side) still works.
				if (!cancelled) setCatalog({ items: [], categories: [] });
			});
		return () => {
			cancelled = true;
		};
	}, [needsCatalog, catalog]);

	const commitManual = (next: IManualRule) => {
		setValue(next.rules.length > 0 ? JSON.stringify(next) : "");
		setTouched(true, false);
	};

	// Summarize an existing rule (opening the group) so the page explains what
	// the audience currently means, not only after a chat turn.
	useEffect(() => {
		if (!stored) return;
		let cancelled = false;
		void (async () => {
			try {
				const res = await getApiClient().request({
					url: "/api/v1/ai/rule-authoring/validate",
					method: "post",
					data: { rule: stored },
				});
				const result = (res.data?.data ?? null) as IRuleDraft | null;
				if (!cancelled && result) setDraft(result);
			} catch {
				/* the summary is informational; the chat still works */
			}
		})();
		return () => {
			cancelled = true;
		};
		// Only re-run when the stored rule itself changes from outside the chat.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [storedJson]);

	const send = async () => {
		const text = input.trim();
		if (!text || sending) return;

		const nextTurns: IChatTurn[] = [...turns, { role: "user", content: text }];
		setTurns(nextTurns);
		setInput("");
		setSending(true);
		setError(null);

		try {
			const res = await getApiClient().request({
				url: "/api/v1/ai/rule-authoring/chat",
				method: "post",
				data: { messages: nextTurns },
			});
			const result = (res.data?.data ?? null) as IChatResult | null;
			if (!result) return;

			setTurns((previous) => [
				...previous,
				{ role: "assistant", content: result.reply },
			]);
			if (result.draft) {
				setDraft(result.draft);
				if (result.draft.valid && result.draft.rule) {
					setValue(JSON.stringify(result.draft.rule));
					setTouched(true, false);
				}
			}
		} catch (requestError) {
			const message =
				(requestError as { response?: { data?: { message?: string } } })
					.response?.data?.message ??
				"The assistant is not available right now.";
			setError(message);
		} finally {
			setSending(false);
		}
	};

	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			void send();
		}
	};

	return (
		<Stack spacing={2}>
			{aiEnabled === false && (
				<Alert severity="info">
					The AI assistant is not configured on this platform. Build the rule
					manually below â€” it is validated and saved exactly like an
					assistant-drafted one.
				</Alert>
			)}

			{showManual ? (
				<Stack spacing={2}>
					<Typography variant="subtitle2" className="font-semibold">
						Build the rule
					</Typography>
					<Typography variant="body2" color="text.secondary">
						Combine the order-history conditions below. Only confirmed orders
						count; pending and cancelled orders are ignored. The group keeps the
						rule and matches customers on it.
					</Typography>

					<TextField
						select
						size="small"
						label="Match"
						value={manualRule.match}
						onChange={(event) =>
							commitManual({
								...manualRule,
								match: event.target.value as IManualRule["match"],
							})
						}
						className="max-w-56"
					>
						<MenuItem value="all">All conditions</MenuItem>
						<MenuItem value="any">Any condition</MenuItem>
					</TextField>

					{manualRule.rules.length === 0 && (
						<Alert severity="warning">
							Add at least one condition to define this audience.
						</Alert>
					)}

					{manualRule.rules.map((rule, index) => {
						const qualifiers = MANUAL_QUALIFIERS[rule.field];
						return (
							<Stack
								key={index}
								direction={{ xs: "column", sm: "row" }}
								spacing={1}
								className="flex-wrap items-stretch sm:items-center"
							>
								<TextField
									select
									size="small"
									label="Field"
									value={rule.field}
									onChange={(event) => {
										const field = event.target.value as TManualField;
										// Switching field drops the qualifiers the new field does
										// not take â€” a stale product id would be rejected by the
										// engine, and a silent one would change the meaning.
										commitManual({
											...manualRule,
											rules: manualRule.rules.map((entry, entryIndex) =>
												entryIndex === index
													? switchField(entry, field)
													: entry,
											),
										});
									}}
									className="min-w-56"
								>
									{MANUAL_FIELDS.map((entry) => (
										<MenuItem key={entry.value} value={entry.value}>
											{entry.label}
										</MenuItem>
									))}
								</TextField>

								<TextField
									select
									size="small"
									label="Operator"
									value={rule.op}
									onChange={(event) =>
										commitManual({
											...manualRule,
											rules: manualRule.rules.map((entry, entryIndex) =>
												entryIndex === index
													? { ...entry, op: event.target.value as TManualOp }
													: entry,
											),
										})
									}
									className="min-w-28"
								>
									{MANUAL_OPS.map((entry) => (
										<MenuItem key={entry.value} value={entry.value}>
											{entry.label}
										</MenuItem>
									))}
								</TextField>

								<TextField
									size="small"
									type="number"
									label="Value"
									value={rule.value}
									onChange={(event) =>
										commitManual({
											...manualRule,
											rules: manualRule.rules.map((entry, entryIndex) =>
												entryIndex === index
													? { ...entry, value: Number(event.target.value) }
													: entry,
											),
										})
									}
									className="max-w-28"
								/>

								{qualifiers.menuItem && (
									<TextField
										select
										size="small"
										label="Product"
										value={rule.menuItemId ?? ""}
										error={!rule.menuItemId}
										helperText={rule.menuItemId ? undefined : "Pick a product"}
										onChange={(event) =>
											commitManual({
												...manualRule,
												rules: manualRule.rules.map((entry, entryIndex) =>
													entryIndex === index
														? { ...entry, menuItemId: event.target.value }
														: entry,
												),
											})
										}
										className="min-w-56"
									>
										{(catalog?.items ?? []).map((item) => (
											<MenuItem key={item.id} value={item.id}>
												{item.name}
											</MenuItem>
										))}
									</TextField>
								)}

								{qualifiers.menuCategory && (
									<TextField
										select
										size="small"
										label="Category"
										value={rule.menuCategoryId ?? ""}
										error={!rule.menuCategoryId}
										helperText={
											rule.menuCategoryId ? undefined : "Pick a category"
										}
										onChange={(event) =>
											commitManual({
												...manualRule,
												rules: manualRule.rules.map((entry, entryIndex) =>
													entryIndex === index
														? { ...entry, menuCategoryId: event.target.value }
														: entry,
												),
											})
										}
										className="min-w-56"
									>
										{(catalog?.categories ?? []).map((category) => (
											<MenuItem key={category.id} value={category.id}>
												{category.name}
											</MenuItem>
										))}
									</TextField>
								)}

								{qualifiers.withinDays && (
									<TextField
										size="small"
										type="number"
										label="Within days"
										placeholder="all time"
										value={rule.withinDays ?? ""}
										onChange={(event) => {
											const raw = event.target.value;
											commitManual({
												...manualRule,
												rules: manualRule.rules.map((entry, entryIndex) => {
													if (entryIndex !== index) return entry;
													const { withinDays: _old, ...rest } = entry;
													return raw === ""
														? rest
														: { ...rest, withinDays: Number(raw) };
												}),
											});
										}}
										className="max-w-36"
									/>
								)}

								<Button
									color="error"
									onClick={() =>
										commitManual({
											...manualRule,
											rules: manualRule.rules.filter(
												(_, entryIndex) => entryIndex !== index,
											),
										})
									}
								>
									Remove
								</Button>
							</Stack>
						);
					})}

					<Button
						variant="outlined"
						size="small"
						onClick={() =>
							commitManual({
								...manualRule,
								rules: [
									...manualRule.rules,
									{ field: "orderCount", op: "gte", value: 1 },
								],
							})
						}
					>
						Add condition
					</Button>
				</Stack>
			) : (
				<>
					<Typography variant="subtitle2" className="font-semibold">
						Describe the audience
					</Typography>
					<Typography variant="body2" color="text.secondary">
						Tell the assistant who should be in this group (e.g. â€œcustomers
						who ordered at least three times and spent more than 100 in the last
						60 daysâ€). It drafts the rule and explains it; saving the group
						stores it.
					</Typography>
				</>
			)}

			{aiEnabled !== false && (
				<Box>
					<Button size="small" onClick={() => setManual((value) => !value)}>
						{manual ? "Use the AI assistant" : "Build the rule manually"}
					</Button>
				</Box>
			)}

			{draft && (
				<Box className="rounded-lg border border-solid border-gray-200 bg-gray-50 p-4">
					<Typography
						variant="caption"
						className="block font-semibold uppercase tracking-wide text-gray-500"
					>
						Rule summary
					</Typography>
					<Typography variant="body1" className="mt-1 font-medium">
						{draft.summary || "No rule yet"}
					</Typography>
					{draft.lines.length > 0 && (
						<Stack spacing={0.5} className="mt-2">
							{draft.lines.map((line) => (
								<Typography key={line} variant="body2" color="text.secondary">
									â€¢ {line}
								</Typography>
							))}
						</Stack>
					)}
					{draft.errors.length > 0 && (
						<Alert severity="error" className="mt-3">
							{draft.errors.map((entry) => entry.message).join(" Â· ")}
						</Alert>
					)}
					{isSuperAdmin && storedJson && (
						<Box className="mt-3">
							<Typography
								variant="caption"
								className="block font-semibold uppercase tracking-wide text-gray-500"
							>
								Rule JSON (super admin)
							</Typography>
							<Box
								component="pre"
								className="mt-1 max-h-64 overflow-auto rounded border border-solid border-gray-200 bg-white p-3 text-xs"
							>
								{storedJson}
							</Box>
						</Box>
					)}
				</Box>
			)}

			{!showManual && (
				<>
					{turns.length > 0 && (
						<Box className="max-h-80 overflow-auto rounded-lg border border-solid border-gray-200 p-3">
							<Stack spacing={1.5}>
								{turns.map((turn, index) => (
									<Box
										key={`${turn.role}-${index}`}
										className={
											turn.role === "user"
												? "self-end rounded-lg bg-blue-50 px-3 py-2"
												: "self-start rounded-lg bg-gray-50 px-3 py-2"
										}
									>
										<Typography variant="caption" color="text.secondary">
											{turn.role === "user" ? "You" : "Assistant"}
										</Typography>
										<Typography variant="body2" className="whitespace-pre-wrap">
											{turn.content}
										</Typography>
									</Box>
								))}
							</Stack>
						</Box>
					)}

					{error && <Alert severity="error">{error}</Alert>}

					<Stack direction="row" spacing={1} className="items-end">
						<TextField
							fullWidth
							size="small"
							multiline
							minRows={2}
							placeholder="Who should be in this audience?"
							value={input}
							onChange={(event) => setInput(event.target.value)}
							onKeyDown={onKeyDown}
							disabled={sending}
						/>
						<Button
							variant="contained"
							onClick={() => void send()}
							disabled={sending || input.trim().length === 0}
						>
							{sending ? <CircularProgress size={18} color="inherit" /> : "Ask"}
						</Button>
					</Stack>
				</>
			)}

			{stored && (
				<>
					<Divider />
					<Stack direction="row" spacing={1} className="items-center">
						<Chip size="small" color="success" label="Rule ready" />
						<Typography variant="caption" color="text.secondary">
							Saving the group stores the rule above.
						</Typography>
					</Stack>
				</>
			)}
		</Stack>
	);
}
