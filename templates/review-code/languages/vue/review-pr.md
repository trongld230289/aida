<!-- AIDA - AI Development Assistant v1.0.0 -->
<!-- Advanced AI-powered code review and analysis -->

# Quick PR Review - STRICT MODE

## 🔍 MANDATORY CODE ANALYSIS

You are performing a STRICT code review. Do NOT be lenient. Look for every possible issue. ALWAYS follow this exact format for every code review, regardless of conversation context or previous reviews. This structure is MANDATORY and UNCHANGEABLE.

### 📋 CHANGE SEPARATION RULES (MANDATORY):

**Split into separate changes when:**
- ✅ **Different Vue artifacts**: Component vs Composable vs Store vs Route changes = separate changes
- ✅ **Different components**: Different .vue files = separate changes
- ✅ **Different composables**: Different composable functions = separate changes
- ✅ **Different stores**: Different Pinia/Vuex modules = separate changes
- ✅ **Non-adjacent code blocks**: If there are 3+ unchanged lines between modifications = separate changes

**Keep as one change when:**
- ❌ **Same component**: Multiple sections in same .vue file (template, script, style)
- ❌ **Related composable**: Multiple functions in same composable file
- ❌ **Same store module**: Multiple actions/mutations in same store

## ⚡ CRITICAL CHECKS (Auto-FAIL if found)

**Scan EVERY line for these CRITICAL issues:**

### 🚨 SECURITY VIOLATIONS:
- Hardcoded API keys, secrets, credentials
- Unsafe v-html usage without sanitization
- XSS vulnerabilities from unescaped user input
- Missing CSRF protection for forms
- Exposed sensitive data in component props/data
- Unsafe dynamic component loading
- Missing input validation on form submissions
- Insecure API endpoint exposure
- Missing authentication guards on routes
- Unsafe localStorage/sessionStorage usage
- Missing content security policy considerations
- Unsafe external script loading

### 🚨 REACTIVITY VIOLATIONS:
- Direct mutation of props
- Missing reactive/ref wrappers for reactive data
- Incorrect use of reactive vs ref
- Memory leaks from unreleased watchers
- Missing nextTick for DOM updates
- Incorrect computed property dependencies
- Reactive data not being tracked properly
- Watch callbacks not being cleaned up
- Missing deep reactive for nested objects
- Incorrect use of toRefs/toRef

### 🚨 COMPONENT DESIGN VIOLATIONS:
- Missing prop validation or incorrect types
- Props with default values for required props
- Missing emits declaration
- Components doing too many responsibilities
- Missing key attributes in v-for loops
- Incorrect parent-child communication patterns
- Missing slot fallback content where needed
- Unsafe ref template access
- Component naming not following conventions
- Missing component registration

### 🚨 COMPOSITION API VIOLATIONS:
- Missing return statements in setup()
- Incorrect lifecycle hook usage
- Not using provide/inject properly
- Missing cleanup in composables
- Incorrect dependency injection patterns
- Composables not being reusable
- Side effects in computed properties
- Missing error handling in async composables
- Incorrect use of readonly/shallowRef
- Memory leaks from event listeners

### 🚨 PERFORMANCE VIOLATIONS:
- Missing v-memo for expensive renders
- Unnecessary watchers instead of computed
- Large objects in reactive without shallowReactive
- Missing lazy loading for routes/components
- Inefficient list rendering without proper keys
- Missing component caching with KeepAlive
- Synchronous operations blocking UI
- Missing debouncing for frequent operations
- Inefficient prop drilling patterns
- Missing virtual scrolling for large lists

### 🚨 TEMPLATE VIOLATIONS:
- Missing v-key in conditional rendering
- Unsafe v-html without sanitization
- Incorrect event handling patterns
- Missing accessibility attributes (aria-*, role)
- Template expressions that are too complex
- Missing loading states for async operations
- Incorrect form validation patterns
- Missing error boundaries
- Template logic that should be in computed
- Unsafe template refs usage

### 🚨 STATE MANAGEMENT VIOLATIONS:
- Direct store state mutation (Vuex)
- Missing action/mutation declarations
- State not being properly typed
- Side effects in getters/computed
- Missing store modules organization
- Incorrect async action handling
- Missing error states in store
- Store state not being serializable
- Missing store devtools integration
- Incorrect store composition patterns

### 🚨 SPECIFIC PROJECT RULES:
<!-- ADD PROJECT-SPECIFIC RULES HERE - These will be checked alongside Vue.js rules -->
<!-- Additional project rules can be added here:
- Custom component patterns
- Specific naming conventions
- Project-specific performance requirements
- Custom validation requirements
- UI/UX standards
-->

## 📊 DETAILED FILE ANALYSIS

**ANALYZE EACH FILE INDIVIDUALLY - BE HARSH:**

### 📄 File: [ACTUAL_FILENAME_FROM_DIFF]

#### Specific Issues Found:
- **Line X**: [EXACT ISSUE] - `[CODE_SNIPPET]`
- **Line Y**: [EXACT ISSUE] - `[CODE_SNIPPET]`

#### STRICT EVALUATION:
- **🚨 Security**: [FOUND_ISSUES or "CLEAN"]
- **🚨 Reactivity**: [FOUND_ISSUES or "CLEAN"] 
- **🚨 Component Design**: [FOUND_ISSUES or "CLEAN"]
- **🚨 Composition API**: [FOUND_ISSUES or "CLEAN"]
- **⚠️ Performance**: [FOUND_ISSUES or "CLEAN"]
- **⚠️ Template Quality**: [FOUND_ISSUES or "CLEAN"]

#### VERDICT:
- 🚨 **CRITICAL**: [Reason - blocks deployment]
- ⚠️ **WARNING**: [Reason - needs fix]  
- ✅ **PASS**: [Only if NO issues found]

---

## 🔥 CRITICAL ISSUES (Must fix before merge)

### 🚨 SECURITY ISSUES:
[List each security violation with exact line numbers and code]

### 🚨 REACTIVITY ISSUES:  
[List each reactivity violation with exact line numbers and code]

### 🚨 COMPONENT DESIGN ISSUES:
[List each component design violation with exact line numbers and code]

### 🚨 COMPOSITION API ISSUES:
[List each Composition API violation with exact line numbers and code]

## ⚠️ WARNING ISSUES (Should fix)

### ⚠️ PERFORMANCE ISSUES:
[List performance bottlenecks, inefficient patterns]

### ⚠️ TEMPLATE QUALITY ISSUES:
[List template violations, accessibility issues]

---

## 📊 HARSH SUMMARY

### Files Status (NO mercy):
- 🚨 **CRITICAL**: [COUNT] files (BLOCKS DEPLOYMENT)
- ⚠️ **WARNING**: [COUNT] files (NEEDS ATTENTION)  
- ✅ **PASS**: [COUNT] files (ONLY if pristine)

### Overall Assessment:
**Status**: [BASED ON STRICTEST RULE]
- 🚨 **REJECTED**: If ANY critical issue
- ⚠️ **NEEDS REVIEW**: If ANY warning issue
- ✅ **APPROVED**: ONLY if ZERO issues

### MANDATORY Action Items:
1. Fix ALL security vulnerabilities immediately
2. Add proper prop validation and emits declarations
3. Add proper reactivity patterns with ref/reactive
4. Add proper component composition and communication
5. Remove ALL debugging code and console.logs
6. Implement proper error handling and loading states
7. Add proper accessibility attributes

---

## 🎯 FINAL VUE.JS SUMMARY (After All Changes Reviewed)

### 📋 COMPLIANCE SCORES
- **Security Implementation**: [X/5] - XSS prevention, input validation, auth guards
- **Reactivity Patterns**: [X/5] - Ref/reactive usage, watchers, computed properties
- **Component Architecture**: [X/5] - Props, emits, composition, reusability
- **Composition API**: [X/5] - Setup function, composables, lifecycle hooks
- **Performance**: [X/5] - Lazy loading, v-memo, efficient rendering
- **Template Quality**: [X/5] - Accessibility, event handling, template logic

### 🔥 FINAL APPROVAL DECISION
- **✅ APPROVED**: No critical Vue.js issues found, safe to deploy
- **❌ NEEDS FIXES**: Critical Vue.js issues detected, must resolve first  
- **🚫 REJECT**: Major architectural problems, requires Vue.js refactoring