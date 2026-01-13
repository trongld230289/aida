# 🤖 AIDA - AI Development Assistant
## Features & Workflow Guide for Visual Design

---

## 📋 Core Features (6 Features)

### 1. 💬 AIDA Chatbot
**Mô tả:** AI Chatbot tích hợp trong VS Code sidebar
- Chat với AI để hỏi về code, debug, giải thích logic
- Hỗ trợ BYOK (Bring Your Own Key) - OpenAI, Claude, Gemini
- Context-aware: hiểu file đang mở
- Hỗ trợ image input (paste screenshot)
- Không cần GitHub Copilot license

**Icon gợi ý:** 💬 Robot chat bubble, AI assistant avatar

---

### 2. 📝 Review Changes
**Mô tả:** Review chỉ những dòng code đã thay đổi (git changes)
- Phát hiện bug, security issues trong code mới viết
- So sánh với best practices
- Đề xuất fix ngay lập tức
- Nhanh, tập trung vào changes

**Icon gợi ý:** 🔍 Magnifying glass với diff lines (+/-)

---

### 3. 📄 Review File  
**Mô tả:** Review toàn bộ nội dung file
- Phân tích architecture, design patterns
- Kiểm tra coding standards
- Phát hiện code smell, technical debt
- Dùng khi refactor hoặc review file mới

**Icon gợi ý:** 📄 Document với checkmarks

---

### 4. 🔀 Review PR (Pull Request)
**Mô tả:** Review toàn bộ Pull Request từ URL
- Hỗ trợ Azure DevOps, GitHub, GitLab
- Xem diff trực tiếp trong VS Code (Monaco Editor)
- Review nhiều files cùng lúc
- Không cần clone repo

**Icon gợi ý:** 🔀 Git merge icon với AI eye

---

### 5. 📊 Dependency Analysis
**Mô tả:** Phân tích dependency của 1 file
- File này import những gì?
- Ai đang import/sử dụng file này?
- Dependency graph visualization (D3.js)
- Hiểu impact khi sửa file

**Icon gợi ý:** 📊 Network/graph diagram với nodes

---

### 6. 🎯 Dependency PR (PR Impact Analysis)
**Mô tả:** Phân tích impact của Pull Request
- PR này ảnh hưởng những modules/features nào?
- Những file nào cần test?
- Risk assessment cho PR
- Giúp reviewer focus đúng chỗ

**Icon gợi ý:** 🎯 Target với ripple effect (impact waves)

---

## 🔄 Developer Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                        DEVELOPMENT PHASE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐   │
│   │   CODING     │────▶│   REVIEW     │────▶│  CREATE PR   │   │
│   │              │     │   CHANGES    │     │              │   │
│   │  💻 Write    │     │  📝 AI Check │     │  🔀 Push to  │   │
│   │     Code     │     │     Code     │     │     Remote   │   │
│   └──────────────┘     └──────────────┘     └──────────────┘   │
│         │                                          │            │
│         │ (optional)                               │            │
│         ▼                                          │            │
│   ┌──────────────┐                                 │            │
│   │   REVIEW     │                                 │            │
│   │    FILE      │                                 │            │
│   │  📄 Full     │                                 │            │
│   │   Analysis   │                                 │            │
│   └──────────────┘                                 │            │
│                                                    │            │
├────────────────────────────────────────────────────┼────────────┤
│                        PR REVIEW PHASE             │            │
├────────────────────────────────────────────────────┼────────────┤
│                                                    ▼            │
│   ┌──────────────────────────────────────────────────────────┐ │
│   │                     PULL REQUEST                          │ │
│   │  ┌─────────────────┐     ┌─────────────────┐             │ │
│   │  │  DEPENDENCY PR  │     │    REVIEW PR    │             │ │
│   │  │  🎯 Impact      │     │  🔀 AI Review   │             │ │
│   │  │     Analysis    │     │     All Files   │             │ │
│   │  └────────┬────────┘     └────────┬────────┘             │ │
│   │           │                       │                       │ │
│   │           └───────────┬───────────┘                       │ │
│   │                       ▼                                   │ │
│   │              ┌─────────────────┐                          │ │
│   │              │    APPROVE /    │                          │ │
│   │              │  REQUEST FIXES  │                          │ │
│   │              └────────┬────────┘                          │ │
│   └───────────────────────┼──────────────────────────────────┘ │
│                           │                                     │
├───────────────────────────┼─────────────────────────────────────┤
│                    MERGE PHASE                                  │
├───────────────────────────┼─────────────────────────────────────┤
│                           ▼                                     │
│                  ┌─────────────────┐                           │
│                  │   MERGE TO      │                           │
│                  │   PRODUCTION    │                           │
│                  │  🚀 Deploy      │                           │
│                  └─────────────────┘                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎨 Visual Summary (For Image Creation)

### Workflow Diagram Elements:

| Phase | Icon | Color | Description |
|-------|------|-------|-------------|
| Coding | 💻 | Blue | Developer writing code |
| Review Changes | 📝 | Yellow | AI checking git changes |
| Review File | 📄 | Orange | AI analyzing full file |
| Create PR | 🔀 | Purple | Push code to remote |
| Dependency PR | 🎯 | Green | Impact analysis |
| Review PR | 🔍 | Cyan | AI reviewing PR |
| Merge | 🚀 | Red/Green | Deploy to production |

### Feature Cards Layout:

```
┌─────────────────────────────────────────────────────────────┐
│                     AIDA FEATURES                           │
├─────────────┬─────────────┬─────────────┬─────────────────┐│
│  💬 AIDA    │  📝 Review  │  📄 Review  │  🔀 Review     ││
│  Chatbot    │  Changes    │  File       │  PR            ││
├─────────────┼─────────────┴─────────────┴─────────────────┤│
│  📊 Dependency Analysis   │  🎯 Dependency PR             ││
│  (Single File)            │  (PR Impact)                  ││
└─────────────────────────────────────────────────────────────┘
```

---

## 🖼️ Suggested Image Concepts for Nano Banana

### Image 1: "AIDA Overview"
- Central: AIDA logo/robot mascot
- Surrounding: 6 feature icons in a circle
- Tagline: "Your Code, Your AI, Your Rules"

### Image 2: "Developer Workflow"
- Left to Right flow diagram
- Developer → Code → Review → PR → Merge
- AIDA appears at Review & PR stages as helper

### Image 3: "Before vs After AIDA"
- Split screen comparison
- Left: Developer stressed, many bugs
- Right: Developer confident, AIDA assisting

### Image 4: "Feature Spotlight" (6 separate images)
- Each feature as a card/poster
- Consistent style, different colors
- Icon + Title + 1-line description

### Image 5: "PR Review Flow"
- Focus on PR phase
- Show: Dependency Analysis → Review PR → Approve/Reject
- AIDA as the AI reviewer character

---

## 📐 Design Guidelines

### Colors (VS Code Theme):
- Background: `#1e1e1e` (Dark)
- Primary: `#007acc` (VS Code Blue)
- Success: `#2ea043` (Green)
- Warning: `#f85149` (Red)
- Accent: `#c586c0` (Purple)

### Typography:
- Headings: Bold, Clean Sans-serif
- Body: Readable, Technical feel
- Code: Monospace (Consolas, Monaco)

### Style:
- Modern, Flat design
- Tech/Developer aesthetic
- Professional but friendly
- Dark mode preferred

---

## 📝 Notes for Designer

1. **Target Audience:** Developers, Tech Leads, Engineering Managers
2. **Tone:** Professional, Trustworthy, Innovative
3. **Key Message:** "AI-powered code review that fits your workflow"
4. **Platforms:** VS Code Marketplace, GitHub README, Documentation

---

*Document created for Nano Banana - Visual Design Reference*
*AIDA v1.1.3 - AI Development Assistant*
