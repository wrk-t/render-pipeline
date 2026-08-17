// ═══════════════════════════════════════════════════════════════
// buildValidationSchema – Converts ValidationRule tuples into Yup
// validation schemas that Formik can use.
//
// Works exclusively with FormRenderResponse (sections.fields:
// RenderField[]).
// ═══════════════════════════════════════════════════════════════

import * as yup from "yup";
import type {
	FieldType,
	FormRenderResponse,
	RenderField,
	ValidationRule,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Regex helpers (mirrored from FormLocaleProvider so custom
// `Pattern` rules can reference them by name)
// ─────────────────────────────────────────────────────────────

const NAMED_REGEX: Record<string, RegExp> = {
	email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
	phone: /^(\+98|0)?9\d{9}$/,
	url: /^https?:\/\/.+/,
	farsi: /^[\u0600-\u06FF\s]+$/,
	nationalId: /^\d{10}$/,
};

// ─────────────────────────────────────────────────────────────
// Message interpolation — replaces {{n}} with the constraint value
// so template translations like "حداکثر {{n}} کاراکتر" become
// "حداکثر ۱۲ کاراکتر" at the last mile.
// ─────────────────────────────────────────────────────────────

function interpolateMessage(
	message: string | undefined,
	n: number,
): string | undefined {
	if (!message) return undefined;
	return message.replace(/\{\{n\}\}/g, String(n));
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Build a single Yup schema for a single field from its validation rules.
 *
 * @param rules      The ValidationRule tuples stored in the field definition.
 * @param fieldType  The FieldType hint (e.g. "number" → yup.number()).
 * @returns          A Yup schema (string, number, boolean, date, or mixed).
 */
export function buildFieldSchema(
	rules: ValidationRule[] | null | undefined,
	fieldType?: FieldType,
): yup.AnySchema {
	// ── 1. Pick the base type ──────────────────────────────────
	let schema: yup.AnySchema;

	const hasNumberRule = rules?.some((r) => r[0] === "IsNumber");
	const isNumericType = fieldType === "number";

	if (hasNumberRule || isNumericType) {
		schema = yup.number();
	} else if (
		rules?.some((r) => r[0] === "IsBoolean") ||
		fieldType === "switch"
	) {
		schema = yup.boolean().transform((value) => {
			// Coerce checkbox values: "on" → true, ["on"] → true, undefined → false
			if (Array.isArray(value)) return value.length > 0 && value[0] === "on";
			if (value === "on") return true;
			if (value === undefined || value === null) return false;
			return Boolean(value);
		});
	} else if (
		rules?.some((r) => r[0] === "IsDate") ||
		fieldType === "date" ||
		fieldType === "datetime"
	) {
		schema = yup.date();
	} else if (fieldType === "multiselect" || fieldType === "variants") {
		// Array-valued fields (multi-select ids, variant rows) — validate as
		// arrays so values like `["id1","id2"]` pass instead of failing the
		// default string schema.
		schema = yup.array();
	} else {
		schema = yup.string();
	}

	// ── 2. Make nullable so null values don't cause type errors ──
	// Yup's base types (string, number, etc.) reject `null` by default
	// even without .required(). Adding .nullable() ensures optional
	// fields can hold null/undefined without validation failure.
	// When a field IS required, .required() on a nullable schema still
	// rejects null values as expected.
	schema = schema.nullable();

	// ── 3. Apply each rule in order ────────────────────────────
	for (const rule of rules ?? []) {
		const [keyword, ...args] = rule;
		// The last arg is the translated message if it's a string
		const last = args.length > 0 ? args[args.length - 1] : undefined;
		const message = typeof last === "string" && last ? last : undefined;
		const params = message ? args.slice(0, -1) : args;

		switch (keyword) {
			// ── Required ─────────────────────────────────────────
			case "Required": {
				schema = schema.required(message);
				break;
			}

			// ── Type coercions (already handled above) ────────────
			case "IsString":
			case "IsNumber":
			case "IsBoolean":
			case "IsDate":
				break;

			// ── Format validators ────────────────────────────────
			case "IsEmail": {
				schema = (schema as yup.StringSchema).email(message);
				break;
			}
			case "IsUrl": {
				schema = (schema as yup.StringSchema).url(message);
				break;
			}

			// ── Length / range ───────────────────────────────────
			case "MinLength": {
				const minLenMsg = interpolateMessage(message, params[0] as number);
				schema = (schema as yup.StringSchema).min(
					params[0] as number,
					minLenMsg,
				);
				break;
			}
			case "MaxLength": {
				const maxLenMsg = interpolateMessage(message, params[0] as number);
				schema = (schema as yup.StringSchema).max(
					params[0] as number,
					maxLenMsg,
				);
				break;
			}
			case "Min": {
				const minMsg = interpolateMessage(message, params[0] as number);
				schema = (schema as yup.NumberSchema).min(params[0] as number, minMsg);
				break;
			}
			case "Max": {
				const maxMsg = interpolateMessage(message, params[0] as number);
				schema = (schema as yup.NumberSchema).max(params[0] as number, maxMsg);
				break;
			}

			// ── Pattern ──────────────────────────────────────────
			case "Pattern": {
				const patternStr = params[0] as string;
				const regex = NAMED_REGEX[patternStr] ?? new RegExp(patternStr);
				schema = (schema as yup.StringSchema).matches(regex, message);
				break;
			}

			// ── Unique (server-side only) ────────────────────────
			case "Unique": {
				break;
			}

			// ── Custom named validator ───────────────────────────
			case "SameAs": {
				const fieldName = params[0] as string;
				schema = schema.test(
					"sameAs",
					message ?? `Must match ${fieldName}`,
					function (value) {
						const other = (this.parent as Record<string, unknown>)[fieldName];
						return value === other;
					},
				);
				break;
			}

			// ── Custom named validator ───────────────────────────
			case "Custom": {
				const validatorName = args[0] as string;
				const validatorFn = CUSTOM_VALIDATORS[validatorName];
				if (validatorFn) {
					schema = schema.test(
						validatorName,
						validatorFn.message,
						validatorFn.test,
					);
				}
				break;
			}

			default:
				break;
		}
	}

	return schema;
}

// ─────────────────────────────────────────────────────────────
// Build a complete Yup object schema from a form's fields
// ─────────────────────────────────────────────────────────────

/**
 * Walk every section's fields and produce a Yup object schema
 * that can be passed to Formik's `validationSchema`.
 *
 * ```ts
 * const schema = buildFormSchema(formConfig);
 * // → yup.object({ username: yup.string().required(), … })
 * ```
 */
export function buildFormSchema(
	form: FormRenderResponse,
): yup.ObjectSchema<Record<string, unknown>> {
	const shape: Record<string, yup.AnySchema> = {};

	const allFields = [
		...form.sections.flatMap((s) => s.fields ?? []),
		...(form.ungroupedFields ?? []),
	];

	for (const field of allFields) {
		const rules = extractRenderFieldRules(field);
		shape[field.name] = buildFieldSchema(
			rules.length > 0 ? rules : null,
			field.type,
		);
	}

	return yup.object(shape);
}

// ─────────────────────────────────────────────────────────────
// Validation rule extraction for RenderField
// ─────────────────────────────────────────────────────────────

/**
 * Extract validation rules from a RenderField.
 *
 * RenderField doesn't carry `validations` directly — the rules
 * come from the underlying `fieldDefinition`. For now we derive
 * them from `isRequired` and type hints.
 * In the future this could look up rules from a cache or
 * field-override chain.
 */
function extractRenderFieldRules(field: RenderField): ValidationRule[] {
	const rules: ValidationRule[] = [];

	let isRequired = field.isRequired;
	if (field.fieldOverrides?.isRequired !== undefined) {
		isRequired = field.fieldOverrides.isRequired;
	}

	// Derive Required from isRequired
	if (isRequired) {
		rules.push(["Required"]);
	}

	// Collect fieldOverrides validation rule names for dedup —
	// fieldOverrides carry resolved translations so they must win
	const overrideRules = field.fieldOverrides?.validations ?? [];
	const overrideRuleNames = new Set(overrideRules.map((r) => r[0]));

	// Derive type-based rules from the field type (only when not
	// already provided by fieldOverrides)
	switch (field.type) {
		case "email":
			if (!overrideRuleNames.has("IsEmail")) {
				rules.push(["IsEmail"]);
			}
			break;
		case "number":
			if (!overrideRuleNames.has("IsNumber")) {
				rules.push(["IsNumber"]);
			}
			break;
		case "password":
			if (!overrideRuleNames.has("IsString")) {
				rules.push(["IsString"]);
			}
			break;
		default:
			break;
	}

	// Apply fieldOverrides validations (with resolved translations)
	if (overrideRules.length > 0) {
		rules.push(...overrideRules);
	}

	return rules;
}

// ─────────────────────────────────────────────────────────────
// Custom validator registry
// ─────────────────────────────────────────────────────────────

interface CustomValidator {
	message: string | ((params: { value: unknown }) => string);
	test: (value: unknown) => boolean;
}

const CUSTOM_VALIDATORS: Record<string, CustomValidator> = {
	/** Must be a strong password (upper + lower + digit + special). */
	strongPassword: {
		message:
			"Password must contain uppercase, lowercase, a digit, and a special character",
		test: (value) =>
			typeof value === "string" &&
			/[a-z]/.test(value) &&
			/[A-Z]/.test(value) &&
			/\d/.test(value) &&
			/[^a-zA-Z0-9]/.test(value),
	},

	/** Must be a valid mobile phone number (Iran format). */
	iranianPhone: {
		message: "Invalid phone number",
		test: (value) =>
			typeof value === "string" && /^(\+98|0)?9\d{9}$/.test(value),
	},

	/** Must be a valid national ID (10 digits). */
	iranianNationalId: {
		message: "Invalid national ID",
		test: (value) => typeof value === "string" && /^\d{10}$/.test(value),
	},
};

/**
 * Register (or override) a custom validator at runtime.
 * Useful for app-specific validation rules that aren't known at
 * compile time.
 */
export function registerCustomValidator(
	name: string,
	validator: CustomValidator,
): void {
	CUSTOM_VALIDATORS[name] = validator;
}
