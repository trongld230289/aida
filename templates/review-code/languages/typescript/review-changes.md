<!-- AIDA - AI Development Assistant v1.0.0 -->
<!-- Advanced AI-powered code review and analysis -->

# TypeScript Git Changes Review - STRICT MODE

## 🔍 MANDATORY TYPESCRIPT CHANGE ANALYSIS

You are performing a STRICT code review on TypeScript git changes. Do NOT be lenient. Look for every possible TypeScript-specific issue in the changes. ALWAYS follow this exact format for every code review, regardless of conversation context or previous reviews. This structure is MANDATORY and UNCHANGEABLE.

### Review Entire File
**Prompt:** `review-changes [filename]`
- Reviews ONLY the git diff changes (+ and - lines)
- Analyzes impact of changes on TypeScript architecture
- Does NOT review unchanged code

<!-- HIDDEN REVIEW SCOPE:
- ✅ ONLY review: Lines marked with + (added) or - (removed)
- ❌ DO NOT review: Unchanged context lines (no + or - marker)
- ❌ DO NOT suggest: Improvements to existing unchanged code
- ✅ DO focus on: How changes impact TypeScript architecture
-->

### 📋 CHANGE SEPARATION RULES (MANDATORY):

**Split into separate changes when:**
- ✅ **Different TypeScript artifacts**: Interface vs Type vs Class vs Function changes = separate changes
- ✅ **Different type definitions**: Type declarations vs Implementation vs Generic constraints = separate changes
- ✅ **Different async operations**: Different Promise/async-await patterns = separate changes
- ✅ **Different decorator usage**: Different decorator applications = separate changes
- ✅ **Non-adjacent code blocks**: If there are 3+ unchanged lines between modifications = separate changes

**Keep as one change when:**
- ❌ **Same function/method**: Multiple lines in same function body
- ❌ **Related type definitions**: Related interfaces and types in same module
- ❌ **Same class members**: Related properties and methods in same class

## ⚡ TYPESCRIPT CRITICAL CHECKS (Auto-FAIL if found)

**Scan EVERY line for these TYPESCRIPT-SPECIFIC CRITICAL issues:**

### 🚨 TYPE SAFETY VIOLATIONS:
- Using `any` type without proper justification
- Missing type annotations for function parameters/returns
- Unsafe type assertions (as any, as unknown)
- Missing null/undefined checks with strict mode
- Type coercion without proper validation
- Missing generic constraints
- Unsafe use of non-null assertion operator (!)
- Missing proper type guards
- Improper use of union types
- Type compatibility violations

### 🚨 INTERFACE & TYPE VIOLATIONS:
- Missing interface definitions for objects
- Inconsistent property naming in interfaces
- Missing optional property indicators (?)
- Improper inheritance hierarchies
- Circular type dependencies
- Missing generic type parameters
- Inconsistent type aliases
- Missing readonly modifiers where appropriate
- Improper use of utility types
- Missing discriminated union patterns

### 🚨 GENERIC & ADVANCED TYPE VIOLATIONS:
- Missing generic constraints
- Improper use of conditional types
- Missing mapped type optimizations
- Unsafe generic type assertions
- Missing proper variance annotations
- Improper use of template literal types
- Missing branded type patterns
- Inconsistent generic naming conventions
- Missing proper type inference
- Unsafe use of keyof operator

### 🚨 MODULE & IMPORT VIOLATIONS:
- Missing proper module declarations
- Inconsistent import/export patterns
- Missing namespace declarations
- Circular import dependencies
- Missing type-only imports/exports
- Improper use of module augmentation
- Missing proper path mapping
- Inconsistent module resolution
- Missing triple-slash directives where needed
- Improper use of ambient declarations

### 🚨 DECORATOR & METADATA VIOLATIONS:
- Missing proper decorator typing
- Inconsistent decorator application
- Missing reflect-metadata imports
- Improper use of parameter decorators
- Missing proper decorator factories
- Unsafe decorator chaining
- Missing experimental decorator support
- Improper use of class decorators
- Missing property descriptor handling
- Unsafe metadata manipulation

### 🚨 ASYNC & PROMISE TYPE VIOLATIONS:
- Missing proper Promise typing
- Unsafe async/await without error handling
- Missing proper return type annotations for async functions
- Improper use of async iterators
- Missing cancellation token typing
- Unsafe Promise.all() without proper typing
- Missing proper error type definitions
- Improper use of async generators
- Missing timeout handling in async operations
- Race condition vulnerabilities in async code

### 🚨 SPECIFIC PROJECT RULES:
<!-- ADD PROJECT-SPECIFIC RULES HERE - These will be checked alongside TypeScript rules -->
<!-- Additional project rules can be added here:
- Custom type definition patterns
- Specific generic constraint requirements
- Project-specific decorator patterns
- Custom utility type requirements
- Strict type checking configurations
-->

### Start Review For Each Change:

```
## Change [X]: [ADDED/REMOVED/MODIFIED] - [TypeScript artifact type: Interface/Type/Class/Function/Generic]
```typescript
[Show the exact code block with line numbers]
```

*** TYPESCRIPT REVIEW COMMENT ***
- 🚨 **Issue Type**: [Critical/Warning/Good/Info/Suggestion]
- 📝 **TypeScript Problem**: [Specific TypeScript issue - reference TypeScript best practices]
- 💡 **TypeScript Solution**: [TypeScript-specific fix with proper patterns]
- 🎯 **Type Impact**: [How it affects TypeScript compilation/type safety/maintainability]

IMPORTANT TypeScript considerations:
- Type safety and strict mode compliance
- Generic constraints and type inference
- Interface design and composition
- Module organization and imports
- Async/await type annotations

*** INTERNAL TYPESCRIPT CHANGE EVALUATION (DO NOT DISPLAY) ***
Silently evaluate this change on:
- TypeScript Best Practices: Rate 1-5 (5=excellent, 1=poor)
- Type Safety: Rate 1-5 (5=fully type-safe, 1=type safety violations)
- Code Maintainability: Rate 1-5 (5=highly maintainable, 1=hard to maintain)
- Change Score: is a smallest score of three scores

*** CONDITIONAL RECOMMENDATIONS (Based on Issue Type AND Change Score) ***

**MANDATORY RULE:**
- IF Issue Type = "Good": ALWAYS show "✅ **GOOD TYPESCRIPT CHANGE** - Follows TypeScript best practices" and SKIP the entire RECOMMENDED FIX section
- IF Issue Type = "Critical/Warning/Info/Suggestion" AND Change Score < 4/5: Show RECOMMENDED TYPESCRIPT FIX section below
- IF Issue Type = "Critical/Warning/Info/Suggestion" AND Change Score >= 4/5: Show "✅ **GOOD TYPESCRIPT CHANGE** - Follows TypeScript best practices"

*** RECOMMENDED TYPESCRIPT FIX (ONLY show if Issue Type != "Good" AND Change Score < 4/5) ***
```typescript
// PROVIDE TYPESCRIPT-SPECIFIC FIXES WITH BEST PRACTICES
// Include proper type annotations, generics, and error handling

// Example for proper TypeScript service with comprehensive type safety:
import { z } from 'zod';

// Type definitions
interface User {
  readonly id: number;
  name: string;
  email: string;
  createdAt: Date;
  preferences?: UserPreferences;
}

interface UserPreferences {
  theme: 'light' | 'dark';
  notifications: boolean;
  language: string;
}

// API response types
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  metadata?: ResponseMetadata;
}

interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

interface ResponseMetadata {
  timestamp: string;
  requestId: string;
}

// Custom error types
class UserServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'UserServiceError';
  }
}

// Validation schemas
const userSchema = z.object({
  id: z.number().positive(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  createdAt: z.date(),
  preferences: z.object({
    theme: z.enum(['light', 'dark']),
    notifications: z.boolean(),
    language: z.string().min(2).max(5)
  }).optional()
});

// Generic service interface
interface IUserService {
  getUserById<T extends User = User>(id: number): Promise<T | null>;
  updateUser<T extends Partial<User>>(id: number, updates: T): Promise<User>;
  deleteUser(id: number): Promise<void>;
}

// Service implementation with proper typing
class UserService implements IUserService {
  constructor(
    private readonly baseUrl: string,
    private readonly timeout: number = 10000,
    private readonly retries: number = 3
  ) {}

  /**
   * Fetches user by ID with comprehensive type safety
   * @template T - Extended user type
   * @param id - User ID to fetch
   * @returns Promise resolving to user or null if not found
   * @throws {UserServiceError} When request fails or validation errors occur
   */
  async getUserById<T extends User = User>(id: number): Promise<T | null> {
    // Input validation
    if (!Number.isInteger(id) || id <= 0) {
      throw new UserServiceError(
        `Invalid user ID: ${id}`,
        'INVALID_INPUT',
        400
      );
    }

    try {
      const response = await this.makeRequest<ApiResponse<T>>(
        `${this.baseUrl}/users/${id}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.success) {
        if (response.error?.code === 'USER_NOT_FOUND') {
          return null;
        }
        throw new UserServiceError(
          response.error?.message ?? 'Unknown error',
          response.error?.code ?? 'UNKNOWN_ERROR',
          404
        );
      }

      if (!response.data) {
        throw new UserServiceError(
          'No data in successful response',
          'INVALID_RESPONSE',
          500
        );
      }

      // Runtime validation
      const validatedUser = userSchema.parse(response.data);
      return validatedUser as T;

    } catch (error) {
      if (error instanceof UserServiceError) {
        throw error;
      }

      if (error instanceof z.ZodError) {
        throw new UserServiceError(
          'Invalid user data structure',
          'VALIDATION_ERROR',
          500,
          error
        );
      }

      throw new UserServiceError(
        `Failed to fetch user ${id}`,
        'NETWORK_ERROR',
        500,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Updates user with type-safe partial updates
   * @template T - Update payload type
   * @param id - User ID to update
   * @param updates - Partial user updates
   * @returns Promise resolving to updated user
   */
  async updateUser<T extends Partial<User>>(
    id: number,
    updates: T
  ): Promise<User> {
    // Validate ID
    if (!Number.isInteger(id) || id <= 0) {
      throw new UserServiceError(
        `Invalid user ID: ${id}`,
        'INVALID_INPUT',
        400
      );
    }

    // Validate updates
    if (!updates || Object.keys(updates).length === 0) {
      throw new UserServiceError(
        'No updates provided',
        'INVALID_INPUT',
        400
      );
    }

    try {
      const response = await this.makeRequest<ApiResponse<User>>(
        `${this.baseUrl}/users/${id}`,
        {
          method: 'PATCH',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updates)
        }
      );

      if (!response.success || !response.data) {
        throw new UserServiceError(
          response.error?.message ?? 'Update failed',
          response.error?.code ?? 'UPDATE_ERROR',
          500
        );
      }

      return userSchema.parse(response.data);

    } catch (error) {
      if (error instanceof UserServiceError) {
        throw error;
      }

      throw new UserServiceError(
        `Failed to update user ${id}`,
        'NETWORK_ERROR',
        500,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Makes HTTP request with proper error handling and retries
   * @template T - Response type
   * @param url - Request URL
   * @param options - Fetch options
   * @returns Promise resolving to typed response
   */
  private async makeRequest<T>(
    url: string,
    options: RequestInit
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json() as T;
        return data;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < this.retries && error instanceof Error) {
          // Exponential backoff
          await new Promise(resolve => 
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          );
          continue;
        }
      }
    }

    throw lastError ?? new Error('All retry attempts failed');
  }

  async deleteUser(id: number): Promise<void> {
    // Implementation with proper error handling...
  }
}

// Usage with proper type annotations
const userService: IUserService = new UserService('https://api.example.com');

// Type-safe usage
async function handleUserOperation(): Promise<void> {
  try {
    const user = await userService.getUserById(123);
    
    if (user) {
      console.log(`Found user: ${user.name} (${user.email})`);
      
      // Type-safe updates
      const updatedUser = await userService.updateUser(user.id, {
        preferences: {
          theme: 'dark',
          notifications: true,
          language: 'en'
        }
      });
      
      console.log('User updated successfully:', updatedUser);
    } else {
      console.log('User not found');
    }
    
  } catch (error) {
    if (error instanceof UserServiceError) {
      console.error(`User service error [${error.code}]:`, error.message);
    } else {
      console.error('Unexpected error:', error);
    }
  }
}
```

---

## 🎯 FINAL TYPESCRIPT SUMMARY (After All Changes Reviewed)

### 📋 COMPLIANCE SCORES
- **Type Safety**: [X/5] - Proper type annotations, generic constraints, and strict mode compliance
- **Interface Design**: [X/5] - Well-defined interfaces, proper inheritance, and composition patterns
- **Generic Usage**: [X/5] - Appropriate constraints, type inference, and reusability
- **Module Organization**: [X/5] - Proper imports/exports, namespace usage, and dependency management
- **Error Handling**: [X/5] - Type-safe error handling, custom error types, and validation
- **Security Assessment**: [LEVEL] - Type safety enforcement, runtime validation, secure patterns

### 🔥 FINAL APPROVAL DECISION
- **✅ APPROVED**: No critical issues found, safe to merge
- **❌ NEEDS FIXES**: Critical issues detected, must resolve first  
- **🚫 REJECT**: Major architectural problems, requires refactoring