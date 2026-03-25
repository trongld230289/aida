# AIDA Extension - Hướng dẫn Build & Phát hành

> **Áp dụng cho:** AIDA v1.1.18+  
> **Yêu cầu:** Node.js 18+, npm 9+

---

## 🔑 Single Edition — Activation Key bắt buộc

Từ v1.1.17, AIDA chỉ có **1 edition duy nhất**. Mọi build đều yêu cầu activation key.

| Tính năng | Mô tả |
|---|---|
| **Activation Key** | ✅ Bắt buộc — block toàn bộ tính năng nếu chưa kích hoạt |
| **Usage Tracking** | ✅ Luôn bật (gửi Azure App Insights — iKey nằm trong activation key) |
| **App Insights Key** | Giải mã từ activation key lúc runtime (không hardcode trong build) |
| **Encryption Secret** | `CEP_AIDA` (inject lúc build bởi `edition.config.js`) |

---

## 🚀 Chạy trực tiếp từ source code (Dev mode)

Extension nằm tại `.vscode/extensions/aida/` trong workspace. VS Code **tự động load** extensions từ thư mục `.vscode/extensions/` — không cần đóng gói VSIX khi phát triển.

### Workflow dev hàng ngày

```bash
# 1. Mở terminal tại thư mục extension
cd .vscode/extensions/aida

# 2. Cài dependencies (lần đầu hoặc khi thêm package)
npm install

# 3. Chạy watch mode — tự rebuild khi sửa code
npm run webpack

# 4. Sửa code → save → webpack tự rebuild
# 5. Ctrl+Shift+P → "Developer: Reload Window" để load code mới
# 6. Ctrl+C để dừng watch mode khi xong
```

> **Lưu ý:** Mỗi lần webpack rebuild xong, cần **Reload Window** để VS Code load lại extension với code mới.

---

## 🔑 Activation Key

AIDA **block toàn bộ tính năng** cho đến khi user nhập activation key hợp lệ.

### Tạo activation key (dành cho admin)

```bash
cd .vscode/extensions/aida

# Tạo key cho dự án
node scripts/tracking/generate-activation-key.js \
  --company "TechCorp" \
  --project "ProjectX" \
  --domains "techcorp.com" \
  --emailDomains "techcorp.com" \
  --expires "2026-12-31" \
  --appInsightsKey "your-ikey" \
  --appInsightsEndpoint "https://southeastasia-1.in.applicationinsights.azure.com/" \
  --appInsightsAppId "your-app-id"
```

Output:
- **Activation key** (encrypted base64) — gửi cho user
- Key được lưu vào `scripts/tracking/activation-keys.json` (registry)

### User nhập activation key

1. Mở VS Code Settings (`Ctrl+,`)
2. Tìm `aida.activationKey`
3. Dán encrypted key vào
4. Hoặc: `Ctrl+Shift+P` → `AIDA: Enter Activation Key`

### Key chứa gì?

```json
{
  "company": "TechCorp",
  "project": "ProjectX",
  "domains": ["techcorp.com"],
  "emailDomains": ["techcorp.com"],
  "expires": "2026-12-31",
  "appInsights": {
    "iKey": "...",
    "endpoint": "...",
    "appId": "..."
  }
}
```

Key được mã hóa AES-256-CBC với secret `CEP_AIDA`. Extension giải mã lúc runtime, trích xuất App Insights config và bật tracking.

> **Periodic check:** Extension tự kiểm tra hạn key mỗi 1 giờ. Nếu key hết hạn giữa phiên, sẽ hiện cảnh báo và tắt tính năng.

---

## 📦 Build production

```bash
npm run build
```

Output: `dist/extension.js` (minified)

---

## 📤 Đóng gói & Phát hành

### Đóng gói VSIX

```bash
npm run package
```

Output: `aida-dev-1.1.18.vsix` trong thư mục gốc.

### Cài VSIX cho người dùng

Cách 1 — Command line:
```bash
code --install-extension aida-dev-1.1.18.vsix
```

Cách 2 — VS Code UI:
1. Mở VS Code
2. `Ctrl+Shift+P` → `Extensions: Install from VSIX...`
3. Chọn file `.vsix`

### Publish lên Marketplace

```bash
# Login (lần đầu)
npx vsce login trongld232

# Publish
npx vsce publish
```

> `vscode:prepublish` script sẽ tự động build trước khi publish.

---

## 📋 Tổng hợp Commands

| Lệnh | Mô tả | Mode |
|-------|--------|------|
| `npm install` | Cài dependencies | - |
| `npm run webpack` | Dev watch mode (tự rebuild khi save) | development |
| `npm run build` | Build production | production |
| `npm run package` | Đóng gói .vsix | production |
| `npx vsce publish` | Publish marketplace | production |
| `npm test` | Chạy unit tests (vitest) | - |
| `npm run test:watch` | Watch mode tests | - |
| `npm run lint` | ESLint check | - |

---

## 🔄 Workflow tổng hợp

### Đang phát triển (dev) — chạy trực tiếp từ code

```
npm run webpack              ← watch mode, tự rebuild khi save
                             ← sửa code, save
                             ← Ctrl+Shift+P → Reload Window → test
Ctrl+C                       ← dừng khi xong
```

### Release (nội bộ hoặc marketplace)

```
npm run package              ← build + đóng gói .vsix
                             ← gửi file .vsix + activation key cho team
npx vsce publish             ← (optional) publish lên marketplace
```

---

## ⚙️ Cấu hình Build

File `edition.config.js` chứa config duy nhất:

```javascript
const config = {
    FORCE_TRACKING: true,
    APP_INSIGHTS_IKEY: '',           // iKey nằm trong activation key
    APP_INSIGHTS_ENDPOINT: '',       // Endpoint nằm trong activation key
    APP_INSIGHTS_APP_ID: '',         // AppId nằm trong activation key
    ENCRYPTION_SECRET: 'CEP_AIDA',  // Dùng để giải mã activation key
};
```

Webpack `DefinePlugin` **thay thế trực tiếp** các giá trị này vào code lúc build (compile-time constant). App Insights config được giải mã từ activation key lúc runtime.

---

## 🐛 Troubleshooting

### `npm install` bị EPERM với monaco-editor
VS Code đang lock file. Đóng VS Code → chạy lại `npm install` → mở lại VS Code.

### `webpack-cli` not found
```bash
npm install --save-dev webpack-cli
```

### Build xong nhưng extension không update
Reload VS Code: `Ctrl+Shift+P` → `Developer: Reload Window`

### "Activation key required"
Tạo activation key bằng `generate-activation-key.js` rồi nhập vào Settings → `aida.activationKey`.

### Muốn xem VSIX chứa gì (kiểm tra .vscodeignore)
```bash
npx @vscode/vsce ls
```

---

## 📄 Template Files

HTML templates nằm trong `templates/` của từng module:

```
scripts/review/templates/       → Monaco diff viewer
scripts/dependency/templates/   → AI analysis panel
scripts/dependency/views/       → Graph view & impact analysis
scripts/chatbot/templates/      → Sidebar templates & fallbacks
```

Webpack `CopyPlugin` tự copy vào `dist/` khi build.
Khi thêm template mới, thêm entry tương ứng trong `webpack.config.js`.

---

## 📁 Cấu trúc thư mục chính

```
.vscode/extensions/aida/
├── extension.ts                  ← Entry point
├── edition.config.js             ← Build config (encryption secret, tracking)
├── webpack.config.js             ← Webpack build config
├── package.json                  ← Extension manifest
├── dist/                         ← Build output (extension.js)
├── scripts/
│   ├── core/                     ← Template engine, error utils
│   ├── review/                   ← Code review module
│   ├── dependency/               ← Dependency analysis
│   ├── chatbot/                  ← AIDA Chatbot
│   └── tracking/                 ← Usage tracking & activation key
│       ├── activation-key.ts     ← Decrypt & validate key
│       ├── usage-tracking.ts     ← App Insights pipeline
│       ├── tracking-event-model.ts
│       ├── generate-activation-key.js  ← Admin: tạo key
│       └── activation-keys.json  ← Registry các key đã tạo
├── docs/                         ← Tài liệu (không đóng gói vào VSIX)
└── templates/                    ← HTML templates
```

---

*Cập nhật: 20/03/2026*
