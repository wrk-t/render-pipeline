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

// ── Dependency seam ──────────────────────────────────────────
export {
  configureRenderPipeline,
  getApiClient,
  useRenderUser,
  getUserSnapshot,
} from "./deps";
export type { RenderPipelineDeps, RenderUser } from "./deps";

// ── Pipeline core ────────────────────────────────────────────
export { AutoComponent, ComponentRenderer } from "./ComponentRenderer";
export type { ComponentRendererProps } from "./ComponentRenderer";
export { rendererRegistry, registerRenderer } from "./registry";
export { RenderBoundary, UnknownRenderer } from "./RenderBoundary";
export {
  ParentBindingsContext,
  getQueryParams,
  resolveParamBindings,
  useParamScope,
  useParentBindings,
} from "./resolveParams";
export type { ParamResolveContext, ParamScope } from "./resolveParams";
export { useComponentRender } from "./useComponentRender";

export type {
  RenderedComponent,
  RenderedElement,
  RendererProps,
  RendererComponent,
  AutoComponentProps,
  FormReadyApi,
  ParamBinding,
  ParamBindingSource,
} from "./types";

// ── Renderers ────────────────────────────────────────────────
export { ScreenLayoutRenderer } from "./renderers/ScreenLayoutRenderer";
export { PageRenderer } from "./renderers/PageRenderer";
export { TableRenderer } from "./renderers/TableRenderer";
export { FormRenderer } from "./renderers/FormRenderer";
export { FormFieldRenderer } from "./renderers/FormFieldRenderer";
export { InfoRenderer } from "./renderers/InfoRenderer";
export { TabsRenderer } from "./renderers/TabsRenderer";
export { SectionRenderer } from "./renderers/SectionRenderer";
export { AvatarRenderer } from "./renderers/AvatarRenderer";
export { RawJsonRenderer } from "./renderers/RawJsonRenderer";
export { PieRenderer } from "./renderers/PieRenderer";
export { BarRenderer } from "./renderers/BarRenderer";
export { LineRenderer } from "./renderers/LineRenderer";
export { MetricRenderer } from "./renderers/MetricRenderer";
export { GaugeRenderer } from "./renderers/GaugeRenderer";
export { DateRangeRenderer } from "./renderers/DateRangeRenderer";
export { StageActionsRenderer } from "./renderers/StageActionsRenderer";
export { StateContextRenderer } from "./renderers/StateContextRenderer";
export { useDateRange, DateRangeProvider } from "./renderers/DateRangeContext";
export { useVersion, VersionProvider } from "./renderers/VersionContext";
export type { VersionInfo } from "./renderers/VersionContext";

export { BadgeCell } from "./renderers/BadgeCell";
export { ReferenceCell } from "./renderers/ReferenceCell";
export { DateCell } from "./renderers/DateCell";
export { LineChartCell } from "./renderers/LineChartCell";
export { CellChartWrapper } from "./renderers/CellChartWrapper";
export { columnCellRenderers } from "./renderers/columnCellRenderers";

// ── Screens (routing) ────────────────────────────────────────
export { ScreenPage } from "./screens/ScreenPage";
export { resolveScreen } from "./screens/resolveScreen";
export { matchPattern } from "./screens/matchPattern";
export {
  useScreen,
  useScreenPreloader,
  screenKey,
} from "./screens/useScreenPreloader";
export { ScreenStateProvider, useScreenState } from "./screens/ScreenState";
export type {
  Screen,
  Widget,
  ResolvedScreen,
  ScreenPageProps,
} from "./screens/types";

// ── Dynamic form / table engines ─────────────────────────────
export { DynamicTable } from "./dynamic-table";
export type {
  DynamicTableProps,
  DynamicTableColumn,
} from "./dynamic-table";
export {
  buildFieldSchema,
  buildFormSchema,
  registerCustomValidator,
} from "./dynamic-form/buildValidationSchema";
export { evaluateFieldConditions } from "./dynamic-form/fieldHelpers";
export type {
  RenderField,
  FieldType,
  FieldDatasource,
  EntityMeta,
  SelectOption,
  ValidationRule,
  FormAction,
  FormRenderSection,
  FormRenderSettings,
  FormRenderForm,
  FormRenderResponse,
  TableAction,
  TableMetadata,
  TableColumnInstance,
  TableSubTable,
} from "./dynamic-form/types";
export {
  FormTextField,
  FormTextareaField,
  FormNumberField,
  FormPasswordField,
  FormSelectField,
  FormMultiSelectField,
  FormSwitchField,
  FormDateField,
  FormEmailField,
  FormJsonField,
  FormImageField,
  FormColorField,
  FormReferenceField,
  FormAutocompleteField,
} from "./dynamic-form/fields";

// ── Shared UI / helpers ──────────────────────────────────────
export { BaseDialog } from "./components/dialog/BaseDialog";
export { BaseDialogHeader } from "./components/dialog/BaseDialogHeader";
export { BaseDialogActions } from "./components/dialog/BaseDialogActions";
export type {
  IBaseDialogProps,
  IBaseDialogActionsProps,
} from "./components/dialog/types";
export { Unicon, ICON_EXPORT } from "./components/common/icon/Unicon";
export { EmptyChart } from "./components/common/emptyChart/EmptyChart";
export { RangeDatePicker } from "./components/common/fields/dateRangePicker";
export {
  Past24Hours,
  type TDatePickerValue,
} from "./components/common/fields/dateRangePicker/config";

export {
  buildAbility,
  type RawPermission,
  type AppAction,
  type AppSubject,
  type AppAbility,
} from "./ability/buildAbility";
export { AbilityProvider, useAbility, useCan } from "./ability/AbilityContext";
export {
  checkComponentPermission,
  type PermissionRequirement,
  type UserPermission,
} from "./ability/checkComponentPermission";

export { useSnack } from "./hooks/useSnack";
export { useFeatures, DEFAULT_FEATURES } from "./hooks/useFeatures";
export type { FeatureFlags } from "./hooks/useFeatures";
export { useResolvedParams } from "./hooks/useResolvedParams";
export {
  resolveUrlTemplate,
  hasUnresolvedParams,
  extractPlaceholders,
  usePageQueryParams,
} from "./query-builder";
export type { QueryParams, PageQueryParams } from "./query-builder";
