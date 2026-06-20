# 🤖 AIDA — AI Development Assistant

**Writing code is easy. Shipping quality code? That's the hard part.** 🧨

AI generates code blazingly fast — but **Technical Debt** and **Regression Bugs** pile up just as quickly. Reviewers are overloaded, coding rules are half-remembered — we've all been there.

👉 **AIDA** was built to solve exactly that. Automated code review, scoring, dependency analysis — all **right inside VS Code**. No tab-switching, no context-switching.

### ⚡ What can AIDA do?

- 📄 **Review File** — full file review, perfect for refactoring or newly created files
- 🔄 **Review Changes** — review only changed lines (git diff)
- 🔀 **Review PR** — paste a PR link and get a full review (Azure DevOps / GitHub / GitLab)
- 📊 **Dependency Scan** — analyze dependencies with zero AI tokens, 100% accuracy
- 🏆 **Auto-scoring (6 criteria)** — Security, Null Safety, Error Handling, Resource Mgmt, Performance, Code Quality

[![Version](https://img.shields.io/badge/version-1.1.27-blue.svg)](https://marketplace.visualstudio.com/items?itemName=trongld232.aida-dev)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.90+-green.svg)](https://code.visualstudio.com/)
[![Cursor IDE](https://img.shields.io/badge/Cursor%20IDE-Compatible-brightgreen.svg)](https://cursor.sh/)
[![License](https://img.shields.io/badge/license-MIT-orange.svg)](LICENSE)
[![Updated](https://img.shields.io/badge/updated-April%202026-lightgrey.svg)]()

---

## 📦 Installation & Activation

### Step 1 — Install

1. Open **Extensions** (`Ctrl+Shift+X`)
2. Search **`aida-dev`**
3. Click **Install** → **Reload Window**

### Step 2 — Enter Activation Key

> ⚠️ **Required** — AIDA won't activate without a valid key.

Contact the **project owner** to obtain an activation key.

- **Option A:** `Ctrl+,` → search `aida.activationKey` → paste key
- **Option B:** `Ctrl+Shift+P` → **AIDA: Show Activation Status**

### Step 3 — Trust Accounts (Optional)

After entering the key, VS Code shows a **trust badge** on the **Accounts** icon (bottom-left). Click to grant:

- 🔷 **Microsoft Account** — organization identity
- ⚫ **GitHub Account** — GitHub username

> AIDA works fully without it. Trusting only improves user identification in usage tracking. You can trust at any time later.

---

## ⚙️ Configuration

Open **Settings** (`Ctrl+,`) → search **"aida"** to find all settings.

### Common Settings

| Setting | Description |
|---------|-------------|
| `aida.activationKey` | Activation key — contact the project owner to obtain a key |
| `aida.templatesBasePath` | Custom path for review templates. Supports `${workspaceFolder}` and relative paths. If empty & `{workspace}/AIDA/` exists → uses it automatically |
| `aida.sourceControls` | Multi-org tokens for Azure DevOps, GitHub, GitLab |
| `aida.debugMode` | Enable debug logging |

### Without GitHub Copilot

For users who don't have a Copilot license:

| Setting | Description |
|---------|-------------|
| `aida.useAIDAChatbot` | Enable AIDA Chatbot — standalone AI chat & code assistance |
| `aida.useExternalAI` | Use your own API key instead of GitHub Copilot for code review |
| `aida.ai.apiKey` | Your AI API Key (OpenAI, Claude, or custom) |
| `aida.ai.apiHost` | API Host URL (default: `https://api.openai.com`) |
| `aida.ai.model` | Model name (default: `Claude-4-Sonnet`) |

### Source Control Tokens (for PR Review)

```json
{
  "aida.sourceControls": {
    "azureDevOps": { "MyOrg": "your-pat" },
    "github": { "my-org": "ghp_your-token" },
    "gitlab": { "my-group": "glpat-your-token" }
  }
}
```

> Org names from URLs: `dev.azure.com/{ORG}`, `github.com/{ORG}`, `gitlab.com/{GROUP}`

---

## 📋 Review Modes

### 📄 Review File

Review **entire file** from top to bottom. Best for refactoring or newly created files.

| Method | Command |
|--------|---------|
| Right-click | → `AIDA: Review File` |
| Chat | → `@review-file` or `@review-file path/to/file.ts` |

### 🔄 Review Changes

Review only **git diff** (changed lines). Also supports reviewing **all modified files** at once.

| Method | Command |
|--------|---------|
| Right-click | → `AIDA: Review Changes` |
| Chat | → `@review-changes` (current file) |
| Chat | → `@review-all-changes` (all modified files) |

### 🔀 Review PR

Review entire **Pull Request** by URL. Supports Azure DevOps, GitHub, GitLab. **No clone needed!**

| Method | Command |
|--------|---------|
| Chat | → `@review-pr` + paste PR URL |

```
@review-pr https://dev.azure.com/org/project/_git/repo/pullrequest/67
@review-pr https://github.com/user/repo/pull/123
@review-pr https://gitlab.com/user/repo/-/merge_requests/45
```

### 🧩 Technical Rules

- **Language templates** (Angular, C#, Go, JS, NodeJS, Python, React, TS, Vue) auto-detect & apply matching rules
- **Custom project rules:** `.github/rules/review-base.md` — add project-specific coding standards, AIDA merges them into every review
- **Sync templates:** `@sync-review-templates`

### 📚 Business Documents

Place `.md` files in `AIDA/business-docs/{category}/` — each subfolder = a selectable category.

When business docs exist, AIDA prompts:
- ⚡ **Quick Review** — code rules only
- 📚 **Enhanced Review** — code rules + business docs

### 📊 Scoring (6 criteria, 1–5)

Security · Null Safety · Error Handling · Resource Management · Performance · Code Quality

- Score ≥ 4 → ✅ **GOOD**
- Score < 4 → 🔧 **RECOMMENDED FIX**

---

## 🔮 Dependency Modes

Analyze code dependencies using **Native VS Code API (LSP)** — **Zero AI tokens, 100% accuracy**.

### 📊 Dependency Scan

Analyze the **current file's** import/dependency tree. Generates an interactive **Force-Directed Graph** (D3.js) inside VS Code.

| Method | Command |
|--------|---------|
| Right-click | → `Analyze Dependency` |
| Chat | → `@dependency` |
| Chat | → `@dependency re-analyze` (force fresh) |

> 🤖 Graph has **Analyze with AI** button — click to get AI-powered analysis & suggestions.

### 🔍 Dependency PR

Analyze a **Pull Request's impact** on the entire dependency graph. Shows which files/modules are affected by PR changes.

| Method | Command |
|--------|---------|
| Chat | → `@dependency-pr` + paste PR URL |

> 🤖 Graph has **Analyze with AI** button — click to get AI-powered impact analysis & testing suggestions.

### Why Native > AI Scan?

- ✅ **Native VS Code API** → High accuracy & **zero cost**
- ⚠️ **AI-based scan** → High cost, prone to hallucination

---

## 🤖 AIDA Chatbot

Built-in sidebar chat — no Copilot required.

- **Open:** Activity Bar → AIDA Chat · or `Ctrl+Shift+A`
- **Image Support:** Analyze code screenshots, error messages, UI designs via OCR
- **Smart Context:** Auto-detects current file, language, and project context

### AI Provider Options

| Provider | Setup |
|----------|-------|
| **GitHub Copilot** | Zero config — works out of the box |
| **OpenAI / Claude** | `aida.useExternalAI` = `true` + `aida.ai.apiKey` |
| **AIDA Chatbot** | `aida.useAIDAChatbot` = `true` + `aida.ai.apiKey` |
| **Company AI** | Point `aida.ai.apiHost` to your internal endpoint |

---

## ⌨️ Commands & Shortcuts

### Command Palette (`Ctrl+Shift+P`)

- `AIDA: Review File`
- `AIDA: Review Changes`
- `AIDA: Review All Changes`
- `AIDA: Review Pull Request`
- `AIDA: Open AIDA Chat`
- `AIDA: Analyze Dependency`
- `AIDA: Show Activation Status`
- `AIDA: Setup Azure DevOps Token`
- `AIDA: Show Available Language Models`

### Keyboard Shortcut

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+A` (`Cmd+Shift+A` on Mac) | Open AIDA Chat |

---

## 🆘 Support

- 📧 **Contact:** [GitHub Issues](https://github.com/trongld230289/aida/issues)
- 🐛 **Bug Reports:** [GitHub Issues](https://github.com/trongld230289/aida/issues)
- 💡 **Feature Requests:** [GitHub Discussions](https://github.com/trongld230289/aida/discussions)

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

**Made with ❤️ by [AIDA Team](https://github.com/trongld230289)**
