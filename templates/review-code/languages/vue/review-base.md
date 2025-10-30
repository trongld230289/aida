<!-- AIDA - Vue Review Base Template -->
<!-- PLACEHOLDER: {{REVIEW_BASE}} -->

## 🔥 MANDATORY PROJECT RULES - MUST CHECK FIRST:
<!-- ADD PROJECT-SPECIFIC RULES HERE - These will be checked alongside Angular rules -->
<!-- Additional project rules can be added here:
- **🚫 CRITICAL**: Never use `isSuccess` as variable name - reserved for business logic
-->

### 🚨 REACTIVITY VIOLATIONS:
- Mutating props directly in child components
- Missing reactive/ref wrappers for reactive data
- Losing reactivity when destructuring reactive objects
- Using wrong reactivity API (ref vs reactive) inappropriately
- Side effects in computed properties
- Accessing reactive data before it's initialized
- Breaking reactivity with Object.assign or spread operator
- Not using readonly() for read-only reactive state
- Reactivity lost when passing to functions
- toRefs not used when destructuring reactive objects

### 🚨 COMPOSITION API VIOLATIONS:
- Setup function returning non-reactive objects
- Not using proper lifecycle hooks in Composition API
- Missing dependency arrays in watch/watchEffect
- Side effects in setup without proper cleanup
- Reactive state not properly exposed in setup return
- Using Options API patterns in Composition API
- Memory leaks from uncleaned event listeners
- Computed properties with side effects
- Watch functions not cleaning up properly
- Composables not properly reusable

### 🚨 COMPONENT DESIGN VIOLATIONS:
- Components with too many responsibilities
- Props not properly validated with types
- Missing default values for optional props
- Event names not following kebab-case convention
- Emitting events without proper payload validation
- Component communication through global state instead of props/events
- Template refs not properly typed
- Slot usage without proper fallback content
- Component names not following PascalCase convention
- Components not properly scoped or isolated

### 🚨 TEMPLATE VIOLATIONS:
- v-html used with user-generated content (XSS risk)
- Missing key attributes in v-for loops
- v-for and v-if used on same element
- Template expressions with complex logic
- Event handlers with inline complex logic
- Missing event modifiers where appropriate
- Improper use of v-show vs v-if
- Template refs conflicting with component data
- Accessibility attributes missing (a11y violations)
- Form inputs without proper labels or validation

### 🚨 STATE MANAGEMENT VIOLATIONS:
- Direct mutation of Vuex/Pinia store state
- Store actions not handling errors properly
- Store modules not properly namespaced
- State shape not normalized for complex data
- Missing state persistence for critical data
- Store actions with side effects not properly isolated
- Getters with expensive computations not cached
- Store state not properly typed
- State mutations not following immutability principles
- Store composition not following single responsibility

### 🚨 PERFORMANCE VIOLATIONS:
- Missing v-memo for expensive list rendering
- Components not using defineAsyncComponent for code splitting
- Watchers without proper deep watching configuration
- Computed properties recalculating unnecessarily
- Event listeners not properly cleaned up
- Large components not split into smaller ones
- Missing keep-alive for frequently toggled components
- Bundle size not optimized with tree shaking
- Images not properly optimized or lazy loaded
- Network requests not properly cached or debounced

### 🚨 ROUTING VIOLATIONS:
- Route guards not handling all navigation scenarios
- Missing error handling in route components
- Route parameters not properly validated
- Navigation not handling loading states
- Back button navigation breaking application state
- Route meta fields not properly utilized
- Dynamic imports not properly handled
- Route transitions without proper cleanup
- Hash vs history mode not chosen appropriately
- Nested routes not properly configured

### 🚨 LIFECYCLE VIOLATIONS:
- Side effects in wrong lifecycle hooks
- Async operations not properly cancelled on unmount
- Event listeners added without cleanup
- Timers or intervals not cleared on component destroy
- Memory leaks from retained references
- Third-party integrations not properly cleaned up
- DOM manipulations in wrong lifecycle phases
- API calls not cancelled when component unmounts
- Watchers not stopped when no longer needed
- Computed properties not properly garbage collected