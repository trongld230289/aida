# 📊 AIDA Usage Tracking - Implementation Plan

> **Version:** Company Internal  
> **Created:** January 31, 2026  
> **Updated:** February 17, 2026  
> **Status:** ✅ Implemented

---

## 📋 Overview

Triển khai hệ thống tracking user sử dụng AIDA extension cho phiên bản internal company. Data được gửi trực tiếp đến **Azure Application Insights** để analytics và monitoring real-time.

### Key Features
- ✅ Force enable tracking (company version)
- ✅ Silent collection (không popup)
- ✅ Priority-based Identity: Windows → Microsoft → GitHub → Git Email → MachineId
- ✅ Real-time analytics với Application Insights
- ✅ Powerful Kusto queries
- ✅ Azure Workbooks dashboards
- ✅ Non-blocking async requests (direct HTTPS POST, không dùng SDK)
- ✅ Centralized Tracking Enums (`tracking-enums.js`)
- ✅ TrackingEventModel class (`tracking-event-model.js`)
- ✅ System info: OS platform, CPU arch, UI kind, remote name
- ✅ All 9 features tracked (Copilot + AIDA Chatbot)

---

## 🏗️ Architecture

```
┌─────────────────┐                        ┌──────────────────────────────────┐
│  AIDA Extension │   Direct HTTPS POST      │   Azure Application Insights     │
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
- [x] Create `scripts/usage-tracking.js`
- [x] Create `scripts/tracking-enums.js` (TrackingEvent, AiProvider, TrackingSource, IdentityProvider)
- [x] Create `scripts/tracking-event-model.js` (TrackingEventModel class)
- [x] Modify `extension.js` - add tracking hooks
- [x] Direct HTTPS POST to App Insights (không cần SDK)
- [x] Priority-based Identity Resolution (Windows → Microsoft → GitHub → Git Email → MachineId)
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
| 3 | userEmail | customDimensions | user@example.com |
| 4 | userDisplayName | customDimensions | Le Trong |
| 5 | userType | customDimensions | windows / microsoft / github / git / anonymous |
| 6 | windowsDomain | customDimensions | EXAMPLECORP |
| 7 | windowsUsername | customDimensions | user01 |
| 8 | computerName | customDimensions | DESKTOP-ABC123 |
| 9 | eventData | customDimensions | {"file":"app.ts","source":"chat_participant","aiProvider":"github_copilot"} |
| 10 | extensionVersion | customDimensions | 1.1.11 |
| 11 | vscodeVersion | customDimensions | 1.85.0 |
| 12 | appName | customDimensions | VS Code / Cursor |
| 13 | sessionId | session_Id | abc123... |
| 14 | userId | user_Id | xyz789... |
| 15 | language | customDimensions | en / vi |
| 16 | editionType | customDimensions | company |
| 17 | osPlatform | customDimensions | win32 / darwin / linux |
| 18 | osArch | customDimensions | x64 / arm64 |
| 19 | uiKind | customDimensions | desktop / web |
| 20 | remoteName | customDimensions | local / ssh-remote / wsl |
| 21 | duration | customMeasurements | 1500 (ms) |

### Identity Resolution Priority

| Priority | Provider | Source | Khi nào dùng |
|----------|----------|--------|-------------|
| 1 | Windows | `os.userInfo()` + `USERDOMAIN` | Enterprise/offline (DOMAIN\\username) |
| 2 | Microsoft | VS Code Authentication API | Có Microsoft account |
| 3 | GitHub | VS Code Authentication API | Có GitHub account |
| 4 | Git Email | `git config user.email` | Fallback |
| 5 | MachineId | VS Code `machineId` | Last resort |

---

## 🔧 Implementation Architecture

### File Structure (3-file system)

```
scripts/
├── tracking-enums.js          # Centralized enums (TrackingEvent, AiProvider, TrackingSource, IdentityProvider)
├── tracking-event-model.js    # TrackingEventModel class (data model + payload builders)
└── usage-tracking.js          # Core logic (identity resolution, trackEvent, sendToAppInsights)
```

### Tracking Enums (`tracking-enums.js`)

```javascript
const TrackingEvent = Object.freeze({
  EXTENSION_ACTIVATED: 'extension_activated',
  REVIEW_FILE: 'review_file',
  REVIEW_CHANGES: 'review_changes',
  REVIEW_ALL_CHANGES: 'review_all_changes',
  REVIEW_PR: 'review_pr',
  SYNC_REVIEW_TEMPLATES: 'sync_review_templates',
  OPEN_CHAT: 'open_chat',
  ANALYZE_DEPENDENCY: 'analyze_dependency',
  ANALYZE_DEPENDENCY_PR: 'analyze_dependency_pr',
  ANALYZE_DEPENDENCY_AI_PR: 'analyze_dependency_ai_pr',
  ANALYZE_DEPENDENCY_AI_NODE: 'analyze_dependency_ai_node',
  SCAN_APP: 'scan_app',
  ERROR_OCCURRED: 'error_occurred'
});

const AiProvider = Object.freeze({
  GITHUB_COPILOT: 'github_copilot',
  AIDA_CHATBOT: 'aida_chatbot'
});

const TrackingSource = Object.freeze({
  CHAT_PARTICIPANT: 'chat_participant',
  CONTEXT_MENU: 'context_menu',
  COMMAND_PALETTE: 'command_palette',
  AIDA_SIDEBAR: 'aida_sidebar'
});

const IdentityProvider = Object.freeze({
  WINDOWS:   { type: 'windows',   priority: 1, enabled: true },
  MICROSOFT: { type: 'microsoft', priority: 2, enabled: true },
  GITHUB:    { type: 'github',    priority: 3, enabled: true },
  GIT_EMAIL: { type: 'git_email', priority: 4, enabled: true },
  MACHINE_ID:{ type: 'machine_id',priority: 5, enabled: true }
});
```

### TrackingEventModel (`tracking-event-model.js`)

```javascript
class TrackingEventModel {
  constructor(eventName, userInfo, eventData, editionType) {
    // User identity
    this.userEmail = userInfo?.email || 'anonymous';
    this.userDisplayName = userInfo?.displayName || '';
    this.userType = userInfo?.type || 'anonymous';
    this.windowsDomain = userInfo?.windowsDomain || '';
    this.windowsUsername = userInfo?.windowsUsername || '';
    this.computerName = userInfo?.computerName || '';
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
const { TrackingEvent, AiProvider, TrackingSource } = require('./scripts/tracking-enums');

// Track from Copilot Chat Participant
trackEvent(TrackingEvent.REVIEW_FILE, {
  source: TrackingSource.CHAT_PARTICIPANT,
  aiProvider: AiProvider.GITHUB_COPILOT
});

// Track from AIDA Chatbot Sidebar
trackEvent(TrackingEvent.REVIEW_FILE, {
  source: TrackingSource.AIDA_SIDEBAR,
  aiProvider: AiProvider.AIDA_CHATBOT
});

// Track from Context Menu
trackEvent(TrackingEvent.REVIEW_FILE, {
  source: TrackingSource.CONTEXT_MENU,
  aiProvider: isCompanyVersion ? AiProvider.AIDA_CHATBOT : AiProvider.GITHUB_COPILOT
});
```

---

## 📈 Events to Track

| Event Name | When Triggered | Source | AI Provider | Custom Properties |
|------------|----------------|--------|-------------|-------------------|
| `extension_activated` | Extension starts | - | - | `{isNewInstall, activationSource}` |
| `open_chat` | Open AIDA sidebar | aida_sidebar | aida_chatbot | `{triggerSource}` |
| `review_file` | @review-file | chat_participant / context_menu / aida_sidebar | github_copilot / aida_chatbot | `{file}` |
| `review_changes` | @review-changes | chat_participant / context_menu / aida_sidebar | github_copilot / aida_chatbot | `{file}` |
| `review_all_changes` | @review-all-changes | chat_participant / command_palette / aida_sidebar | github_copilot / aida_chatbot | `{}` |
| `review_pr` | @review-pr | chat_participant / aida_sidebar | github_copilot / aida_chatbot | `{prUrl}` |
| `sync_review_templates` | @sync-review-templates | chat_participant / aida_sidebar | github_copilot / aida_chatbot | `{}` |
| `scan_app` | @scan-app | chat_participant / aida_sidebar | github_copilot / aida_chatbot | `{}` |
| `analyze_dependency` | @dependency | chat_participant / context_menu / aida_sidebar | github_copilot / aida_chatbot | `{fileType, framework}` |
| `analyze_dependency_pr` | @dependency-pr | chat_participant / aida_sidebar | github_copilot / aida_chatbot | `{prUrl}` |
| `analyze_dependency_ai_pr` | @dependency-pr AI | chat_participant / aida_sidebar | github_copilot / aida_chatbot | `{prUrl}` |
| `analyze_dependency_ai_node` | @dependency AI node | chat_participant / aida_sidebar | github_copilot / aida_chatbot | `{node}` |
| `error_occurred` | Error happens | - | - | `{errorType, errorMessage}` |

### Tracking Coverage Matrix

| Feature | Copilot (Chat Participant) | AIDA Chatbot (Sidebar) | Context Menu |
|---------|--------------------------|----------------------|--------------|
| review-file | ✅ review-file.js | ✅ chatbot-sidebar.js | ✅ extension.js |
| review-changes | ✅ review-changes.js | ✅ chatbot-sidebar.js | ✅ extension.js |
| review-all-changes | ✅ review-all-changes.js | ✅ chatbot-sidebar.js | ✅ extension.js |
| review-pr | ✅ review-pr.js | ✅ review-pr.js (internal) | - |
| sync-review-templates | ✅ sync-review-templates.js | ✅ chatbot-sidebar.js | - |
| scan-app | ✅ scan-app.js | ✅ chatbot-sidebar.js | - |
| dependency | ✅ dependency.js | ✅ dependency.js (internal) | ✅ extension.js |
| dependency-pr | ✅ dependency.js | ✅ dependency.js (internal) | - |

---

## 🔍 Kusto Queries - Azure Monitor Workbook

> **Note:** Tất cả queries dùng `{TimeRange}` parameter của Azure Workbooks.
> Khi tạo Workbook, thêm parameter **TimeRange** (type: Time range picker) ở đầu trang.

### 📋 Query Summary

| # | Query Name | Visualization | Mục đích |
|---|-----------|---------------|----------|
| Q1 | All Events by User | Table | Tổng hợp events theo từng user, breakdown theo feature |
| Q2 | All Events Detail Log | Table (timeline) | Chi tiết từng event: timestamp, user, source, aiProvider |
| Q3 | Event Distribution | Pie Chart | Phân bố % các loại event |
| Q4 | Daily Usage Trend | Time Chart (line) | Xu hướng sử dụng hàng ngày (events + unique users) |
| Q5 | Feature Usage Over Time | Area Chart (stacked) | So sánh mức độ sử dụng các feature theo thời gian |
| Q6 | AI Provider: Copilot vs AIDA | Pie Chart | Tỷ lệ dùng Copilot vs AIDA Chatbot |
| Q7 | Entry Point / Source Distribution | Bar Chart | User truy cập feature từ đâu (chat, context menu, sidebar...) |
| Q8 | Top Active Users | Bar Chart | Top 15 users theo số lượng event |

---

### 📊 Query 1: All Events by User
```kusto
// Tổng hợp events theo user - dùng TimeRange parameter trong Azure Workbooks
// Workbook Parameter: TimeRange (type: Time range picker)
customEvents
| where timestamp {TimeRange}
| extend 
    userEmail = tostring(customDimensions.userEmail),
    userDisplayName = tostring(customDimensions.userDisplayName),
    appName = tostring(customDimensions.appName)
| where isnotempty(userEmail)
| summarize 
    TotalEvents = count(),
    ExtensionActivated = countif(name == "extension_activated"),
    ReviewFile = countif(name == "review_file"),
    ReviewChanges = countif(name == "review_changes"),
    ReviewAllChanges = countif(name == "review_all_changes"),
    ReviewPR = countif(name == "review_pr"),
    OpenChat = countif(name == "open_chat"),
    Dependency = countif(name == "analyze_dependency"),
    DependencyPR = countif(name == "analyze_dependency_pr"),
    DependencyAiPR = countif(name == "analyze_dependency_ai_pr"),
    DependencyAiNode = countif(name == "analyze_dependency_ai_node"),
    SyncTemplates = countif(name == "sync_review_templates"),
    ScanApp = countif(name == "scan_app"),
    Errors = countif(name == "error_occurred"),
    FirstActivity = min(timestamp),
    LastActivity = max(timestamp),
    AllEventNames = make_set(name)
    by userEmail, userDisplayName
| order by TotalEvents desc
```

### 📊 Query 2: All Events Detail Log
```kusto
// Chi tiết từng event - timeline view
customEvents
| where timestamp {TimeRange}
| extend 
    userEmail = tostring(customDimensions.userEmail),
    eventData = tostring(customDimensions.eventData),
    source = tostring(parse_json(tostring(customDimensions.eventData)).source),
    aiProvider = tostring(parse_json(tostring(customDimensions.eventData)).aiProvider),
    appName = tostring(customDimensions.appName),
    extensionVersion = tostring(customDimensions.extensionVersion)
| where isnotempty(userEmail)
| project 
    timestamp,
    userEmail,
    Event = name,
    Source = source,
    AiProvider = aiProvider,
    EventData = eventData,
    App = appName,
    Version = extensionVersion
| order by timestamp desc
```

### 📊 Query 3: Event Distribution Pie Chart
```kusto
// Pie chart phân bố các event types
customEvents
| where timestamp {TimeRange}
| where name != "extension_activated"
| summarize EventCount = count() by name
| order by EventCount desc
| render piechart with (title="Event Distribution")
```

### 📊 Query 4: Daily Usage Trend
```kusto
// Line chart: số event theo ngày - xem xu hướng adoption
customEvents
| where timestamp {TimeRange}
| where name != "extension_activated"
| summarize Events = count(), Users = dcount(tostring(customDimensions.userEmail)) by bin(timestamp, 1d)
| order by timestamp asc
| render timechart with (title="Daily Usage Trend")
```

### 📊 Query 5: Feature Usage Over Time - Stacked Area
```kusto
// Stacked area chart: xem feature nào được dùng nhiều theo thời gian
customEvents
| where timestamp {TimeRange}
| where name != "extension_activated"
| summarize EventCount = count() by bin(timestamp, 1d), name
| order by timestamp asc
| render areachart with (title="Feature Usage Over Time")
```

### 📊 Query 6: AI Provider Distribution - Copilot vs AIDA
```kusto
// Pie chart: so sánh dùng Copilot vs AIDA Chatbot
customEvents
| where timestamp {TimeRange}
| where name != "extension_activated"
| extend aiProvider = tostring(parse_json(tostring(customDimensions.eventData)).aiProvider)
| where isnotempty(aiProvider)
| summarize EventCount = count() by aiProvider
| render piechart with (title="AI Provider: Copilot vs AIDA Chatbot")
```

### 📊 Query 7: Entry Point / Source Distribution
```kusto
// Bar chart: user dùng feature từ đâu (chat, context menu, sidebar, command palette)
customEvents
| where timestamp {TimeRange}
| where name != "extension_activated"
| extend source = tostring(parse_json(tostring(customDimensions.eventData)).source)
| where isnotempty(source)
| summarize EventCount = count() by source
| order by EventCount desc
| render barchart with (title="Usage by Entry Point")
```

### 📊 Query 8: Top Active Users Bar Chart
```kusto
// Bar chart: top 15 users theo số event
customEvents
| where timestamp {TimeRange}
| extend userEmail = tostring(customDimensions.userEmail)
| where isnotempty(userEmail)
| where name != "extension_activated"
| summarize Events = count() by userEmail
| top 15 by Events
| order by Events asc
| render barchart with (title="Top 15 Active Users")
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

*Last Updated: February 17, 2026*
