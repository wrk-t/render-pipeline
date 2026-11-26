"use client";

import type { Column } from "@tanstack/react-table";
import { cn } from "cn";
import {
	ChevronDown,
	ChevronsUpDown,
	ChevronUp,
	EyeOff,
	X,
} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "../ui/dropdown-menu";

interface DataTableColumnHeaderProps<TData, TValue>
	extends ComponentProps<typeof DropdownMenuTrigger> {
	column: Column<TData, TValue>;
	label: ReactNode;
}

/**
 * DiceUI's column header: a menu with sort asc/desc/reset and hide.
 *
 * The label is a ReactNode (not the upstream `string`) because metadata
 * column headers can render components, not just text.
 */
export function DataTableColumnHeader<TData, TValue>({
	column,
	label,
	className,
	...props
}: DataTableColumnHeaderProps<TData, TValue>) {
	if (!(column.getCanSort() || column.getCanHide())) {
		return <div className={cn(className)}>{label}</div>;
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				className={cn(
					"flex h-8 items-center gap-1.5 rounded-md px-1.5 py-1 text-start transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-accent [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
					className,
				)}
				{...props}
			>
				{label}
				{column.getCanSort() &&
					(column.getIsSorted() === "desc" ? (
						<ChevronDown />
					) : column.getIsSorted() === "asc" ? (
						<ChevronUp />
					) : (
						<ChevronsUpDown />
					))}
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-28">
				{column.getCanSort() && (
					<>
						<DropdownMenuCheckboxItem
							className="relative pe-8 ps-2 [&>span:first-child]:end-2 [&>span:first-child]:start-auto [&_svg]:text-muted-foreground"
							checked={column.getIsSorted() === "asc"}
							onClick={() => column.toggleSorting(false)}
						>
							<ChevronUp />
							Ascending
						</DropdownMenuCheckboxItem>
						<DropdownMenuCheckboxItem
							className="relative pe-8 ps-2 [&>span:first-child]:end-2 [&>span:first-child]:start-auto [&_svg]:text-muted-foreground"
							checked={column.getIsSorted() === "desc"}
							onClick={() => column.toggleSorting(true)}
						>
							<ChevronDown />
							Descending
						</DropdownMenuCheckboxItem>
						{column.getIsSorted() && (
							<DropdownMenuItem
								className="ps-2 [&_svg]:text-muted-foreground"
								onClick={() => column.clearSorting()}
							>
								<X />
								Reset
							</DropdownMenuItem>
						)}
					</>
				)}
				{column.getCanHide() && (
					<DropdownMenuCheckboxItem
						className="relative pe-8 ps-2 [&>span:first-child]:end-2 [&>span:first-child]:start-auto [&_svg]:text-muted-foreground"
						checked={!column.getIsVisible()}
						onClick={() => column.toggleVisibility(false)}
					>
						<EyeOff />
						Hide
					</DropdownMenuCheckboxItem>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
