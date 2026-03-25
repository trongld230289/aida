/**
 * @module __mocks__/vscode
 * @description Minimal mock of the `vscode` API for unit testing.
 * Only the surfaces actually used by the modules under test are implemented.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

// ─── Configuration Mock ──────────────────────────────────────────────

const _configStore: Record<string, unknown> = {};

/** Stub for vscode.WorkspaceConfiguration */
const _workspaceConfig = {
  get<T>(key: string, defaultValue?: T): T {
    return (key in _configStore ? _configStore[key] : defaultValue) as T;
  },
  has(key: string): boolean {
    return key in _configStore;
  },
  update: async (_key: string, _value: unknown) => {},
  inspect: (_key: string) => undefined,
};

/** Helper — test code can seed config values before calling `getSetting()` etc. */
export function __setMockConfig(key: string, value: unknown): void {
  _configStore[key] = value;
}

/** Helper — reset config store between tests */
export function __clearMockConfig(): void {
  for (const key in _configStore) delete _configStore[key];
}

// ─── Workspace ───────────────────────────────────────────────────────

export const workspace = {
  getConfiguration: (_section?: string) => _workspaceConfig,
  workspaceFolders: [] as Array<{ uri: { fsPath: string }; name: string }>,
  fs: {
    readFile: async () => Buffer.from(''),
    writeFile: async () => {},
  },
};

// ─── Window ──────────────────────────────────────────────────────────

export const window = {
  createOutputChannel: (_name: string) => ({
    appendLine: (_msg: string) => {},
    append: (_msg: string) => {},
    show: () => {},
    clear: () => {},
    dispose: () => {},
  }),
  showInformationMessage: async (..._args: unknown[]) => undefined,
  showWarningMessage: async (..._args: unknown[]) => undefined,
  showErrorMessage: async (..._args: unknown[]) => undefined,
  showQuickPick: async (..._args: unknown[]) => undefined,
  showInputBox: async (..._args: unknown[]) => undefined,
  activeTextEditor: undefined,
  visibleTextEditors: [],
};

// ─── Commands ────────────────────────────────────────────────────────

export const commands = {
  registerCommand: (_cmd: string, _cb: (...args: unknown[]) => unknown) => ({ dispose: () => {} }),
  executeCommand: async (..._args: unknown[]) => undefined,
};

// ─── Uri ─────────────────────────────────────────────────────────────

export const Uri = {
  file: (path: string) => ({ fsPath: path, scheme: 'file', path }),
  parse: (uri: string) => ({ fsPath: uri, scheme: 'file', path: uri }),
};

// ─── Enums / Constants ───────────────────────────────────────────────

export enum ViewColumn { One = 1, Two = 2, Three = 3, Active = -1, Beside = -2 }

export const ExtensionKind = { UI: 1, Workspace: 2 };

export const StatusBarAlignment = { Left: 1, Right: 2 };

export class EventEmitter {
  event = () => ({ dispose: () => {} });
  fire() {}
  dispose() {}
}

export class CancellationTokenSource {
  token = { isCancellationRequested: false, onCancellationRequested: () => ({ dispose: () => {} }) };
  cancel() {}
  dispose() {}
}

// ─── Misc stubs ──────────────────────────────────────────────────────

export const env = { clipboard: { writeText: async () => {} }, uiKind: 1, language: 'en' };
export const languages = { registerCodeActionsProvider: () => ({ dispose: () => {} }) };
export class Disposable { static from(..._d: unknown[]) { return { dispose: () => {} }; } dispose() {} }
export class Range { constructor(public startLine: number, public startChar: number, public endLine: number, public endChar: number) {} }
export class Position { constructor(public line: number, public character: number) {} }
