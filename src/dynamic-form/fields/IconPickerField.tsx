"use client";

import { useField, useFormikContext } from "formik";
import { type ReactElement, useMemo, useState } from "react";
import { ICON_EXPORT, Unicon } from "../../components/common/icon/Unicon";

// ════════════════════════════════════════════════════════════════
// IconPickerField — searchable grid of icons from the app's Unicon
// set. The field value is the icon NAME (an ICON_EXPORT key), e.g.
// "Warning" — exactly what <Unicon name="Warning" /> expects.
//
// Plain native elements + utilities: the search box is an <input>,
// each icon is a real <button> (so Enter/Space work without a key
// handler), and the icon name is the button's native tooltip.
// ════════════════════════════════════════════════════════════════

const ALL_ICON_NAMES = Object.keys(ICON_EXPORT).sort();

const INPUT_CLASS =
	"w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60";

export function IconPickerField({
	field,
}: {
	field: {
		name: string;
		label?: string;
		isRequired?: boolean;
		isReadOnly?: boolean;
	};
}): ReactElement {
	const [{ value }, meta, { setValue, setTouched }] = useField<string>(
		field.name,
	);
	const { isSubmitting } = useFormikContext();
	const [query, setQuery] = useState("");

	const selected = typeof value === "string" && value ? value : "";
	const disabled = isSubmitting || field.isReadOnly;

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return ALL_ICON_NAMES;
		return ALL_ICON_NAMES.filter((n) => n.toLowerCase().includes(q));
	}, [query]);

	const selectIcon = (name: string): void => {
		if (disabled) return;
		setValue(name);
		setTimeout(() => setTouched(true), 0);
	};

	return (
		<div className="flex flex-col gap-2">
			<span className="text-sm font-medium text-foreground">
				{field.label}
				{field.isRequired ? (
					<span className="text-destructive" aria-hidden="true">
						{" "}
						*
					</span>
				) : null}
			</span>

			<input
				type="search"
				placeholder="Search icons…"
				aria-label={field.label ? `Search ${field.label}` : "Search icons"}
				value={query}
				disabled={disabled}
				onChange={(e) => setQuery(e.target.value)}
				className={INPUT_CLASS}
			/>

			{selected && (
				<div className="flex items-center gap-2">
					<Unicon name={selected as keyof typeof ICON_EXPORT} size={24} />
					<span className="text-xs text-muted-foreground">{selected}</span>
				</div>
			)}

			<div className="max-h-[220px] overflow-auto rounded-lg border border-border p-2">
				{filtered.length === 0 ? (
					<p className="text-xs text-muted-foreground">
						No icons match “{query}”
					</p>
				) : (
					<div className="grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-1">
						{filtered.map((name) => {
							const isSelected = name === selected;
							return (
								<button
									key={name}
									type="button"
									title={name}
									aria-label={name}
									aria-pressed={isSelected}
									disabled={disabled}
									onClick={() => selectIcon(name)}
									className={[
										"flex items-center justify-center rounded-md p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-60",
										isSelected
											? "bg-primary text-primary-foreground"
											: "text-foreground hover:bg-muted",
									].join(" ")}
								>
									<Unicon name={name as keyof typeof ICON_EXPORT} size={22} />
								</button>
							);
						})}
					</div>
				)}
			</div>

			{meta.touched && meta.error && (
				<p className="text-xs text-destructive">{meta.error}</p>
			)}
		</div>
	);
}
