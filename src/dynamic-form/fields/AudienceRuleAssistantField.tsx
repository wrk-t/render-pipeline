// ═══════════════════════════════════════════════════════════════
// AudienceRuleAssistantField — the AI rule builder for a group's
// "Define a rule" audience mode.
//
// The manager describes who should be in the group in words; the
// `ai/rule-authoring` assistant drafts a rule, the backend validates it with
// the same engine that stores it, and the canonical rule is written to the
// form's `conditions` field (a JSON string the group API already accepts).
//
// The summary is **ours** (generated from the canonical rule), so it can never
// disagree with what will be saved. The raw JSON is shown only to a platform
// super admin — a tenant sees the summary and the conversation.
// ═══════════════════════════════════════════════════════════════
"use client";

import { useField } from "formik";
import {
	type KeyboardEvent,
	type ReactElement,
	type ReactNode,
	useEffect,
	useId,
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

interface IPreviewMember {
	customerId: string;
	name: string;
	phone: string;
	orderCount: number;
}

/** What the rule would match right now — a dry run, nothing is saved. */
interface IMatchPreview {
	matchedCount: number;
	sample: IPreviewMember[];
}

/**
 * How long a rule edit waits before the preview asks the server (UX-21).
 *
 * Debounced so typing a threshold does not send one request per keystroke;
 * 500 ms keeps the count "within 1 s of a rule change" including the round
 * trip.
 */
const PREVIEW_DEBOUNCE_MS = 500;

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

// ── Manual rule builder ─────────────────────────────────────────
// The assistant is optional (AI_ENDPOINT/AI_API_KEY); without it a tenant
// still needs a way to define an audience. These are the aggregates the rule
// engine supports (see customerSegments.ts) and its operators, together with
// the qualifiers each field accepts — a product filter and the look-back
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
 * Which qualifier a field takes — mirrors `CUSTOMER_SEGMENT_FIELD_QUALIFIERS`
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
	{ value: "neq", label: "≠" },
	{ value: "gt", label: ">" },
	{ value: "gte", label: "≥" },
	{ value: "lt", label: "<" },
	{ value: "lte", label: "≤" },
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

/** Ask the server what the rule matches right now (a dry run, no save). */
async function fetchMatchPreview(
	conditions: Record<string, unknown>,
	signal: AbortSignal,
): Promise<IMatchPreview | null> {
	const res = await getApiClient().request({
		url: "/api/v1/customer-segments/preview",
		method: "post",
		data: { conditions },
		signal,
	});
	return (res.data?.data ?? null) as IMatchPreview | null;
}

/** A preview failure is reported, never written to the form's rule. */
function previewErrorMessage(requestError: unknown): string {
	const response = (
		requestError as {
			response?: { status?: number; data?: { message?: string } };
		}
	).response;
	const message = response?.data?.message;
	// Surface the API's translated validation message when there is one; a raw
	// `errors.*` key (no locale resolved) is not something a manager should read.
	if (message && !message.startsWith("errors.")) return message;

	return response?.status === 400
		? "This rule is not valid yet — fix it and the count will come back."
		: "The match count is unavailable right now. Your rule is unchanged.";
}

// ── Shared Tailwind primitives ──────────────────────────────────

const INPUT_CLASS =
	"w-full rounded-lg border border-border bg-background px-3 py-2 text-start text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60";

const LABEL_CLASS = "text-xs text-muted-foreground";

const SECTION_TITLE_CLASS = "text-sm font-semibold text-foreground";

const CAPTION_CLASS = "text-xs text-muted-foreground";

const GHOST_BUTTON_CLASS =
	"inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-primary transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";

const OUTLINE_BUTTON_CLASS =
	"inline-flex items-center justify-center gap-2 self-start rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";

const PRIMARY_BUTTON_CLASS =
	"inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";

const DESTRUCTIVE_BUTTON_CLASS =
	"inline-flex items-center gap-1.5 self-start rounded-lg px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 sm:self-end";

const BANNER_CLASS: Record<"info" | "warning" | "error", string> = {
	info: "border-info-main/30 bg-info-main/10 text-foreground",
	warning: "border-warning-main/30 bg-warning-main/10 text-foreground",
	error: "border-destructive/30 bg-destructive/10 text-destructive",
};

function Spinner({ className }: { className?: string }): ReactElement {
	return (
		<span
			role="status"
			aria-label="Loading"
			className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className ?? "size-4"}`}
		/>
	);
}

function Banner({
	severity,
	className,
	children,
}: {
	severity: "info" | "warning" | "error";
	className?: string;
	children: ReactNode;
}): ReactElement {
	return (
		<div
			role="alert"
			className={`rounded-lg border px-4 py-3 text-sm ${BANNER_CLASS[severity]}${className ? ` ${className}` : ""}`}
		>
			{children}
		</div>
	);
}

function ReadyChip(): ReactElement {
	return (
		<span className="inline-flex items-center rounded-full bg-success-main/10 px-2 py-0.5 text-xs font-medium text-success-main">
			Rule ready
		</span>
	);
}

/**
 * The live match count under the builder (UX-21): "Matches N customers" and,
 * on request, the first ten of them.
 *
 * Presentational on purpose — the request, its debounce and its cancellation
 * live in the field, so toggling the sample never re-queries the audience.
 */
function AudienceMatchPreview({
	loading,
	preview,
	error,
}: {
	loading: boolean;
	preview: IMatchPreview | null;
	error: string | null;
}): ReactElement {
	const [showSample, setShowSample] = useState(false);
	const hasSample = (preview?.sample.length ?? 0) > 0;
	const idle = !(loading || preview || error);

	return (
		<div className="flex flex-col gap-2">
			{loading && (
				<div className="flex items-center gap-2">
					<Spinner className="size-4 text-primary" />
					<p className="text-sm text-muted-foreground">Counting matches…</p>
				</div>
			)}

			{!loading && preview && (
				<div className="flex flex-wrap items-center gap-2">
					<ReadyChip />
					<p className="text-sm font-semibold text-foreground">
						{preview.matchedCount === 1
							? "Matches 1 customer"
							: `Matches ${preview.matchedCount} customers`}
					</p>
					{hasSample && (
						<button
							type="button"
							onClick={() => setShowSample((open) => !open)}
							className={GHOST_BUTTON_CLASS}
						>
							{showSample
								? "Hide sample"
								: `View ${preview.sample.length}-customer sample`}
						</button>
					)}
				</div>
			)}

			{idle && (
				<div className="flex flex-wrap items-center gap-2">
					<ReadyChip />
					<p className={CAPTION_CLASS}>
						Saving the group stores the rule above.
					</p>
				</div>
			)}

			{showSample && preview && hasSample && (
				<div className="rounded-lg border border-border p-3">
					<p className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						Sample — customers matching now
					</p>
					<div className="mt-1 flex flex-col gap-1">
						{preview.sample.map((member) => (
							<div
								key={member.customerId}
								className="flex flex-wrap items-baseline gap-2"
							>
								<p className="text-sm font-medium text-foreground">
									{member.name}
								</p>
								<p className={CAPTION_CLASS}>{member.phone}</p>
								<p className={CAPTION_CLASS}>
									·{" "}
									{member.orderCount === 1
										? "1 order"
										: `${member.orderCount} orders`}
								</p>
							</div>
						))}
					</div>
				</div>
			)}

			{error && <Banner severity="warning">{error}</Banner>}

			{preview && (
				<p className={CAPTION_CLASS}>
					This is a live preview; saving stores the rule above and keeps the
					same members.
				</p>
			)}
		</div>
	);
}

export function AudienceRuleAssistantField({
	field,
}: {
	// biome-ignore lint/suspicious/noExplicitAny: RenderField union shared with the form renderer
	field: any;
}): ReactElement {
	const [{ value }, , { setValue, setTouched }] = useField<string>(field.name);
	const baseId = useId();
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
	const [matchPreview, setMatchPreview] = useState<IMatchPreview | null>(null);
	const [previewLoading, setPreviewLoading] = useState(false);
	const [previewError, setPreviewError] = useState<string | null>(null);

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

	// "Matches N customers" while the rule is being built (UX-21).
	//
	// A dry run through the same evaluator the save uses, so the count the
	// manager sees cannot disagree with the group's members afterwards. The
	// request is debounced and every edit aborts the previous one, so a slow
	// answer for an older rule can never land under a newer one. A failure is
	// reported in place and leaves the form value — the rule — untouched.
	useEffect(() => {
		const rule = parseConditions(value);
		if (!rule) {
			setMatchPreview(null);
			setPreviewError(null);
			setPreviewLoading(false);
			return;
		}

		const controller = new AbortController();
		const timer = setTimeout(async () => {
			setPreviewLoading(true);
			setPreviewError(null);
			try {
				const result = await fetchMatchPreview(rule, controller.signal);
				if (controller.signal.aborted || !result) return;
				setMatchPreview(result);
				setPreviewLoading(false);
			} catch (requestError) {
				if (controller.signal.aborted) return;
				setMatchPreview(null);
				setPreviewError(previewErrorMessage(requestError));
				setPreviewLoading(false);
			}
		}, PREVIEW_DEBOUNCE_MS);

		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	}, [value]);

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

	const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			void send();
		}
	};

	return (
		<div className="flex flex-col gap-4">
			{aiEnabled === false && (
				<Banner severity="info">
					The AI assistant is not configured on this platform. Build the rule
					manually below — it is validated and saved exactly like an
					assistant-drafted one.
				</Banner>
			)}

			{showManual ? (
				<div className="flex flex-col gap-4">
					<h3 className={SECTION_TITLE_CLASS}>Build the rule</h3>
					<p className="text-sm text-muted-foreground">
						Combine the order-history conditions below. Only confirmed orders
						count; pending and cancelled orders are ignored. The group keeps the
						rule and matches customers on it.
					</p>

					<div className="flex w-full max-w-56 flex-col gap-0.5">
						<label htmlFor={`${baseId}-match`} className={LABEL_CLASS}>
							Match
						</label>
						<select
							id={`${baseId}-match`}
							value={manualRule.match}
							onChange={(event) =>
								commitManual({
									...manualRule,
									match: event.target.value as IManualRule["match"],
								})
							}
							className={INPUT_CLASS}
						>
							<option value="all">All conditions</option>
							<option value="any">Any condition</option>
						</select>
					</div>

					{manualRule.rules.length === 0 && (
						<Banner severity="warning">
							Add at least one condition to define this audience.
						</Banner>
					)}

					{manualRule.rules.map((rule, index) => {
						const qualifiers = MANUAL_QUALIFIERS[rule.field];
						return (
							<div
								key={index}
								className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end"
							>
								<div className="flex w-full flex-col gap-0.5 sm:w-64">
									<label
										htmlFor={`${baseId}-field-${index}`}
										className={LABEL_CLASS}
									>
										Field
									</label>
									<select
										id={`${baseId}-field-${index}`}
										value={rule.field}
										onChange={(event) => {
											const field = event.target.value as TManualField;
											// Switching field drops the qualifiers the new field does
											// not take — a stale product id would be rejected by the
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
										className={INPUT_CLASS}
									>
										{MANUAL_FIELDS.map((entry) => (
											<option key={entry.value} value={entry.value}>
												{entry.label}
											</option>
										))}
									</select>
								</div>

								<div className="flex w-full flex-col gap-0.5 sm:w-28">
									<label
										htmlFor={`${baseId}-op-${index}`}
										className={LABEL_CLASS}
									>
										Operator
									</label>
									<select
										id={`${baseId}-op-${index}`}
										value={rule.op}
										onChange={(event) =>
											commitManual({
												...manualRule,
												rules: manualRule.rules.map((entry, entryIndex) =>
													entryIndex === index
														? {
																...entry,
																op: event.target.value as TManualOp,
															}
														: entry,
												),
											})
										}
										className={INPUT_CLASS}
									>
										{MANUAL_OPS.map((entry) => (
											<option key={entry.value} value={entry.value}>
												{entry.label}
											</option>
										))}
									</select>
								</div>

								<div className="flex w-full flex-col gap-0.5 sm:w-28">
									<label
										htmlFor={`${baseId}-value-${index}`}
										className={LABEL_CLASS}
									>
										Value
									</label>
									<input
										id={`${baseId}-value-${index}`}
										type="number"
										value={rule.value}
										onChange={(event) =>
											commitManual({
												...manualRule,
												rules: manualRule.rules.map((entry, entryIndex) =>
													entryIndex === index
														? {
																...entry,
																value: Number(event.target.value),
															}
														: entry,
												),
											})
										}
										className={INPUT_CLASS}
									/>
								</div>

								{qualifiers.menuItem && (
									<div className="flex w-full flex-col gap-0.5 sm:w-56">
										<label
											htmlFor={`${baseId}-product-${index}`}
											className={LABEL_CLASS}
										>
											Product
										</label>
										<select
											id={`${baseId}-product-${index}`}
											value={rule.menuItemId ?? ""}
											aria-invalid={!rule.menuItemId || undefined}
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
											className={`${INPUT_CLASS} ${
												rule.menuItemId ? "" : "border-destructive"
											}`}
										>
											<option value="">Select…</option>
											{(catalog?.items ?? []).map((item) => (
												<option key={item.id} value={item.id}>
													{item.name}
												</option>
											))}
										</select>
										{!rule.menuItemId && (
											<p className="text-xs text-destructive">Pick a product</p>
										)}
									</div>
								)}

								{qualifiers.menuCategory && (
									<div className="flex w-full flex-col gap-0.5 sm:w-56">
										<label
											htmlFor={`${baseId}-category-${index}`}
											className={LABEL_CLASS}
										>
											Category
										</label>
										<select
											id={`${baseId}-category-${index}`}
											value={rule.menuCategoryId ?? ""}
											aria-invalid={!rule.menuCategoryId || undefined}
											onChange={(event) =>
												commitManual({
													...manualRule,
													rules: manualRule.rules.map((entry, entryIndex) =>
														entryIndex === index
															? {
																	...entry,
																	menuCategoryId: event.target.value,
																}
															: entry,
													),
												})
											}
											className={`${INPUT_CLASS} ${
												rule.menuCategoryId ? "" : "border-destructive"
											}`}
										>
											<option value="">Select…</option>
											{(catalog?.categories ?? []).map((category) => (
												<option key={category.id} value={category.id}>
													{category.name}
												</option>
											))}
										</select>
										{!rule.menuCategoryId && (
											<p className="text-xs text-destructive">
												Pick a category
											</p>
										)}
									</div>
								)}

								{qualifiers.withinDays && (
									<div className="flex w-full flex-col gap-0.5 sm:w-36">
										<label
											htmlFor={`${baseId}-within-${index}`}
											className={LABEL_CLASS}
										>
											Within days
										</label>
										<input
											id={`${baseId}-within-${index}`}
											type="number"
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
											className={INPUT_CLASS}
										/>
									</div>
								)}

								<button
									type="button"
									onClick={() =>
										commitManual({
											...manualRule,
											rules: manualRule.rules.filter(
												(_, entryIndex) => entryIndex !== index,
											),
										})
									}
									className={DESTRUCTIVE_BUTTON_CLASS}
								>
									Remove
								</button>
							</div>
						);
					})}

					<button
						type="button"
						onClick={() =>
							commitManual({
								...manualRule,
								rules: [
									...manualRule.rules,
									{ field: "orderCount", op: "gte", value: 1 },
								],
							})
						}
						className={OUTLINE_BUTTON_CLASS}
					>
						Add condition
					</button>
				</div>
			) : (
				<div className="flex flex-col gap-1">
					<h3 className={SECTION_TITLE_CLASS}>Describe the audience</h3>
					<p className="text-sm text-muted-foreground">
						Tell the assistant who should be in this group (e.g. “customers who
						ordered at least three times and spent more than 100 in the last 60
						days”). It drafts the rule and explains it; saving the group stores
						it.
					</p>
				</div>
			)}

			{aiEnabled !== false && (
				<div>
					<button
						type="button"
						onClick={() => setManual((value) => !value)}
						className={GHOST_BUTTON_CLASS}
					>
						{manual ? "Use the AI assistant" : "Build the rule manually"}
					</button>
				</div>
			)}

			{draft && (
				<div className="rounded-lg border border-border bg-muted p-4">
					<p className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						Rule summary
					</p>
					<p className="mt-1 text-base font-medium text-foreground">
						{draft.summary || "No rule yet"}
					</p>
					{draft.lines.length > 0 && (
						<div className="mt-2 flex flex-col gap-1">
							{draft.lines.map((line) => (
								<p key={line} className="text-sm text-muted-foreground">
									• {line}
								</p>
							))}
						</div>
					)}
					{draft.errors.length > 0 && (
						<Banner severity="error" className="mt-3">
							{draft.errors.map((entry) => entry.message).join(" · ")}
						</Banner>
					)}
					{isSuperAdmin && storedJson && (
						<div className="mt-3">
							<p className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
								Rule JSON (super admin)
							</p>
							<pre className="mt-1 max-h-64 overflow-auto rounded border border-border bg-background p-3 text-xs text-foreground">
								{storedJson}
							</pre>
						</div>
					)}
				</div>
			)}

			{!showManual && (
				<>
					{turns.length > 0 && (
						<div className="max-h-80 overflow-auto rounded-lg border border-border p-3">
							<div className="flex flex-col gap-3">
								{turns.map((turn, index) => (
									<div
										key={`${turn.role}-${index}`}
										className={
											turn.role === "user"
												? "self-end rounded-lg bg-info-main/10 px-3 py-2"
												: "self-start rounded-lg bg-muted px-3 py-2"
										}
									>
										<p className="text-xs text-muted-foreground">
											{turn.role === "user" ? "You" : "Assistant"}
										</p>
										<p className="whitespace-pre-wrap text-sm text-foreground">
											{turn.content}
										</p>
									</div>
								))}
							</div>
						</div>
					)}

					{error && <Banner severity="error">{error}</Banner>}

					<div className="flex items-end gap-2">
						<div className="flex-1">
							<textarea
								aria-label="Who should be in this audience?"
								rows={2}
								placeholder="Who should be in this audience?"
								value={input}
								onChange={(event) => setInput(event.target.value)}
								onKeyDown={onKeyDown}
								disabled={sending}
								className={INPUT_CLASS}
							/>
						</div>
						<button
							type="button"
							onClick={() => void send()}
							disabled={sending || input.trim().length === 0}
							className={PRIMARY_BUTTON_CLASS}
						>
							{sending ? (
								<Spinner className="size-[18px] text-primary-foreground" />
							) : (
								"Ask"
							)}
						</button>
					</div>
				</>
			)}

			{stored && (
				<>
					<div className="border-t border-border" />
					<AudienceMatchPreview
						loading={previewLoading}
						preview={matchPreview}
						error={previewError}
					/>
				</>
			)}
		</div>
	);
}
