// ──────────────────────────────────────────────────────────────────
// Renderer registry — the SINGLE source of truth for dispatching a
// blueprint name to its renderer component.
//
// To add a new renderer:
//   1. Create the renderer in ./renderers/
//   2. Import it here and add one entry below
// ──────────────────────────────────────────────────────────────────

import { AuditHistoryRenderer } from "./renderers/AuditHistoryRenderer";
import { AvatarRenderer } from "./renderers/AvatarRenderer";
import { BarRenderer } from "./renderers/BarRenderer";
import { BoxRenderer } from "./renderers/BoxRenderer";
import { ButtonRenderer } from "./renderers/ButtonRenderer";
import { ContainerRenderer } from "./renderers/ContainerRenderer";
import { DateRangeRenderer } from "./renderers/DateRangeRenderer";
import { FormRenderer } from "./renderers/FormRenderer";
import { GaugeRenderer } from "./renderers/GaugeRenderer";
import { GridRenderer } from "./renderers/GridRenderer";
import { InfoRenderer } from "./renderers/InfoRenderer";
import { LayoutRenderer } from "./renderers/LayoutRenderer";
import { LineRenderer } from "./renderers/LineRenderer";
import { LinkRenderer } from "./renderers/LinkRenderer";
import { ListRenderer } from "./renderers/ListRenderer";
import { LogoUploaderRenderer } from "./renderers/LogoUploaderRenderer";
import { MetricRenderer } from "./renderers/MetricRenderer";
import { PageRenderer } from "./renderers/PageRenderer";
import { PaperRenderer } from "./renderers/PaperRenderer";
import { PieRenderer } from "./renderers/PieRenderer";
import { RawJsonRenderer } from "./renderers/RawJsonRenderer";
import { ScreenLayoutRenderer } from "./renderers/ScreenLayoutRenderer";
import { ScreenTreeRenderer } from "./renderers/ScreenTreeRenderer";
import { StackRenderer } from "./renderers/StackRenderer";
import { StageActionsRenderer } from "./renderers/StageActionsRenderer";
import { StateContextRenderer } from "./renderers/StateContextRenderer";
import { TableRenderer } from "./renderers/TableRenderer";
import { TabsRenderer } from "./renderers/TabsRenderer";
import { TypographyRenderer } from "./renderers/TypographyRenderer";
import type { RendererComponent } from "./types";

export const rendererRegistry: Record<string, RendererComponent> = {
	// ── Blueprint-driven ──
	form: FormRenderer,
	page: PageRenderer,
	screen_layout_general: ScreenLayoutRenderer,
	table: TableRenderer,
	info: InfoRenderer,
	tabs: TabsRenderer,
	list: ListRenderer,
	"screen-tree": ScreenTreeRenderer,
	avatar: AvatarRenderer,
	"logo-uploader": LogoUploaderRenderer,
	"raw-json": RawJsonRenderer,
	"audit-history": AuditHistoryRenderer,
	"pie-chart": PieRenderer,
	"bar-chart": BarRenderer,
	"line-chart": LineRenderer,
	metric: MetricRenderer,
	"date-range-picker": DateRangeRenderer,
	"speed-gauge": GaugeRenderer,
	"stage-actions": StageActionsRenderer,
	"state-context": StateContextRenderer,
	// ── Explicit layout primitives (MUI-aligned) ──
	grid: GridRenderer,
	stack: StackRenderer,
	container: ContainerRenderer,
	box: BoxRenderer,
	paper: PaperRenderer,
	// ── Actions (full components) ──
	button: ButtonRenderer,
	link: LinkRenderer,
	typography: TypographyRenderer,
	layout: LayoutRenderer,
	// Site-builder screens (siteBuilderManager / siteTemplatesManager) are
	// APP-owned renderers — the host app registers them at startup.
};

/**
 * Register (or override) a renderer for a blueprint name.
 *
 * The host app uses this to add app-specific renderers (e.g.
 * "swagger-editor", "test-tab" backed by its own API explorer and
 * generated services) at startup, before any component renders.
 */
export function registerRenderer(
	blueprintName: string,
	renderer: RendererComponent,
): void {
	rendererRegistry[blueprintName] = renderer;
}
