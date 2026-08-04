import { useTranslations } from "next-intl";
import { enqueueSnackbar } from "notistack";
import { extractErrorMessage } from "./extractErrorMessage";

export type TSnack = ReturnType<typeof useSnack>;

export const useSnack = () => {
	const t = useTranslations("");

	const snackError = async (error: unknown, fallback?: string) => {
		const message = extractErrorMessage(error, t, fallback);

		enqueueSnackbar(message, {
			variant: "error",
			preventDuplicate: true,
			autoHideDuration: 5000,
		});
	};

	const snackSuccess = async (message: string) => {
		enqueueSnackbar(message, {
			variant: "success",
			preventDuplicate: true,
			autoHideDuration: 5000,
		});
	};

	return { error: snackError, success: snackSuccess };
};
