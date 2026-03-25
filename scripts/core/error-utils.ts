/**
 * @module error-utils
 * @description Shared error-handling utilities for the AIDA extension.
 *
 * Provides a safe, typed way to normalise unknown values caught in
 * `catch (error: unknown)` blocks into proper `Error` objects.
 */

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Coerce an unknown caught value into an `Error` instance.
 *
 * - If the value is already an `Error`, it is returned as-is.
 * - If it is a string, a new `Error` is created with that message.
 * - If it is an object with a `message` property, that is used.
 * - Otherwise, `JSON.stringify` is attempted;
 *   if that fails, a generic "Unknown error" is returned.
 *
 * @example
 * ```ts
 * try {
 *   await riskyCall();
 * } catch (err: unknown) {
 *   const error = toError(err);
 *   console.error(error.message);
 * }
 * ```
 */
export function toError(err: unknown): Error {
    if (err instanceof Error) {
        return err;
    }
    if (typeof err === 'string') {
        return new Error(err);
    }
    if (err !== null && typeof err === 'object' && 'message' in err) {
        return new Error(String((err as { message: unknown }).message));
    }
    try {
        return new Error(JSON.stringify(err));
    } catch {
        return new Error('Unknown error');
    }
}

/**
 * Extract a human-readable message from an unknown caught value.
 *
 * Convenience wrapper around {@link toError} for the common case where
 * only the message string is needed.
 */
export function errorMessage(err: unknown): string {
    return toError(err).message;
}
