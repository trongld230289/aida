# AIDA Extension - Tổng hợp chức năng (v1.1.14)

> Tài liệu tổng hợp tất cả các chức năng mà extension **AIDA (AI Development Assistant)** cung cấp cho user.

---

## 1. Smart Code Review (`Review File`)

- Phân tích chất lượng code, bảo mật, hiệu năng cho file đang mở hoặc file chỉ định
- Hỗ trợ đa ngôn ngữ: **TypeScript, JavaScript, Python, C#, Go, Java, PHP, Ruby, Rust, Kotlin, Swift**
- Nhận diện framework: **Angular, React, Vue, Node.js**
- Hỗ trợ **Technical Project Rules** và **Business Project Rules** tùy chỉnh
- **Review Mode:** Quick (không business docs) / Enhanced (có business docs từ `AIDA/business-docs/`)
- **Truy cập:**
  - Right-click → `AIDA: Review File`
  - Command Palette (`Ctrl+Shift+P`) → `AIDA: Review File`
  - Chat: `@review-file [file-path]`

## 2. Review Changes (Git Diff Analysis)

- Phân tích các thay đổi chưa commit (uncommitted changes) bằng AI
- Đánh giá rủi ro, phát hiện breaking changes
- Gợi ý cải thiện code
- **Truy cập:**
  - Right-click trong Editor/Git view → `AIDA: Review Changes`
  - Command Palette → `AIDA: Review Changes`
  - Chat: `@review-changes`

## 3. Review All Changes

- Phân tích **tất cả** các file đã thay đổi trong workspace cùng lúc
- **Truy cập:**
  - Command Palette → `AIDA: Review All Changes`
  - Chat: `@review-all-changes`

## 4. Pull Request Intelligence (`Review PR`)

- Phân tích PR từ **GitHub, GitLab, Azure DevOps**
- AI-powered review với diff viewer (Monaco Editor tích hợp)
- Đánh giá merge readiness, team collaboration insights
- Automated review comments
- **Truy cập:**
  - Command Palette → `AIDA: Review Pull Request`
  - Chat: `@review-pr <pr-url>`

## 5. AIDA Chatbot (Sidebar Chat)

- Giao diện chat sidebar tương tự GitHub Copilot
- Hỗ trợ **hình ảnh** (phân tích screenshot, error messages, UI designs)
- Lịch sử hội thoại
- Hỗ trợ tiếng Việt và tiếng Anh
- Tự động nhận diện file và project context hiện tại
- **Truy cập:**
  - Icon AIDA trên Activity Bar
  - `Ctrl+Shift+A`
  - Command Palette → `AIDA: Open AIDA Chat`

## 6. Dependency Analysis (`@dependency`)

- Trực quan hóa dependencies dạng **interactive graph**
- Phát hiện circular dependencies và vấn đề kiến trúc
- AI-powered impact analysis cho các thay đổi
- Smart caching 24h (dùng `@dependency re-analyze` để phân tích lại)
- Hỗ trợ C# (MediatR, constructor injection, base classes...)
- **Truy cập:**
  - Right-click → `AIDA: Analyze Dependency`
  - Chat: `@dependency`

## 6b. PR Dependency Analysis (`@dependency-pr`)

- Phân tích dependency impact cho Pull Request (tách riêng từ `@dependency`)
- Hỗ trợ GitHub, GitLab, Azure DevOps PR URL
- Phân tích impact của các file thay đổi trong PR lên hệ thống dependency
- **Truy cập:**
  - Chat: `@dependency-pr <pr-url>`

## 7. Sync Review Templates (`@sync-review-templates`)

- Đồng bộ template review code mới nhất về workspace
- Template theo framework/ngôn ngữ cụ thể (Angular, React, Vue...)
- Tùy chỉnh được trong `AIDA/templates/review-code/`
- **Truy cập:** Chat: `@sync-review-templates`

## 8. Scan App (`@scan-app`)

- AI-powered code scanning
- Phát hiện duplicate code
- **Truy cập:** Chat: `@scan-app`

---

## Chat Participants (Tổng hợp)

| Participant | Chức năng |
|---|---|
| `@review-file` | Review file hiện tại hoặc chỉ định path |
| `@review-changes` | Phân tích git changes cho file hiện tại |
| `@review-all-changes` | Review tất cả thay đổi trong workspace |
| `@review-pr` | Review Pull Request bằng URL |
| `@sync-review-templates` | Đồng bộ template review |
| `@scan-app` | AI-powered code scanning & duplicate detection |
| `@dependency` | Phân tích dependency với visual graph |
| `@dependency-pr` | Phân tích dependency impact cho Pull Request |

---

## AI Provider hỗ trợ

| Provider | Mô tả |
|---|---|
| **GitHub Copilot** | Dùng trực tiếp nếu có license, không cần cấu hình thêm |
| **OpenAI** | GPT-4, GPT-5 — cần API key |
| **Claude** | Sonnet, Opus — cần API key |
| **Custom AI** | Endpoint AI nội bộ công ty |
| **Hybrid Mode** | Kết hợp nhiều AI provider cho các task khác nhau |

### Cấu hình AI Provider

```json
{
  "aida.useExternalAI": true,
  "aida.ai.apiKey": "your-api-key",
  "aida.ai.apiHost": "https://api.openai.com",
  "aida.ai.model": "gpt-4o"
}
```

---

## Tích hợp & Truy cập nhanh

### Context Menu (Right-click)

- **Editor Context Menu:** Review File, Review Changes, Analyze Dependency
- **Explorer Context Menu:** Review File, Review Changes, Analyze Dependency (cho các file code)
- **SCM (Git) Context Menu:** Review Changes, Review File

### Keybinding

| Phím tắt | Chức năng |
|---|---|
| `Ctrl+Shift+A` | Mở AIDA Chat |
| `Ctrl+Shift+P` → tìm "AIDA" | Truy cập tất cả commands |

### Command Palette (`Ctrl+Shift+P`)

| Command | Chức năng |
|---|---|
| `AIDA: Review File` | Review file hiện tại |
| `AIDA: Review Changes` | Review git changes |
| `AIDA: Review All Changes` | Review tất cả git changes |
| `AIDA: Review Pull Request` | Review PR bằng URL |
| `AIDA: Open AIDA Chat` | Mở giao diện chat |
| `AIDA: Setup Azure DevOps Token` | Cấu hình token Azure DevOps |
| `AIDA: Show Available Language Models` | Xem danh sách AI models khả dụng |
| `AIDA: Analyze Dependency` | Phân tích dependency |

---

## Tính năng bổ trợ

- **Cross-IDE Support** — Tương thích cả VS Code và Cursor IDE
- **Debug Mode** — Bật logging chi tiết (`aida.debugMode: true`)
- **Custom Templates Base Path** — Tuỳ chỉnh đường dẫn template (`aida.templatesBasePath`)
- **Multi-platform Source Control** — Cấu hình token cho nhiều organization trên GitHub/GitLab/Azure DevOps cùng lúc
- **Business Documents** — Tự động phát hiện business docs từ workspace `AIDA/business-docs/`

---

## Cấu hình Source Control (cho PR Review)

```json
{
  "aida.sourceControls": {
    "azureDevOps": {
      "MyOrg": "your-azure-devops-token"
    },
    "github": {
      "MyOrg": "your-github-token"
    },
    "gitlab": {
      "MyGroup": "your-gitlab-token"
    }
  }
}
```

---

*Tài liệu được cập nhật ngày 25/02/2026 — dựa trên AIDA v1.1.14*
