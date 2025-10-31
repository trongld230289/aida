# 📝 AIDA Template Guide

**Complete guide to creating and customizing AIDA review templates**

Learn how to create powerful, customized code review templates that match your team's coding standards and project requirements.

## 📖 Table of Contents

- [Overview](#-overview)
- [Template Structure](#-template-structure)
- [Getting Started](#-getting-started)
- [Template Types](#-template-types)
- [Creating Custom Templates](#-creating-custom-templates)
- [Template Variables](#-template-variables)
- [Language-Specific Templates](#-language-specific-templates)
- [Framework Templates](#-framework-templates)
- [Advanced Customization](#-advanced-customization)
- [Best Practices](#-best-practices)
- [Examples](#-examples)

## 🌟 Overview

AIDA templates define how code reviews are structured and what criteria are checked. Templates enable:

- **Consistent Reviews:** Standardized review criteria across your team
- **Framework-Aware Analysis:** Specialized checks for different technologies
- **Customizable Standards:** Adapt to your team's coding conventions
- **Scalable Process:** Maintain quality as your team grows

### Template Benefits
- ✅ **Automated Quality Checks** - Consistent code standards
- 🎯 **Framework-Specific** - Tailored analysis per technology
- 🔧 **Customizable** - Adapt to team requirements
- 📊 **Metrics & Scoring** - Quantifiable code quality
- 🚀 **Team Efficiency** - Faster, more thorough reviews

## 🏗️ Template Structure

### Folder Organization
```
your-project/
├── AIDA/
│   └── templates/
│       └── review-code/
│           ├── languages/          # Language-specific templates
│           │   ├── angular/
│           │   │   ├── review-base.md
│           │   │   ├── review-file.md
│           │   │   ├── review-changes.md
│           │   │   └── review-pr.md
│           │   ├── react/
│           │   ├── typescript/
│           │   ├── python/
│           │   └── ...
│           └── fallback/           # Default templates
│               ├── review-base.md
│               ├── review-file.md
│               ├── review-changes.md
│               └── review-pr.md
```

### Template Files

#### review-base.md
Core review criteria shared across all review types.

#### review-file.md
File-specific analysis template.

#### review-changes.md
Git changes analysis template.

#### review-pr.md
Pull request analysis template.

## 🚀 Getting Started

### 1. Sync Base Templates
```
@sync-review-templates
```
This creates the initial template structure in your project.

### 2. Explore Default Templates
Navigate to `AIDA/templates/review-code/` to see the structure.

### 3. Customize for Your Needs
Edit templates to match your team's requirements.

### 4. Test Your Templates
Use AIDA commands to verify templates work correctly.

## 📋 Template Types

### Language Templates
Located in `languages/{language}/`

**Supported Languages:**
- **angular/** - Angular framework
- **react/** - React framework  
- **vue/** - Vue.js framework
- **typescript/** - TypeScript language
- **javascript/** - JavaScript language
- **python/** - Python language
- **csharp/** - C# language
- **go/** - Go language
- **nodejs/** - Node.js runtime

### Fallback Templates
Located in `fallback/`

Used when no specific language template is found.

## 🛠️ Creating Custom Templates

### Step 1: Create Template Directory
```bash
mkdir -p AIDA/templates/review-code/languages/myframework
```

### Step 2: Create Template Files
```bash
cd AIDA/templates/review-code/languages/myframework
touch review-base.md review-file.md review-changes.md review-pr.md
```

### Step 3: Define Review Criteria
Edit each template file with your review requirements.

### Example: Custom React Template

#### review-file.md
```markdown
# React Component Review - {{FILE_NAME}}

## Component Analysis
- [ ] **Component Type**: Functional vs Class component appropriateness
- [ ] **Props Interface**: TypeScript props properly defined
- [ ] **State Management**: useState/useReducer usage
- [ ] **Side Effects**: useEffect dependencies and cleanup
- [ ] **Performance**: useMemo/useCallback optimization
- [ ] **Testing**: Component testability

## React Best Practices
- [ ] **JSX Standards**: Proper JSX formatting and structure
- [ ] **Event Handling**: Event handler naming and binding
- [ ] **Conditional Rendering**: Clean conditional logic
- [ ] **List Rendering**: Proper key usage
- [ ] **Ref Usage**: useRef and forwardRef patterns
- [ ] **Error Boundaries**: Error handling implementation

## Hooks Review
- [ ] **Custom Hooks**: Reusable logic extraction
- [ ] **Hook Dependencies**: Correct dependency arrays
- [ ] **Hook Rules**: Rules of hooks compliance
- [ ] **Effect Cleanup**: Memory leak prevention

## Accessibility
- [ ] **ARIA Labels**: Screen reader support
- [ ] **Keyboard Navigation**: Tab order and focus
- [ ] **Semantic HTML**: Proper HTML elements
- [ ] **Color Contrast**: Visual accessibility

## Security
- [ ] **XSS Prevention**: Input sanitization
- [ ] **Props Validation**: Input validation
- [ ] **Dangerous HTML**: dangerouslySetInnerHTML usage

## Performance
- [ ] **Bundle Size**: Component size impact
- [ ] **Render Optimization**: Unnecessary re-renders
- [ ] **Lazy Loading**: Code splitting opportunities
- [ ] **Image Optimization**: Image loading strategies

## Code Quality Score
**Overall Rating**: ⭐⭐⭐⭐⭐ (Rate 1-5 stars)

**Critical Issues**: 0
**Warnings**: 0
**Suggestions**: 0

## Recommendations
1. [Specific improvement suggestions]
2. [Performance optimization opportunities]
3. [Security enhancements]
```

## 🔧 Template Variables

### Available Variables
```markdown
{{FILE_NAME}}        # Current file name
{{FILE_PATH}}        # Full file path
{{FILE_EXTENSION}}   # File extension (.ts, .js, etc.)
{{PROJECT_NAME}}     # Project name from package.json
{{LANGUAGE}}         # Detected language
{{FRAMEWORK}}        # Detected framework
{{DATE}}             # Current date
{{TIME}}             # Current time
{{REVIEWER}}         # AIDA version/model
```

### Usage Examples
```markdown
# Review for {{FILE_NAME}}
**Project**: {{PROJECT_NAME}}
**Language**: {{LANGUAGE}}
**Framework**: {{FRAMEWORK}}
**Date**: {{DATE}}

## Analysis for {{FILE_PATH}}
This {{LANGUAGE}} file uses {{FRAMEWORK}} patterns.
```

## 🎯 Language-Specific Templates

### TypeScript Template
```markdown
# TypeScript Code Review - {{FILE_NAME}}

## Type Safety
- [ ] **Strict Types**: No `any` types without justification
- [ ] **Interface Design**: Well-defined interfaces
- [ ] **Generic Usage**: Appropriate generic constraints
- [ ] **Type Guards**: Runtime type checking
- [ ] **Utility Types**: Proper utility type usage

## Modern TypeScript
- [ ] **ES6+ Features**: Modern syntax usage
- [ ] **Async/Await**: Promise handling
- [ ] **Decorators**: Decorator patterns (if applicable)
- [ ] **Modules**: Import/export statements

## Code Quality
- [ ] **Naming**: Clear, descriptive names
- [ ] **Functions**: Single responsibility
- [ ] **Classes**: SOLID principles
- [ ] **Error Handling**: Proper error management
```

### Python Template
```markdown
# Python Code Review - {{FILE_NAME}}

## PEP 8 Compliance
- [ ] **Naming**: snake_case conventions
- [ ] **Imports**: Import organization
- [ ] **Line Length**: 79 character limit
- [ ] **Whitespace**: Proper spacing

## Python Best Practices
- [ ] **Type Hints**: Function annotations
- [ ] **Docstrings**: Documentation strings
- [ ] **List Comprehensions**: Pythonic constructs
- [ ] **Context Managers**: Resource management

## Error Handling
- [ ] **Exceptions**: Specific exception types
- [ ] **Try/Except**: Proper exception handling
- [ ] **Logging**: Appropriate logging usage
```

## 🚀 Framework Templates

### Angular Template
```markdown
# Angular Component Review - {{FILE_NAME}}

## Component Architecture
- [ ] **Component Structure**: Single responsibility
- [ ] **Lifecycle Hooks**: Proper hook usage
- [ ] **Data Binding**: Appropriate binding types
- [ ] **Dependency Injection**: Service injection

## Angular Best Practices
- [ ] **OnPush Strategy**: Change detection optimization
- [ ] **Reactive Forms**: Form handling
- [ ] **RxJS Patterns**: Observable usage
- [ ] **Lazy Loading**: Route optimization

## Performance
- [ ] **TrackBy Functions**: NgFor optimization
- [ ] **Async Pipe**: Memory leak prevention
- [ ] **OnDestroy**: Subscription cleanup
```

### Vue.js Template
```markdown
# Vue.js Component Review - {{FILE_NAME}}

## Composition API
- [ ] **Setup Function**: Composition API usage
- [ ] **Reactive References**: ref() and reactive()
- [ ] **Computed Properties**: Cached computations
- [ ] **Watchers**: Effect tracking

## Vue Best Practices
- [ ] **Single File Components**: SFC structure
- [ ] **Props Validation**: Prop definitions
- [ ] **Event Handling**: Custom events
- [ ] **Slot Usage**: Content projection

## Performance
- [ ] **V-Show vs V-If**: Conditional rendering
- [ ] **Key Attributes**: List rendering
- [ ] **Lazy Loading**: Component loading
```

## 🔧 Advanced Customization

### Custom Review Categories

#### Security-Focused Template
```markdown
## Security Checklist
- [ ] **Input Validation**: All inputs validated
- [ ] **Output Encoding**: XSS prevention
- [ ] **Authentication**: Secure auth implementation
- [ ] **Authorization**: Proper access controls
- [ ] **Data Encryption**: Sensitive data protection
- [ ] **Dependency Security**: No vulnerable packages
```

#### Performance-Focused Template
```markdown
## Performance Checklist
- [ ] **Algorithm Complexity**: O(n) analysis
- [ ] **Memory Usage**: Memory leaks prevention
- [ ] **Database Queries**: N+1 query prevention
- [ ] **Caching Strategy**: Appropriate caching
- [ ] **Bundle Size**: Code splitting
- [ ] **Lazy Loading**: Resource optimization
```

### Scoring Systems

#### Quality Score Template
```markdown
## Quality Metrics
**Code Quality**: {{QUALITY_SCORE}}/10
**Security Score**: {{SECURITY_SCORE}}/10
**Performance Score**: {{PERFORMANCE_SCORE}}/10
**Maintainability**: {{MAINTAINABILITY_SCORE}}/10

**Overall Score**: {{OVERALL_SCORE}}/10

## Score Breakdown
- **Excellent (9-10)**: Production ready
- **Good (7-8)**: Minor improvements needed
- **Fair (5-6)**: Significant improvements required
- **Poor (1-4)**: Major refactoring needed
```

### Team-Specific Standards

#### Company Standards Template
```markdown
## Company Coding Standards
- [ ] **Naming Convention**: Follows company style guide
- [ ] **Documentation**: Required JSDoc comments
- [ ] **Testing**: Unit test coverage >80%
- [ ] **Linting**: ESLint/Prettier compliance
- [ ] **Git Hooks**: Pre-commit checks pass

## Architecture Compliance
- [ ] **Design Patterns**: Approved patterns only
- [ ] **API Standards**: RESTful API compliance
- [ ] **Database**: ORM usage guidelines
- [ ] **Logging**: Structured logging format
```

## 💡 Best Practices

### Template Design

#### Keep It Focused
- **Single Responsibility**: Each template has clear purpose
- **Relevant Checks**: Only include applicable criteria
- **Concise Language**: Clear, actionable items

#### Make It Actionable
- **Specific Criteria**: Clear pass/fail conditions
- **Examples**: Include code examples where helpful
- **Resources**: Link to documentation/guidelines

#### Maintain Consistency
- **Standard Format**: Consistent template structure
- **Shared Criteria**: Common checks across templates
- **Version Control**: Track template changes

### Team Adoption

#### Gradual Implementation
1. **Start Simple**: Begin with basic templates
2. **Gather Feedback**: Iterate based on team input
3. **Expand Gradually**: Add complexity over time
4. **Document Changes**: Track template evolution

#### Training & Documentation
- **Template Guide**: Document custom templates
- **Examples**: Provide usage examples
- **Best Practices**: Share team learnings
- **Regular Updates**: Keep templates current

### Maintenance

#### Regular Reviews
- **Template Effectiveness**: Are templates helping?
- **Missing Criteria**: What should be added?
- **Outdated Checks**: Remove obsolete items
- **Team Feedback**: Gather improvement suggestions

#### Version Control
```bash
# Track template changes
git add AIDA/templates/
git commit -m "Update React template with hooks guidelines"
```

## 📚 Examples

### Complete Angular Template

#### languages/angular/review-file.md
```markdown
# Angular Component Review - {{FILE_NAME}}

**Project**: {{PROJECT_NAME}}
**Date**: {{DATE}}
**Reviewer**: AIDA {{REVIEWER}}

## Component Analysis
- [ ] **Component Purpose**: Single, well-defined responsibility
- [ ] **Component Type**: Appropriate component vs directive choice
- [ ] **Template Complexity**: Template not overly complex
- [ ] **Style Encapsulation**: ViewEncapsulation strategy appropriate

## TypeScript Implementation
- [ ] **Type Safety**: Strong typing throughout
- [ ] **Interface Usage**: Proper interfaces for data structures
- [ ] **Access Modifiers**: Appropriate public/private usage
- [ ] **Method Organization**: Logical method grouping

## Angular Best Practices
- [ ] **Lifecycle Hooks**: Proper hook implementation and cleanup
- [ ] **Change Detection**: OnPush strategy where appropriate
- [ ] **Input/Output**: Proper @Input/@Output usage
- [ ] **Dependency Injection**: Services properly injected
- [ ] **Reactive Forms**: FormBuilder and validators usage

## RxJS & Observables
- [ ] **Observable Usage**: Proper observable patterns
- [ ] **Subscription Management**: Unsubscribe in OnDestroy
- [ ] **Async Pipe**: Preferred over manual subscription
- [ ] **Operators**: Appropriate RxJS operators
- [ ] **Error Handling**: Observable error handling

## Performance Optimization
- [ ] **TrackBy Functions**: Implemented for NgFor loops
- [ ] **OnPush Strategy**: Used where beneficial
- [ ] **Lazy Loading**: Routes lazy loaded where appropriate
- [ ] **Bundle Size**: No unnecessary imports

## Testing Readiness
- [ ] **Testability**: Component easily testable
- [ ] **Mocking**: Dependencies can be mocked
- [ ] **Pure Functions**: Logic extracted to pure functions
- [ ] **Test Coverage**: Critical paths covered

## Security
- [ ] **Template Security**: No innerHTML usage without sanitization
- [ ] **Input Validation**: Form inputs validated
- [ ] **XSS Prevention**: User content properly escaped
- [ ] **Authentication**: Route guards where needed

## Code Quality Score
**Overall Rating**: ⭐⭐⭐⭐⭐

**Breakdown**:
- Code Quality: ___/10
- Angular Patterns: ___/10
- Performance: ___/10
- Security: ___/10
- Testability: ___/10

**Issues Found**:
- Critical: 0
- Warnings: 0
- Suggestions: 0

## Detailed Analysis
[AIDA will provide specific analysis here]

## Recommendations
1. [Specific suggestions for improvement]
2. [Performance optimization opportunities]
3. [Security enhancements if needed]

## Next Steps
- [ ] Address critical issues
- [ ] Consider suggestions for improvement
- [ ] Update tests if needed
- [ ] Review with team if significant changes required
```

### Custom API Template

#### languages/nodejs/review-api.md
```markdown
# Node.js API Review - {{FILE_NAME}}

## API Design
- [ ] **RESTful Design**: Proper HTTP methods and status codes
- [ ] **URL Structure**: Logical, hierarchical URLs
- [ ] **Versioning**: API versioning strategy
- [ ] **Documentation**: OpenAPI/Swagger documentation

## Express.js Patterns
- [ ] **Middleware Usage**: Proper middleware chain
- [ ] **Route Organization**: Routes logically grouped
- [ ] **Error Handling**: Centralized error handling
- [ ] **Validation**: Input validation middleware

## Security
- [ ] **Authentication**: Proper auth implementation
- [ ] **Authorization**: Role-based access control
- [ ] **Rate Limiting**: API rate limiting
- [ ] **Input Sanitization**: SQL injection prevention
- [ ] **CORS**: Proper CORS configuration

## Database
- [ ] **Query Optimization**: Efficient database queries
- [ ] **Connection Pooling**: Database connection management
- [ ] **Transactions**: Proper transaction usage
- [ ] **Migration Strategy**: Database schema management

## Performance
- [ ] **Caching**: Appropriate caching strategy
- [ ] **Async Patterns**: Non-blocking operations
- [ ] **Memory Management**: No memory leaks
- [ ] **Monitoring**: Performance monitoring hooks
```

## 🚀 Advanced Features

### Template Inheritance
```markdown
<!-- Base template -->
{{include:review-base.md}}

<!-- Language-specific additions -->
## Language-Specific Checks
[Additional criteria here]
```

### Conditional Sections
```markdown
{{#if FRAMEWORK === 'react'}}
## React-Specific Checks
- [ ] Hook usage patterns
{{/if}}

{{#if TESTING_FRAMEWORK === 'jest'}}
## Jest Testing
- [ ] Test structure
{{/if}}
```

### Dynamic Scoring
```markdown
## Quality Score: {{calculateScore(checks)}}
**Weight Distribution**:
- Security: 40%
- Performance: 30%
- Maintainability: 20%
- Style: 10%
```

---

**Ready to create powerful, customized code review templates! 🎯📝**

> "Templates are the foundation of consistent, high-quality code reviews."