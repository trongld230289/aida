# AIDA Development Guide

## Production vs Development Features

### Current Architecture (Simplified)

AIDA uses a simple approach for feature management:

- **Production Features**: Always available in `package.json`
- **Experimental Features**: Commented out in `package.json`

### Production Chat Participants (Always Available)

```json
"chatParticipants": [
  {
    "id": "review-file",
    "name": "review-file", 
    "description": "📄 Review current opening file or 🔗 specify file path"
  },
  {
    "id": "review-changes",
    "name": "review-changes",
    "description": "🔄 Review changes for current opening file or 🔗 specify file path"
  },
  {
    "id": "review-pr", 
    "name": "review-pr",
    "description": "🔍 Review Azure DevOps Pull Request by PR ID or URL"
  }
]
```

### Experimental Features (Development Only)

To enable experimental features during development, uncomment these in `package.json`:

```json
// Add these to chatParticipants array:
{
  "id": "scan-app",
  "name": "scan-app",
  "description": "🤖 AI-powered code scanning and duplicate detection with GPT-5",
  "isSticky": true
},
{
  "id": "create-app", 
  "name": "create-app",
  "description": "Generate React apps from wireframes",
  "isSticky": true
},
{
  "id": "daily-report",
  "name": "daily-report", 
  "description": "📊 Generate and view daily project report",
  "isSticky": true
}
```

### Development Workflow

1. **Production Mode** (Default):
   - Only `@review-file`, `@review-changes`, `@review-pr` visible
   - Stable, production-ready features only

2. **Development Mode**:
   - Uncomment experimental features in `package.json`
   - Restart VS Code Extension Development Host (F5)
   - All features available for testing

3. **Release Preparation**:
   - Comment out experimental features
   - Test only production features
   - Update version in `package.json`

### Note

This simplified approach eliminates the need for:
- ❌ `feature-manager.js` 
- ❌ Conditional registration logic
- ❌ Runtime feature flags

Just comment/uncomment in `package.json` as needed! 🎯