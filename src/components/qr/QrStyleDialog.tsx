"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useRef, useState } from "react";
import { getApiClient, useRenderUser } from "../../deps";
import { useSnack } from "../../hooks/useSnack";
import { Unicon } from "../common/icon/Unicon";
import { BaseDialog } from "../dialog/BaseDialog";

// ════════════════════════════════════════════════════════════════
// QR STYLE DIALOG — customize the tenant's default QR style.
//
// Opened from the qr-codes table toolbar ("Customize QR Style").
// Left: style settings (dot/bg color, error correction, margin).
// Right: live example QR rendered by the backend (debounced).
// Saved as the tenant's `qr_style` tenantSetting (JSON), which every
// QR falls back to unless it has its own per-QR `meta.style`.
// ════════════════════════════════════════════════════════════════

export interface QrStyleDialogProps {
	open: boolean;
	onClose: () => void;
}

const DEFAULT_STYLE = {
	dotColor: "#111827",
	bgColor: "#ffffff",
	errorCorrection: "M" as "L" | "M" | "Q" | "H",
	margin: 2,
};

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function ColorInput({
	label,
	value,
	onChange,
}: {
	label: string;
	value: string;
	onChange: (v: string) => void;
}) {
	const swatch = HEX_RE.test(value) ? value : "#000000";
	return (
		<Stack spacing={0.5}>
			<Typography variant="body2">{label}</Typography>
			<Stack direction="row" spacing={1} className="items-center">
				<input
					type="color"
					value={swatch}
					onChange={(e) => onChange(e.target.value)}
					className="h-10 w-10 cursor-pointer rounded-md border border-divider"
					aria-label={label}
				/>
				<TextField
					size="small"
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder="#4F46E5"
					className="flex-1"
				/>
			</Stack>
		</Stack>
	);
}

export const QrStyleDialog: React.FC<QrStyleDialogProps> = ({
	open,
	onClose,
}) => {
	const snack = useSnack();
	const snackRef = useRef(snack);
	snackRef.current = snack;

	const { data: user } = useRenderUser();

	const [tenantId, setTenantId] = useState<string | null>(null);
	const [tenants, setTenants] = useState<
		Array<{ id: string; displayName: string }>
	>([]);
	const [dotColor, setDotColor] = useState(DEFAULT_STYLE.dotColor);
	const [bgColor, setBgColor] = useState(DEFAULT_STYLE.bgColor);
	const [errorCorrection, setErrorCorrection] = useState<
		"L" | "M" | "Q" | "H"
	>(DEFAULT_STYLE.errorCorrection);
	const [margin, setMargin] = useState(DEFAULT_STYLE.margin);
	const [exampleUrl, setExampleUrl] = useState<string | null>(null);
	const [loadingExample, setLoadingExample] = useState(false);
	const [saving, setSaving] = useState(false);
	const [loading, setLoading] = useState(false);

	// ── Resolve tenant context + load existing style on open ──
	useEffect(() => {
		if (!open) return;
		let cancelled = false;

		const contextTenantId = user?.tenant?.id ?? null;
		setLoading(true);
		setExampleUrl(null);

		const resolve = async () => {
			// Super admins without an active workspace pick a tenant.
			if (!contextTenantId) {
				try {
					const res = await getApiClient().get(
						`${process.env.NEXT_PUBLIC_ENDPOINT ?? ""}/api/v1/tenants?limit=100`,
					);
					const list =
						(res.data?.data?.data as
							| Array<{ id: string; displayName: string }>
							| undefined) ?? [];
					if (cancelled) return;
					setTenants(list);
					setTenantId(list[0]?.id ?? null);
				} catch {
					if (!cancelled) setTenantId(null);
				}
			} else {
				setTenantId(contextTenantId);
			}
		};
		void resolve();

		return () => {
			cancelled = true;
		};
	}, [open, user?.tenant?.id]);

	// ── Load the tenant's current qr_style (if any) ──
	useEffect(() => {
		if (!open) return;
		if (!tenantId) {
			setLoading(false);
			return;
		}
		let cancelled = false;
		getApiClient()
			.get(
				`${process.env.NEXT_PUBLIC_ENDPOINT ?? ""}/api/v1/tenant/${tenantId}/settings/by-key/qr_style`,
			)
			.then((res) => {
				if (cancelled) return;
				const raw = res.data?.data?.value as string | undefined;
				if (!raw) return;
				const parsed = JSON.parse(raw) as Partial<
					typeof DEFAULT_STYLE
				>;
				if (typeof parsed.dotColor === "string")
					setDotColor(parsed.dotColor);
				if (typeof parsed.bgColor === "string") setBgColor(parsed.bgColor);
				if (
					parsed.errorCorrection === "L" ||
					parsed.errorCorrection === "M" ||
					parsed.errorCorrection === "Q" ||
					parsed.errorCorrection === "H"
				) {
					setErrorCorrection(parsed.errorCorrection);
				}
				if (typeof parsed.margin === "number") setMargin(parsed.margin);
			})
			.catch(() => {
				/* no saved style yet — keep defaults */
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [open, tenantId]);

	// ── Debounced example fetch on every style change ──
	useEffect(() => {
		if (!open || !tenantId) return;
		let cancelled = false;
		const timer = setTimeout(() => {
			setLoadingExample(true);
			const base = process.env.NEXT_PUBLIC_ENDPOINT ?? "";
			const url =
				`${base}/api/v1/qr-codes/example.svg?tenantId=${encodeURIComponent(tenantId)}` +
				`&dotColor=${encodeURIComponent(dotColor)}` +
				`&bgColor=${encodeURIComponent(bgColor)}` +
				`&errorCorrection=${errorCorrection}` +
				`&margin=${margin}`;
			getApiClient()
				.get(url, { responseType: "text" })
				.then((res) => {
					if (cancelled) return;
					const svg = typeof res.data === "string" ? res.data : "";
					const bytes = new TextEncoder().encode(svg);
					let binary = "";
					for (const byte of bytes)
						binary += String.fromCharCode(byte);
					setExampleUrl(
						`data:image/svg+xml;base64,${btoa(binary)}`,
					);
				})
				.catch((err: unknown) => {
					if (!cancelled) {
						void snackRef.current.error(err, "Failed to render example");
					}
				})
				.finally(() => {
					if (!cancelled) setLoadingExample(false);
				});
		}, 300);
		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [open, tenantId, dotColor, bgColor, errorCorrection, margin]);

	const handleSave = useCallback(async () => {
		if (!tenantId) {
			await snack.error(new Error("no_tenant"), "Select a tenant first");
			return;
		}
		setSaving(true);
		try {
			const base = process.env.NEXT_PUBLIC_ENDPOINT ?? "";
			await getApiClient().post(
				`${base}/api/v1/tenant/${tenantId}/settings/upsert`,
				{
					key: "qr_style",
					value: JSON.stringify({
						dotColor,
						bgColor,
						errorCorrection,
						margin,
					}),
					type: "object",
				},
			);
			await snack.success("QR style saved");
			onClose();
		} catch (err) {
			await snack.error(err, "Failed to save QR style");
		} finally {
			setSaving(false);
		}
	}, [tenantId, dotColor, bgColor, errorCorrection, margin, snack, onClose]);

	return (
		<BaseDialog
			isOpen={open}
			onClose={onClose}
			onSubmit={handleSave}
			isPending={saving}
			slotProps={{
				submitButton: {
					show: true,
					props: {
						children: "Save",
						color: "primary",
						startIcon: <Unicon name="Save" size={18} />,
					},
				},
				closeButton: { show: true, props: { children: "Close" } },
			}}
		>
			{loading ? (
				<Box className="flex justify-center py-8">
					<CircularProgress size={28} />
				</Box>
			) : (
				<Stack
					direction="row"
					spacing={4}
					className="w-full items-center justify-between"
				>
					{/* ── Settings ── */}
					<Stack spacing={2} className="w-64 shrink-0">
						{tenants.length > 0 && (
							<FormControl size="small" fullWidth>
								<InputLabel id="qr-style-tenant-label">
									Tenant
								</InputLabel>
								<Select
									labelId="qr-style-tenant-label"
									label="Tenant"
									value={tenantId ?? ""}
									onChange={(e) => setTenantId(e.target.value)}
								>
									{tenants.map((t) => (
										<MenuItem key={t.id} value={t.id}>
											{t.displayName}
										</MenuItem>
									))}
								</Select>
							</FormControl>
						)}
						<ColorInput
							label="Dot color"
							value={dotColor}
							onChange={setDotColor}
						/>
						<ColorInput
							label="Background color"
							value={bgColor}
							onChange={setBgColor}
						/>
						<FormControl size="small" fullWidth>
							<InputLabel id="qr-style-ec-label">
								Error correction
							</InputLabel>
							<Select
								labelId="qr-style-ec-label"
								label="Error correction"
								value={errorCorrection}
								onChange={(e) =>
									setErrorCorrection(
										e.target.value as "L" | "M" | "Q" | "H",
									)
								}
							>
								<MenuItem value="L">L — low</MenuItem>
								<MenuItem value="M">M — medium</MenuItem>
								<MenuItem value="Q">Q — quartile</MenuItem>
								<MenuItem value="H">H — high</MenuItem>
							</Select>
						</FormControl>
						<TextField
							label="Margin"
							type="number"
							size="small"
							value={margin}
							onChange={(e) => {
								const n = Number(e.target.value);
								if (!Number.isNaN(n)) {
									setMargin(Math.min(8, Math.max(0, n)));
								}
							}}
							slotProps={{ htmlInput: { min: 0, max: 8 } }}
						/>
					</Stack>

					{/* ── Live example ── */}
					<Stack className="items-center gap-2 self-center">
						{loadingExample && !exampleUrl && (
							<CircularProgress size={28} />
						)}
						{exampleUrl && (
							<img
								src={exampleUrl}
								alt="QR style example"
								className="h-48 w-48"
								style={{ imageRendering: "pixelated" }}
							/>
						)}
						{!loadingExample && !exampleUrl && (
							<Typography color="textSecondary" variant="body2">
								No preview
							</Typography>
						)}
						<Typography variant="caption" color="textSecondary">
							Applies to all QR codes in this tenant
						</Typography>
					</Stack>
				</Stack>
			)}
		</BaseDialog>
	);
};
