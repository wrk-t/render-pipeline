"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getApiClient, useRenderUser } from "../../deps";
import { ColorPickerInput } from "../../dynamic-form/fields/FormColorField";
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

const LABEL_CLASS = "text-sm font-medium text-foreground";
const FIELD_CLASS =
	"h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground transition-colors outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60";

const Spinner: React.FC<{ className?: string }> = ({ className }) => (
	<span
		role="status"
		aria-label="Loading"
		className={`inline-block animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary ${
			className ?? "size-7"
		}`}
	/>
);

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
	const [errorCorrection, setErrorCorrection] = useState<"L" | "M" | "Q" | "H">(
		DEFAULT_STYLE.errorCorrection,
	);
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
			if (contextTenantId) {
				setTenantId(contextTenantId);
			} else {
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
				const parsed = JSON.parse(raw) as Partial<typeof DEFAULT_STYLE>;
				if (typeof parsed.dotColor === "string") setDotColor(parsed.dotColor);
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
		if (!(open && tenantId)) return;
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
					for (const byte of bytes) binary += String.fromCharCode(byte);
					setExampleUrl(`data:image/svg+xml;base64,${btoa(binary)}`);
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
				<div className="flex justify-center py-8">
					<Spinner />
				</div>
			) : (
				<div className="flex w-full flex-row items-center justify-between gap-8 max-sm:flex-col max-sm:items-stretch">
					{/* ── Settings ── */}
					<div className="flex w-64 shrink-0 flex-col gap-4 max-sm:w-full">
						{tenants.length > 0 && (
							<div className="flex flex-col gap-1.5">
								<label htmlFor="qr-style-tenant" className={LABEL_CLASS}>
									Tenant
								</label>
								<select
									id="qr-style-tenant"
									className={FIELD_CLASS}
									value={tenantId ?? ""}
									onChange={(e) => setTenantId(e.target.value)}
								>
									{tenants.map((tenant) => (
										<option key={tenant.id} value={tenant.id}>
											{tenant.displayName}
										</option>
									))}
								</select>
							</div>
						)}
						<ColorPickerInput
							label="Dot color"
							value={dotColor}
							onChange={setDotColor}
						/>
						<ColorPickerInput
							label="Background color"
							value={bgColor}
							onChange={setBgColor}
						/>
						<div className="flex flex-col gap-1.5">
							<label htmlFor="qr-style-ec" className={LABEL_CLASS}>
								Error correction
							</label>
							<select
								id="qr-style-ec"
								className={FIELD_CLASS}
								value={errorCorrection}
								onChange={(e) =>
									setErrorCorrection(e.target.value as "L" | "M" | "Q" | "H")
								}
							>
								<option value="L">L — low</option>
								<option value="M">M — medium</option>
								<option value="Q">Q — quartile</option>
								<option value="H">H — high</option>
							</select>
						</div>
						<div className="flex flex-col gap-1.5">
							<label htmlFor="qr-style-margin" className={LABEL_CLASS}>
								Margin
							</label>
							<input
								id="qr-style-margin"
								type="number"
								min={0}
								max={8}
								value={margin}
								onChange={(e) => {
									const n = Number(e.target.value);
									if (!Number.isNaN(n)) {
										setMargin(Math.min(8, Math.max(0, n)));
									}
								}}
								className={FIELD_CLASS}
							/>
						</div>
					</div>

					{/* ── Live example ── */}
					<div className="flex flex-col items-center gap-2 self-center">
						{loadingExample && !exampleUrl && <Spinner />}
						{exampleUrl && (
							<img
								src={exampleUrl}
								alt="QR style example"
								className="h-48 w-48"
								style={{ imageRendering: "pixelated" }}
							/>
						)}
						{!(loadingExample || exampleUrl) && (
							<p className="text-sm text-muted-foreground">No preview</p>
						)}
						<p className="text-xs text-muted-foreground">
							Applies to all QR codes in this tenant
						</p>
					</div>
				</div>
			)}
		</BaseDialog>
	);
};
