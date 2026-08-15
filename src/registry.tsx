// ──────────────────────────────────────────────────────────────────
// Renderer registry — the SINGLE source of truth for dispatching a
// blueprint name to its renderer component.
//
// To add a new renderer:
//   1. Create the renderer in ./renderers/
//   2. Import it here and add one entry below
// ──────────────────────────────────────────────────────────────────

import { AvatarRenderer } from "./renderers/AvatarRenderer";
import { AuditHistoryRenderer } from "./renderers/AuditHistoryRenderer";
import { BarRenderer } from "./renderers/BarRenderer";
import { DateRangeRenderer } from "./renderers/DateRangeRenderer";
import { FormRenderer } from "./renderers/FormRenderer";
import { GaugeRenderer } from "./renderers/GaugeRenderer";
import { InfoRenderer } from "./renderers/InfoRenderer";
import { LineRenderer } from "./renderers/LineRenderer";
import { ListRenderer } from "./renderers/ListRenderer";
import { LogoUploaderRenderer } from "./renderers/LogoUploaderRenderer";
import { MetricRenderer } from "./renderers/MetricRenderer";
import { PageRenderer } from "./renderers/PageRenderer";
import { PieRenderer } from "./renderers/PieRenderer";
import { RawJsonRenderer } from "./renderers/RawJsonRenderer";
import { ScreenLayoutRenderer } from "./renderers/ScreenLayoutRenderer";
import { ScreenTreeRenderer } from "./renderers/ScreenTreeRenderer";
import { SectionRenderer } from "./renderers/SectionRenderer";
import { StageActionsRenderer } from "./renderers/StageActionsRenderer";
import { StateContextRenderer } from "./renderers/StateContextRenderer";
import { TableRenderer } from "./renderers/TableRenderer";
import { TabsRenderer } from "./renderers/TabsRenderer";
import type { RendererComponent } from "./types";

export const rendererRegistry: Record<string, RendererComponent> = {
	// ── Blueprint-driven ──
	form: FormRenderer,
	page: PageRenderer,
	screen_layout_general: ScreenLayoutRenderer,
	table: TableRenderer,
	info: InfoRenderer,
	tabs: TabsRenderer,
	section: SectionRenderer,
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
