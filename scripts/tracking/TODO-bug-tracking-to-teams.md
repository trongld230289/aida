# TODO: Bug/Exception Tracking → Teams Notification

> Noted: 2026-03-31 — revisit when free

## Goal

Bắn bug/exception từ AIDA extension lên App Insights, rồi từ App Insights tự động notify về Teams channel.

## Current State

- AIDA đã có `trackEvent()` gửi **custom events** (`EventData`) lên Application Insights.
- Chưa có function gửi **exception/error** (`ExceptionData`).

## Plan

### 1. AIDA Extension — Thêm `trackException()`

- Tạo function `trackException(error, severityLevel, customData)` trong `usage-tracking.ts`
- Dùng App Insights baseType `ExceptionData` (thay vì `EventData`)
- Reuse infrastructure hiện có: activation key config, user identity, `sendToAppInsights()`
- Severity levels: `0=Verbose, 1=Information, 2=Warning, 3=Error, 4=Critical`

### 2. Azure Portal — Alert Rule + Action Group

- **Application Insights** → Create **Alert Rule**
  - Condition: Custom log query (ví dụ `exceptions | where timestamp > ago(5m)`)
  - Hoặc: Exception count > 0 trong 5 phút
- **Action Group** → chọn 1 trong các cách:
  - **Logic App** → Adaptive Card đến Teams channel (đẹp nhất, customizable)
  - **Webhook** → Teams Incoming Webhook URL (nhanh nhất)
  - **Email** → backup option

### 3. Flow tổng thể

```
AIDA Extension  →  App Insights (ExceptionData)  →  Alert Rule  →  Action Group  →  Teams Channel
```

## Notes

- Teams Incoming Webhook đang bị Microsoft deprecate dần → nên dùng **Power Automate** hoặc **Logic App** cho long-term.
- Cần decide: bắn tất cả error hay chỉ critical? Tránh spam Teams.
