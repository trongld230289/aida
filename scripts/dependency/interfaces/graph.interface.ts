/**
 * @module dependency/interfaces/graph
 * @description Interfaces for the dependency graph data model.
 */

/** Per-node metadata stored alongside a graph node */
export interface INodeMetadata {
    /** Relative path within workspace */
    path: string;
    /** Detected language key (typescript, python, csharp …) */
    language?: string;
    /** Number of outgoing dependencies */
    dependencyCount?: number;
    /** Number of incoming dependents */
    dependentCount?: number;
    /** Any additional per-node data */
    [key: string]: unknown;
}

/** Serialised form of a single graph node (for JSON cache / webview) */
export interface ISerializedNode {
    id: string;
    label: string;
    metadata?: INodeMetadata;
}

/** Serialised form of a single directed edge */
export interface ISerializedEdge {
    source: string;
    target: string;
}

/** Full serialised graph (nodes + edges) for persistence / webview transfer */
export interface ISerializedGraph {
    nodes: ISerializedNode[];
    edges: ISerializedEdge[];
}
