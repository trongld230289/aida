<!-- AIDA - AI Development Assistant v1.0.15 -->
<!-- Advanced AI-powered code review and analysis -->

# JavaScript Framework Review Template

## 🎯 JavaScript-Specific Review Guidelines

This template focuses specifically on JavaScript framework best practices, patterns, and common pitfalls. Use this for reviewing JavaScript modules, functions, classes, and configuration files.

🎯 REVIEW PRINCIPLES:
- ONLY flag issues that violate the specific rules in the template
- If code follows template guidelines, it's acceptable - don't force changes
- Focus on actual violations, not subjective preferences

---

## ⚡ JAVASCRIPT CRITICAL CHECKS (Auto-FAIL if found)

**Scan EVERY line for these JAVASCRIPT-SPECIFIC CRITICAL issues:**

{{REVIEW_BASE}}


### 🚨 ERROR HANDLING VIOLATIONS:
- Try-catch blocks without proper error handling
- Swallowing errors without logging
- Generic error messages without context
- Missing error boundaries for modules
- Not handling specific error types appropriately
- Exposing internal error details to client
- Missing graceful degradation patterns
- Error handling that breaks application flow
- Missing operational vs programmer error distinction
- Incorrect error propagation patterns

### 🚨 CODE QUALITY VIOLATIONS:
- Magic numbers without named constants
- Functions with too many parameters (>5)
- Deep nesting levels (>4 levels)
- Large functions (>50 lines)
- Global variables without proper namespacing
- Missing JSDoc documentation for complex functions
- Inconsistent naming conventions
- Duplicate code without refactoring
- Missing proper error messages
- No code organization patterns

---

## 🔍 JavaScript Code Analysis

### 1. **Modern JavaScript & ES6+ Features**

#### 🆕 Language Features
- **ES6+ Adoption**
  - Proper use of let/const over var?
  - Arrow functions where appropriate?
  - Template literals for string formatting?
  - Destructuring for cleaner code?

#### 📦 Module System
- Modern import/export patterns
- Proper module organization
- Tree-shaking friendly exports
- Circular dependency avoidance

#### 🔄 Modern Syntax
```javascript
// Example: Modern JavaScript patterns
// ✅ Good: Modern destructuring and defaults
const processUser = ({ 
  name, 
  email, 
  age = 18, 
  preferences = {} 
} = {}) => {
  if (!name || !email) {
    throw new Error('Name and email are required');
  }
  
  return {
    id: generateId(),
    name: name.trim(),
    email: email.toLowerCase(),
    age,
    preferences: { notifications: true, ...preferences }
  };
};

// ✅ Good: Template literals and arrow functions
const createUserMessage = (user) => 
  `Welcome ${user.name}! Your account (${user.email}) has been created.`;

// ❌ Bad: Old patterns
var createUser = function(name, email, age, preferences) {
  if (age === undefined) age = 18;
  if (preferences === undefined) preferences = {};
  
  return {
    id: generateId(),
    name: name,
    email: email,
    age: age,
    preferences: preferences
  };
};
```

#### ❌ Common Issues
- Using var instead of let/const
- Missing modern array methods
- Not using template literals
- Avoiding arrow functions unnecessarily

---

### 2. **Async Programming & Promises**

#### ⚡ Async Best Practices
```javascript
// Best Practice: Proper async/await patterns
class ApiService {
  async fetchUserData(userId) {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getToken()}`
        },
        signal: AbortSignal.timeout(5000) // Timeout after 5 seconds
      });
      
      if (!response.ok) {
        throw new ApiError(`Failed to fetch user: ${response.status}`, response.status);
      }
      
      const userData = await response.json();
      
      // Validate the response data
      if (!this.isValidUserData(userData)) {
        throw new ValidationError('Invalid user data received');
      }
      
      return userData;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new TimeoutError('Request timed out');
      }
      
      this.logger.error('Failed to fetch user data:', error);
      throw error;
    }
  }
  
  // Good: Promise aggregation with proper error handling
  async fetchUserProfile(userId) {
    try {
      const [user, preferences, permissions] = await Promise.allSettled([
        this.fetchUserData(userId),
        this.fetchUserPreferences(userId),
        this.fetchUserPermissions(userId)
      ]);
      
      return {
        user: user.status === 'fulfilled' ? user.value : null,
        preferences: preferences.status === 'fulfilled' ? preferences.value : {},
        permissions: permissions.status === 'fulfilled' ? permissions.value : []
      };
    } catch (error) {
      this.logger.error('Failed to fetch user profile:', error);
      throw new Error('Unable to load user profile');
    }
  }
}

// ❌ Bad: Promise anti-patterns
function badAsyncExample() {
  return new Promise((resolve, reject) => {
    fetch('/api/data')
      .then(response => response.json())
      .then(data => resolve(data))
      .catch(error => reject(error));
  });
}

// ✅ Good: Simply return the promise
const goodAsyncExample = () => 
  fetch('/api/data').then(response => response.json());
```

#### 🚨 Async Anti-patterns
- Promise constructor anti-patterns
- Missing error handling
- Callback hell
- Racing conditions

---

### 3. **Error Handling & Validation**

#### 🛡️ Robust Error Handling
```javascript
// Best Practice: Custom error classes
class AppError extends Error {
  constructor(message, code, statusCode = 500) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, field, value) {
    super(message, 'VALIDATION_ERROR', 400);
    this.field = field;
    this.value = value;
  }
}

class ApiError extends AppError {
  constructor(message, statusCode) {
    super(message, 'API_ERROR', statusCode);
  }
}

// Good: Input validation with detailed errors
function validateUserInput(userData) {
  const errors = [];
  
  if (!userData || typeof userData !== 'object') {
    throw new ValidationError('User data must be an object', 'root', userData);
  }
  
  if (!userData.name || typeof userData.name !== 'string' || userData.name.trim().length < 2) {
    errors.push(new ValidationError('Name must be at least 2 characters', 'name', userData.name));
  }
  
  if (!userData.email || !isValidEmail(userData.email)) {
    errors.push(new ValidationError('Valid email is required', 'email', userData.email));
  }
  
  if (userData.age !== undefined && (!Number.isInteger(userData.age) || userData.age < 0 || userData.age > 150)) {
    errors.push(new ValidationError('Age must be a valid integer between 0 and 150', 'age', userData.age));
  }
  
  if (errors.length > 0) {
    const error = new Error('Validation failed');
    error.code = 'VALIDATION_FAILED';
    error.errors = errors;
    throw error;
  }
  
  return true;
}

// Good: Centralized error handling
class ErrorHandler {
  static handle(error, context = {}) {
    const errorInfo = {
      message: error.message,
      code: error.code || 'UNKNOWN_ERROR',
      stack: error.stack,
      context,
      timestamp: new Date().toISOString()
    };
    
    if (error instanceof ValidationError) {
      console.warn('Validation Error:', errorInfo);
    } else if (error instanceof ApiError) {
      console.error('API Error:', errorInfo);
    } else {
      console.error('Unexpected Error:', errorInfo);
    }
    
    // Send to error reporting service
    this.reportError(errorInfo);
  }
  
  static reportError(errorInfo) {
    // Implementation for error reporting
    if (typeof window !== 'undefined' && window.errorReporter) {
      window.errorReporter.captureException(errorInfo);
    }
  }
}
```

#### ✅ Validation Patterns
- Runtime type checking
- Schema validation
- Input sanitization
- Error aggregation

---

### 4. **DOM Manipulation & Events**

#### 🎨 Efficient DOM Operations
```javascript
// Best Practice: Efficient DOM manipulation
class DOMHelper {
  // Good: Event delegation
  static addDelegatedListener(container, selector, event, handler) {
    container.addEventListener(event, (e) => {
      if (e.target.matches(selector)) {
        handler(e);
      }
    });
  }
  
  // Good: Batch DOM operations
  static createUserList(users) {
    const fragment = document.createDocumentFragment();
    
    users.forEach(user => {
      const listItem = this.createElement('li', {
        className: 'user-item',
        dataset: { userId: user.id }
      });
      
      listItem.innerHTML = `
        <img src="${this.escapeHtml(user.avatar)}" alt="Avatar" class="user-avatar">
        <span class="user-name">${this.escapeHtml(user.name)}</span>
        <span class="user-email">${this.escapeHtml(user.email)}</span>
      `;
      
      fragment.appendChild(listItem);
    });
    
    return fragment;
  }
  
  // Good: Safe element creation
  static createElement(tag, attributes = {}) {
    const element = document.createElement(tag);
    
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'dataset') {
        Object.assign(element.dataset, value);
      } else if (key === 'className') {
        element.className = value;
      } else {
        element.setAttribute(key, value);
      }
    });
    
    return element;
  }
  
  // Good: XSS prevention
  static escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  // Good: Cleanup management
  static createCleanupManager() {
    const cleanupTasks = [];
    
    return {
      add(cleanupFn) {
        cleanupTasks.push(cleanupFn);
      },
      
      cleanup() {
        cleanupTasks.forEach(fn => {
          try {
            fn();
          } catch (error) {
            console.error('Cleanup error:', error);
          }
        });
        cleanupTasks.length = 0;
      }
    };
  }
}

// ❌ Bad: Inefficient DOM operations
function badDOMExample(users) {
  const container = document.getElementById('user-list');
  container.innerHTML = ''; // Forces reflow
  
  users.forEach(user => {
    const item = document.createElement('li');
    item.innerHTML = user.name; // XSS vulnerability
    container.appendChild(item); // Forces reflow on each iteration
  });
}

// ✅ Good: Efficient and safe
function goodDOMExample(users) {
  const container = document.getElementById('user-list');
  const fragment = DOMHelper.createUserList(users);
  
  container.innerHTML = '';
  container.appendChild(fragment); // Single reflow
}
```

#### 📱 Event Management
- Proper event delegation
- Event cleanup patterns
- Performance optimization
- Accessibility considerations

---

### 5. **Performance Optimization**

#### ⚡ Performance Patterns
```javascript
// Best Practice: Debouncing and throttling
class PerformanceUtils {
  static debounce(func, wait, immediate = false) {
    let timeout;
    
    return function executedFunction(...args) {
      const later = () => {
        timeout = null;
        if (!immediate) func.apply(this, args);
      };
      
      const callNow = immediate && !timeout;
      
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      
      if (callNow) func.apply(this, args);
    };
  }
  
  static throttle(func, limit) {
    let inThrottle;
    
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
  
  // Good: Memoization
  static memoize(fn, getKey = (...args) => JSON.stringify(args)) {
    const cache = new Map();
    
    return function(...args) {
      const key = getKey(...args);
      
      if (cache.has(key)) {
        return cache.get(key);
      }
      
      const result = fn.apply(this, args);
      cache.set(key, result);
      
      return result;
    };
  }
  
  // Good: Lazy loading
  static createLazyLoader(loader) {
    let promise;
    let loaded = false;
    let result;
    
    return async () => {
      if (loaded) return result;
      
      if (!promise) {
        promise = loader();
      }
      
      result = await promise;
      loaded = true;
      
      return result;
    };
  }
}

// Good: Efficient data processing
class DataProcessor {
  static processLargeDataset(data, chunkSize = 1000) {
    return new Promise((resolve) => {
      const results = [];
      let index = 0;
      
      function processChunk() {
        const endIndex = Math.min(index + chunkSize, data.length);
        
        for (let i = index; i < endIndex; i++) {
          results.push(this.processItem(data[i]));
        }
        
        index = endIndex;
        
        if (index < data.length) {
          // Use setTimeout to yield control to the browser
          setTimeout(processChunk, 0);
        } else {
          resolve(results);
        }
      }
      
      processChunk();
    });
  }
  
  static processItem(item) {
    // Process individual item
    return {
      ...item,
      processed: true,
      timestamp: Date.now()
    };
  }
}
```

---

### 6. **Module Design & Organization**

#### 📦 Module Patterns
```javascript
// Best Practice: Modern module patterns
// userService.js
export class UserService {
  constructor(apiClient, cache) {
    this.apiClient = apiClient;
    this.cache = cache;
  }
  
  async getUser(id) {
    const cacheKey = `user:${id}`;
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;
    
    // Fetch from API
    const user = await this.apiClient.get(`/users/${id}`);
    
    // Cache the result
    this.cache.set(cacheKey, user, { ttl: 300000 }); // 5 minutes
    
    return user;
  }
  
  async createUser(userData) {
    validateUserInput(userData);
    
    const user = await this.apiClient.post('/users', userData);
    
    // Invalidate related caches
    this.cache.invalidatePattern('user:*');
    
    return user;
  }
}

// Good: Factory pattern
export function createUserService(config = {}) {
  const apiClient = new ApiClient(config.apiUrl);
  const cache = new LRUCache(config.cacheSize || 100);
  
  return new UserService(apiClient, cache);
}

// Good: Singleton pattern with proper initialization
class ConfigManager {
  constructor() {
    if (ConfigManager.instance) {
      return ConfigManager.instance;
    }
    
    this.config = {};
    this.initialized = false;
    
    ConfigManager.instance = this;
  }
  
  async initialize(configPath) {
    if (this.initialized) return;
    
    try {
      this.config = await this.loadConfig(configPath);
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize config: ${error.message}`);
    }
  }
  
  get(key, defaultValue = null) {
    if (!this.initialized) {
      throw new Error('Config not initialized');
    }
    
    return this.config[key] ?? defaultValue;
  }
  
  async loadConfig(configPath) {
    const response = await fetch(configPath);
    if (!response.ok) {
      throw new Error(`Failed to load config from ${configPath}`);
    }
    return response.json();
  }
}

export const configManager = new ConfigManager();
```

---

### 7. **Testing & Quality Assurance**

#### 🧪 Testing Patterns
```javascript
// Good: Test utilities and helpers
export class TestHelpers {
  static createMockUser(overrides = {}) {
    return {
      id: 'user-123',
      name: 'Test User',
      email: 'test@example.com',
      age: 25,
      ...overrides
    };
  }
  
  static createMockApiResponse(data, options = {}) {
    return {
      ok: options.ok ?? true,
      status: options.status ?? 200,
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(JSON.stringify(data))
    };
  }
  
  static async waitFor(condition, timeout = 5000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    throw new Error('Condition not met within timeout');
  }
}

// Good: Test setup and teardown
describe('UserService', () => {
  let userService;
  let mockApiClient;
  let mockCache;
  
  beforeEach(() => {
    mockApiClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn()
    };
    
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      invalidatePattern: jest.fn()
    };
    
    userService = new UserService(mockApiClient, mockCache);
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('getUser', () => {
    it('should return cached user when available', async () => {
      const userId = 'user-123';
      const mockUser = TestHelpers.createMockUser({ id: userId });
      
      mockCache.get.mockReturnValue(mockUser);
      
      const result = await userService.getUser(userId);
      
      expect(result).toEqual(mockUser);
      expect(mockCache.get).toHaveBeenCalledWith(`user:${userId}`);
      expect(mockApiClient.get).not.toHaveBeenCalled();
    });
    
    it('should fetch from API when not cached', async () => {
      const userId = 'user-123';
      const mockUser = TestHelpers.createMockUser({ id: userId });
      
      mockCache.get.mockReturnValue(null);
      mockApiClient.get.mockResolvedValue(mockUser);
      
      const result = await userService.getUser(userId);
      
      expect(result).toEqual(mockUser);
      expect(mockApiClient.get).toHaveBeenCalledWith(`/users/${userId}`);
      expect(mockCache.set).toHaveBeenCalledWith(
        `user:${userId}`, 
        mockUser, 
        { ttl: 300000 }
      );
    });
  });
});
```

---

### 8. **Security Best Practices**

#### 🔒 Security Patterns
```javascript
// Best Practice: Input sanitization and validation
class SecurityUtils {
  static sanitizeHtml(input) {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
  }
  
  static validateAndSanitizeInput(input, rules = {}) {
    if (typeof input !== 'string') {
      throw new ValidationError('Input must be a string');
    }
    
    let sanitized = input.trim();
    
    if (rules.maxLength && sanitized.length > rules.maxLength) {
      throw new ValidationError(`Input too long (max ${rules.maxLength})`);
    }
    
    if (rules.pattern && !rules.pattern.test(sanitized)) {
      throw new ValidationError('Input format is invalid');
    }
    
    if (rules.allowHtml) {
      sanitized = this.sanitizeHtml(sanitized);
    }
    
    return sanitized;
  }
  
  static generateSecureToken(length = 32) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  
  static async hashPassword(password, salt) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

// Good: CSRF protection
class CSRFProtection {
  static getToken() {
    return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
  }
  
  static addToHeaders(headers = {}) {
    const token = this.getToken();
    if (token) {
      headers['X-CSRF-Token'] = token;
    }
    return headers;
  }
  
  static addToFormData(formData) {
    const token = this.getToken();
    if (token && formData instanceof FormData) {
      formData.append('_token', token);
    }
    return formData;
  }
}
```

---

## 📊 JavaScript Health Metrics

### Framework Compliance
- **Modern JavaScript**: ⭐⭐⭐⭐⭐ (X/5)
- **Async Patterns**: ⭐⭐⭐⭐⭐ (X/5)
- **Error Handling**: ⭐⭐⭐⭐⭐ (X/5)
- **Performance**: ⭐⭐⭐⭐⭐ (X/5)
- **Security**: ⭐⭐⭐⭐⭐ (X/5)

### Overall JavaScript Score: ⭐⭐⭐⭐⭐ (X/10)

---

## 🎯 JavaScript-Specific Action Items

### 🔴 Critical (Security/Memory)
1. [ ] Fix all security vulnerabilities (XSS, injection)
2. [ ] Add proper input validation and sanitization
3. [ ] Fix memory leaks from event listeners and timers
4. [ ] Add proper error handling for all async operations
5. [ ] Remove debugging code and console.logs

### 🟡 Important (Performance/Best Practices)
1. [ ] Migrate to modern ES6+ syntax
2. [ ] Implement proper async/await patterns
3. [ ] Add debouncing/throttling for performance
4. [ ] Optimize DOM manipulation patterns
5. [ ] Add proper module organization

### 🟢 Improvements (Code Quality)
1. [ ] Add comprehensive JSDoc documentation
2. [ ] Implement proper testing strategies
3. [ ] Add code linting and formatting
4. [ ] Improve naming conventions
5. [ ] Add performance monitoring

---

## 💡 JavaScript Upgrade Recommendations

### Migration Opportunities
- Modern JavaScript features (ES2022+)
- Web APIs for better performance
- Modern bundling and tree-shaking
- Progressive Web App features
- WebAssembly for performance-critical code
- Service Workers for offline functionality

### Tooling Improvements
- ESLint with modern rules
- Prettier for code formatting
- Babel for transpilation
- Webpack/Vite for bundling
- Jest for testing
- Performance monitoring tools
