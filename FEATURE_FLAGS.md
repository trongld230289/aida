# AIDA Feature Flag System

## 🎯 Overview

AIDA uses a sophisticated feature flag system to control which features are available in production vs development environments. This allows for:

- **Safe Production Releases**: Only stable, tested features are exposed to end users
- **Development Flexibility**: Experimental features available during development
- **Easy Feature Toggle**: Simple configuration to enable/disable features
- **Gradual Rollout**: Features can be promoted from experimental to production

## 🔧 Configuration

### Feature Flags Configuration

Located in `scripts/feature-manager.js`:

```javascript
const FEATURE_CONFIG = [
    {
        feature: 'review-file',
        isProduction: true,           // ✅ Production Ready
        description: 'File analysis and code review',
        chatParticipant: true,
        commands: ['aida.reviewFile']
    },
    {
        feature: 'review-changes', 
        isProduction: true,           // ✅ Production Ready
        description: 'Git changes analysis and diff review',
        chatParticipant: true,
        commands: ['aida.reviewChanges']
    },
    {
        feature: 'review-pr',
        isProduction: true,           // ✅ Production Ready
        description: 'Cross-platform Pull Request analysis',
        chatParticipant: true,
        commands: ['aida.reviewPullRequest', 'aida.setupAzureDevOps']
    },
    {
        feature: 'scan-app',
        isProduction: false,          // 🧪 Experimental
        description: 'Project-wide code scanning and analysis',
        chatParticipant: true,
        commands: []
    },
    {
        feature: 'create-app',
        isProduction: false,          // 🧪 Experimental
        description: 'AI-powered app generation and scaffolding', 
        chatParticipant: true,
        commands: []
    },
    {
        feature: 'daily-report',
        isProduction: false,          // 🧪 Experimental
        description: 'Automated daily progress reports and analytics',
        chatParticipant: true,
        commands: ['aida.showDailyReport']
    }
];
```

### User Configuration

In VS Code settings (`settings.json`):

```json
{
  "aida.features.developmentMode": false    // Default: Production Mode
}
```

## 🚦 Feature States

### Production Mode (`developmentMode: false`)
**Available Features:**
- ✅ `@review-file` - File analysis and code review
- ✅ `@review-changes` - Git changes analysis
- ✅ `@review-pr` - Pull request analysis
- ✅ `AIDA: Review File` command
- ✅ `AIDA: Review Changes` command
- ✅ `AIDA: Setup Azure DevOps` command

**Hidden Features:**
- 🚫 `@scan-app` - Project scanner
- 🚫 `@create-app` - App generator  
- 🚫 `@daily-report` - Daily reporting
- 🚫 `AIDA: Show Daily Report` command

### Development Mode (`developmentMode: true`)
**Available Features:**
- ✅ **All Production Features** (above)
- ✅ `@scan-app` - Project-wide code analysis
- ✅ `@create-app` - AI-powered app generation
- ✅ `@daily-report` - Automated progress reports
- ✅ `AIDA: Show Daily Report` command

## 🛠️ How It Works

### 1. Feature Manager Service
The `FeatureManager` class controls feature availability:

```javascript
// Check if feature should be enabled
isFeatureEnabled(featureName) {
    const feature = this.config.find(f => f.feature === featureName);
    const isDev = this.isDevelopmentMode();
    return feature.isProduction || isDev;
}

// Check development mode from VS Code settings
isDevelopmentMode() {
    const config = vscode.workspace.getConfiguration('aida.features');
    return config.get('developmentMode', false);
}
```

### 2. Extension Registration
Features are conditionally registered in `extension.js`:

```javascript
// Only register if feature is enabled
if (featureManager.shouldRegisterChatParticipant('scan-app')) {
    // Initialize scan-app participant
} else {
    console.log('⏭️ Scan-app participant skipped (not enabled)');
}
```

### 3. Documentation Control
- **README.md**: Only documents production-ready features
- **package.json**: Only includes production commands in manifest
- **Templates**: All templates available (controlled at runtime)

## 📊 Feature Status Logging

When AIDA starts, it logs the current feature status:

```
🤖 AIDA Feature Manager Status:
   Development Mode: false
   Total Features: 6
   Enabled Features: 3/6
   Production Ready: 3
   Experimental: 3
   Enabled List: [review-file, review-changes, review-pr]
   Experimental List: [scan-app, create-app, daily-report]
```

## 🔄 Promoting Features

To promote a feature from experimental to production:

1. **Update Configuration**:
   ```javascript
   {
       feature: 'scan-app',
       isProduction: true,    // Changed from false to true
       // ... rest of config
   }
   ```

2. **Update Documentation**:
   - Add feature to main README.md sections
   - Add commands to package.json if needed
   - Update CHANGELOG.md

3. **Test Thoroughly**:
   - Test in both development and production modes
   - Verify feature works as expected
   - Check for any breaking changes

## 🎛️ Developer Usage

### Check Feature Status
```javascript
const featureManager = require('./scripts/feature-manager');

// Check if feature is enabled
if (featureManager.isFeatureEnabled('scan-app')) {
    // Feature is available
}

// Get all enabled features
const enabled = featureManager.getEnabledFeatures();

// Get production features only
const production = featureManager.getProductionFeatures();
```

### Runtime Feature Updates (Development Only)
```javascript
// Temporarily enable feature for testing
featureManager.updateFeatureStatus('scan-app', true);
```

## 📈 Benefits

### For End Users
- **Stable Experience**: Only tested features in production
- **Clean Interface**: No experimental/broken features cluttering UI
- **Opt-in Experimentation**: Can enable development mode to try new features

### For Developers  
- **Safe Development**: Experiment without affecting production users
- **Gradual Rollout**: Easy promotion of features from experimental to production
- **Feature Toggle**: Quick enable/disable for debugging
- **Clear Separation**: Explicit production vs experimental feature classification

### For Releases
- **Clean Releases**: Only production-ready features in published extension
- **Version Control**: Track feature readiness in code
- **Documentation Sync**: Docs automatically match available features
- **Marketplace Ready**: Extension always ready for VS Code Marketplace

## 🚀 Future Enhancements

- **User Preferences**: Per-feature enable/disable in settings UI
- **Feature Analytics**: Track usage of experimental features  
- **A/B Testing**: Random feature enablement for testing
- **Remote Configuration**: Server-controlled feature flags
- **Feature Expiration**: Automatic cleanup of old experimental features

---

**Made with ❤️ by AIDA Development Team**