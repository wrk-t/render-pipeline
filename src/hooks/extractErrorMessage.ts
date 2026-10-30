import { AxiosError } from "axios";

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
	typeof value === "object" && value !== null;

/**
 * Collect the *reasons* an error body carries.
 *
 * The API reports why it refused a request in `errors[].messages`
 * (`ValidationErrorDto` from `@wrk-t/ts-exc` — used by the custom
 * `ValidationPipe` and by services that validate a payload after their own
 * checks). Nest's built-in `ValidationPipe` instead puts a `string[]` in
 * `message`. Both used to be dropped, so a toast only showed the generic
 * summary ("This message cannot be saved") while the actionable line —
 * "This message uses a discount variable but no discount is attached" —
 * never reached the user.
 */
const collectDetails = (body: UnknownRecord): string[] => {
	const details: string[] = [];

	const pushAll = (value: unknown) => {
		if (Array.isArray(value)) {
			for (const item of value) pushAll(item);
			return;
		}
		if (typeof value === "string" && value.trim().length > 0) {
			details.push(value.trim());
		}
	};

	if (Array.isArray(body.errors)) {
		for (const entry of body.errors) {
			if (isRecord(entry)) pushAll(entry.messages);
		}
	}

	// Nest's default validation answer: `message: ["email must be an email"]`.
	if (Array.isArray(body.message)) pushAll(body.message);

	return [...new Set(details)];
};

/**
 * The message to show for a normalized error body: the details when there are
 * any (the summary says nothing the user can act on), else the summary.
 */
const messageFromBody = (body: UnknownRecord): string | undefined => {
	const details = collectDetails(body);
	if (details.length > 0) return details.join("; ");

	if (typeof body.message === "string" && body.message) return body.message;
	if (typeof body.description === "string" && body.description)
		return body.description;

	return undefined;
};

/**
 * NOTE: Error messages from different services use different fields.
 *       Normalize these fields here to ensure consistent error handling.
 */
export const extractErrorMessage = (
	error: unknown,
	// biome-ignore lint/suspicious/noExplicitAny: next-intl's `t` carries generated key unions; only the fallback key is read here.
	t: any,
	fallback?: string,
): string => {
	if (error instanceof AxiosError) {
		const body = error.response?.data;
		const message = isRecord(body) ? messageFromBody(body) : undefined;
		if (message) return message;
	}

	return fallback ?? t("errors.unexpected");
};
