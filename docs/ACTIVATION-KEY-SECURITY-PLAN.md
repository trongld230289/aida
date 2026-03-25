# 🔑 AIDA Activation Key - Security Plan

> **Version:** 1.0  
> **Created:** February 26, 2026  
> **Updated:** March 4, 2026  
> **Status:** ✅ Implemented

---

## 📋 Vấn đề

Hiện tại App Insights `iKey` được hardcode trong `edition.config.js` → webpack bake vào `dist/extension.js` trong VSIX.

**Rủi ro:**
- VSIX leak ra ngoài → user ngoài company cài được → bị track → tốn phí + lưu data rác
- VSIX là file ZIP → decompile dễ dàng → lộ iKey → attacker có thể POST trực tiếp vào App Insights
- Ví dụ thực tế: `CORP.LOCAL\NonNH` đã bị track dù không phải target company

---

## 🏗️ Giải pháp: Activation Key + Domain Check

### Concept

> **❗ Public edition (marketplace) does NOT need an activation key. Tracking is disabled by default. Only company edition requires activation.**

- Bỏ iKey khỏi VSIX (set empty string trong build)
- iKey được encrypted vào **Activation Key** (chuỗi base64)
- Admin generate key per company → đưa cho employee
- Employee nhập key 1 lần → lưu trong VS Code `globalState`
- Extension decrypt key → lấy iKey + allowed domains → check domain → track

### Ai giữ gì

| Thứ | Nằm ở đâu | Ai có |
|-----|-----------|-------|
| `ENCRYPTION_SECRET` | `'CEP_AIDA'` — Hardcode trong source code → bake vào VSIX | Extension (mọi user cài đều có) |
| `Activation Key` (encrypted string chứa iKey + domains) | Admin generate → đưa cho employee | Chỉ employee được cấp |
| `iKey` (App Insights) | Bên trong activation key (encrypted) | Không ai thấy trực tiếp |

### Flow

```
Admin chạy generate script
    ↓
Input: iKey + domains + expiry
    ↓
Encrypt bằng ENCRYPTION_SECRET
    ↓
Output: "aG9sYTEyM..." (1 chuỗi base64 dài)
    ↓
Đưa cho employee qua email/Teams
    ↓
Employee paste vào VS Code setting "aida.activationKey" (1 lần duy nhất, lưu settings.json)
    ↓
Extension dùng ENCRYPTION_SECRET = CEP_AIDA (có sẵn trong code) để decrypt
    ↓
Lấy ra: iKey, domains, expiry
    ↓
Check domain match → ✅ Track | ❌ Reject
```

### 3 Lớp bảo vệ

1. **iKey không trong VSIX** → decompile vô ích (chỉ thấy empty string)
2. **Activation key encrypted** → phải có key string mới decrypt được
3. **Domain check** → decrypt được cũng phải đúng Windows domain / email domain mới track

---

## 🔍 Phân tích bảo mật VSIX decompile

VSIX là file ZIP → extract ra `dist/extension.js` → readable JS (dù minified).

**Decompile VSIX sẽ thấy gì?**

| Item | Có trong VSIX? | Rủi ro |
|------|---------------|--------|
| `APP_INSIGHTS_IKEY` | `''` (empty) | ✅ An toàn |
| `ENCRYPTION_SECRET` | ✅ Có | ⚠️ Medium — nhưng cần activation key + vẫn bị domain check |
| `iKey thật` | ❌ Không | ✅ An toàn |
| Domain check logic | ✅ Có | Low — check `process.env.USERDOMAIN` (OS-level, không fake được) |

**Attack vectors:**

| Attack | Domain Check chặn? | Kết quả |
|--------|-------------------|---------|
| User ngoài cài VSIX, không có key | ✅ Chặn | Không track — iKey empty |
| User ngoài cài VSIX, có key (được share) | ✅ Chặn | Domain khác → reject |
| Decompile, lấy secret, forge key | ✅ Chặn | Tạo key được nhưng fail domain check |
| Decompile, lấy secret + có key, decrypt lấy iKey, tự POST | ❌ Không chặn | Có thể spam — nhưng cần effort cao, detectable via dashboard |

---

## 📦 Activation Key Payload (encrypted JSON)

```json
{
  "company": "ExampleCorp",
  "domains": ["CORPDOMAIN"],
  "emailDomains": ["examplecorp.com"],
  "appInsights": {
    "instrumentationKey": "32510ee2-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "ingestionEndpoint": "https://southcentralus-3.in.applicationinsights.azure.com/",
    "applicationId": "dd38ae2c-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  },
  "expires": "2027-12-31",
  "issued": "2026-02-26"
}
```

---

## 📁 File Structure (khi implement)

```
scripts/tracking/
├── activation-key.ts              # Decrypt, validate, domain check, prompt UI
├── generate-activation-key.js     # Admin tool: generate encrypted key per company
├── tracking-enums.ts              # (existing) Enums
├── tracking-event-model.ts        # (existing) Event model
└── usage-tracking.ts              # (modified) Gate tracking behind activation
```

### Thay đổi cần làm

| File | Thay đổi |
|------|----------|
| `activation-key.ts` | **NEW** — decrypt, validate, domain check, config change listener, VS Code settings persistence |
| `generate-activation-key.js` | **NEW** — admin CLI tool to generate encrypted keys |
| `usage-tracking.ts` | **MODIFY** — replace hardcoded `APP_INSIGHTS_CONFIG` với activation-based config; gate `trackEvent()` behind activation check |
| `extension.ts` | **MODIFY** — call `initializeActivationKey(context)` on activate; register commands: `aida.clearActivationKey`, `aida.showActivationStatus` |
| `edition.config.js` | **MODIFY** — company edition: set `APP_INSIGHTS_IKEY = ''` (empty), add `ENCRYPTION_SECRET = 'CEP_AIDA'` |
| `package.json` | **MODIFY** — add 2 new commands + `aida.activationKey` setting |
| `global.d.ts` | **MODIFY** — add `__ENCRYPTION_SECRET__` type declaration |

### VS Code Settings & Commands (mới)

**Setting:**

| Setting | Type | Default | Mô tả |
|---------|------|---------|-------|
| `aida.activationKey` | string | `""` | Activation key for company edition. Public edition does NOT need this. |

**Commands:**

| Command | Title | Mô tả |
|---------|-------|──────|
| `aida.clearActivationKey` | Clear Activation Key | Xoá key đã lưu, disable tracking |
| `aida.showActivationStatus` | Show Activation Status | Hiện company name + expiry |

---

## 🔮 Future Enhancement (Phase 2)

Nếu cần bảo mật cao hơn (chống decompile lấy secret + iKey):

| Option | Mô tả | Effort |
|--------|-------|--------|
| **Server-side validation** | Extension gọi central server để validate key → server trả iKey | High — cần infra |
| **Obfuscation** | Dùng JavaScript obfuscator cho `dist/extension.js` | Low — nhưng chỉ delay, không prevent |
| **Rotate secret** | Đổi `ENCRYPTION_SECRET` mỗi version → old keys invalid | Medium |

---

*Last Updated: March 4, 2026*
