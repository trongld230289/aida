# 📊 AIDA Usage Tracking - Implementation Plan

> **Version:** Company Internal  
> **Created:** January 31, 2026  
> **Updated:** February 26, 2026  
> **Status:** ✅ Implemented

---

## 📋 Overview

Triển khai hệ thống tracking user sử dụng AIDA extension cho phiên bản internal company. Data được gửi trực tiếp đến **Azure Application Insights** để analytics và monitoring real-time.

### Key Features
- ✅ Force enable tracking (company version)
- ✅ Silent collection (không popup)
- ✅ Parallel Identity Collection: Windows + Microsoft + GitHub (all collected simultaneously)
- ✅ Display Name Resolution: windowsDisplayName ?? microsoftAccount ?? githubAccount
- ✅ Real-time analytics với Application Insights
- ✅ Powerful Kusto queries
- ✅ Azure Workbooks dashboards
- ✅ Non-blocking async requests (direct HTTPS POST, không dùng SDK)
- ✅ Centralized Tracking Enums (`tracking-enums.ts`)
- ✅ TrackingEventModel class (`tracking-event-model.ts`)
- ✅ System info: OS platform, CPU arch, UI kind, remote name
- ✅ ReviewMode tracking: Quick (no business docs) vs Enhanced (with business docs)
- ✅ All 9 features tracked (Copilot + AIDA Chatbot)
- ✅ AI Provider detection: GitHub Copilot / AIDA Chatbot / Cursor (auto-detected via `vscode.env.appName`)
- ✅ Event Buffering: events wait for identity resolution before sending
- ✅ Dedup guards: each action fires exactly 1 event (re-entry from Quick/Enhanced buttons skipped)
- ✅ `extension_activated` throttled: max 1 event/day/user (via globalState)
- ✅ `open_chat` removed from tracking (chỉ mở sidebar, không phải feature usage)

---

## 🏗️ Architecture

```
┌─────────────────┐                        ┌──────────────────────────────────┐
│  AIDA Extension │   Direct HTTPS POST    │   Azure Application Insights     │
│  (VS Code)      │ ─────────────────────► │   ┌────────────────────────────┐ │
│                 │                        │   │  customEvents              │ │
│  tracking-enums │  (No SDK dependency)   │   │  customMetrics             │ │
│  tracking-model │                        │   │  traces                    │ │
│  usage-tracking │                        │   └────────────────────────────┘ │
└─────────────────┘                        │              │                   │
                                           │              ▼                   │
                                           │   ┌────────────────────────────┐ │
                                           │   │  Log Analytics Workspace   │ │
                                           │   │  (Kusto Queries)           │ │
                                           │   └────────────────────────────┘ │
                                           │              │                   │
                                           │              ▼                   │
                                           │   ┌────────────────────────────┐ │
                                           │   │  Azure Workbooks           │ │
                                           │   │  (Dashboards & Alerts)     │ │
                                           │   └────────────────────────────┘ │
                                           └──────────────────────────────────┘
```

---

## ✅ Implementation Checklist

### Phase 1: Setup Azure Infrastructure
- [x] Create Azure Application Insights resource
- [x] Get Instrumentation Key / Connection String
- [ ] Configure data retention (90 days default, extend if needed)
- [x] Setup Log Analytics Workspace (auto-created)

### Phase 2: Extension Code
- [x] Create `scripts/tracking/usage-tracking.ts`
- [x] Create `scripts/tracking/tracking-enums.ts` (TrackingEvent, AiProvider, TrackingSource, ReviewMode)
- [x] Create `scripts/tracking/tracking-event-model.ts` (TrackingEventModel class)
- [x] Modify `extension.ts` - add tracking hooks
- [x] Direct HTTPS POST to App Insights (không cần SDK)
- [x] Parallel Identity Collection (Windows + Microsoft + GitHub — all collected simultaneously)
- [x] Track all 9 features qua cả Copilot và AIDA Chatbot
- [x] Test locally

### Phase 3: Monitoring Setup
- [ ] Import Kusto queries (see below)
- [ ] Create Azure Workbook dashboard
- [ ] Setup Alerts for anomalies
- [ ] Configure Smart Detection

### Phase 4: Deploy
- [ ] Build VSIX package
- [ ] Test on another machine
- [ ] Distribute to team

---

## 📊 Data Schema (Application Insights)

### Custom Events Table: `customEvents`

| # | Property | Location | Example |
|---|----------|----------|---------|
| 1 | timestamp | Built-in | 2026-01-31T10:30:00Z |
| 2 | name | Built-in | review_file |
| 3 | userDisplayName | customDimensions | Trong Duc Le |
| 4 | windowsId | customDimensions | CORPDOMAIN\user01 |
| 5 | windowsDomain | customDimensions | CORPDOMAIN |
| 6 | windowsUsername | customDimensions | user01 |
| 7 | computerName | customDimensions | azvd11sdc01-137 |
| 8 | windowsDisplayName | customDimensions | Trong Duc Le |
| 9 | microsoftAccount | customDimensions | user@company.com |
| 10 | githubAccount | customDimensions | username |
| 8 | computerName | customDimensions | DESKTOP-ABC123 |
| 9 | eventData | customDimensions | {"file":"app.ts","source":"chat_participant","aiProvider":"github_copilot","reviewMode":"quick"} |
| 10 | extensionVersion | customDimensions | 1.1.11 |
| 11 | vscodeVersion | customDimensions | 1.85.0 |
| 12 | appName | customDimensions | VS Code / Cursor |
| 13 | sessionId | session_Id | abc123... |
| 14 | userId | user_Id | xyz789... |
| 15 | language | customDimensions | en / vi |
| 16 | editionType | customDimensions | company |
| 17 | project | customDimensions | ProjectX |
| 18 | osPlatform | customDimensions | win32 / darwin / linux |
| 19 | osArch | customDimensions | x64 / arm64 |
| 20 | uiKind | customDimensions | desktop / web |
| 21 | remoteName | customDimensions | local / ssh-remote / wsl |
| 22 | duration | customMeasurements | 1500 (ms) |
| 23 | reviewMode | customDimensions (inside eventData) | quick / enhanced |

### Identity Collection (Parallel)

All 3 identity sources are collected simultaneously (no priority chain):

| Source | Method | Data Collected |
|--------|--------|----------------|
| Windows | `os.userInfo()` + `USERDOMAIN` + `GetUserNameEx(3)` | domain\username, computer name, display name from AD |
| Microsoft | VS Code Authentication API | Account label (email/name) |
| GitHub | VS Code Authentication API | Account label (username) |

**Display Name Resolution:** `windowsDisplayName ?? microsoftAccount ?? githubAccount`

> On Linux/macOS, Windows identity returns null. Display name falls back to Microsoft or GitHub account.

---

## 🔧 Implementation Architecture

### File Structure (3-file system)

```
scripts/
├── tracking-enums.ts          # Centralized enums (TrackingEvent, AiProvider, TrackingSource, ReviewMode)
├── tracking-event-model.ts    # TrackingEventModel class (data model + payload builders)
└── usage-tracking.ts          # Core logic (identity resolution, trackEvent, sendToAppInsights)
```

### Tracking Enums (`tracking-enums.ts`)

```javascript
const TrackingEvent = Object.freeze({
  EXTENSION_ACTIVATED: 'extension_activated',   // throttled: max 1/day/user
  REVIEW_FILE: 'review_file',
  REVIEW_CHANGES: 'review_changes',
  REVIEW_ALL_CHANGES: 'review_all_changes',
  REVIEW_PR: 'review_pr',
  SYNC_REVIEW_TEMPLATES: 'sync_review_templates',
  ANALYZE_DEPENDENCY: 'analyze_dependency',
  ANALYZE_DEPENDENCY_PR: 'analyze_dependency_pr',
  ANALYZE_DEPENDENCY_AI_PR: 'analyze_dependency_ai_pr',
  ANALYZE_DEPENDENCY_AI_NODE: 'analyze_dependency_ai_node',
  SCAN_APP: 'scan_app',
  ERROR_OCCURRED: 'error_occurred'
});

const AiProvider = Object.freeze({
  GITHUB_COPILOT: 'github_copilot',
  AIDA_CHATBOT: 'aida_chatbot',
  CURSOR: 'cursor'
});

const TrackingSource = Object.freeze({
  CHAT_PARTICIPANT: 'chat_participant',
  AIDA_CHATBOT: 'aida_chatbot',
  CONTEXT_MENU: 'context_menu',
  WEBVIEW_BUTTON: 'webview_button'
});

const ReviewMode = Object.freeze({
  QUICK: 'quick',
  ENHANCED: 'enhanced'
});

/**
 * Determine the current review mode based on global.selectedBusinessDocs.
 * @returns {'quick' | 'enhanced'} The review mode
 */
function getReviewMode() {
    const docs = global.selectedBusinessDocs;
    if (docs && Array.isArray(docs) && docs.length > 0) {
        return ReviewMode.ENHANCED;
    }
    return ReviewMode.QUICK;
}

/**
 * Detect AI provider based on the IDE.
 * VS Code → github_copilot, Cursor → cursor.
 * For AIDA Chatbot sidebar, always use AiProvider.AIDA_CHATBOT directly.
 */
function getIdeAiProvider() {
    const appName = (vscode.env.appName || '').toLowerCase();
    if (appName.includes('cursor')) {
        return AiProvider.CURSOR;
    }
    return AiProvider.GITHUB_COPILOT;
}

// ES exports
export { TrackingEvent, AiProvider, TrackingSource, ReviewMode, getReviewMode, getIdeAiProvider };
```

### TrackingEventModel (`tracking-event-model.ts`)

```javascript
class TrackingEventModel {
  constructor(eventName, userInfo, eventData, editionType, project) {
    // Resolved display name (windowsDisplayName ?? microsoftAccount ?? githubAccount)
    this.userDisplayName = userInfo?.displayName || '';
    // Windows identity
    this.windowsId = userInfo?.windowsId || '';
    this.windowsDomain = userInfo?.windowsDomain || '';
    this.windowsUsername = userInfo?.windowsUsername || '';
    this.computerName = userInfo?.computerName || '';
    this.windowsDisplayName = userInfo?.windowsDisplayName || '';
    // Account identities
    this.microsoftAccount = userInfo?.microsoftAccount || '';
    this.githubAccount = userInfo?.githubAccount || '';
    // Project (from activation key)
    this.project = project || '';
    // Machine
    this.machineId = userInfo?.machineId || vscode.env.machineId;
    // Event data
    this.eventName = eventName;
    this.eventData = eventData;
    // Extension context
    this.extensionVersion = TrackingEventModel.getExtensionVersion();
    this.editionType = editionType;
    // VS Code context
    this.vscodeVersion = vscode.version;
    this.appName = vscode.env.appName;
    this.language = vscode.env.language;
    this.uiKind = vscode.env.uiKind === 1 ? 'desktop' : 'web';
    this.remoteName = vscode.env.remoteName || 'local';
    // System info
    this.osPlatform = os.platform();
    this.osArch = os.arch();
    // Session
    this.sessionId = vscode.env.sessionId;
    this.machineId = vscode.env.machineId;
  }

  toCustomProperties() { /* ... */ }
  toAppInsightsTags() { /* ... */ }
  toAppInsightsPayload(instrumentationKey) { /* ... */ }
}
```

### Usage Example (Actual)

```javascript
import { TrackingEvent, AiProvider, TrackingSource, getReviewMode, getIdeAiProvider } from './scripts/tracking-enums';

// Track from Copilot / Cursor Chat Participant (auto-detect IDE)
trackEvent(TrackingEvent.REVIEW_FILE, {
  source: TrackingSource.CHAT_PARTICIPANT,
  aiProvider: getIdeAiProvider(),   // 'github_copilot' or 'cursor'
  reviewMode: getReviewMode()       // 'quick' or 'enhanced'
});

// Track from AIDA Chatbot Sidebar (always aida_chatbot)
trackEvent(TrackingEvent.REVIEW_FILE, {
  source: TrackingSource.AIDA_CHATBOT,
  aiProvider: AiProvider.AIDA_CHATBOT,
  reviewMode: getReviewMode()
});

// Track from Dependency Context Menu
trackEvent(TrackingEvent.ANALYZE_DEPENDENCY, {
  source: TrackingSource.CONTEXT_MENU,
  fileType: '.ts'
});
```

> **Note:** Context menu commands for review (reviewFile, reviewChanges, reviewAllChanges) do NOT track
> — they are pure routers. Tracking is handled by the downstream handler:
> - Copilot path → chat participant (review-file.ts, review-changes.ts, etc.)
> - AIDA path → sidebar-participants.ts `callParticipant()`
>
> **Dedup guard:** Chat participants skip tracking when `global.selectedBusinessDocs` is set
> (re-entry from Quick/Enhanced review buttons).

---

## 📈 Events to Track

| Event Name | When Triggered | Source | AI Provider | Custom Properties |
|------------|----------------|--------|-------------|-------------------|
| `extension_activated` | Extension starts (max 1/day/user) | - | - | `{isNewInstall, activationSource}` |
| `review_file` | @review-file | chat_participant / aida_chatbot | github_copilot / aida_chatbot / cursor | `{file, reviewMode}` |
| `review_changes` | @review-changes | chat_participant / aida_chatbot | github_copilot / aida_chatbot / cursor | `{file, reviewMode}` |
| `review_all_changes` | @review-all-changes | chat_participant / aida_chatbot | github_copilot / aida_chatbot / cursor | `{reviewMode}` |
| `review_pr` | @review-pr | chat_participant / aida_chatbot | github_copilot / aida_chatbot / cursor | `{prUrl, reviewMode}` |
| `sync_review_templates` | @sync-review-templates | chat_participant / aida_chatbot | github_copilot / aida_chatbot / cursor | `{}` |
| `scan_app` | @scan-app | chat_participant / aida_chatbot | github_copilot / aida_chatbot / cursor | `{}` |
| `analyze_dependency` | @dependency | chat_participant / context_menu / aida_chatbot | github_copilot / aida_chatbot / cursor | `{fileType, framework}` |
| `analyze_dependency_pr` | @dependency-pr | chat_participant / aida_chatbot | github_copilot / aida_chatbot / cursor | `{prUrl}` |
| `analyze_dependency_ai_pr` | AI button (PR graph) | webview_button | github_copilot / cursor | `{prUrl}` |
| `analyze_dependency_ai_node` | AI button (node graph) | webview_button | github_copilot / cursor | `{node}` |
| `error_occurred` | Error happens | - | - | `{errorType, errorMessage}` |

### Tracking Coverage Matrix

> **Dedup Rule:** Each user action fires exactly **1 event**.
> - Context menu commands (`review-commands.ts`) are pure routers — NO tracking.
> - Chat participants skip tracking on re-entry (`global.selectedBusinessDocs` guard).
> - `getIdeAiProvider()` auto-detects VS Code (github_copilot) vs Cursor (cursor).
> - `extension_activated` throttled to 1/day/user via `globalState.lastActivatedDate`.
> - `open_chat` removed — opening sidebar is not a feature action.

| Feature | Copilot/Cursor (Chat Participant) | AIDA Chatbot (Sidebar) | Context Menu | Webview Button | reviewMode |
|---------|----------------------------------|----------------------|--------------|----------------|------------|
| review-file | ✅ review-file.ts | ✅ sidebar-participants.ts | ⤵️ routes to participant | - | ✅ quick / enhanced |
| review-changes | ✅ review-changes.ts | ✅ sidebar-participants.ts | ⤵️ routes to participant | - | ✅ quick / enhanced |
| review-all-changes | ✅ review-all-changes.ts | ✅ sidebar-participants.ts | ⤵️ routes to participant | - | ✅ quick / enhanced |
| review-pr | ✅ pr-review-handler.ts (handleReviewPr) | ✅ pr-review-handler.ts (processReviewPr) | - | - | ✅ quick / enhanced |
| sync-review-templates | ✅ sync-review-templates.ts | ✅ sidebar-participants.ts | - | - | - |
| scan-app | ✅ scan-app.ts | ✅ sidebar-participants.ts | - | - | - |
| dependency | ✅ dependency.ts (participant) | ✅ dependency.ts (aiDependencyAnalysis) | ✅ dependency-commands.ts | - | - |
| dependency-pr | ✅ dependency.ts (participant) | ✅ dependency.ts (aiDependencyPrAnalysis) | - | - | - |
| dependency-ai-pr | - | - | - | ✅ dependency-ai-analysis-service.ts | - |
| dependency-ai-node | - | - | - | ✅ dependency-ai-analysis-service.ts | - |

---

## 🔍 Kusto Queries - Azure Monitor Workbook

> **Note:** Tất cả queries dùng `{TimeRange}` parameter của Azure Workbooks.
> Khi tạo Workbook, thêm parameter **TimeRange** (type: Time range picker) ở đầu trang.

### 📋 Query Summary

| # | Query Name | Visualization | Mục đích |
|---|-----------|---------------|----------|
| Q1 | All Events by User | Table | Tổng hợp events theo từng user, breakdown theo feature |
| Q2 | All Events Detail Log | Table (timeline) | Chi tiết từng event: timestamp, user, source, aiProvider, reviewMode |
| Q3 | Event Distribution | Pie Chart | Phân bố % các loại event |
| Q4 | Daily Usage Trend | Time Chart (line) | Xu hướng sử dụng hàng ngày (events + unique users) |
| Q5 | Feature Usage Over Time | Area Chart (stacked) | So sánh mức độ sử dụng các feature theo thời gian |
| Q6 | AI Provider: Copilot vs AIDA vs Cursor | Pie Chart | Tỷ lệ dùng Copilot vs AIDA Chatbot vs Cursor |
| Q7 | Entry Point / Source Distribution | Bar Chart | User truy cập feature từ đâu (chat, context menu, sidebar...) |
| Q8 | Top Active Users | Bar Chart | Top 15 users theo số lượng event |
| Q9 | Review Mode Distribution | Pie Chart | Tỷ lệ Quick vs Enhanced review |
| Q10 | Review Mode by Feature | Bar Chart | Breakdown Quick vs Enhanced theo từng review feature |
| Q11 | Enhanced Review Adoption | Time Chart (line) | Xu hướng adoption Enhanced review theo thời gian |
| Q12 | Install-Only Users (Ghost Users) | Table | Users chỉ có extension_activated, không dùng feature nào — cài cho vui |
| Q13 | Usage by Project | Bar Chart + Table | Phân bố event theo project, so sánh usage giữa các dự án |

> **Note:** `extension_activated` is throttled to 1/day/user. `open_chat` has been removed from tracking.

---

### 👥 Query 1: All Events by User
```kusto
// Tổng hợp events theo user - group by userId (alias của user_Id built-in App Insights)
// ai.user.id = windowsId || microsoftAccount || githubAccount || machineId (set trong code)
// Dùng take_anyif() để lấy giá trị non-empty cho các identity fields display
// Note: extension_activated is throttled to 1/day/user; open_chat removed
// Workbook Parameter: TimeRange (type: Time range picker)
customEvents
| where timestamp {TimeRange}
| extend 
    userDisplayName = tostring(customDimensions.userDisplayName),
    microsoftAccount = tostring(customDimensions.microsoftAccount),
    githubAccount = tostring(customDimensions.githubAccount),
    projectName = tostring(customDimensions["project"]),
    resolvedProvider = iif(isempty(tostring(parse_json(tostring(customDimensions.eventData)).aiProvider)), "github_copilot", tostring(parse_json(tostring(customDimensions.eventData)).aiProvider)),
    userId = user_Id
| where isnotempty(userId)
| summarize 
    userDisplayName = take_anyif(userDisplayName, isnotempty(userDisplayName)),
    microsoftAccount = take_anyif(microsoftAccount, isnotempty(microsoftAccount)),
    githubAccount = take_anyif(githubAccount, isnotempty(githubAccount)),
    TotalEvents = count(),
    ExtensionActivated = countif(name == "extension_activated"),
    ReviewFile = countif(name == "review_file"),
    ReviewChanges = countif(name == "review_changes"),
    ReviewAllChanges = countif(name == "review_all_changes"),
    ReviewPR = countif(name == "review_pr"),
    Dependency = countif(name == "analyze_dependency"),
    DependencyPR = countif(name == "analyze_dependency_pr"),
    DependencyAiPR = countif(name == "analyze_dependency_ai_pr"),
    DependencyAiNode = countif(name == "analyze_dependency_ai_node"),
    SyncTemplates = countif(name == "sync_review_templates"),
    Errors = countif(name == "error_occurred"),
    CopilotEvents = countif(resolvedProvider == "github_copilot"),
    AidaEvents = countif(resolvedProvider == "aida_chatbot"),
    CursorEvents = countif(resolvedProvider == "cursor"),
    QuickReviews = countif(parse_json(tostring(customDimensions.eventData)).reviewMode == "quick"),
    EnhancedReviews = countif(parse_json(tostring(customDimensions.eventData)).reviewMode == "enhanced"),
    FirstActivity = min(timestamp),
    LastActivity = max(timestamp),
    AllEventNames = make_set(name)
    by userId, projectName
| project userId, userDisplayName, microsoftAccount, githubAccount, projectName,
    totalEvents = TotalEvents,
    extensionActivated = ExtensionActivated,
    reviewFile = ReviewFile,
    reviewChanges = ReviewChanges,
    reviewAllChanges = ReviewAllChanges,
    reviewPR = ReviewPR,
    dependency = Dependency,
    dependencyPR = DependencyPR,
    dependencyAiPR = DependencyAiPR,
    dependencyAiNode = DependencyAiNode,
    syncTemplates = SyncTemplates,
    errors = Errors,
    copilotEvents = CopilotEvents,
    aidaEvents = AidaEvents,
    cursorEvents = CursorEvents,
    quickReviews = QuickReviews,
    enhancedReviews = EnhancedReviews,
    firstActivity = FirstActivity,
    lastActivity = LastActivity,
    allEventNames = AllEventNames
| order by totalEvents desc
```

### 🔍 Debug Query: Raw Events (chạy query này trước để check data có tồn tại)
```kusto
// Debug: xem raw data trong App Insights - check field names và values
// Chạy query này trước khi dùng các query khác để confirm data có push đúng
customEvents
| where timestamp > ago(7d)
| take 10
| project timestamp, name,
    userId = user_Id,
    userDisplayName = tostring(customDimensions.userDisplayName),
    microsoftAccount = tostring(customDimensions.microsoftAccount),
    githubAccount = tostring(customDimensions.githubAccount),
    projectName = tostring(customDimensions["project"]),
    eventData = tostring(customDimensions.eventData),
    appName = tostring(customDimensions.appName),
    extensionVersion = tostring(customDimensions.extensionVersion)
```
> **Troubleshooting:** Nếu Debug Query cũng trả về 0 results → data chưa được push tới App Insights.
> Check: (1) extension đã build lại chưa, (2) connection string đúng chưa, (3) event buffering chờ identity → mở Dev Tools (Help > Toggle Developer Tools > Console) xem logs.

### 📝 Query 2: All Events Detail Log
```kusto
// Chi tiết từng event - timeline view (bao gồm reviewMode)
customEvents
| where timestamp {TimeRange}
| extend 
    userId = user_Id,
    userDisplayName = tostring(customDimensions.userDisplayName),
    projectName = tostring(customDimensions["project"]),
    eventData = tostring(customDimensions.eventData),
    source = tostring(parse_json(tostring(customDimensions.eventData)).source),
    aiProvider = iif(isempty(tostring(parse_json(tostring(customDimensions.eventData)).aiProvider)), "github_copilot", tostring(parse_json(tostring(customDimensions.eventData)).aiProvider)),
    reviewMode = tostring(parse_json(tostring(customDimensions.eventData)).reviewMode),
    appName = tostring(customDimensions.appName),
    extensionVersion = tostring(customDimensions.extensionVersion)
| where isnotempty(userDisplayName)
| project 
    timestamp,
    userId,
    userDisplayName,
    Project = projectName,
    Event = name,
    Source = source,
    AiProvider = aiProvider,
    ReviewMode = reviewMode,
    EventData = eventData,
    App = appName,
    Version = extensionVersion
| order by timestamp desc
```

### 🥧 Query 3: Event Distribution Pie Chart
```kusto
// Pie chart phân bố các event types (with project filter)
customEvents
| where timestamp {TimeRange}
| where name != "extension_activated"
| extend projectName = tostring(customDimensions["project"])
| summarize EventCount = count() by name, projectName
| order by EventCount desc
| render piechart with (title="Event Distribution")
```

### 📈 Query 4: Daily Usage Trend
```kusto
// Line chart: số event theo ngày - xem xu hướng adoption (by project)
customEvents
| where timestamp {TimeRange}
| where name != "extension_activated"
| extend projectName = tostring(customDimensions["project"])
| summarize Events = count(), Users = dcount(tostring(customDimensions.userDisplayName)) by bin(timestamp, 1d), projectName
| order by timestamp asc
| render timechart with (title="Daily Usage Trend by Project")
```

### 📊 Query 5: Feature Usage Over Time - Stacked Area
```kusto
// Stacked area chart: xem feature nào được dùng nhiều theo thời gian (by project)
customEvents
| where timestamp {TimeRange}
| where name != "extension_activated"
| extend projectName = tostring(customDimensions["project"])
| summarize EventCount = count() by bin(timestamp, 1d), name, projectName
| order by timestamp asc
| render areachart with (title="Feature Usage Over Time")
```

### 🤖 Query 6: AI Provider Distribution - Copilot vs AIDA vs Cursor
```kusto
// Pie chart: so sánh dùng Copilot vs AIDA Chatbot vs Cursor (by project)
customEvents
| where timestamp {TimeRange}
| where name != "extension_activated"
| extend aiProvider = iif(isempty(tostring(parse_json(tostring(customDimensions.eventData)).aiProvider)), "github_copilot", tostring(parse_json(tostring(customDimensions.eventData)).aiProvider)),
    projectName = tostring(customDimensions["project"])
| summarize EventCount = count() by aiProvider, projectName
| render piechart with (title="AI Provider: Copilot vs AIDA vs Cursor")
```

### 🚪 Query 7: Entry Point / Source Distribution
```kusto
// Bar chart: user dùng feature từ đâu (chat, context menu, sidebar, command palette) — by project
customEvents
| where timestamp {TimeRange}
| where name != "extension_activated"
| extend source = tostring(parse_json(tostring(customDimensions.eventData)).source),
    projectName = tostring(customDimensions["project"])
| where isnotempty(source)
| summarize EventCount = count() by source, projectName
| order by EventCount desc
| render barchart with (title="Usage by Entry Point")
```

### 🏆 Query 8: Top Active Users Bar Chart
```kusto
// Bar chart: top 15 users theo số event (with project)
customEvents
| where timestamp {TimeRange}
| extend userDisplayName = tostring(customDimensions.userDisplayName),
    projectName = tostring(customDimensions["project"])
| where isnotempty(userDisplayName)
| where name != "extension_activated"
| summarize Events = count() by userDisplayName, projectName
| top 15 by Events
| order by Events asc
| render barchart with (title="Top 15 Active Users")
```

### ⚡ Query 9: Review Mode Distribution - Quick vs Enhanced
```kusto
// Pie chart: so sánh Quick Review vs Enhanced Review (có business docs) — by project
customEvents
| where timestamp {TimeRange}
| where name in ("review_file", "review_changes", "review_all_changes", "review_pr")
| extend reviewMode = tostring(parse_json(tostring(customDimensions.eventData)).reviewMode),
    projectName = tostring(customDimensions["project"])
| where isnotempty(reviewMode)
| summarize EventCount = count() by reviewMode, projectName
| render piechart with (title="Review Mode: Quick vs Enhanced")
```

### 🔀 Query 10: Review Mode by Feature
```kusto
// Bar chart: breakdown Quick vs Enhanced theo từng feature (by project)
customEvents
| where timestamp {TimeRange}
| where name in ("review_file", "review_changes", "review_all_changes", "review_pr")
| extend reviewMode = tostring(parse_json(tostring(customDimensions.eventData)).reviewMode),
    projectName = tostring(customDimensions["project"])
| where isnotempty(reviewMode)
| summarize EventCount = count() by name, reviewMode, projectName
| order by name asc, reviewMode asc
| render barchart with (title="Review Mode by Feature")
```

### 🚀 Query 11: Enhanced Review Adoption Over Time
```kusto
// Line chart: xu hướng adoption Enhanced review theo thời gian (by project)
customEvents
| where timestamp {TimeRange}
| where name in ("review_file", "review_changes", "review_all_changes", "review_pr")
| extend reviewMode = tostring(parse_json(tostring(customDimensions.eventData)).reviewMode),
    projectName = tostring(customDimensions["project"])
| where isnotempty(reviewMode)
| summarize 
    QuickReviews = countif(reviewMode == "quick"),
    EnhancedReviews = countif(reviewMode == "enhanced")
    by bin(timestamp, 1d), projectName
| order by timestamp asc
| render timechart with (title="Quick vs Enhanced Review Over Time")
```

### 👻 Query 12: Install-Only Users (Ghost Users)
```kusto
// Table: users chỉ có extension_activated, không dùng feature nào — cài cho vui
// Giúp identify ai cần training hoặc chưa biết cách dùng
// extension_activated is throttled to 1/day/user, so ActivationCount ≈ number of days used
let mainFeatures = dynamic(["review_file", "review_changes", "review_all_changes", "review_pr", "analyze_dependency", "analyze_dependency_pr", "sync_review_templates"]);
let activeUsers = customEvents
    | where timestamp {TimeRange}
    | where name in (mainFeatures)
    | extend userId = tostring(coalesce(
        customDimensions.userId,
        parse_json(tostring(customDimensions.eventData)).userId,
        user_AuthenticatedId,
        user_Id
    ))
    | where isnotempty(userId)
    | distinct userId;
customEvents
| where timestamp {TimeRange}
| where name == "extension_activated"
| extend userId = tostring(coalesce(
    customDimensions.userId,
    parse_json(tostring(customDimensions.eventData)).userId,
    user_AuthenticatedId,
    user_Id
))
| extend userDisplayName = tostring(customDimensions.userDisplayName)
| where isnotempty(userId)
| where userId !in (activeUsers)
| summarize 
    userDisplayName = take_anyif(userDisplayName, isnotempty(userDisplayName)),
    projectName = take_anyif(tostring(customDimensions["project"]), isnotempty(tostring(customDimensions["project"]))),
    ActivationCount = count(),
    FirstSeen = min(timestamp),
    LastSeen = max(timestamp),
    DaysSinceFirstInstall = datetime_diff('day', now(), min(timestamp))
    by userId
| project userId, userDisplayName, projectName, ActivationCount, FirstSeen, LastSeen, DaysSinceFirstInstall
| order by FirstSeen asc
```

### 📁 Query 13: Usage by Project
```kusto
// Table + Bar chart: phân bố event theo project — xem dự án nào dùng AIDA nhiều nhất
// Mỗi activation key chứa project name, tự động push vào tracking
customEvents
| where timestamp {TimeRange}
| where name != "extension_activated"
| extend projectName = tostring(customDimensions["project"])
| where isnotempty(projectName)
| summarize
    TotalEvents = count(),
    UniqueUsers = dcount(user_Id),
    ReviewFile = countif(name == "review_file"),
    ReviewChanges = countif(name == "review_changes"),
    ReviewAllChanges = countif(name == "review_all_changes"),
    ReviewPR = countif(name == "review_pr"),
    Dependency = countif(name == "analyze_dependency"),
    DependencyPR = countif(name == "analyze_dependency_pr"),
    SyncTemplates = countif(name == "sync_review_templates"),
    ScanApp = countif(name == "scan_app"),
    Errors = countif(name == "error_occurred"),
    FirstActivity = min(timestamp),
    LastActivity = max(timestamp)
    by projectName
| project projectName, TotalEvents, UniqueUsers,
    ReviewFile, ReviewChanges, ReviewAllChanges, ReviewPR,
    Dependency, DependencyPR, SyncTemplates, ScanApp, Errors,
    FirstActivity, LastActivity
| order by TotalEvents desc
| render barchart with (title="Usage by Project")
```

---

## 🚨 Alert Rules Configuration

### Alert 1: Error Rate Spike
```kusto
// Trigger alert if error rate > 5%
customEvents
| where timestamp >= ago(1h)
| summarize 
    TotalEvents = count(),
    ErrorEvents = countif(name == "error_occurred")
| extend ErrorRate = todouble(ErrorEvents) / todouble(TotalEvents) * 100
| where ErrorRate > 5
```

### Alert 2: No Activity (Extension Down?)
```kusto
// Alert if no events in last 30 minutes during business hours
customEvents
| where timestamp >= ago(30m)
| count
| where Count == 0
```

### Alert 3: High Latency
```kusto
// Alert if P95 latency > 5000ms
customEvents
| where timestamp >= ago(15m) and name == "ai_request"
| extend latency = todouble(customMeasurements.latency)
| summarize P95 = percentile(latency, 95)
| where P95 > 5000
```

---

## 📝 Configuration Needed

| Item | Value | Status |
|------|-------|--------|
| App Insights Connection String | `InstrumentationKey=xxx;IngestionEndpoint=xxx` | ⏳ Pending |
| Log Analytics Workspace ID | `_________________` | ⏳ Pending |
| Data Retention | 90 days (default) | ✅ Default |
| Sampling Rate | 100% (no sampling) | ✅ Recommended |
| Azure Region | East US / Southeast Asia | ⏳ Pending |

---

## 📚 References

- [Application Insights Documentation](https://docs.microsoft.com/en-us/azure/azure-monitor/app/app-insights-overview)
- [Kusto Query Language (KQL)](https://docs.microsoft.com/en-us/azure/data-explorer/kusto/query/)
- [Azure Workbooks](https://docs.microsoft.com/en-us/azure/azure-monitor/visualize/workbooks-overview)
- [Application Insights JavaScript SDK](https://github.com/microsoft/ApplicationInsights-JS)

---

*Last Updated: March 4, 2026*
