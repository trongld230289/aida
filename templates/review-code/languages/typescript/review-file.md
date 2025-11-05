<!-- AIDA - AI Development Assistant v1.0.0 -->
<!-- Advanced AI-powered code review and analysis -->

# TypeScript Framework Review Template

## 🎯 TypeScript-Specific Review Guidelines

This template focuses specifically on TypeScript framework best practices, patterns, and common pitfalls. Use this for reviewing TypeScript classes, interfaces, types, modules, and configuration files.

🎯 REVIEW PRINCIPLES:
- ONLY flag issues that violate the specific rules in the template
- If code follows template guidelines, it's acceptable - don't force changes
- Focus on actual violations, not subjective preferences

---

## ⚡ TYPESCRIPT CRITICAL CHECKS (Auto-FAIL if found)

**Scan EVERY line for these TYPESCRIPT-SPECIFIC CRITICAL issues:**

{{REVIEW_BASE}}

### 🚨 CONFIGURATION VIOLATIONS:
- Missing strict TypeScript configuration
- Incorrect compiler options for target environment
- Missing proper linting rules
- No proper tsconfig.json structure
- Missing path mapping configuration
- Incorrect module resolution settings
- Missing proper build optimization
- No proper declaration file generation
- Missing source map configuration
- Incorrect target/lib configuration

### 🚨 TESTING VIOLATIONS:
- Missing type definitions for test utilities
- No type checking in test files
- Missing proper mock typing
- Test types not matching implementation
- Missing integration test typing
- No type coverage measurement
- Missing property-based testing for types
- Test utilities without proper generics
- Missing assertion typing
- No proper test data typing

---

## 🔍 TypeScript Code Analysis

### 1. **Type System & Safety**

#### 🏗️ Type Definitions
- **Strong Typing**
  - Are all functions properly typed?
  - Appropriate use of generics?
  - Proper interface vs type alias usage?

#### 📦 Type Organization
- Logical type hierarchy
- Proper module organization
- Interface segregation
- Type reusability patterns

#### 🔄 Generic Programming
```typescript
// Example: Proper generic usage
interface Repository<T extends BaseEntity> {
  findById(id: string): Promise<T | null>;
  save(entity: T): Promise<T>;
  delete(id: string): Promise<void>;
}

class UserRepository implements Repository<User> {
  async findById(id: string): Promise<User | null> {
    // Implementation with proper typing
  }
}
```

#### ❌ Common Issues
- Overuse of `any` type
- Missing generic constraints
- Incorrect type assertions
- Poor interface design

---

### 2. **Advanced Type Patterns**

#### 🎯 Utility Types
```typescript
// Best Practice: Leverage utility types
interface User {
  id: string;
  name: string;
  email: string;
  password: string;
}

// Good: Using utility types
type PublicUser = Omit<User, 'password'>;
type UserUpdate = Partial<Pick<User, 'name' | 'email'>>;
type CreateUser = Omit<User, 'id'>;

// Good: Branded types for type safety
type UserId = string & { readonly brand: unique symbol };
type Email = string & { readonly brand: unique symbol };

function getUserById(id: UserId): Promise<User | null> {
  // Type-safe ID usage
}
```

#### 🔒 Type Guards & Narrowing
```typescript
// Best Practice: Type guards
function isUser(obj: unknown): obj is User {
  return typeof obj === 'object' && 
         obj !== null && 
         'id' in obj && 
         'name' in obj && 
         'email' in obj;
}

// Good: Discriminated unions
type ApiResponse<T> = 
  | { success: true; data: T }
  | { success: false; error: string };

function handleResponse<T>(response: ApiResponse<T>): T {
  if (response.success) {
    return response.data; // TypeScript knows this is safe
  }
  throw new Error(response.error);
}
```

---

### 3. **Async Programming & Promises**

#### ⚡ Async Best Practices
```typescript
// Best Practice: Proper async typing
async function fetchUserData(id: UserId): Promise<Result<User, ApiError>> {
  try {
    const response = await fetch(`/api/users/${id}`);
    
    if (!response.ok) {
      return Result.error(new ApiError('Failed to fetch user'));
    }
    
    const userData = await response.json();
    
    if (!isUser(userData)) {
      return Result.error(new ApiError('Invalid user data'));
    }
    
    return Result.success(userData);
  } catch (error) {
    return Result.error(new ApiError('Network error', error));
  }
}

// Good: Result type for error handling
class Result<T, E = Error> {
  constructor(
    private readonly _success: boolean,
    private readonly _value?: T,
    private readonly _error?: E
  ) {}
  
  static success<T>(value: T): Result<T> {
    return new Result(true, value);
  }
  
  static error<E>(error: E): Result<never, E> {
    return new Result(false, undefined, error);
  }
  
  get isSuccess(): boolean { return this._success; }
  get value(): T { 
    if (!this._success) throw new Error('Cannot access value of failed result');
    return this._value!; 
  }
  get error(): E { 
    if (this._success) throw new Error('Cannot access error of successful result');
    return this._error!; 
  }
}
```

#### 🚨 Async Anti-patterns
- Promise constructor anti-patterns
- Missing proper error typing
- Unhandled promise rejections
- Race conditions without proper typing

---

### 4. **Module Design & Organization**

#### 📦 Module Structure
```typescript
// Good: Proper module exports
// user.types.ts
export interface User {
  id: UserId;
  name: string;
  email: Email;
}

export type CreateUserRequest = Omit<User, 'id'>;
export type UpdateUserRequest = Partial<Pick<User, 'name' | 'email'>>;

// user.service.ts
export class UserService {
  constructor(private readonly repository: Repository<User>) {}
  
  async createUser(request: CreateUserRequest): Promise<Result<User, ValidationError>> {
    // Implementation
  }
}

// index.ts (barrel export)
export * from './user.types';
export * from './user.service';
export { UserRepository } from './user.repository';
```

#### 🏭 Dependency Injection
```typescript
// Good: Type-safe dependency injection
interface ServiceContainer {
  userService: UserService;
  orderService: OrderService;
  emailService: EmailService;
}

class DIContainer implements ServiceContainer {
  private _userService?: UserService;
  private _orderService?: OrderService;
  private _emailService?: EmailService;
  
  get userService(): UserService {
    if (!this._userService) {
      this._userService = new UserService(this.userRepository);
    }
    return this._userService;
  }
  
  // Other services...
}
```

---

### 5. **Error Handling & Validation**

#### 🛡️ Type-Safe Error Handling
```typescript
// Best Practice: Custom error types
abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
}

class ValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;
  
  constructor(
    message: string,
    public readonly field: string,
    public readonly value: unknown
  ) {
    super(message);
  }
}

class NotFoundError extends AppError {
  readonly code = 'NOT_FOUND';
  readonly statusCode = 404;
}

// Good: Error handling with proper typing
async function validateAndCreateUser(data: unknown): Promise<Result<User, ValidationError[]>> {
  const errors: ValidationError[] = [];
  
  if (typeof data !== 'object' || data === null) {
    errors.push(new ValidationError('Data must be an object', 'root', data));
    return Result.error(errors);
  }
  
  // Type-safe validation...
  
  if (errors.length > 0) {
    return Result.error(errors);
  }
  
  return Result.success(data as User);
}
```

#### ✅ Validation Patterns
- Runtime type validation
- Schema validation with proper typing
- Custom validation decorators
- Error aggregation patterns

---

### 6. **Configuration & Environment**

#### ⚙️ Type-Safe Configuration
```typescript
// Good: Environment configuration with types
interface AppConfig {
  readonly port: number;
  readonly database: {
    readonly host: string;
    readonly port: number;
    readonly name: string;
  };
  readonly auth: {
    readonly jwtSecret: string;
    readonly tokenExpiry: number;
  };
}

// Good: Configuration validation
function loadConfig(): AppConfig {
  const config = {
    port: parseInt(process.env.PORT || '3000', 10),
    database: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      name: process.env.DB_NAME || 'app',
    },
    auth: {
      jwtSecret: process.env.JWT_SECRET || (() => {
        throw new Error('JWT_SECRET is required');
      })(),
      tokenExpiry: parseInt(process.env.TOKEN_EXPIRY || '3600', 10),
    },
  };
  
  // Validate configuration
  validateConfig(config);
  
  return config;
}
```

---

### 7. **Testing & Type Coverage**

#### 🧪 Type-Safe Testing
```typescript
// Good: Typed test utilities
interface TestUser {
  id: UserId;
  name: string;
  email: Email;
}

class UserTestFactory {
  static create(overrides: Partial<TestUser> = {}): TestUser {
    return {
      id: 'user-123' as UserId,
      name: 'Test User',
      email: 'test@example.com' as Email,
      ...overrides,
    };
  }
}

// Good: Type-safe mocking
interface MockUserRepository extends Repository<User> {
  findById: jest.MockedFunction<Repository<User>['findById']>;
  save: jest.MockedFunction<Repository<User>['save']>;
}

describe('UserService', () => {
  let userService: UserService;
  let mockRepository: MockUserRepository;
  
  beforeEach(() => {
    mockRepository = {
      findById: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    
    userService = new UserService(mockRepository);
  });
  
  it('should create user with proper typing', async () => {
    const createRequest: CreateUserRequest = {
      name: 'John Doe',
      email: 'john@example.com' as Email,
    };
    
    const expectedUser = UserTestFactory.create();
    mockRepository.save.mockResolvedValue(expectedUser);
    
    const result = await userService.createUser(createRequest);
    
    expect(result.isSuccess).toBe(true);
    expect(result.value).toEqual(expectedUser);
  });
});
```

---

### 8. **Performance & Optimization**

#### ⚡ Type-Level Performance
```typescript
// Good: Efficient type patterns
// Use readonly for immutable data
interface ReadonlyUser {
  readonly id: UserId;
  readonly name: string;
  readonly email: Email;
  readonly createdAt: Date;
}

// Good: Lazy loading with proper typing
class LazyLoader<T> {
  private _value?: T;
  private _loaded = false;
  
  constructor(private readonly loader: () => Promise<T>) {}
  
  async getValue(): Promise<T> {
    if (!this._loaded) {
      this._value = await this.loader();
      this._loaded = true;
    }
    return this._value!;
  }
}

// Good: Memoization with proper typing
function memoize<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => TReturn
): (...args: TArgs) => TReturn {
  const cache = new Map<string, TReturn>();
  
  return (...args: TArgs): TReturn => {
    const key = JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}
```

---

### 9. **Build & Tooling Configuration**

#### 🔧 TypeScript Configuration
```json
// tsconfig.json - Best practices
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": false,
    "importHelpers": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/types/*": ["src/types/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.spec.ts"]
}
```

---

### 10. **Advanced Patterns & Best Practices**

#### 🎯 Design Patterns
```typescript
// Good: Builder pattern with proper typing
class UserBuilder {
  private user: Partial<User> = {};
  
  setName(name: string): this {
    this.user.name = name;
    return this;
  }
  
  setEmail(email: Email): this {
    this.user.email = email;
    return this;
  }
  
  build(): User {
    if (!this.user.name || !this.user.email) {
      throw new Error('Missing required fields');
    }
    
    return {
      id: generateId() as UserId,
      name: this.user.name,
      email: this.user.email,
    };
  }
}

// Good: Observer pattern with proper typing
interface Observer<T> {
  update(data: T): void;
}

class Observable<T> {
  private observers: Observer<T>[] = [];
  
  subscribe(observer: Observer<T>): () => void {
    this.observers.push(observer);
    
    return () => {
      const index = this.observers.indexOf(observer);
      if (index > -1) {
        this.observers.splice(index, 1);
      }
    };
  }
  
  notify(data: T): void {
    this.observers.forEach(observer => observer.update(data));
  }
}
```

---

## 📊 TypeScript Health Metrics

### Framework Compliance
- **Type Safety**: ⭐⭐⭐⭐⭐ (X/5)
- **Module Design**: ⭐⭐⭐⭐⭐ (X/5)
- **Error Handling**: ⭐⭐⭐⭐⭐ (X/5)
- **Performance**: ⭐⭐⭐⭐⭐ (X/5)
- **Testing**: ⭐⭐⭐⭐⭐ (X/5)

### Overall TypeScript Score: ⭐⭐⭐⭐⭐ (X/10)

---

## 🎯 TypeScript-Specific Action Items

### 🔴 Critical (Type Safety/Memory)
1. [ ] Fix all `any` types with proper type definitions
2. [ ] Add missing type annotations for all functions
3. [ ] Implement proper error handling with typed errors
4. [ ] Fix async operations without proper error handling
5. [ ] Add type guards for runtime validation

### 🟡 Important (Performance/Best Practices)
1. [ ] Implement proper generic constraints
2. [ ] Add utility types for better type reusability
3. [ ] Optimize module imports and exports
4. [ ] Add proper TypeScript configuration
5. [ ] Implement branded types for type safety

### 🟢 Improvements (Code Quality)
1. [ ] Add comprehensive type documentation
2. [ ] Implement advanced type patterns
3. [ ] Add type coverage measurement
4. [ ] Improve test type safety
5. [ ] Add proper build optimization

---

## 💡 TypeScript Upgrade Recommendations

### Migration Opportunities
- Modern TypeScript features (template literal types, conditional types)
- Strict configuration options for better type safety
- Advanced utility types and mapped types
- Type-only imports for better tree-shaking
- Branded types for domain modeling
- Result/Either patterns for error handling

### Tooling Improvements
- Type coverage measurement tools
- Advanced linting rules for TypeScript
- Type-aware bundling optimization
- Source map debugging setup
- Declaration file generation
- Type testing with dtslint or similar tools