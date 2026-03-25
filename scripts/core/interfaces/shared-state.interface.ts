/**
 * @module ISharedState
 * @description Shared state interfaces for cross-module communication.
 */

import * as vscode from 'vscode';

/** Chat session entry for the "Enter twice" logic */
export interface IChatSession {
    participantType: string;
    fileName: string;
    hasSeenQuestion: boolean;
}

/** Callback invoked when auto-review is triggered on second Enter */
export type AutoReviewCallback = () => Promise<void>;

/** Mock stream interface matching VS Code ChatResponseStream API */
export interface IMockStream {
    markdown(text: string): IMockStream;
    button(button: { title?: string; command?: string; arguments?: unknown[]; tooltip?: string }): IMockStream;
    progress(text: string): IMockStream;
    filetree(tree: unknown[], baseUri?: vscode.Uri): IMockStream;
    anchor(anchor: { title?: string; value?: string }): IMockStream;
    reference(ref: { value?: string }): IMockStream;
}
