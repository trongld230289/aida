/**
 * Type declarations for third-party CJS packages without bundled types.
 * These can be removed once @types/xxx packages are installed.
 */

declare module 'string-similarity' {
    export function compareTwoStrings(first: string, second: string): number;
    export function findBestMatch(mainString: string, targetStrings: string[]): {
        ratings: Array<{ target: string; rating: number }>;
        bestMatch: { target: string; rating: number };
        bestMatchIndex: number;
    };
}

declare module 'minimatch' {
    function minimatch(target: string, pattern: string, options?: Record<string, unknown>): boolean;
    export = minimatch;
}
