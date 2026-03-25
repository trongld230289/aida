/**
 * PR Dependency Analyzer  Thin Facade
 *
 * This file re-exports PRDependencyAnalyzer from `./pr-analyzer-core`.
 * The implementation is split across:
 *   - pr-analyzer-core.ts          (class definition + orchestration)
 *   - pr-graph-builder.ts          (graph construction + analysis helpers)
 *   - pr-symbol-extractor.ts       (symbol extraction helpers)
 *   - pr-barrel-resolver-helpers.ts (barrel resolution + language config utils)
 */

// Re-export the class exactly as before so all existing consumers continue to work.
import { PRDependencyAnalyzer } from './pr-analyzer-core';

export { PRDependencyAnalyzer };
