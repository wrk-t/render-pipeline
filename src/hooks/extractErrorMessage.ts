import { AxiosError } from "axios";

/**
 * NOTE: Error messages from different services use different fields.
 *       Normalize these fields here to ensure consistent error handling.
 */
export const extractErrorMessage = (
	error: unknown,
	t: any,
	fallback?: string,
): string => {
	if (error instanceof AxiosError) {
		if (error.response?.data.message) {
			return error.response?.data.message;
		}
		return fallback ?? t("errors.unexpected");
	}

	return fallback ?? t("errors.unexpected");
};
