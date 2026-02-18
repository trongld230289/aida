# AIDA Extension - Hướng dẫn Build & Phát hành

> **Áp dụng cho:** AIDA v1.1.11+  
> **Yêu cầu:** Node.js 18+, npm 9+

---

## 📦 Hai phiên bản (Edition)

| | Public | Company |
|---|---|---|
| **Mục đích** | Phát hành marketplace, cộng đồng | Dùng nội bộ dự án |
| **Usage Tracking** | ❌ Tắt (không gửi data) | ✅ Bật (gửi Azure App Insights) |
| **User Identity** | Không thu thập | Windows → Microsoft → GitHub → Git → MachineId |
| **App Insights Key** | Rỗng | Có sẵn |
| **Config file** | `edition.config.js` → `public` | `edition.config.js` → `company` |

Chỉ cần **1 branch** duy nhất. Khác biệt được xử lý tự động lúc build bởi webpack `DefinePlugin`.

---

## 🚀 Các bước thường dùng

### 1. Cài dependencies (lần đầu hoặc khi thêm package)

```bash
cd .vscode/aida
npm install
```

### 2. Dev mode — Watch & auto-rebuild (Company edition)

```bash
npm run webpack
```

- Tự động rebuild khi sửa code
- Company edition (có tracking)
- Dùng khi đang phát triển, debug

> **Ctrl+C** để dừng watch mode.

### 3. Build production

```bash
# Public edition (không tracking) — dùng để phát hành
npm run build

# Company edition (có tracking) — dùng nội bộ
npm run build:company
```

Output: `dist/extension.js` (minified)

### 4. Đóng gói VSIX

```bash
# Public — file .vsix cho marketplace
npm run package

# Company — file .vsix cho nội bộ (build + package 1 lệnh)
npm run package:company
```

Output: `aida-dev-1.1.11.vsix` trong thư mục gốc.

### 5. Cài VSIX cho người dùng

Cách 1 — Command line:
```bash
code --install-extension aida-dev-1.1.11.vsix
```

Cách 2 — VS Code UI:
1. Mở VS Code
2. `Ctrl+Shift+P` → `Extensions: Install from VSIX...`
3. Chọn file `.vsix`

### 6. Publish lên Marketplace (chỉ Public edition)

```bash
# Login (lần đầu)
npx vsce login trongld232

# Publish
npx vsce publish
```

> `vscode:prepublish` script sẽ tự động build Public edition trước khi publish.

---

## 📋 Tổng hợp Commands

| Lệnh | Mô tả | Edition |
|-------|--------|---------|
| `npm install` | Cài dependencies | - |
| `npm run webpack` | Dev watch mode | Company |
| `npm run build` | Build production | **Public** |
| `npm run build:company` | Build production | **Company** |
| `npm run build:dev` | Build development | Company |
| `npm run package` | Đóng gói .vsix | Public |
| `npm run package:company` | Build + đóng gói .vsix | Company |
| `npx vsce publish` | Publish marketplace | Public |

---

## 🔄 Workflow thường ngày

### Đang phát triển (dev)

```
npm run webpack          ← watch mode, tự rebuild
                         ← sửa code, save, test trong VS Code
Ctrl+C                   ← dừng khi xong
```

### Release nội bộ (company)

```
npm run package:company  ← build + đóng gói 1 lệnh
                         ← gửi file .vsix cho team
```

### Release public (marketplace)

```
npm run build            ← build public edition
npm run package          ← đóng gói .vsix
npx vsce publish         ← publish lên marketplace
```

---

## ⚙️ Cấu hình Edition

File `edition.config.js` chứa config cho cả 2 edition:

```javascript
const editions = {
    public: {
        IS_COMPANY_VERSION: false,    // Không tracking
        APP_INSIGHTS_IKEY: '',        // Không gửi data
    },
    company: {
        IS_COMPANY_VERSION: true,     // Tracking enabled
        APP_INSIGHTS_IKEY: '269da...', // Gửi đến App Insights
    }
};
```

Webpack sẽ **thay thế trực tiếp** các giá trị này vào code lúc build (compile-time constant). Không cần sửa code khi chuyển edition.

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

### Muốn xem edition nào đang được build
Xem dòng log đầu tiên khi build:
```
🏷️  Building AIDA extension — Edition: COMPANY
```

---

*Cập nhật: 18/02/2026*
