# 🧪 AIDA Extension Testing Guide

## Quick Start Test

### 1. 🔧 Enable AIDA Chat
1. Open VS Code Settings (`Ctrl+,`)
2. Search for "AIDA"  
3. Enable: **"AIDA: Has No Github Copilot"** ✅

### 2. 🚀 Test Commands
Open Command Palette (`Ctrl+Shift+P`) and test:

#### Direct Chat Access
- `AIDA: Open AIDA Chat` - Should open Copilot-style right sidebar

#### Context Menu Testing  
- Right-click any file → `Review File` - Should route to AIDA chat
- Right-click any file → `Review Changes` - Should route to AIDA chat

#### Direct AIDA Commands
- `AIDA: Review File Context` - Direct AIDA chat with @review-file
- `AIDA: Review Changes Context` - Direct AIDA chat with @review-changes

### 3. 🎯 Expected Behavior

#### When `hasNoGithubCopilot = true`:
- ✅ Right-click "Review File" → Opens AIDA Copilot-style chat
- ✅ Right-click "Review Changes" → Opens AIDA Copilot-style chat  
- ✅ Chat appears in right sidebar (like GitHub Copilot)
- ✅ All @participants work: @review-file, @review-changes, @review-pr, @sync-review-templates

#### When `hasNoGithubCopilot = false` AND GitHub Copilot available:
- ✅ Right-click commands route to GitHub Copilot
- ✅ Direct AIDA commands still work (bypass routing)

## 🐛 Troubleshooting

### Problem: "Cannot access before initialization"
**Solution**: Extension initialization was fixed - copilot chat now initializes early

### Problem: "AIDA Chat is not initialized" 
**Check**:
1. Extension console for errors (`Developer Tools` → `Console`)
2. Reload VS Code window (`Ctrl+Shift+P` → "Reload Window")

### Problem: Commands not appearing
**Check**:
1. Extension is activated (`Extensions` → Search "AIDA")
2. Commands are in package.json
3. Reload window if needed

## 🔍 Verification Steps

### Step 1: Basic Functionality
```
1. Open Command Palette (Ctrl+Shift+P)
2. Type "AIDA: Open AIDA Chat" 
3. Should see right sidebar panel open
4. Type message in chat input
5. Should see message appear in chat
```

### Step 2: Participant Integration  
```
1. In AIDA chat, type: @review-file
2. Should trigger review-file participant
3. Should see file review functionality
4. Test other participants: @review-changes, @review-pr
```

### Step 3: Right-Click Integration
```
1. Right-click any .js/.ts file in Explorer
2. Click "Review File"
3. Should open AIDA chat with @review-file message
4. File path should be included automatically
```

## ⚙️ Configuration Testing

### Test Configuration Switching
1. **Set** `hasNoGithubCopilot = false`
2. **Right-click** → "Review File" → Should try GitHub Copilot
3. **Set** `hasNoGithubCopilot = true` 
4. **Right-click** → "Review File" → Should use AIDA chat

### Test Direct Commands (Always AIDA)
- `AIDA: Review File Context` → Always AIDA (ignores hasNoGithubCopilot)
- `AIDA: Review Changes Context` → Always AIDA (ignores hasNoGithubCopilot)

## 🎨 UI Verification

### Copilot-Style Appearance
- ✅ Right sidebar position
- ✅ Dark theme matching VS Code
- ✅ Chat bubbles with user/assistant styling
- ✅ Input field at bottom
- ✅ Send button functionality
- ✅ Message history scrolling

### Expected Visual Match
The AIDA chat should be visually identical to GitHub Copilot:
- Same background color (#1e1e1e)
- Same message bubble styling
- Same typography and spacing
- Same input field design
- Same overall layout and positioning

## 🔧 Development Notes

### Key Files
- `extension.js` - Main activation and command routing
- `scripts/copilot-style-chat.js` - Copilot UI implementation  
- `package.json` - Commands and configuration
- `COPILOT-REPLACEMENT-GUIDE.md` - Full documentation

### Initialization Order  
1. Extension activates (`activate()`)
2. Copilot chat initializes early (before commands)
3. Commands register with copilot reference available
4. All participants initialize
5. Subscriptions added to context

This ensures `copilotStyleChat` is available when commands need it! 🎉