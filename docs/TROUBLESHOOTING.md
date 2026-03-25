# 🛠️ AIDA Troubleshooting Guide

**Complete troubleshooting guide for AIDA - AI Development Assistant**

Quick solutions to common issues and problems you might encounter while using AIDA.

## 📖 Table of Contents

- [Quick Diagnostics](#-quick-diagnostics)
- [Installation Issues](#-installation-issues)
- [Chat Interface Problems](#-chat-interface-problems)
- [AI Provider Issues](#-ai-provider-issues)
- [Template Problems](#-template-problems)
- [Pull Request Analysis Issues](#-pull-request-analysis-issues)
- [Performance Problems](#-performance-problems)
- [Configuration Issues](#-configuration-issues)
- [Extension Conflicts](#-extension-conflicts)
- [Debug Mode](#-debug-mode)
- [Common Error Messages](#-common-error-messages)
- [Getting Help](#-getting-help)

## 🔍 Quick Diagnostics

### First Steps Checklist
When experiencing issues, try these steps first:

1. **Restart VS Code** - Resolves most temporary issues
2. **Check Settings** - Verify AIDA configuration (`Ctrl+,` → "AIDA")
3. **Test Internet** - Ensure stable internet connection
4. **Check Output** - View VS Code Output panel → AIDA
5. **Update Extension** - Ensure latest AIDA version

### Health Check Command
```
@review-file
```
If this works, AIDA is functioning correctly.

### Quick Status Check
- ✅ **Chat Opens**: AIDA chat interface loads
- ✅ **Commands Work**: @review-file responds
- ✅ **AI Provider**: Configured and responding
- ✅ **Templates**: Templates sync successfully

## 📦 Installation Issues

### Extension Won't Install

#### Problem: "Extension installation failed"
**Causes:**
- VS Code permissions
- Network connectivity
- Marketplace issues

**Solutions:**
1. **Run VS Code as Administrator** (Windows)
   ```bash
   # Right-click VS Code → "Run as administrator"
   ```

2. **Clear Extension Cache**
   ```bash
   # Close VS Code
   # Delete: %USERPROFILE%/.vscode/extensions/trongld232.aida-dev-*
   # Restart VS Code and reinstall
   ```

3. **Manual Installation**
   ```bash
   code --install-extension aida-dev-1.1.14.vsix
   ```

4. **Network Issues**
   - Check firewall settings
   - Try different network
   - Use corporate proxy settings

### Extension Won't Activate

#### Problem: AIDA doesn't appear after installation
**Solutions:**
1. **Reload Window**: `Ctrl+Shift+P` → "Developer: Reload Window"
2. **Check Extension List**: Ensure AIDA is enabled
3. **Check Logs**: VS Code Output → AIDA for errors
4. **Restart VS Code**: Complete restart

### Version Conflicts

#### Problem: "Extension activation failed"
**Solutions:**
1. **Update VS Code**: Ensure VS Code 1.90+
2. **Clean Install**:
   - Uninstall AIDA
   - Restart VS Code
   - Reinstall latest version

## 💬 Chat Interface Problems

### Chat Won't Open

#### Problem: AIDA chat doesn't open
**Symptoms:**
- No chat panel appears
- Activity bar icon missing
- Keyboard shortcut doesn't work

**Solutions:**
1. **Check Activity Bar**
   - Look for AIDA icon (💬)
   - Right-click activity bar → ensure AIDA visible

2. **Use Command Palette**
   ```
   Ctrl+Shift+P → "AIDA: Open AIDA Chat"
   ```

3. **Reset Chat View**
   ```
   Ctrl+Shift+P → "View: Reset View Locations"
   ```

4. **Check Configuration**
   ```json
   {
     "aida.hasNoGithubCopilot": true // If no Copilot
   }
   ```

### Chat Interface Blank

#### Problem: Chat panel opens but shows blank screen
**Solutions:**
1. **Refresh Chat**
   - Click refresh button in chat panel
   - Or restart VS Code

2. **Check WebView**
   ```
   Ctrl+Shift+P → "Developer: Open Webview Developer Tools"
   ```

3. **Clear Cache**
   - Close VS Code
   - Clear browser cache if using external browser

### Commands Not Working

#### Problem: @review-file doesn't respond
**Symptoms:**
- No response to chat commands
- "Command not found" errors
- Infinite loading

**Solutions:**
1. **Check AI Configuration**
   ```json
   {
     "aida.ai.apiKey": "your-key-here",
     "aida.ai.apiHost": "https://api.openai.com/v1/chat/completions"
   }
   ```

2. **Test API Key**
   - Verify key is valid
   - Check key permissions
   - Test with direct API call

3. **Network Issues**
   - Check firewall settings
   - Verify proxy configuration
   - Test internet connectivity

## 🤖 AI Provider Issues

### OpenAI API Problems

#### Problem: "Invalid API key" error
**Solutions:**
1. **Verify Key Format**
   - OpenAI keys start with `sk-`
   - No extra spaces or characters
   - Key is active and has credits

2. **Test Key Manually**
   ```bash
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer YOUR_API_KEY"
   ```

3. **Check Permissions**
   - Ensure key has chat completion access
   - Verify rate limits not exceeded

#### Problem: "Rate limit exceeded"
**Solutions:**
1. **Wait and Retry** - Rate limits reset over time
2. **Upgrade Plan** - Higher tier plans have better limits
3. **Reduce Usage** - Use smaller token limits

### Claude API Problems

#### Problem: Claude API not responding
**Solutions:**
1. **Verify Endpoint**
   ```json
   {
     "aida.ai.apiHost": "https://api.anthropic.com/v1/messages"
   }
   ```

2. **Check Model Name**
   ```json
   {
     "aida.ai.model": "claude-3-sonnet-20240229"
   }
   ```

3. **API Key Format**
   - Claude keys start with `sk-ant-`
   - Verify key is active

### GitHub Copilot Issues

#### Problem: Copilot integration not working
**Solutions:**
1. **Check Copilot Status**
   - Ensure Copilot is active
   - Verify subscription is valid

2. **Configuration**
   ```json
   {
     "aida.useApiKeyInsteadOfCopilot": false
   }
   ```

3. **Restart Extension Host**
   ```
   Ctrl+Shift+P → "Developer: Restart Extension Host"
   ```

## 📝 Template Problems

### Templates Won't Sync

#### Problem: @sync-review-templates fails
**Symptoms:**
- "Failed to sync templates" error
- No AIDA folder created
- Permission errors

**Solutions:**
1. **Check Workspace Permissions**
   - Ensure write access to workspace
   - Run VS Code as administrator if needed

2. **Manual Template Creation**
   ```bash
   mkdir -p AIDA/templates/review-code/fallback
   mkdir -p AIDA/templates/review-code/languages
   ```

3. **Network Issues**
   - Check internet connection
   - Verify proxy settings
   - Try again later

### Templates Not Found

#### Problem: "No template found for language"
**Solutions:**
1. **Sync Templates First**
   ```
   @sync-review-templates
   ```

2. **Check Template Path**
   ```json
   {
     "aida.review.templatePath": "AIDA/templates/review-code"
   }
   ```

3. **Verify Folder Structure**
   ```
   AIDA/
   └── templates/
       └── review-code/
           ├── languages/
           └── fallback/
   ```

### Custom Templates Not Working

#### Problem: Custom templates ignored
**Solutions:**
1. **Check File Names**
   - Must be: `review-base.md`, `review-file.md`, etc.
   - Case sensitive

2. **Verify Template Syntax**
   - Valid Markdown format
   - Proper template variables

3. **Reload Templates**
   - Restart VS Code
   - Re-sync templates

## 🔍 Pull Request Analysis Issues

### GitHub Integration Problems

#### Problem: Cannot analyze GitHub PRs
**Solutions:**
1. **Check Personal Access Token**
   ```json
   {
     "aida.github.personalAccessToken": "ghp_your_token_here"
   }
   ```

2. **Verify Token Permissions**
   - `repo` scope for private repos
   - `public_repo` for public repos

3. **Test Token**
   ```bash
   curl -H "Authorization: token YOUR_TOKEN" \
        https://api.github.com/user
   ```

### GitLab Integration Problems

#### Problem: GitLab MRs won't analyze
**Solutions:**
1. **Check Token Format**
   ```json
   {
     "aida.gitlab.personalAccessToken": "glpat-your_token"
   }
   ```

2. **Verify Permissions**
   - `read_api` or `api` scope
   - Access to target repository

### Azure DevOps Problems

#### Problem: Azure DevOps PRs fail
**Solutions:**
1. **Complete Configuration**
   ```json
   {
     "aida.azureDevOps.personalAccessToken": "your_token",
     "aida.azureDevOps.organization": "your_org",
     "aida.azureDevOps.defaultProject": "your_project"
   }
   ```

2. **Check Permissions**
   - `Code (read)` permission
   - `Pull Request (read)` permission

## ⚡ Performance Problems

### Slow Response Times

#### Problem: AIDA takes too long to respond
**Solutions:**
1. **Reduce Token Limits**
   ```json
   {
     "aida.ai.maxTokens": 2048
   }
   ```

2. **Increase Timeout**
   ```json
   {
     "aida.ai.timeout": 60000
   }
   ```

3. **Use Faster Models**
   - OpenAI: `gpt-3.5-turbo` instead of `gpt-4`
   - Claude: `claude-3-haiku` instead of `claude-3-sonnet`

### Memory Issues

#### Problem: VS Code becomes slow/crashes
**Solutions:**
1. **Restart VS Code** regularly
2. **Clear Chat History** periodically
3. **Reduce File Size** being analyzed
4. **Close Unused Files** before analysis

### Network Timeouts

#### Problem: Frequent timeout errors
**Solutions:**
1. **Increase Timeout**
   ```json
   {
     "aida.ai.timeout": 90000
   }
   ```

2. **Check Network Stability**
3. **Use Retry Logic** - Try command again

## ⚙️ Configuration Issues

### Settings Not Saving

#### Problem: Configuration changes don't persist
**Solutions:**
1. **Check Settings Scope**
   - User vs Workspace settings
   - Ensure proper scope selected

2. **Restart VS Code** after changes

3. **Manual Settings Edit**
   ```
   Ctrl+Shift+P → "Preferences: Open Settings (JSON)"
   ```

### Invalid Configuration

#### Problem: "Invalid configuration" errors
**Solutions:**
1. **Validate JSON Syntax**
   - Use JSON validator
   - Check for trailing commas

2. **Reset to Defaults**
   ```json
   {
     "aida.ai.apiKey": "",
     "aida.ai.apiHost": "https://api.openai.com/v1/chat/completions",
     "aida.ai.model": "gpt-4o"
   }
   ```

## 🔄 Extension Conflicts

### Copilot Conflicts

#### Problem: Conflicts with GitHub Copilot
**Solutions:**
1. **Disable Copilot Chat** temporarily
2. **Use AIDA Mode**
   ```json
   {
     "aida.useApiKeyInsteadOfCopilot": true
   }
   ```

### Other AI Extension Conflicts

#### Problem: Multiple AI extensions interfering
**Solutions:**
1. **Disable Other AI Extensions** temporarily
2. **Check Keybinding Conflicts**
   ```
   Ctrl+K Ctrl+S → Search for conflicts
   ```

## 🐛 Debug Mode

### Enable Debug Logging

```json
{
  "aida.debug.enabled": true,
  "aida.debug.logLevel": "debug"
}
```

### View Debug Logs

1. **Open Output Panel**: `Ctrl+Shift+U`
2. **Select AIDA** from dropdown
3. **Review Logs** for errors

### Common Debug Information

```
[DEBUG] AIDA initialized
[INFO] Chat command received: @review-file
[ERROR] API request failed: Invalid key
[DEBUG] Template loaded: typescript/review-file.md
```

## ❗ Common Error Messages

### "Extension activation failed"
**Cause**: Extension startup error
**Solution**: Restart VS Code, check logs

### "API key is required"
**Cause**: Missing AI provider configuration
**Solution**: Configure API key in settings

### "Network request failed"
**Cause**: Internet connectivity issues
**Solution**: Check network, proxy settings

### "Template not found"
**Cause**: Missing or invalid templates
**Solution**: Run `@sync-review-templates`

### "Rate limit exceeded"
**Cause**: API usage limits reached
**Solution**: Wait or upgrade API plan

### "Invalid model name"
**Cause**: Incorrect AI model specification
**Solution**: Use valid model names (gpt-4o, claude-3-sonnet)

### "Workspace not found"
**Cause**: VS Code workspace issues
**Solution**: Open proper workspace folder

### "Permission denied"
**Cause**: File system permission issues
**Solution**: Run VS Code as administrator

## 🆘 Getting Help

### Self-Help Resources

1. **Check Documentation**
   - README.md - Basic setup
   - USER_GUIDE.md - Comprehensive guide
   - TEMPLATES.md - Template customization

2. **Search Issues**
   - GitHub Issues: Common problems and solutions
   - VS Code Output: Error messages and logs

### Community Support

1. **GitHub Issues**
   - Report bugs: Include VS Code version, AIDA version, error logs
   - Feature requests: Describe use case and expected behavior

2. **GitHub Discussions**
   - Ask questions
   - Share tips and tricks
   - Community solutions

### Direct Contact

**Email**: trongld232@gmail.com
- Critical issues
- Security concerns
- Enterprise support

### Bug Report Template

When reporting issues, include:

```
**AIDA Version**: 1.1.14
**VS Code Version**: 1.90.0
**Operating System**: Windows 11 / macOS 14 / Ubuntu 22.04
**AI Provider**: OpenAI / Claude / Copilot

**Problem Description**:
[Describe the issue]

**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Behavior**:
[What should happen]

**Actual Behavior**:
[What actually happens]

**Error Messages**:
[Copy any error messages]

**Configuration**:
```json
{
  "aida.ai.apiKey": "[REDACTED]",
  "aida.ai.model": "gpt-4o"
}
```

**Debug Logs**:
[Include relevant debug logs]
```

### Emergency Recovery

If AIDA completely stops working:

1. **Disable Extension**
   ```
   Ctrl+Shift+X → AIDA → Disable
   ```

2. **Clear All Settings**
   ```json
   // Remove all aida.* settings
   ```

3. **Restart VS Code**

4. **Clean Reinstall**
   - Uninstall AIDA
   - Restart VS Code
   - Reinstall from marketplace

---

**Most issues can be resolved quickly with these solutions! 🛠️✨**

> "When in doubt, restart VS Code and check the debug logs."