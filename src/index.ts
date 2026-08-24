// ──────────────────────────────────────────────────────────────────
// @wrk-t/render-pipeline — public API.
//
// Metadata-driven client rendering: pipeline (fetch → gate → resolve
// → dispatch), blueprint renderers, screen routing, dynamic forms
// and tables, plus the shared UI/helpers they rely on.
//
// The host app must call `configureRenderPipeline(...)` once at
// startup (see deps.ts).
// ──────────────────────────────────────────────────────────────────

export { AbilityProvider, useAbility, useCan } from "./ability/AbilityContext";
export {
	type AppAbility,
	type AppAction,
	type AppSubject,
	buildAbility,
	type RawPermission,
} from "./ability/buildAbility";
export {
	checkComponentPermission,
	type PermissionRequirement,
	type UserPermission,
} from "./ability/checkComponentPermission";
export {
	checkTier,
	resolveTier,
	TIER_ORDER,
	type WorkspaceTier,
} from "./ability/checkTier";
export type { ComponentRendererProps } from "./ComponentRenderer";
// ── Pipeline core ────────────────────────────────────────────
export { AutoComponent, ComponentRenderer } from "./ComponentRenderer";
export { EmptyChart } from "./components/common/emptyChart/EmptyChart";
export { RangeDatePicker } from "./components/common/fields/dateRangePicker";
export {
	Past24Hours,
	type TDatePickerValue,
} from "./components/common/fields/dateRangePicker/config";
export { ICON_EXPORT, Unicon } from "./components/common/icon/Unicon";
export { LocalMonacoEditor } from "./components/common/LocalMonacoEditor";
export type { LocalMonacoEditorProps } from "./components/common/LocalMonacoEditor";
// ── Shared UI / helpers ──────────────────────────────────────
export { BaseDialog } from "./components/dialog/BaseDialog";
export { BaseDialogActions } from "./components/dialog/BaseDialogActions";
export { BaseDialogHeader } from "./components/dialog/BaseDialogHeader";
export type {
	IBaseDialogActionsProps,
	IBaseDialogProps,
} from "./components/dialog/types";
export type { RenderPipelineDeps, RenderUser } from "./deps";
// ── Dependency seam ──────────────────────────────────────────
export {
	configureRenderPipeline,
	getApiClient,
	getUserSnapshot,
	useRenderUser,
} from "./deps";
export {
	buildFieldSchema,
	buildFormSchema,
	registerCustomValidator,
} from "./dynamic-form/buildValidationSchema";
export { evaluateFieldConditions } from "./dynamic-form/fieldHelpers";
export {
	FormAutocompleteField,
	FormColorField,
	FormDateField,
	FormEmailField,
	FormImageField,
	FormJsonField,
	FormMultiSelectField,
	FormNumberField,
	FormPasswordField,
	FormReferenceField,
	FormSelectField,
	FormSwitchField,
	FormTextareaField,
	FormTextField,
} from "./dynamic-form/fields";
export type {
	EntityMeta,
	FieldDatasource,
	FieldType,
	FormAction,
	FormRenderForm,
	FormRenderResponse,
	FormRenderSection,
	FormRenderSettings,
	RenderField,
	SelectOption,
	TableAction,
	TableColumnInstance,
	TableMetadata,
	TableSubTable,
	ValidationRule,
} from "./dynamic-form/types";
export type {
	DynamicTableColumn,
	DynamicTableProps,
} from "./dynamic-table";
// ── Dynamic form / table engines ─────────────────────────────
export { DynamicTable } from "./dynamic-table";
export type { FeatureFlags } from "./hooks/useFeatures";
export { DEFAULT_FEATURES, useFeatures } from "./hooks/useFeatures";
export { useResolvedParams } from "./hooks/useResolvedParams";
export { useSnack } from "./hooks/useSnack";
export type { PageQueryParams, QueryParams } from "./query-builder";
export {
	extractPlaceholders,
	hasUnresolvedParams,
	resolveUrlTemplate,
	usePageQueryParams,
} from "./query-builder";
export { RenderBoundary, UnknownRenderer } from "./RenderBoundary";
export { registerRenderer, rendererRegistry } from "./registry";
export { AvatarRenderer } from "./renderers/AvatarRenderer";
export { BadgeCell } from "./renderers/BadgeCell";
export { BarRenderer } from "./renderers/BarRenderer";
export { CellChartWrapper } from "./renderers/CellChartWrapper";
export { columnCellRenderers } from "./renderers/columnCellRenderers";
export { DateCell } from "./renderers/DateCell";
export { DateRangeProvider, useDateRange } from "./renderers/DateRangeContext";
export { DateRangeRenderer } from "./renderers/DateRangeRenderer";
export { FormFieldRenderer } from "./renderers/FormFieldRenderer";
export { FormRenderer } from "./renderers/FormRenderer";
export { GaugeRenderer } from "./renderers/GaugeRenderer";
export { InfoRenderer } from "./renderers/InfoRenderer";
export { LineChartCell } from "./renderers/LineChartCell";
export { LineRenderer } from "./renderers/LineRenderer";
export { MetricRenderer } from "./renderers/MetricRenderer";
export { PageRenderer } from "./renderers/PageRenderer";
export { PieRenderer } from "./renderers/PieRenderer";
export { RawJsonRenderer } from "./renderers/RawJsonRenderer";
export { ReferenceCell } from "./renderers/ReferenceCell";
// ── Renderers ────────────────────────────────────────────────
export { ScreenLayoutRenderer } from "./renderers/ScreenLayoutRenderer";
export { StageActionsRenderer } from "./renderers/StageActionsRenderer";
export { StateContextRenderer } from "./renderers/StateContextRenderer";
export { TypographyRenderer } from "./renderers/TypographyRenderer";
export { TableRenderer } from "./renderers/TableRenderer";
export { TabsRenderer } from "./renderers/TabsRenderer";
export type { VersionInfo } from "./renderers/VersionContext";
export { useVersion, VersionProvider } from "./renderers/VersionContext";
export type { ParamResolveContext, ParamScope } from "./resolveParams";
export {
	getQueryParams,
	ParentBindingsContext,
	resolveParamBindings,
	useParamScope,
	useParentBindings,
} from "./resolveParams";
export { matchPattern } from "./screens/matchPattern";
export { resolveScreen } from "./screens/resolveScreen";
// ── Screens (routing) ────────────────────────────────────────
export { ScreenPage } from "./screens/ScreenPage";
export { ScreenStateProvider, useScreenState } from "./screens/ScreenState";
export type {
	ResolvedScreen,
	Screen,
	ScreenPageProps,
} from "./screens/types";
export {
	screenKey,
	useScreen,
	useScreenPreloader,
} from "./screens/useScreenPreloader";
export type {
	AutoComponentProps,
	FormReadyApi,
	ParamBinding,
	ParamBindingSource,
	RenderedComponent,
	RenderedElement,
	RendererComponent,
	RendererProps,
} from "./types";
export type { UiComponentSeed } from "./ui-components";
// ── Shared UI / helpers ──────────────────────────────────────
// ── UI components (canonical seed contract) ──────────────────
export { UI_COMPONENT_CUIDS, UI_COMPONENTS_SEED } from "./ui-components";
export { useComponentRender } from "./useComponentRender";
