import type {
	CompoundCondition,
	FormElementInstanceConfig,
	RenderField,
	SimpleCondition,
} from "./types";

/**
 * Read a value by **path**, so a condition can test a nested form value.
 *
 * Formik stores `schedule.frequency` as `{ schedule: { frequency } }`, so a
 * plain `values[field]` lookup silently sees `undefined` for every nested field
 * and the condition never fires (CRM-23's send-type fields live on
 * `schedule.*`). A path with no dot is a normal lookup, so flat fields are
 * unaffected.
 */
function getByPath(values: Record<string, unknown>, path: string): unknown {
	if (!path.includes(".")) return values[path];

	let current: unknown = values;
	for (const key of path.split(".")) {
		if (current === null || current === undefined) return undefined;
		current = (current as Record<string, unknown>)[key];
	}
	return current;
}

/**
 * Resolve the value to compare against.
 * When `valueType` is "field", the `value` is treated as the name of
 * another field whose value should be used for comparison.
 */
function resolveConditionValue(
	condition: SimpleCondition,
	values: Record<string, unknown>,
): unknown {
	if (condition.valueType === "field") {
		// value references another field name
		const referencedField = condition.value as string;
		return getByPath(values, referencedField);
	}
	return condition.value;
}

export function evaluateCondition(
	condition: SimpleCondition | CompoundCondition,
	values: Record<string, unknown>,
): boolean {
	if (condition.type === "simple") {
		const fieldValue = getByPath(values, condition.field);
		const resolvedValue = resolveConditionValue(condition, values);

		switch (condition.operator) {
			case "eq":
				return fieldValue === resolvedValue;
			case "ne":
				return fieldValue !== resolvedValue;
			case "gt":
				return Number(fieldValue) > Number(resolvedValue);
			case "gte":
				return Number(fieldValue) >= Number(resolvedValue);
			case "lt":
				return Number(fieldValue) < Number(resolvedValue);
			case "lte":
				return Number(fieldValue) <= Number(resolvedValue);
			case "contains":
				return String(fieldValue ?? "").includes(String(resolvedValue ?? ""));
			case "in": {
				const arr = resolvedValue as unknown[];
				return arr?.includes(fieldValue) ?? false;
			}
			case "isEmpty":
				return (
					fieldValue === undefined || fieldValue === null || fieldValue === ""
				);
			case "notEmpty":
				return (
					fieldValue !== undefined && fieldValue !== null && fieldValue !== ""
				);
			default:
				return true;
		}
	}

	// Compound condition
	const cmp = condition as CompoundCondition;
	const results = cmp.conditions.map((c: SimpleCondition | CompoundCondition) =>
		evaluateCondition(c, values),
	);

	switch (cmp.operator) {
		case "AND":
			return results.every(Boolean);
		case "OR":
			return results.some(Boolean);
		case "NOT":
			return !results.every(Boolean);
		default:
			return true;
	}
}

// ─────────────────────────────────────────────────────────────
// Condition array evaluators (used for top-level field conditions)
// ─────────────────────────────────────────────────────────────

/**
 * Evaluate an array of conditions as a conjunction (ALL must match).
 * Used for `visibleWhen` — the field is visible only when ALL conditions match.
 */
export function allConditionsMatch(
	conditions: Array<SimpleCondition | CompoundCondition> | null | undefined,
	values: Record<string, unknown>,
): boolean {
	if (!(conditions && Array.isArray(conditions)) || conditions.length === 0)
		return true;
	return conditions.every((c) => evaluateCondition(c, values));
}

/**
 * Evaluate an array of conditions as a disjunction (ANY must match).
 * Used for `disabledWhen` — the field is disabled when ANY condition matches.
 */
export function anyConditionMatches(
	conditions: Array<SimpleCondition | CompoundCondition> | null | undefined,
	values: Record<string, unknown>,
): boolean {
	if (!(conditions && Array.isArray(conditions)) || conditions.length === 0)
		return false;
	return conditions.some((c) => evaluateCondition(c, values));
}

// ─────────────────────────────────────────────────────────────
// InstanceConfig-based conditional logic evaluators
// ─────────────────────────────────────────────────────────────

export function shouldBeVisible(
	config: FormElementInstanceConfig | null | undefined,
	values: Record<string, unknown>,
): boolean {
	if (
		!(config?.visibleWhen && Array.isArray(config.visibleWhen)) ||
		config.visibleWhen.length === 0
	)
		return true;
	return config.visibleWhen.every((c: SimpleCondition | CompoundCondition) =>
		evaluateCondition(c, values),
	);
}

export function shouldBeDisabled(
	config: FormElementInstanceConfig | null | undefined,
	values: Record<string, unknown>,
): boolean {
	if (
		!(config?.disabledWhen && Array.isArray(config.disabledWhen)) ||
		config.disabledWhen.length === 0
	)
		return false;
	return config.disabledWhen.some((c: SimpleCondition | CompoundCondition) =>
		evaluateCondition(c, values),
	);
}

export function shouldBeRequired(
	config: FormElementInstanceConfig | null | undefined,
	values: Record<string, unknown>,
): boolean {
	if (
		!(config?.requiredWhen && Array.isArray(config.requiredWhen)) ||
		config.requiredWhen.length === 0
	)
		return false;
	return config.requiredWhen.some((c: SimpleCondition | CompoundCondition) =>
		evaluateCondition(c, values),
	);
}

// ─────────────────────────────────────────────────────────────
// Convenience: evaluate all conditions for a RenderField,
// merging both top-level conditions and instanceConfig conditions.
// ─────────────────────────────────────────────────────────────

export interface FieldConditionResult {
	/** Whether the field should be visible */
	isVisible: boolean;
	/** Whether the field should be disabled (readOnly or disabledWhen matches) */
	isDisabled: boolean;
	/** Whether the field should be required (from requiredWhen) */
	isRequired: boolean;
}

/**
 * Evaluate all conditions for a RenderField, merging both top-level
 * conditions (`field.visibleWhen`, `field.disabledWhen`, `field.requiredWhen`)
 * and instanceConfig conditions.
 */
export function evaluateFieldConditions(
	field: RenderField,
	values: Record<string, unknown>,
): FieldConditionResult {
	const instanceConfig = field.instanceConfig as
		| FormElementInstanceConfig
		| null
		| undefined;

	// ── Visibility: ALL conditions must match (from both field and instanceConfig) ──
	const visibleFromField = allConditionsMatch(field.visibleWhen, values);
	const visibleFromConfig = shouldBeVisible(instanceConfig, values);
	const isVisible = visibleFromField && visibleFromConfig;

	// ── Disabled: ANY condition can disable ──
	const readonly = field.isReadOnly;
	const disabledFromField = anyConditionMatches(field.disabledWhen, values);
	const disabledFromConfig =
		instanceConfig?.isReadOnly === true ||
		shouldBeDisabled(instanceConfig, values);
	const isDisabled = readonly || disabledFromField || disabledFromConfig;

	// ── Required: ANY condition can make it required ──
	const requiredFromField = anyConditionMatches(
		field.requiredWhen as
			| Array<SimpleCondition | CompoundCondition>
			| null
			| undefined,
		values,
	);
	const requiredFromConfig =
		instanceConfig?.isRequired === true ||
		shouldBeRequired(instanceConfig, values);
	const isRequired =
		field.isRequired || requiredFromField || requiredFromConfig;

	return { isVisible, isDisabled, isRequired };
}

/**
 * The accessible name of a form control (UX-9).
 *
 * The render contract puts the translated label on `field.label`, but a seed
 * field that declares no `displayName` reaches the component with an empty
 * label — the control then has no accessible name at all, and a screen reader
 * announces only its state ("on") or, for a select, nothing. Falling back to
 * the translated description and lastly the field name guarantees that every
 * control is named, while the label still wins whenever it exists.
 *
 * `aria-label` is set from this helper even when the visible label is present:
 * the two strings are identical, so the visible label stays part of the
 * accessible name (WCAG 2.5.3) and MUI's implicit label association can never
 * be lost to a wrapper.
 */
export function fieldAccessibleName(field: {
	label?: string | null;
	name?: string | null;
	fieldOverrides?: { description?: string | null } | null;
}): string {
	const label = field.label?.trim();
	if (label) return label;

	const description = field.fieldOverrides?.description?.trim();
	if (description) return description;

	const name = field.name?.trim() ?? "";
	// A CUID is an id, not a name — leaking it into an accessible name is the
	// exact complaint UX-9 fixes, so an id-shaped name yields no name at all.
	return looksLikeId(name) ? "" : name;
}

/** `cm5gdfqkqz8p5c9hjw5owbbb` (a CUID) or another id-shaped token. */
function looksLikeId(value: string): boolean {
	return value.length >= 20 && !/[^a-z0-9]/i.test(value) && /\d/.test(value);
}
