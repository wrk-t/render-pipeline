import type {
  CompoundCondition,
  FormElementInstanceConfig,
  RenderField,
  SimpleCondition,
} from "./types";

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
    return values[referencedField];
  }
  return condition.value;
}

export function evaluateCondition(
  condition: SimpleCondition | CompoundCondition,
  values: Record<string, unknown>,
): boolean {
  if (condition.type === "simple") {
    const fieldValue = values[condition.field];
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
  if (!conditions || !Array.isArray(conditions) || conditions.length === 0) return true;
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
  if (!conditions || !Array.isArray(conditions) || conditions.length === 0) return false;
  return conditions.some((c) => evaluateCondition(c, values));
}

// ─────────────────────────────────────────────────────────────
// InstanceConfig-based conditional logic evaluators
// ─────────────────────────────────────────────────────────────

export function shouldBeVisible(
  config: FormElementInstanceConfig | null | undefined,
  values: Record<string, unknown>,
): boolean {
  if (!config?.visibleWhen || !Array.isArray(config.visibleWhen) || config.visibleWhen.length === 0) return true;
  return config.visibleWhen.every((c: SimpleCondition | CompoundCondition) =>
    evaluateCondition(c, values),
  );
}

export function shouldBeDisabled(
  config: FormElementInstanceConfig | null | undefined,
  values: Record<string, unknown>,
): boolean {
  if (!config?.disabledWhen || !Array.isArray(config.disabledWhen) || config.disabledWhen.length === 0) return false;
  return config.disabledWhen.some((c: SimpleCondition | CompoundCondition) =>
    evaluateCondition(c, values),
  );
}

export function shouldBeRequired(
  config: FormElementInstanceConfig | null | undefined,
  values: Record<string, unknown>,
): boolean {
  if (!config?.requiredWhen || !Array.isArray(config.requiredWhen) || config.requiredWhen.length === 0) return false;
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
