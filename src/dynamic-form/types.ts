// ═══════════════════════════════════════════════════════════════
// FRONTEND-BACKEND CONTRACT
// ─────────────────────────────────────────────────────────────
// Importable TypeScript definitions for the frontend.
// Source of truth: drizzle schemas in src/config/database/main/schemas/
// ═══════════════════════════════════════════════════════════════

// ── 1. PAGINATION & QUERY HELPERS ──

export interface PaginatedResponse<T> {
	total: number | null;
	page: number | null;
	limit: number | null;
	totalPages: number | null;
	data: T[];
}

export interface PaginatedQuery {
	page?: number;
	limit?: number;
	search?: string;
	searchFields?: string[];
	sortBy?: string;
	sortOrder?: "asc" | "desc";
	include?: string[];
	[key: string]: unknown;
}

// ── 2. BASE ENTITY ──

export interface BaseEntity {
	id: string;
	createdAt: string;
	updatedAt: string;
	deletedAt: string | null;
}

export interface ActiveEntity extends BaseEntity {
	isActive: boolean;
	isSystem: boolean;
}

// ── 3. CONDITIONAL LOGIC ──

export type ConditionOperator =
	| "eq"
	| "ne"
	| "gt"
	| "gte"
	| "lt"
	| "lte"
	| "contains"
	| "in"
	| "isEmpty"
	| "notEmpty";

export type ConditionValueType = "literal" | "field";

export interface SimpleCondition {
	type: "simple";
	field: string;
	operator: ConditionOperator;
	value: unknown;
	valueType?: ConditionValueType;
}

export interface CompoundCondition {
	type: "compound";
	operator: "AND" | "OR" | "NOT";
	conditions: Array<SimpleCondition | CompoundCondition>;
}

export type Condition = SimpleCondition | CompoundCondition;

// ── 4. VALIDATION RULES ──
export type ValidationRule =
	| ["Required", string?]
	| ["IsString"]
	| ["IsNumber"]
	| ["IsBoolean"]
	| ["IsDate"]
	| ["IsEmail", string?]
	| ["IsUrl"]
	| ["MinLength", number, string?]
	| ["MaxLength", number, string?]
	| ["Min", number, string?]
	| ["Max", number, string?]
	| ["Pattern", string, string?]
	| ["Unique"]
	| ["Custom", string]
	| ["SameAs", string, string?];

// ── 5. SELECT OPTIONS ──

export interface SelectOption {
	label: string;
	value: unknown;
	disabled?: boolean;
}

// ── 6. FIELD TYPE ENUM ──

export type FieldType =
	| "text"
	| "textarea"
	| "number"
	| "email"
	| "password"
	| "select"
	| "multiselect"
	| "radio"
	| "checkbox"
	| "switch"
	| "date"
	| "datetime"
	| "time"
	| "file"
	| "image"
	| "richtext"
	| "json"
	| "reference"
	| "autocomplete"
	| "color";

// ── 7. DATASOURCE TYPES ──

/** Metadata attached by the backend when an entity datasource is resolved. */
export interface EntityMeta {
	displayField: string;
	valueField: string;
	searchFields: string[];
	filter?: { field: string; value: unknown };
	orderBy?: { field: string; direction: "asc" | "desc" };
}

export interface ServiceDatasource {
	type: "service";
	endpoint: string;
	method: "GET" | "POST";
	params?: Record<string, unknown>;
	dependsOn?: string[];
	transform?: string;
}

export interface FunctionDatasource {
	type: "function";
	module: string;
	function: string;
	params?: unknown[];
	dependsOn?: string[];
}

export interface StaticDatasource {
	type: "static";
	options: SelectOption[];
}

export interface SqlDatasource {
	type: "sql";
	query: string;
	connection?: string;
	dependsOn?: string[];
}

// ── 8. ENTITY DEFINITIONS ──

export interface Entity extends ActiveEntity {
	name: string;
	tableName: string;
	description: string | null;
	displayName: string | null;
	tenantId: string | null;
	meta: Record<string, unknown> | null;
}

export interface CreateEntityPayload {
	name: string;
	tableName: string;
	description?: string;
	displayName?: string;
	isSystem?: boolean;
	meta?: Record<string, unknown>;
}

export interface UpdateEntityPayload {
	name?: string;
	tableName?: string;
	description?: string;
	displayName?: string;
	isActive?: boolean;
	meta?: Record<string, unknown>;
}

// ── 9. FIELD DEFINITIONS ──

export interface ComputedExpression {
	type: "function" | "expression";
	expression?: string;
	function?: string;
	module?: string;
	dependsOn?: string[];
}

export interface FieldRelation {
	type: "oneToOne" | "oneToMany" | "manyToOne" | "manyToMany";
	targetEntity: string;
	targetField: string;
	joinTable?: string;
	cascade?: boolean;
}

export interface FieldDefinition extends ActiveEntity {
	name: string;
	displayName: string;
	type: FieldType;
	defaultValue: unknown;
	validations: ValidationRule[] | null;
	datasource: FieldDatasource | null;
	uiComponentId: string | null;
	configProps: Record<string, unknown>;
	dependsOn: string[] | null;
	visibleWhen: Condition[] | null;
	disabledWhen: Condition[] | null;
	requiredWhen: Condition[] | null;
	readonlyOnCreate: boolean;
	readonlyOnUpdate: boolean;
	hideOnCreate: boolean;
	hideOnUpdate: boolean;
	hideOnTable: boolean;
	visibleToRoles: string[] | null;
	order: number;
	category: string | null;
	tenantId: string | null;
	meta: Record<string, unknown> | null;
}

// ── 10. FORM TYPES ──

export type FormContext = "create" | "edit" | "view";

export type FormAction =
	| {
			action: "apiCall";
			label: string;
			endpoint: string;
			method: "POST" | "PUT" | "PATCH";
			context?: "create" | "edit";
			visibleIn?: ("page" | "dialog")[];
			onSuccess?: "closeDialog" | "redirect";
			successRedirect?: string;
			successMessage?: string;
			confirm?: { title: string; message: string };
	  }
	| {
			action: "navigate";
			label: string;
			path: string;
			context?: "create" | "edit";
			visibleIn?: ("page" | "dialog")[];
	  }
	| {
			action: "cancel";
			label: string;
			context?: "create" | "edit";
			visibleIn?: ("page" | "dialog")[];
	  }
	| {
			action: "link";
			label: string;
			path: string;
			context?: "create" | "edit";
			visibleIn?: ("page" | "dialog")[];
	  }
	| {
			action: "custom";
			label: string;
			context?: "create" | "edit";
			visibleIn?: ("page" | "dialog")[];
	  };

export interface FormSettings {
	validateOnBlur: boolean;
	validateOnChange: boolean;
	confirmOnLeave: boolean;
	autoSave?: boolean;
	autoSaveInterval?: number;
}

export interface FormDatasourceEntry {
	type: "service";
	name: string;
	endpoint: string;
	params?: Record<string, string>;
	dependsOn?: string;
}

export interface Form extends ActiveEntity {
	name: string;
	displayName: string;
	description: string | null;
	version: number;
	dataSource: FormDatasourceEntry[] | null;
	actions: FormAction[];
	settings: FormSettings;
	tenantId: string | null;
	category: string | null;
	meta: Record<string, unknown> | null;
}

// ── 11. UI TEMPLATES ──

export interface UiComponent {
	name: string;
	displayName: string | null;
	componentType: string;
	configProps: Record<string, unknown>;
}

// ── 12. FORM ELEMENTS & SECTIONS ──

export interface FormElementFieldOverrides {
	displayName?: string;
	description?: string;
	validations?: ValidationRule[] | null;
	datasource?: FieldDatasource | null;
	defaultValue?: unknown;
	isRequired?: boolean;
	isUnique?: boolean;
}

export interface FormElementUiOverrides {
	component?: string;
	props?: Record<string, unknown>;
	layout?: {
		colSpan?: number;
		rowSpan?: number;
		className?: string;
		style?: Record<string, string>;
	};
	behavior?: {
		autoFocus?: boolean;
		placeholder?: string;
		tooltip?: string;
		prefixIcon?: string;
		suffixIcon?: string;
		readOnly?: boolean;
		disabled?: boolean;
		autoComplete?: string;
		debounce?: number;
		throttle?: number;
	};
}

export interface FormElementInstanceConfig {
	isRequired?: boolean;
	isReadOnly?: boolean;
	isHidden?: boolean;
	dependsOn?: string[];
	visibleWhen?: Condition[];
	disabledWhen?: Condition[];
	requiredWhen?: Condition[];
	computedValue?: ComputedExpression;
}

export interface FormElement extends BaseEntity {
	formId: string;
	sectionId: string | null;
	fieldDefinitionId: string | null;
	uiTemplateId: string | null;
	fieldOverrides: FormElementFieldOverrides | null;
	uiOverrides: FormElementUiOverrides | null;
	instanceConfig: FormElementInstanceConfig | null;
	displayOrder: number;
	colSpan: number | null;
	tenantId: string | null;
	isActive: boolean;
	meta: Record<string, unknown> | null;
}

export interface FormSection extends BaseEntity {
	formId: string;
	name: string;
	displayName: string;
	description: string | null;
	collapsible: boolean;
	collapsedByDefault: boolean;
	displayOrder: number;
	tenantId: string | null;
	isActive: boolean;
	meta: Record<string, unknown> | null;
}

// ═══════════════════════════════════════════════════════════════
// FORM RENDER — Discriminated Union Fields
// ═══════════════════════════════════════════════════════════════
//
// Each raw form element is transformed into a discriminated union
// variant keyed by `type`. Enables exhaustive pattern matching:
//
//   match(field)
//     .with({ type: "text" }, (f) => <TextField name={f.name} ... />)
//     .with({ type: "select" }, (f) => <SelectField options={f.options} ... />)
//     .exhaustive()
//
// ═══════════════════════════════════════════════════════════════

// ── 13. RENDER FIELD BASE ──

export type FieldDatasource =
	| {
			type: "service";
			endpoint: string;
			method: "GET" | "POST";
			params?: Record<string, unknown>;
			dependsOn?: string[];
			transform?: string;
			/** Metadata from a resolved entity datasource (set by backend). */
			entityMeta?: EntityMeta;
	  }
	| {
			type: "function";
			module: string;
			function: string;
			params?: unknown[];
			dependsOn?: string[];
	  }
	| {
			type: "static";
			options: SelectOption[];
	  }
	| {
			type: "sql";
			query: string;
			connection?: string;
			dependsOn?: string[];
	  }
	| {
			type: "entity";
			entity: string;
			displayField: string;
			valueField?: string;
			searchFields?: string[];
			filter?: { field: string; value: unknown };
			orderBy?: { field: string; direction: "asc" | "desc" };
			dependsOn?: string[];
	  };

export interface FieldOverrides {
	displayName?: string;
	description?: string;
	validations?: ValidationRule[] | null;
	datasource?: FieldDatasource | null;
	defaultValue?: unknown;
	isRequired?: boolean;
	isUnique?: boolean;
}

// ── Shared base — no fieldOverrides or uiOverrides, each variant declares them ──

export interface FieldBase {
	id: string;
	formId: string;
	name: string;
	label: string;
	isRequired: boolean;
	isReadOnly: boolean;
	isActive: boolean;
	order: number;
	colSpan?: number;
	sectionId: string | null;
	dependsOn?: string[];
	visibleWhen?: Array<SimpleCondition | CompoundCondition>;
	disabledWhen?: Array<SimpleCondition | CompoundCondition>;
	requiredWhen?: Array<SimpleCondition | CompoundCondition>;
	instanceConfig?: unknown;
	fieldDefinitionId: string | null;
	uiComponentId: string | null;
	uiComponent?: UiComponent | null;
	tenantId: string | null;
	meta?: Record<string, unknown> | null;
}

// ── Layout — shared across all variants ──

interface FieldLayout {
	colSpan?: number;
	rowSpan?: number;
	className?: string;
	style?: Record<string, string>;
}

// ── Discriminated variants — each has typed fieldOverrides and uiOverrides ──

export interface TextField extends FieldBase {
	type: "text";
	fieldOverrides?: FieldOverrides | null;
	uiOverrides: {
		layout?: FieldLayout;
		behavior?: {
			placeholder?: string;
			defaultValue?: string;
			maxLength?: number;
			minLength?: number;
			pattern?: string;
			prefixIcon?: string;
			suffixIcon?: string;
			autoComplete?: string;
		};
	};
}

export interface ColorField extends FieldBase {
	type: "color";
	fieldOverrides?: FieldOverrides | null;
	uiOverrides: {
		layout?: FieldLayout;
		behavior?: {
			placeholder?: string;
			defaultValue?: string;
		};
	};
}

export interface TextareaField extends FieldBase {
	type: "textarea";
	fieldOverrides?: FieldOverrides | null;
	uiOverrides: {
		layout?: FieldLayout;
		behavior?: {
			placeholder?: string;
			defaultValue?: string;
			maxLength?: number;
			rows?: number;
		};
	};
}

export interface NumberField extends FieldBase {
	type: "number";
	fieldOverrides?: FieldOverrides | null;
	uiOverrides: {
		layout?: FieldLayout;
		behavior?: {
			placeholder?: string;
			defaultValue?: number;
			min?: number;
			max?: number;
			step?: number;
			prefixIcon?: string;
			suffixIcon?: string;
		};
	};
}

export interface EmailField extends FieldBase {
	type: "email";
	fieldOverrides?: FieldOverrides | null;
	uiOverrides: {
		layout?: FieldLayout;
		behavior?: {
			placeholder?: string;
			defaultValue?: string;
			autoComplete?: string;
		};
	};
}

export interface PasswordField extends FieldBase {
	type: "password";
	fieldOverrides?: FieldOverrides | null;
	uiOverrides: {
		layout?: FieldLayout;
		behavior?: {
			placeholder?: string;
			autoComplete?: string;
		};
	};
}

export interface SelectField extends FieldBase {
	type: "select";
	fieldOverrides?: FieldOverrides | null;
	options: SelectOption[];
	uiOverrides: {
		layout?: FieldLayout;
		behavior?: {
			placeholder?: string;
			defaultValue?: string;
		};
	};
}

export interface MultiselectField extends FieldBase {
	type: "multiselect";
	fieldOverrides?: FieldOverrides | null;
	options: SelectOption[];
	/** Remote datasource for dynamically-fetched options. */
	datasource?: FieldDatasource | null;
	description?: string;
	uiOverrides: {
		layout?: FieldLayout;
		behavior?: {
			placeholder?: string;
			defaultValue?: string[];
		};
	};
}

export interface RadioField extends FieldBase {
	type: "radio";
	fieldOverrides?: FieldOverrides | null;
	options: SelectOption[];
	uiOverrides: {
		layout?: FieldLayout;
		behavior?: Record<string, never>;
	};
}

export interface CheckboxField extends FieldBase {
	type: "checkbox";
	fieldOverrides?: FieldOverrides | null;
	uiOverrides: {
		layout?: FieldLayout;
		behavior?: { defaultValue?: boolean };
	};
}

export interface SwitchField extends FieldBase {
	type: "switch";
	fieldOverrides?: FieldOverrides | null;
	uiOverrides: {
		layout?: FieldLayout;
		behavior?: { defaultValue?: boolean };
	};
}

export interface DateField extends FieldBase {
	type: "date";
	fieldOverrides?: FieldOverrides | null;
	uiOverrides: {
		layout?: FieldLayout;
		behavior?: {
			placeholder?: string;
			defaultValue?: string;
			min?: string;
			max?: string;
		};
	};
}

export interface DateTimeField extends FieldBase {
	type: "datetime";
	fieldOverrides?: FieldOverrides | null;
	uiOverrides: {
		layout?: FieldLayout;
		behavior?: {
			placeholder?: string;
			defaultValue?: string;
			min?: string;
			max?: string;
		};
	};
}

export interface TimeField extends FieldBase {
	type: "time";
	fieldOverrides?: FieldOverrides | null;
	uiOverrides: {
		layout?: FieldLayout;
		behavior?: {
			placeholder?: string;
			defaultValue?: string;
			min?: string;
			max?: string;
		};
	};
}

export interface FileField extends FieldBase {
	type: "file";
	fieldOverrides?: FieldOverrides | null;
	uiOverrides: {
		layout?: FieldLayout;
		behavior?: {
			accept?: string;
			multiple?: boolean;
			maxSize?: number;
		};
	};
}

export interface ImageField extends FieldBase {
	type: "image";
	fieldOverrides?: FieldOverrides | null;
	uiOverrides: {
		layout?: FieldLayout;
		behavior?: {
			accept?: string;
			multiple?: boolean;
			maxSize?: number;
		};
	};
}

export interface RichtextField extends FieldBase {
	type: "richtext";
	fieldOverrides?: FieldOverrides | null;
	uiOverrides: {
		layout?: FieldLayout;
		behavior?: {
			placeholder?: string;
			defaultValue?: string;
			maxLength?: number;
		};
	};
}

export interface JsonField extends FieldBase {
	type: "json";
	fieldOverrides?: FieldOverrides | null;
	uiOverrides: {
		layout?: FieldLayout;
		behavior?: { defaultValue?: Record<string, unknown> };
	};
}

export interface ReferenceField extends FieldBase {
	type: "reference";
	fieldOverrides?: FieldOverrides | null;
	uiOverrides: {
		layout?: FieldLayout;
		behavior?: {
			displayField?: string;
			endpoint?: string;
		};
	};
}

export interface AutocompleteField extends FieldBase {
	type: "autocomplete";
	fieldOverrides?: FieldOverrides | null;
	options?: SelectOption[];
	uiOverrides: {
		layout?: FieldLayout;
		behavior?: {
			placeholder?: string;
			debounce?: number;
			minChars?: number;
		};
	};
}

// ── The full discriminated union ──

export type RenderField =
	| TextField
	| ColorField
	| TextareaField
	| NumberField
	| EmailField
	| PasswordField
	| SelectField
	| MultiselectField
	| RadioField
	| CheckboxField
	| SwitchField
	| DateField
	| DateTimeField
	| TimeField
	| FileField
	| ImageField
	| RichtextField
	| JsonField
	| ReferenceField
	| AutocompleteField;
// ── 16. RENDER RESPONSE SHAPES ──

export interface FormRenderSettings extends FormSettings {
	readonly: boolean;
}

export interface FormRenderForm {
	id: string;
	name: string;
	displayName: string;
	description?: string | null;
	version: number;
	renderContext: FormContext;
	actions: FormAction[];
	settings: FormRenderSettings;
	category?: string | null;
	isActive: boolean;
	isSystem: boolean;
	tenantId?: string | null;
	dataSource?: FormDatasourceEntry[] | null;
	meta?: Record<string, unknown> | null;
	createdAt: string;
	updatedAt: string;
	deletedAt?: string | null;
}

export interface FormRenderSection {
	id: string;
	name: string;
	displayName: string;
	description?: string | null;
	collapsible: boolean;
	collapsedByDefault: boolean;
	displayOrder: number;
	fields: RenderField[];
}

export interface FormRenderResponse {
	form: FormRenderForm;
	sections: FormRenderSection[];
	ungroupedFields: RenderField[];
}

export interface GetFormQuery {
	include?: string[];
	context?: FormContext;
	recordId?: string;
}

// ── 17. OVERRIDE TYPES ──

export interface FormOverride {
	formId: string;
	tenantId: string;
	displayName?: string | null;
	description?: string | null;
	actions?: FormAction[] | null;
	settings?: {
		validateOnBlur?: boolean;
		validateOnChange?: boolean;
		confirmOnLeave?: boolean;
		autoSave?: boolean;
		autoSaveInterval?: number;
	} | null;
	meta?: Record<string, unknown> | null;
}

export interface SectionOverride {
	sectionId: string;
	formId: string;
	tenantId: string;
	displayName?: string | null;
	description?: string | null;
	displayOrder?: number | null;
	collapsible?: boolean | null;
	collapsedByDefault?: boolean | null;
	isHidden?: boolean | null;
	meta?: Record<string, unknown> | null;
}

export interface FieldOverride {
	formId: string;
	elementId: string | null; // null = new field
	tenantId: string;
	displayName?: string | null;
	description?: string | null;
	isHidden?: boolean | null;
	isRequired?: boolean | null;
	isReadOnly?: boolean | null;
	placeholder?: string | null;
	tooltip?: string | null;
	validations?: ValidationRule[] | null;
	datasource?: unknown | null;
	defaultValue?: unknown;
	// For new fields (elementId IS NULL)
	fieldDefinitionId?: string | null;
	uiComponentId?: string | null;
	displayOrder?: number | null;
	colSpan?: number | null;
	sectionId?: string | null;
	visibleWhen?: Condition[] | null;
	disabledWhen?: Condition[] | null;
	meta?: Record<string, unknown> | null;
}

// ── 18. TABLE TYPES ──

export type PaginationType = "offset" | "cursor";
export type TableDensity = "compact" | "normal" | "comfortable";
export type FilterType = "text" | "select" | "date" | "number" | "boolean";
export type SelectionType = "single" | "multiple";
export type FrozenPosition = "left" | "right";
export type AggregationType = "sum" | "avg" | "count" | "min" | "max";
export type TableDatasourceType = "rest" | "graphql" | "sql";

export interface TablePaginationConfig {
	type: PaginationType;
	defaultPageSize: number;
	pageSizeOptions: number[];
}

export interface TableDatasourceConfig {
	type: TableDatasourceType;
	endpoint: string;
	method?: "GET" | "POST";
	params?: Record<string, string>;
	pagination: TablePaginationConfig;
	serverSide?: boolean;
}

export interface TableActionCondition {
	field: string;
	operator: ConditionOperator;
	value?: unknown;
}

export interface TableActionConfirm {
	title: string;
	message: string;
}

// ── TableAction – discriminated union supporting both legacy and new formats ──

interface TableActionBase {
	id: string;
	label: string;
	icon?: string;
	iconOn?: string;
	iconOff?: string;
	color?: string;
	type?: "button" | "dropdown" | "link";
	condition?: TableActionCondition;
	confirm?: TableActionConfirm;
	placement?: "top-toolbar" | "toolbar-actions";
	permissions?: string[];
	roles?: string[];
}

/** New format: open a dialog (form) from a table row or toolbar. */
interface TableActionOpenDialog extends TableActionBase {
	action: "openDialog";
	dialog: { formId: string; context?: "create" | "edit" | "view" };
}

/** New format: navigate to a path (supports {placeholder} resolution). */
interface TableActionNavigate extends TableActionBase {
	action: "navigate";
	path: string;
}

/** New format: call an API endpoint, optionally refresh table on success. */
interface TableActionApiCall extends TableActionBase {
	action: "apiCall";
	endpoint: string;
	method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
	onSuccess?: "refreshTable" | "closeDialog" | "navigate";
	successRedirect?: string;
	onError?: "showSnackbar";
}

/** New format: custom action with a string identifier (toggleDeleted, refreshData, …). */
interface TableActionCustomNew extends TableActionBase {
	action: "custom";
	customAction?: string;
}

/** Selection-based toolbar action — appears when rows are selected. */
interface TableActionLinkSelected extends TableActionBase {
	action: "linkSelected" | "unlinkSelected";
	endpoint: string;
	method: "GET" | "POST" | "PATCH" | "DELETE";
	redirect?: string;
	customAction?: string;
}

/** Legacy format (still supported during migration). */
interface TableActionLegacy extends TableActionBase {
	action: "view" | "edit" | "delete" | "custom";
	customAction?: string;
	redirect?: string;
	endpoint?: string;
	method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
}

export type TableAction =
	| TableActionOpenDialog
	| TableActionNavigate
	| TableActionApiCall
	| TableActionCustomNew
	| TableActionLinkSelected
	| TableActionLegacy;

export interface TableSettings {
	density: TableDensity;
	striped: boolean;
	bordered: boolean;
	stickyHeader: boolean;
	resizableColumns: boolean;
	exportable: boolean;
	importable: boolean;
	refreshable: boolean;
	searchable: boolean;
	searchableFields?: string[];
	columnToggle: boolean;
}

export interface TableEmptyState {
	title: string;
	description?: string;
	action?: string;
}

export interface ITableOnRowClick {
	redirect?: string;
	endpoint?: string;
	method?: "POST" | "PUT" | "PATCH" | "DELETE";
	permissions?: string[];
	/** When this feature flag is OFF, use fallbackRedirect instead of redirect. */
	fallbackFeature?: string;
	fallbackRedirect?: string;
}

export interface TableColumnConfig {
	width?: string | number;
	minWidth?: string | number;
	maxWidth?: string | number;
	align?: "left" | "center" | "right" | "justify";
	sortable?: boolean;
	filterable?: boolean;
	resizable?: boolean;
	draggable?: boolean;
	hideable?: boolean;
	pinnable?: boolean;
	editable?: boolean;
	filterType?: FilterType;
	filterOptions?: SelectOption[];
	filterPlaceholder?: string;
	filterDebounce?: number;
	sortFn?: string;
	sortOrder?: "asc" | "desc";
	cellRenderer?: string;
	cellClassName?: string;
	cellStyle?: Record<string, string | number>;
	headerRenderer?: string;
	headerClassName?: string;
	headerStyle?: Record<string, string | number>;
	tooltip?: string;
	tooltipRenderer?: string;
	format?: {
		type?:
			| "text"
			| "badge"
			| "tag"
			| "avatar"
			| "progress"
			| "rating"
			| "boolean"
			| "date"
			| "number";
		props?: Record<string, unknown>;
		transform?: string;
		pattern?: string;
		prefix?: string;
		suffix?: string;
		dateFormat?: string;
		timeFormat?: string;
	};
	aggregatable?: boolean;
	aggregationType?: AggregationType;
	aggregationRenderer?: string;
	groupable?: boolean;
	groupRenderer?: string;
	expandable?: boolean;
	expandRenderer?: string;
	selectable?: boolean;
	selectionType?: "checkbox" | "radio";
	actions?: Array<{
		type: "button" | "icon" | "dropdown" | "link";
		label?: string;
		icon?: string;
		action: string;
		props?: Record<string, unknown>;
		conditions?: Record<string, unknown>[];
	}>;
}

export interface TableSubTable {
	/** Name of another table_metadata row to use for nested expandable rows. */
	tableName: string;
	/** The target table's ID (for direct render endpoint lookup). */
	tableId: string;
}

export interface TableMetadata extends ActiveEntity {
	name: string;
	entityId: string | null;
	entity: string;
	title: string;
	description: string | null;
	datasource: TableDatasourceConfig;
	selection: {
		enabled: boolean;
		type: SelectionType;
		actions: TableAction[];
	} | null;
	rowActions: TableAction[];
	toolbarActions: TableAction[];
	settings: TableSettings;
	subTable?: TableSubTable | null;
	onRowClick?: ITableOnRowClick;
	expandable: { enabled: boolean; component: string } | null;
	emptyState: TableEmptyState | null;
	tenantId: string | null;
	category: string | null;
	displayOrder: number;
	meta: Record<string, unknown> | null;
}

export interface TableColumnInstance extends BaseEntity {
	tableMetadataId: string;
	fieldDefinitionId: string | null;
	uiTemplateId: string | null;
	fieldOverrides: FormElementFieldOverrides | null;
	uiOverrides: FormElementUiOverrides | null;
	columnConfig: TableColumnConfig | null;
	instanceConfig: FormElementInstanceConfig | null;
	displayOrder: number;
	fixedPosition: FrozenPosition | null;
	columnGroup: string | null;
	description: string | null;
	tenantId: string | null;
	isActive: boolean;
	isSystem: boolean;
	meta: Record<string, unknown> | null;
}
