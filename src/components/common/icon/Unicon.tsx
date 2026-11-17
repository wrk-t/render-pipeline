// ═══════════════════════════════════════════════════════════════
// Unicon – Renders an icon by semantic name.
//
// `ICON_EXPORT` is the public key → lucide component map: every
// semantic name the backend can emit (module.icon, screen.icon,
// table action) resolves to a real lucide-react icon. All icons are
// imported eagerly so there is no flash or async loading.
//
// Usage:
//   <Unicon name="UsersAlt" />
//   <Unicon name="Edit" size={20} className="text-blue-500" />
//
// To add a new icon:
//   1. Import it from "lucide-react".
//   2. Add it to ICON_EXPORT (and import it above).
// ═══════════════════════════════════════════════════════════════
"use client";

import {
	ArrowDownAZ,
	ArrowLeft,
	ArrowRight,
	ArrowUpDown,
	BatteryCharging,
	BatteryFull,
	Bell,
	Bold,
	Bookmark,
	BookOpen,
	Box,
	Building,
	Calculator,
	CalendarRange,
	ChartColumn,
	ChartLine,
	ChartNoAxesCombined,
	ChartPie,
	Check,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	ChevronUp,
	Circle,
	CircleAlert,
	CircleCheck,
	CircleHelp,
	CircleUserRound,
	CircleX,
	CircuitBoard,
	ClipboardList,
	Clock,
	Cloud,
	CloudCheck,
	CloudDownload,
	CloudOff,
	CloudUpload,
	Columns3,
	Compass,
	ContactRound,
	Copy,
	Database,
	Ellipsis,
	EllipsisVertical,
	ExternalLink,
	Eye,
	EyeOff,
	File,
	FileDown,
	FileText,
	FileUp,
	Filter,
	Fingerprint,
	FlaskConical,
	Folder,
	GitBranch,
	Globe,
	GripHorizontal,
	GripVertical,
	Heart,
	History,
	House,
	Info,
	Italic,
	KeyRound,
	Landmark,
	Languages,
	Layers,
	LayoutDashboard,
	LayoutGrid,
	Link,
	List,
	ListOrdered,
	Lock,
	LockKeyhole,
	LockOpen,
	LogOut,
	type LucideIcon,
	Mail,
	Map as MapIcon,
	MapPin,
	Maximize,
	Menu,
	Minimize,
	Navigation,
	Network,
	OctagonAlert,
	Package,
	Palette,
	Paperclip,
	Pause,
	Pencil,
	Play,
	Plus,
	Power,
	PowerOff,
	Printer,
	QrCode,
	Quote,
	RefreshCw,
	Repeat,
	RotateCcw,
	Route,
	Save,
	Search,
	Send,
	Server,
	ServerCog,
	Settings,
	Share2,
	Shield,
	ShieldAlert,
	ShieldCheck,
	ShieldX,
	ShoppingCart,
	Signal,
	SlidersHorizontal,
	SlidersVertical,
	Smile,
	Star,
	Tag,
	Tags,
	Terminal,
	Trash2,
	TrendingDown,
	TrendingUp,
	TriangleAlert,
	Type,
	Underline,
	Unlink,
	User,
	Users,
	UsersRound,
	Utensils,
	UtensilsCrossed,
	Wallet,
	Wifi,
	WifiOff,
	Wrench,
	X,
} from "lucide-react";
import type { FC, SVGProps } from "react";

// ── Semantic name → lucide icon ──────────────────────────────
// Key   = icon name from the backend (module.icon, screen.icon, table action)
// Value = the lucide-react component that renders it
//
// This map is also the source of the public `name` prop type:
// `keyof typeof ICON_EXPORT`. The keys are a published contract
// (callers and site-kit types reference them), so never remove or
// rename a key — add a new one instead.
export const ICON_EXPORT = {
	// ── Module / screen icons ──
	UsersAlt: Users,
	Group: UsersRound,
	Contacts: ContactRound,
	Setting: Settings,
	Settings: Settings,
	Lock: Lock,
	Shield: Shield,
	Security: Shield,
	Palette: Palette,
	BookOpen: BookOpen,
	EnglishToChinese: Languages,
	Message: Mail,
	Dashboard: LayoutDashboard,
	File: File,
	Play: Play,
	Box: Box,
	CodeBranch: GitBranch,
	Business: Building,
	Building: Building,
	User: User,
	LetterChineseA: Languages,
	ServerAlt: ServerCog,
	Server: Server,
	Circuit: CircuitBoard,
	Globe: Globe,
	Package: Package,
	Repeat: Repeat,

	// ── Restaurant / menu builder ──
	RestaurantMenu: UtensilsCrossed,
	LocalDining: Utensils,
	Folder: Folder,
	Qrcode: QrCode,
	Languages: Languages,
	Sliders: SlidersVertical,

	// ── Table action icons ──
	Add: Plus,
	Delete: Trash2,
	Edit: Pencil,
	Refresh: RefreshCw,
	MoreVert: EllipsisVertical,
	Visibility: Eye,
	Eye: Eye,
	VisibilityOff: EyeOff,
	FilterList: Filter,
	ViewColumn: Columns3,
	Restore: History,
	Search: Search,
	CheckCircle: CircleCheck,
	Cancel: CircleX,
	CancelPresentation: CircleX,
	GroupWork: UsersRound,
	AdminPanelSettings: Settings,
	RemoveRedEye: Eye,
	ArrowForward: ArrowRight,
	ArrowBack: ArrowLeft,
	ArrowDropDown: ChevronDown,
	ArrowDropUp: ChevronUp,
	ChevronDown: ChevronDown,
	ChevronUp: ChevronUp,
	ChevronLeft: ChevronLeft,
	ChevronRight: ChevronRight,
	Close: X,
	Done: Check,
	Info: Info,
	Warning: TriangleAlert,
	Error: CircleAlert,
	Menu: Menu,
	MoreHoriz: Ellipsis,
	Home: House,
	Person: User,
	Notifications: Bell,
	Help: CircleHelp,
	Print: Printer,
	Save: Save,
	Upload: FileUp,
	Download: FileDown,
	Send: Send,
	Share: Share2,
	Star: Star,
	Favorite: Heart,
	LocationOn: MapPin,
	DateRange: CalendarRange,
	Schedule: Clock,
	Language: Globe,
	Translate: Languages,
	AccountBalance: Landmark,
	Wallet: Wallet,
	ShoppingCart: ShoppingCart,
	AttachFile: Paperclip,
	CloudUpload: CloudUpload,
	CloudDownload: CloudDownload,
	Fullscreen: Maximize,
	FullscreenExit: Minimize,
	OpenInNew: ExternalLink,
	Copy: Copy,
	ContentCopy: Copy,
	Link: Link,
	LinkOff: Unlink,
	AddLink: Link,
	DragIndicator: GripVertical,
	DragHandle: GripHorizontal,
	Reorder: List,
	List: List,
	ListUl: List,
	GridView: LayoutGrid,
	ViewList: List,
	Sort: ArrowUpDown,
	SortByAlpha: ArrowDownAZ,
	Tune: SlidersHorizontal,
	SettingsApplications: Settings,
	Build: Wrench,
	Construction: Wrench,

	// ── MUI icon name aliases (kept for call sites) ──
	AltRoute: Route,
	ArrowBackRounded: ArrowLeft,
	Circle: Circle,
	Clear: X,
	CloseOutlined: X,
	CloseRounded: X,
	CloudUploadOutlined: CloudUpload,
	Description: FileText,
	ErrorOutline: CircleAlert,
	ExpandLess: ChevronUp,
	ExpandMore: ChevronDown,
	KeyboardArrowDown: ChevronDown,
	KeyboardArrowLeft: ArrowLeft,
	Lan: Network,
	Logout: LogOut,
	NavigateBefore: ChevronLeft,
	NavigateNext: ChevronRight,
	Science: FlaskConical,
	UploadFile: FileUp,
	VerifiedUser: ShieldCheck,
	SupervisorAccount: Users,
	ManageAccounts: CircleUserRound,
	AccountCircle: CircleUserRound,
	Groups: Users,
	Face: Smile,
	Tag: Tag,
	Label: Tags,
	Category: Layers,
	Bookmark: Bookmark,
	Book: BookOpen,
	Article: FileText,
	ClipboardNotes: ClipboardList,
	Assignment: ClipboardList,
	Task: ClipboardList,
	FactCheck: ClipboardList,
	Verified: CircleCheck,
	NewReleases: OctagonAlert,
	Report: OctagonAlert,
	Flag: MapPin,
	OutlinedFlag: MapPin,
	PushPin: MapPin,
	Room: MapPin,
	Explore: Compass,
	TravelExplore: Compass,
	Map: MapIcon,
	Directions: Route,
	Navigation: Navigation,
	Timeline: ChartLine,
	TrendingUp: TrendingUp,
	TrendingDown: TrendingDown,
	ShowChart: ChartLine,
	BarChart: ChartColumn,
	PieChart: ChartPie,
	DonutLarge: ChartPie,
	InsertChart: ChartColumn,
	Analytics: ChartNoAxesCombined,
	Insights: ChartNoAxesCombined,
	DataUsage: ChartPie,
	Schema: Share2,
	AccountTree: Share2,
	Hub: Share2,
	DeviceHub: Share2,
	Api: GitBranch,
	CodeOff: GitBranch,
	Terminal: Terminal,
	IntegrationInstructions: GitBranch,
	Widgets: LayoutGrid,
	DashboardCustomize: LayoutDashboard,
	Web: Globe,
	Public: Globe,
	TextFields: Type,
	Title: Type,
	FontDownload: Type,
	FormatBold: Bold,
	FormatItalic: Italic,
	FormatUnderlined: Underline,
	FormatQuote: Quote,
	FormatListBulleted: List,
	FormatListNumbered: ListOrdered,
	Functions: Calculator,
	Calculate: Calculator,
	Storage: Database,
	Dns: Network,
	Cloud: Cloud,
	CloudQueue: Cloud,
	CloudDone: CloudCheck,
	CloudOff: CloudOff,
	Wifi: Wifi,
	WifiOff: WifiOff,
	SignalCellularAlt: Signal,
	BatteryFull: BatteryFull,
	BatteryStd: BatteryCharging,
	PowerSettingsNew: Power,
	PowerOff: PowerOff,
	Pause: Pause,
	RestartAlt: RotateCcw,
	LockOpen: LockOpen,
	LockOutline: LockKeyhole,
	VpnKey: KeyRound,
	Key: KeyRound,
	Fingerprint: Fingerprint,
	SecurityUpdate: Shield,
	GppBad: ShieldX,
	GppMaybe: ShieldAlert,
	GppGood: ShieldCheck,
} satisfies Record<string, LucideIcon>;

// ── Renderer lookup ──────────────────────────────────────────
// Same map, typed loosely so an unknown name (from untyped callers,
// e.g. backend JSON) resolves to undefined instead of throwing.
const LUCIDE_ICONS: Record<string, LucideIcon | undefined> = ICON_EXPORT;

type UniconComponent = FC<SVGProps<SVGSVGElement> & { size?: number | string }>;

// ── Props ─────────────────────────────────────────────────────

export interface UniconProps {
	/** Icon name matching the backend contract. */
	name: keyof typeof ICON_EXPORT | null;
	/** Icon size in px. Defaults to 24. */
	size?: number | string;
	/** Optional className for Tailwind / CSS overrides. */
	className?: string;
	/** Optional inline style. */
	style?: React.CSSProperties;
	/** SVG fill color. Defaults to "currentColor" so it inherits from parent. */
	color?: string;
}

// ── Component ─────────────────────────────────────────────────

/**
 * Resolve the icon size to a pixel number.
 *
 * Accepts numeric px values, plus MUI-style string sizes for
 * convenience. Passing a raw string (e.g. "small") straight into
 * the SVG component produces an invalid `width` attribute and
 * renders the icon at a huge intrinsic size.
 */
const resolveIconSize = (size: number | string | undefined): number => {
	if (typeof size === "number") return size;
	const SIZES: Record<string, number> = { small: 16, medium: 24, large: 32 };
	return (size && SIZES[size]) || 24;
};

export const Unicon: FC<UniconProps> = ({
	name,
	size = 24,
	className,
	style,
	color = "currentColor",
}) => {
	const pxSize = resolveIconSize(size);

	if (!name) {
		return (
			<span
				className={className}
				style={{
					width: pxSize,
					height: pxSize,
					display: "inline-block",
					...style,
				}}
			/>
		);
	}

	const IconComponent = LUCIDE_ICONS[name];
	if (!IconComponent) {
		if (process.env.NODE_ENV === "development") {
			// biome-ignore lint/suspicious/noConsole: dev-only diagnostic for a bad backend icon name
			console.warn(`[Unicon] Unknown icon "${name}". Add it to ICON_EXPORT.`);
		}
		return (
			<span
				className={className}
				style={{
					width: pxSize,
					height: pxSize,
					display: "inline-block",
					...style,
				}}
			/>
		);
	}

	const spanStyle = color === "currentColor" ? undefined : { color };

	return (
		<span style={spanStyle} className={className}>
			<IconComponent size={pxSize} color={color} style={style} />
		</span>
	);
};

// ── Re-export for convenience ─────────────────────────────────
export type { UniconComponent };
