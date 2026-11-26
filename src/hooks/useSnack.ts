"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { extractErrorMessage } from "./extractErrorMessage";

export type TSnack = ReturnType<typeof useSnack>;

export const useSnack = () => {
	const t = useTranslations("");

	const snackError = async (error: unknown, fallback?: string) => {
		const message = extractErrorMessage(error, t, fallback);

		// A message id makes repeats update the visible toast instead of stacking.
		toast.error(message, {
			id: `snack-error:${message}`,
			duration: 5000,
		});
	};

	const snackSuccess = async (message: string) => {
		toast.success(message, {
			id: `snack-success:${message}`,
			duration: 5000,
		});
	};

	return { error: snackError, success: snackSuccess };
};
