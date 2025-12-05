# Update New Feature From Copilot To AIDA Guide

## Overview
When adding a new chat participant/command to GitHub Copilot Chat, you need to also integrate it into AIDA Chatbot sidebar to maintain feature parity.

## Integration Checklist (6 locations)

### 1. **Export reusable function** in feature file
```javascript
// Example: scripts/dependency.js
async function aiDependencyAnalysis(message, stream, token, context) {
    // Reusable logic for both Copilot and AIDA
}

module.exports = {
    initializeDependencyGraph,  // For Copilot
    aiDependencyAnalysis        // For AIDA Chatbot
};
```
**Purpose**: Share logic between Copilot participant and AIDA chatbot

---

### 2. **Add to `isReviewCommand` array** (chatbot-sidebar.js ~line 387)
```javascript
const isReviewCommand = [
    'review-file', 
    'review-changes', 
    'review-all-changes', 
    'review-pr', 
    'sync-review-templates',
    'scan-app',
    'dependency'  // ← ADD NEW COMMAND
].includes(participantType);
```
**Purpose**: Skip file context detection for command-based features

---

### 3. **Add to `isReviewMode` array** (chatbot-sidebar.js ~line 723)
```javascript
const isReviewMode = [
    'review-file', 
    'review-changes', 
    'review-all-changes', 
    'review-pr', 
    'scan-app', 
    'sync-review-templates', 
    'dependency'  // ← ADD NEW COMMAND
].includes(participant);
```
**Purpose**: Enable review mode UI/behavior for command

---

### 4. **Add detection in `determineParticipant()`** (chatbot-sidebar.js ~line 790)
```javascript
determineParticipant(message) {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('@review-file')) return 'review-file';
    if (lowerMessage.includes('@review-changes')) return 'review-changes';
    if (lowerMessage.includes('@review-all-changes')) return 'review-all-changes';
    if (lowerMessage.includes('@review-pr')) return 'review-pr';
    if (lowerMessage.includes('@sync-review-templates')) return 'sync-review-templates';
    if (lowerMessage.includes('@scan-app')) return 'scan-app';
    if (lowerMessage.includes('@dependency')) return 'dependency';  // ← ADD NEW
    
    return 'general';
}
```
**Purpose**: Route @command messages to appropriate handler

---

### 5. **Add case handler** (chatbot-sidebar.js ~line 2779)
```javascript
switch (participant) {
    case 'review-file':
        // ... existing cases ...
        
    case 'dependency':  // ← ADD NEW CASE
        try {
            console.log('🔍 AIDA Chat: Calling dependency with reusable logic');
            const dependencyModule = require('../dependency.js');
            await dependencyModule.aiDependencyAnalysis(messageWithoutParticipant, mockStream, null, this.context);
            return result || '✅ **Dependency Analysis Complete**\n\nDependency analysis completed.';
        } catch (error) {
            console.error('❌ AIDA Chat dependency error:', error);
            return '❌ **Error**: ' + error.message + '\n\nPlease check the console for details.';
        }
        
    default:
        return '❌ Unknown command';
}
```
**Purpose**: Execute feature logic when command is detected

---

### 6. **Add to help text** (chatbot-sidebar.js ~line 2857 & 2873)

**Vietnamese help text (~line 2857):**
```javascript
- \`@review-file\` - Review file hiện tại
- \`@review-changes\` - Phân tích git changes
- \`@review-all-changes\` - Phân tích TẤT CẢ git changes trong workspace
- \`@review-pr\` - Review pull request  
- \`@sync-review-templates\` - Sync templates
- \`@dependency\` - Phân tích dependency graph  // ← ADD NEW
```

**English help text (~line 2873):**
```javascript
**Special Commands:**
- \`@review-file\` - Review current file
- \`@review-changes\` - Analyze git changes
- \`@dependency\` - Analyze project dependencies  // ← ADD NEW
```
**Purpose**: Document command in welcome/help messages

---

### 7. **Add to autocomplete** (scripts/chatbot/templates/sidebar-script.js ~line 29)
```javascript
const participants = [
    { name: '@review-file', icon: '📁', description: 'Review current opening file or specify file path' },
    { name: '@review-changes', icon: '🔍', description: 'Review changes for current opening file or specify file path' },
    { name: '@review-all-changes', icon: '🔍', description: 'Review ALL git changes in workspace' },
    { name: '@review-pr', icon: '🔄', description: 'Review Pull Request by URL' },
    { name: '@sync-review-templates', icon: '⚙️', description: 'Sync AIDA review templates to workspace' },
    { name: '@scan-app', icon: '🤖', description: 'AI-powered code scanning and duplicate detection' },
    { name: '@dependency', icon: '🕸️', description: 'Analyze project dependency graph' },  // ← ADD NEW
    { name: '/clear', icon: '🗑️', description: 'Clear chat history' }
];
```
**Purpose**: Show command in autocomplete dropdown when user types `@`

---

## Quick Reference Summary

| Location | File | Line | What to Add |
|----------|------|------|-------------|
| 1. Export | `scripts/[feature].js` | Bottom | `aiFeatureName` function in module.exports |
| 2. Review Command | `chatbot-sidebar.js` | ~387 | Add to `isReviewCommand` array |
| 3. Review Mode | `chatbot-sidebar.js` | ~723 | Add to `isReviewMode` array |
| 4. Detection | `chatbot-sidebar.js` | ~790 | Add `if` condition in `determineParticipant()` |
| 5. Handler | `chatbot-sidebar.js` | ~2779 | Add `case` in switch statement |
| 6. Help Text | `chatbot-sidebar.js` | ~2857, ~2873 | Add to Vietnamese & English help |
| 7. Autocomplete | `sidebar-script.js` | ~29 | Add to `participants` array |

---

## Example: Adding @dependency Command

### Step 1: Export function in dependency.js
```javascript
async function aiDependencyAnalysis(message, stream, token, context) {
    // Reusable logic
}

module.exports = {
    initializeDependencyGraph,  // Copilot
    aiDependencyAnalysis        // AIDA
};
```

### Step 2-6: Update chatbot-sidebar.js
```javascript
// Line 387
const isReviewCommand = [..., 'dependency'].includes(participantType);

// Line 723
const isReviewMode = [..., 'dependency'].includes(participant);

// Line 790
if (lowerMessage.includes('@dependency')) return 'dependency';

// Line 2779
case 'dependency':
    const dependencyModule = require('../dependency.js');
    await dependencyModule.aiDependencyAnalysis(...);
    break;

// Line 2857, 2873
- `@dependency` - Phân tích dependency graph
```

### Step 7: Update sidebar-script.js
```javascript
// Line 29
{ name: '@dependency', icon: '🕸️', description: 'Analyze project dependency graph' }
```

---

## Testing Checklist
- [ ] Feature works in GitHub Copilot Chat (`@feature-name`)
- [ ] Feature works in AIDA Chatbot sidebar (`@feature-name`)
- [ ] Autocomplete shows command when typing `@`
- [ ] Help text displays command in both languages
- [ ] Error handling works properly
- [ ] No console errors

---

## Common Patterns

### Pattern 1: Simple Command (No user input)
```javascript
case 'sync-review-templates':
    const syncModule = require('../sync-review-templates.js');
    await syncModule.aiSyncReviewTemplates(messageWithoutParticipant, mockStream, null, this.context);
    break;
```

### Pattern 2: Command with User Input
```javascript
case 'review-file':
    const reviewFileModule = require('../review-file.js');
    // messageWithoutParticipant contains user's additional input
    await reviewFileModule.aiReviewFile(messageWithoutParticipant, mockStream, null, this.context);
    break;
```

### Pattern 3: Background Processing
```javascript
case 'dependency':
    stream.markdown('✅ **Analysis started in background**\n\n');
    // Don't await - let it run in background
    performDependencyAnalysisInBackground(workspaceRoot);
    break;
```

---

## Notes
- Always follow the same pattern as existing commands
- Test both Copilot Chat and AIDA Chatbot
- Keep icon choices consistent with feature purpose
- Use clear, concise descriptions for autocomplete
- Handle errors gracefully with user-friendly messages

---

**Last Updated**: December 5, 2025  
**Maintained By**: AIDA Team
