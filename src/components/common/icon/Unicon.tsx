// ═══════════════════════════════════════════════════════════════
// Unicon – Renders an icon from @tooni/iconscout-unicons-react/line
// by name. All icons used by the app are eagerly imported so
// there's no flash or async loading.
//
// Usage:
//   <Unicon name="UsersAlt" />
//   <Unicon name="Edit" size={20} className="text-blue-500" />
//
// To add a new icon:
//   1. Import it from "@tooni/iconscout-unicons-react/line"
//   2. Add it to EAGER_ICONS and ICON_EXPORT
// ═══════════════════════════════════════════════════════════════
"use client";

import type { FC, SVGProps } from "react";

// ── Icon name → unicon export name mapping ───────────────────
// Key   = icon name from backend (module.icon, screen.icon, table action)
// Value = the corresponding named export from @tooni/iconscout-unicons-react/line
export const ICON_EXPORT = {
	// ── Module / screen icons ──
	UsersAlt: "UilUsersAlt",
	Group: "UilUsersAlt",
	Contacts: "UilEnvelopeAlt",
	Setting: "UilSetting",
	Settings: "UilSetting",
	Lock: "UilLock",
	Shield: "UilShield",
	Security: "UilShield",
	Palette: "UilPalette",
	BookOpen: "UilBookOpen",
	EnglishToChinese: "UilEnglishToChinese",
	Message: "UilMessage",
	Dashboard: "UilDashboard",
	File: "UilFile",
	Play: "UilPlay",
	Box: "UilBox",
	CodeBranch: "UilCodeBranch",
	Business: "UilBuilding",
	Building: "UilBuilding",
	User: "UilUser",
	LetterChineseA: "UilLetterChineseA",
	ServerAlt: "UilServerAlt",
	Server: "UilServer",
	Circuit: "UilCircuit",
	Globe: "UilGlobe",
	Package: "UilPackage",
	Repeat: "UilRepeat",

	// ── Restaurant / menu builder ──
	RestaurantMenu: "UilRestaurant",
	LocalDining: "UilUtensils",
	Folder: "UilFolder",
	Qrcode: "UilQrcodeScan",
	Languages: "UilLanguage",
	Sliders: "UilSlidersV",

	// ── Table action icons ──
	Add: "UilPlus",
	Delete: "UilTrashAlt",
	Edit: "UilEdit",
	Refresh: "UilRefresh",
	MoreVert: "UilEllipsisV",
	Visibility: "UilEye",
	Eye: "UilEye",
	VisibilityOff: "UilEyeSlash",
	FilterList: "UilFilter",
	ViewColumn: "UilColumns",
	Restore: "UilHistory",
	Search: "UilSearch",
	CheckCircle: "UilCheckCircle",
	Cancel: "UilTimesCircle",
	CancelPresentation: "UilTimesCircle",
	GroupWork: "UilUsersAlt",
	AdminPanelSettings: "UilSetting",
	RemoveRedEye: "UilEye",
	ArrowForward: "UilArrowRight",
	ArrowBack: "UilArrowLeft",
	ArrowDropDown: "UilAngleDown",
	ArrowDropUp: "UilAngleUp",
	Close: "UilTimes",
	Done: "UilCheck",
	Info: "UilInfoCircle",
	Warning: "UilExclamationTriangle",
	Error: "UilExclamationCircle",
	Menu: "UilBars",
	MoreHoriz: "UilEllipsisH",
	Home: "UilHome",
	Person: "UilUser",
	Notifications: "UilBell",
	Help: "UilQuestionCircle",
	Print: "UilPrint",
	Save: "UilSave",
	Upload: "UilFileUpload",
	Download: "UilFileDownload",
	Send: "UilEnvelopeSend",
	Share: "UilShareAlt",
	Star: "UilStar",
	Favorite: "UilHeart",
	LocationOn: "UilMapMarker",
	DateRange: "UilCalendarAlt",
	Schedule: "UilClock",
	Language: "UilGlobe",
	Translate: "UilLanguage",
	AccountBalance: "UilBuilding",
	Wallet: "UilSuitcase",
	ShoppingCart: "UilShoppingCart",
	AttachFile: "UilPaperclip",
	CloudUpload: "UilCloudUpload",
	CloudDownload: "UilCloudDownload",
	Fullscreen: "UilArrowsMaximize",
	FullscreenExit: "UilCompressAlt",
	OpenInNew: "UilExternalLinkAlt",
	Copy: "UilCopy",
	ContentCopy: "UilCopy",
	Link: "UilLink",
	LinkOff: "UilLinkBroken",
	AddLink: "UilLinkAdd",
	DragIndicator: "UilDraggabledots",
	DragHandle: "UilDraggabledots",
	Reorder: "UilListUl",
	List: "UilListUl",
	ListUl: "UilListUl",
	GridView: "UilApps",
	ViewList: "UilListUl",
	Sort: "UilSort",
	SortByAlpha: "UilSort",
	Tune: "UilSlidersV",
	SettingsApplications: "UilSetting",
	Build: "UilWrench",
	Construction: "UilWrench",
	// ── MUI icon name aliases ──
	AltRoute: "UilSignAlt",
	ArrowBackRounded: "UilArrowLeft",
	Circle: "UilCircle",
	Clear: "UilTimes",
	CloseOutlined: "UilTimes",
	CloseRounded: "UilTimes",
	CloudUploadOutlined: "UilCloudUpload",
	Description: "UilFileAlt",
	ErrorOutline: "UilExclamationCircle",
	ExpandLess: "UilAngleUp",
	ExpandMore: "UilAngleDown",
	KeyboardArrowDown: "UilAngleDown",
	KeyboardArrowLeft: "UilArrowLeft",
	Lan: "UilServerNetworkAlt",
	Logout: "UilSignOutAlt",
	NavigateBefore: "UilAngleLeft",
	NavigateNext: "UilAngleRight",
	Science: "UilFlask",
	UploadFile: "UilFileUpload",

	VerifiedUser: "UilShieldCheck",
	SupervisorAccount: "UilUsersAlt",
	ManageAccounts: "UilUserCircle",
	AccountCircle: "UilUserCircle",
	Groups: "UilUsersAlt",
	Face: "UilSmile",
	Tag: "UilTag",
	Label: "UilTagAlt",
	Category: "UilLayerGroup",
	Bookmark: "UilBookmark",
	Book: "UilBookOpen",
	Article: "UilFileAlt",
	ClipboardNotes: "UilClipboardNotes",
	Assignment: "UilClipboardNotes",
	Task: "UilClipboardNotes",
	FactCheck: "UilClipboardNotes",
	Verified: "UilCheckCircle",
	NewReleases: "UilExclamationOctagon",
	Report: "UilExclamationOctagon",
	Flag: "UilMapPin",
	OutlinedFlag: "UilMapPin",
	PushPin: "UilMapPin",
	Room: "UilMapMarker",
	Explore: "UilCompass",
	TravelExplore: "UilCompass",
	Map: "UilMap",
	Directions: "UilSignAlt",
	Navigation: "UilCompass",
	Timeline: "UilChartLine",
	TrendingUp: "UilChartGrowth",
	TrendingDown: "UilChartDown",
	ShowChart: "UilChartLine",
	BarChart: "UilChartBar",
	PieChart: "UilChartPie",
	DonutLarge: "UilChartPie",
	InsertChart: "UilChartBar",
	Analytics: "UilAnalytics",
	Insights: "UilAnalytics",
	DataUsage: "UilDataSharing",
	Schema: "UilShare",
	AccountTree: "UilShare",
	Hub: "UilShare",
	DeviceHub: "UilShare",
	Api: "UilCodeBranch",
	CodeOff: "UilCodeBranch",
	Terminal: "UilCodeBranch",
	IntegrationInstructions: "UilCodeBranch",
	Widgets: "UilApps",
	DashboardCustomize: "UilCreateDashboard",
	Web: "UilGlobe",
	Public: "UilGlobe",
	TextFields: "UilTextFields",
	Title: "UilTextFields",
	FontDownload: "UilTextFields",
	FormatBold: "UilBold",
	FormatItalic: "UilItalic",
	FormatUnderlined: "UilUnderline",
	FormatQuote: "UilComment",
	FormatListBulleted: "UilListUl",
	FormatListNumbered: "UilListOl",
	Functions: "UilCalculatorAlt",
	Calculate: "UilCalculatorAlt",
	Storage: "UilServerNetworkAlt",
	Dns: "UilServerNetworkAlt",
	Cloud: "UilCloud",
	CloudQueue: "UilCloud",
	CloudDone: "UilCloudCheck",
	CloudOff: "UilCloudSlash",
	Wifi: "UilWifi",
	WifiOff: "UilWifiSlash",
	SignalCellularAlt: "UilSignalAlt",
	BatteryFull: "UilBatteryBolt",
	BatteryStd: "UilBatteryBolt",
	PowerSettingsNew: "UilPower",
	PowerOff: "UilPower",
	RestartAlt: "UilRefresh",
	LockOpen: "UilLockOpenAlt",
	LockOutline: "UilLockAlt",
	VpnKey: "UilKeySkeletonAlt",
	Key: "UilKeySkeletonAlt",
	Fingerprint: "UilLock",
	SecurityUpdate: "UilShield",
	GppBad: "UilShieldExclamation",
	GppMaybe: "UilShieldExclamation",
	GppGood: "UilShieldCheck",
} as const;

// ── All icon components ──────────────────────────────────────
// Import every icon used anywhere in the app. This avoids async
// loading and ensures icons render immediately.
import {
	UilAnalytics,
	UilAngleDown,
	UilAngleLeft,
	UilAngleRight,
	UilAngleUp,
	UilApps,
	UilArrowLeft,
	UilArrowRight,
	UilArrowsMaximize,
	UilBars,
	UilBatteryBolt,
	UilBell,
	UilBold,
	UilBookmark,
	UilBookOpen,
	UilBox,
	UilBuilding,
	UilCalculatorAlt,
	UilCalendarAlt,
	UilChartBar,
	UilChartDown,
	UilChartGrowth,
	UilChartLine,
	UilChartPie,
	UilCheck,
	UilCheckCircle,
	UilCircle,
	UilCircuit,
	UilClipboardNotes,
	UilClock,
	UilCloud,
	UilCloudCheck,
	UilCloudDownload,
	UilCloudSlash,
	UilCloudUpload,
	UilCodeBranch,
	UilColumns,
	UilCompass,
	UilCompressAlt,
	UilCopy,
	UilCreateDashboard,
	UilDashboard,
	UilDataSharing,
	UilDraggabledots,
	UilEdit,
	UilEllipsisH,
	UilEllipsisV,
	UilEnglishToChinese,
	UilEnvelopeAlt,
	UilEnvelopeSend,
	UilExclamationCircle,
	UilExclamationOctagon,
	UilExclamationTriangle,
	UilExternalLinkAlt,
	UilEye,
	UilEyeSlash,
	UilFile,
	UilFileAlt,
	UilFileDownload,
	UilFileUpload,
	UilFilter,
	UilFlask,
	UilFolder,
	UilGlobe,
	UilHeart,
	UilHistory,
	UilHome,
	UilInfoCircle,
	UilItalic,
	UilKeySkeletonAlt,
	UilLanguage,
	UilLayerGroup,
	UilLetterChineseA,
	UilLink,
	UilLinkAdd,
	UilLinkBroken,
	UilListOl,
	UilListUl,
	UilLock,
	UilLockAlt,
	UilLockOpenAlt,
	UilMap,
	UilMapMarker,
	UilMapPin,
	UilMessage,
	UilPackage,
	UilPalette,
	UilPaperclip,
	UilPlay,
	UilPlus,
	UilPower,
	UilPrint,
	UilQuestionCircle,
	UilQrcodeScan,
	UilRefresh,
	UilRestaurant,
	UilRepeat,
	UilSave,
	UilSearch,
	UilServer,
	UilServerAlt,
	UilServerNetworkAlt,
	UilSetting,
	UilShare,
	UilShareAlt,
	UilShield,
	UilShieldCheck,
	UilShieldExclamation,
	UilShoppingCart,
	UilSignAlt,
	UilSignalAlt,
	UilSignOutAlt,
	UilSlidersV,
	UilSmile,
	UilSort,
	UilStar,
	UilSuitcase,
	UilTag,
	UilTagAlt,
	UilTextFields,
	UilTimes,
	UilTimesCircle,
	UilTrashAlt,
	UilUnderline,
	UilUser,
	UilUserCircle,
	UilUsersAlt,
	UilUtensils,
	UilWifi,
	UilWifiSlash,
	UilWrench,
} from "@tooni/iconscout-unicons-react/line";

type UniconComponent = FC<SVGProps<SVGSVGElement> & { size?: number | string }>;

const EAGER_ICONS: Record<string, UniconComponent> = {
	UilUsersAlt,
	UilBox,
	UilSetting,
	UilLock,
	UilShield,
	UilPackage,
	UilPalette,
	UilBookOpen,
	UilEnglishToChinese,
	UilMessage,
	UilDashboard,
	UilFile,
	UilPlay,
	UilCodeBranch,
	UilBuilding,
	UilPlus,
	UilTrashAlt,
	UilEdit,
	UilRefresh,
	UilRepeat,
	UilEllipsisV,
	UilEye,
	UilEyeSlash,
	UilFilter,
	UilColumns,
	UilFolder,
	UilHistory,
	UilSearch,
	UilCheckCircle,
	UilTimesCircle,
	UilExclamationCircle,
	UilExclamationTriangle,
	UilAngleDown,
	UilAngleUp,
	UilAngleRight,
	UilAngleLeft,
	UilArrowRight,
	UilArrowLeft,
	UilTimes,
	UilCheck,
	UilInfoCircle,
	UilBars,
	UilEllipsisH,
	UilHome,
	UilUser,
	UilBell,
	UilQuestionCircle,
	UilQrcodeScan,
	UilRestaurant,
	UilPrint,
	UilSave,
	UilFileUpload,
	UilFileDownload,
	UilStar,
	UilHeart,
	UilMapMarker,
	UilCalendarAlt,
	UilClock,
	UilGlobe,
	UilLanguage,
	UilShoppingCart,
	UilCloudUpload,
	UilCloudDownload,
	UilArrowsMaximize,
	UilCopy,
	UilLink,
	UilLinkBroken,
	UilLinkAdd,
	UilExternalLinkAlt,
	UilApps,
	UilListUl,
	UilSort,
	UilSlidersV,
	UilWrench,
	UilUserCircle,
	UilSmile,
	UilUtensils,
	UilTag,
	UilTagAlt,
	UilLayerGroup,
	UilBookmark,
	UilFileAlt,
	UilCompass,
	UilMap,
	UilChartLine,
	UilChartGrowth,
	UilChartDown,
	UilChartBar,
	UilChartPie,
	UilAnalytics,
	UilCreateDashboard,
	UilBold,
	UilItalic,
	UilUnderline,
	UilListOl,
	UilCalculatorAlt,
	UilCloud,
	UilCloudCheck,
	UilWifi,
	UilPower,
	UilLockOpenAlt,
	UilLockAlt,
	UilKeySkeletonAlt,
	UilShieldCheck,
	UilShieldExclamation,
	UilSignAlt,
	UilShareAlt,
	UilPaperclip,
	UilDataSharing,
	UilTextFields,
	UilServerNetworkAlt,
	UilCloudSlash,
	UilWifiSlash,
	UilMapPin,
	UilClipboardNotes,
	UilExclamationOctagon,
	UilSignalAlt,
	UilEnvelopeSend,
	UilSuitcase,
	UilCompressAlt,
	UilDraggabledots,
	UilShare,
	UilBatteryBolt,
	UilLetterChineseA,
	UilServerAlt,
	UilServer,
	UilCircuit,
	UilCircle,
	UilFlask,
	UilSignOutAlt,
	UilEnvelopeAlt,
};

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

	const exportName = ICON_EXPORT[name];
	if (!exportName) {
		if (process.env.NODE_ENV === "development") {
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

	const IconComponent = EAGER_ICONS[exportName];
	if (!IconComponent) {
		if (process.env.NODE_ENV === "development") {
			console.warn(
				`[Unicon] Icon "${name}" (→ ${exportName}) is mapped but not eagerly imported. Import it in Unicon.tsx.`,
			);
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
			<IconComponent size={pxSize} style={style} />
		</span>
	);
};

// ── Re-export for convenience ─────────────────────────────────
export type { UniconComponent };
