<!-- AIDA - AI Development Assistant v1.0.0 -->
<!-- Advanced AI-powered code review and analysis -->

# Generic File Review Template

## 🎯 Generic Review Guidelines

This is a fallback template for comprehensive file analysis when no specific language/framework template is available. It provides general code quality, security, and maintainability checks applicable to most programming languages.

---

<!-- 
📝 NOTE: The following CRITICAL CHECKS section applies to REVIEW-FILE only.
These comprehensive checks are for complete file analysis, not incremental changes.
For PR/change reviews, use review-pr.md or review-changes.md templates.
-->

## ⚡ GENERIC CRITICAL CHECKS (Auto-FAIL if found)

**Scan EVERY line for these UNIVERSAL CRITICAL issues:**

{{REVIEW_BASE}}

### 🚨 TESTING VIOLATIONS:
- Critical paths not covered by tests
- Tests not isolated from external dependencies
- Test data management not properly handled
- Flaky tests that fail intermittently
- Tests not maintained with code changes
- Integration tests missing for critical flows
- Performance characteristics not tested
- Error scenarios not tested
- Security vulnerabilities not tested
- Test environments not representative

### 🚨 CONFIGURATION VIOLATIONS:
- Configuration secrets stored in plaintext
- Default credentials used in production
- Configuration not validated at startup
- Environment-specific configs hardcoded
- Missing configuration for security settings
- Configuration changes requiring code deployment
- Sensitive configuration logged or exposed
- Configuration backup and versioning missing
- Runtime configuration changes not audited
- Configuration documentation missing

---

## 🔍 Generic Code Analysis

### 1. **Code Structure & Organization**

#### 📁 File Organization
- **Single Responsibility**
  - File focused on single concern?
  - Clear separation of concerns?
  - Appropriate file size and complexity?
  - Logical grouping of related functionality?

#### 🏗️ Architecture Patterns
- Consistent architectural patterns used?
- Proper abstraction layers maintained?
- Dependencies properly managed?
- Interface segregation followed?

#### 🎯 Code Structure Example
```javascript
// Best Practice: Well-structured modular code with clear separation

// config/database.js - Configuration management
const config = {
  development: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'app_dev',
    username: process.env.DB_USER || 'dev_user',
    password: process.env.DB_PASS || 'dev_pass',
    pool: {
      min: 2,
      max: 10,
      idle: 10000,
      acquire: 30000
    },
    logging: process.env.NODE_ENV === 'development'
  },
  production: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    pool: {
      min: 5,
      max: 20,
      idle: 10000,
      acquire: 30000
    },
    logging: false,
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  }
}

// Validate required environment variables
function validateConfig(env) {
  const requiredVars = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASS']
  const missing = requiredVars.filter(varName => !process.env[varName])
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}

if (process.env.NODE_ENV === 'production') {
  validateConfig()
}

module.exports = config[process.env.NODE_ENV || 'development']

// utils/logger.js - Centralized logging utility
const winston = require('winston')

class Logger {
  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { 
        service: process.env.SERVICE_NAME || 'app',
        version: process.env.APP_VERSION || '1.0.0'
      },
      transports: [
        new winston.transports.File({ 
          filename: 'logs/error.log', 
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        }),
        new winston.transports.File({ 
          filename: 'logs/combined.log',
          maxsize: 5242880,
          maxFiles: 5
        })
      ]
    })

    // Add console transport in development
    if (process.env.NODE_ENV !== 'production') {
      this.logger.add(new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      }))
    }
  }

  info(message, meta = {}) {
    this.logger.info(message, { ...meta, timestamp: new Date().toISOString() })
  }

  error(message, error = null, meta = {}) {
    const errorMeta = {
      ...meta,
      timestamp: new Date().toISOString(),
      ...(error && {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        }
      })
    }
    this.logger.error(message, errorMeta)
  }

  warn(message, meta = {}) {
    this.logger.warn(message, { ...meta, timestamp: new Date().toISOString() })
  }

  debug(message, meta = {}) {
    this.logger.debug(message, { ...meta, timestamp: new Date().toISOString() })
  }
}

module.exports = new Logger()

// services/userService.js - Business logic layer
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const User = require('../models/User')
const logger = require('../utils/logger')
const { ValidationError, AuthenticationError, NotFoundError } = require('../utils/errors')

class UserService {
  constructor() {
    this.saltRounds = 12
    this.jwtSecret = process.env.JWT_SECRET
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d'
    
    if (!this.jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required')
    }
  }

  async createUser(userData) {
    try {
      // Validate input data
      this.validateUserData(userData)
      
      // Check if user already exists
      const existingUser = await User.findByEmail(userData.email)
      if (existingUser) {
        throw new ValidationError('User with this email already exists')
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, this.saltRounds)
      
      // Create user
      const user = await User.create({
        ...userData,
        password: hashedPassword,
        createdAt: new Date(),
        isActive: true
      })

      // Log user creation
      logger.info('User created successfully', {
        userId: user.id,
        email: user.email,
        action: 'user_created'
      })

      // Return user without password
      const { password, ...userWithoutPassword } = user.toObject()
      return userWithoutPassword

    } catch (error) {
      logger.error('Failed to create user', error, {
        email: userData?.email,
        action: 'user_creation_failed'
      })
      throw error
    }
  }

  async authenticateUser(email, password) {
    try {
      // Find user with password field
      const user = await User.findByEmail(email).select('+password')
      if (!user) {
        throw new AuthenticationError('Invalid email or password')
      }

      // Check if account is active
      if (!user.isActive) {
        throw new AuthenticationError('Account is deactivated')
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password)
      if (!isPasswordValid) {
        // Log failed login attempt
        logger.warn('Failed login attempt', {
          email,
          action: 'login_failed',
          reason: 'invalid_password'
        })
        throw new AuthenticationError('Invalid email or password')
      }

      // Generate JWT token
      const token = jwt.sign(
        { 
          userId: user.id,
          email: user.email,
          roles: user.roles 
        },
        this.jwtSecret,
        { expiresIn: this.jwtExpiresIn }
      )

      // Update last login
      await User.updateById(user.id, {
        lastLoginAt: new Date(),
        lastLoginIP: this.getCurrentIP()
      })

      // Log successful login
      logger.info('User authenticated successfully', {
        userId: user.id,
        email: user.email,
        action: 'user_authenticated'
      })

      // Return user and token
      const { password: _, ...userWithoutPassword } = user.toObject()
      return {
        user: userWithoutPassword,
        token
      }

    } catch (error) {
      logger.error('Authentication failed', error, {
        email,
        action: 'authentication_failed'
      })
      throw error
    }
  }

  async getUserById(userId) {
    try {
      const user = await User.findById(userId)
      if (!user) {
        throw new NotFoundError('User not found')
      }

      return user
    } catch (error) {
      logger.error('Failed to get user by ID', error, {
        userId,
        action: 'get_user_failed'
      })
      throw error
    }
  }

  async updateUser(userId, updateData) {
    try {
      // Validate update data
      this.validateUpdateData(updateData)

      // If password is being updated, hash it
      if (updateData.password) {
        updateData.password = await bcrypt.hash(updateData.password, this.saltRounds)
        updateData.passwordChangedAt = new Date()
      }

      // Update user
      const user = await User.updateById(userId, {
        ...updateData,
        updatedAt: new Date()
      })

      if (!user) {
        throw new NotFoundError('User not found')
      }

      logger.info('User updated successfully', {
        userId,
        action: 'user_updated',
        updatedFields: Object.keys(updateData)
      })

      return user
    } catch (error) {
      logger.error('Failed to update user', error, {
        userId,
        action: 'user_update_failed'
      })
      throw error
    }
  }

  async deleteUser(userId) {
    try {
      const user = await User.findById(userId)
      if (!user) {
        throw new NotFoundError('User not found')
      }

      // Soft delete by deactivating account
      await User.updateById(userId, {
        isActive: false,
        deactivatedAt: new Date()
      })

      logger.info('User deleted successfully', {
        userId,
        action: 'user_deleted'
      })

      return { success: true }
    } catch (error) {
      logger.error('Failed to delete user', error, {
        userId,
        action: 'user_deletion_failed'
      })
      throw error
    }
  }

  // Private helper methods
  validateUserData(userData) {
    const requiredFields = ['email', 'password', 'firstName', 'lastName']
    const missingFields = requiredFields.filter(field => !userData[field])
    
    if (missingFields.length > 0) {
      throw new ValidationError(`Missing required fields: ${missingFields.join(', ')}`)
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(userData.email)) {
      throw new ValidationError('Invalid email format')
    }

    // Password validation
    if (userData.password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long')
    }
  }

  validateUpdateData(updateData) {
    // Prevent updating sensitive fields
    const forbiddenFields = ['id', 'createdAt', 'passwordChangedAt']
    const invalidFields = forbiddenFields.filter(field => updateData.hasOwnProperty(field))
    
    if (invalidFields.length > 0) {
      throw new ValidationError(`Cannot update fields: ${invalidFields.join(', ')}`)
    }

    // Validate email if provided
    if (updateData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(updateData.email)) {
        throw new ValidationError('Invalid email format')
      }
    }

    // Validate password if provided
    if (updateData.password && updateData.password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long')
    }
  }

  getCurrentIP() {
    // Implementation depends on request context
    return '127.0.0.1' // Placeholder
  }
}

module.exports = new UserService()
```

---

### 2. **Security & Data Validation**

#### 🔒 Security Implementation
```python
# Best Practice: Comprehensive security patterns

import hashlib
import secrets
import hmac
import time
import re
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from datetime import datetime, timedelta
import logging

# Configure secure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('security.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class SecurityConfig:
    """Security configuration with secure defaults"""
    password_min_length: int = 12
    password_max_length: int = 128
    max_login_attempts: int = 5
    lockout_duration: int = 900  # 15 minutes
    session_timeout: int = 3600  # 1 hour
    csrf_token_length: int = 32
    rate_limit_window: int = 60
    rate_limit_max_requests: int = 100

class SecurityValidator:
    """Comprehensive security validation and protection"""
    
    def __init__(self, config: SecurityConfig = SecurityConfig()):
        self.config = config
        self.failed_attempts = {}  # In production, use Redis or database
        self.rate_limits = {}
        
    def validate_password(self, password: str) -> Dict[str, Any]:
        """Validate password strength with comprehensive checks"""
        errors = []
        
        # Length check
        if len(password) < self.config.password_min_length:
            errors.append(f"Password must be at least {self.config.password_min_length} characters")
        
        if len(password) > self.config.password_max_length:
            errors.append(f"Password must be less than {self.config.password_max_length} characters")
        
        # Character type checks
        if not re.search(r'[a-z]', password):
            errors.append("Password must contain at least one lowercase letter")
        
        if not re.search(r'[A-Z]', password):
            errors.append("Password must contain at least one uppercase letter")
        
        if not re.search(r'\d', password):
            errors.append("Password must contain at least one digit")
        
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            errors.append("Password must contain at least one special character")
        
        # Common password checks
        common_passwords = [
            'password', '123456', 'qwerty', 'admin', 'letmein',
            'welcome', 'monkey', '1234567890'
        ]
        
        if password.lower() in common_passwords:
            errors.append("Password is too common")
        
        # Sequential character check
        if self._has_sequential_chars(password):
            errors.append("Password should not contain sequential characters")
        
        return {
            'is_valid': len(errors) == 0,
            'errors': errors,
            'strength_score': self._calculate_strength_score(password)
        }
    
    def _has_sequential_chars(self, password: str) -> bool:
        """Check for sequential characters"""
        sequential_patterns = [
            'abcdefghijklmnopqrstuvwxyz',
            '0123456789',
            'qwertyuiopasdfghjklzxcvbnm'
        ]
        
        for pattern in sequential_patterns:
            for i in range(len(pattern) - 2):
                if pattern[i:i+3] in password.lower():
                    return True
        return False
    
    def _calculate_strength_score(self, password: str) -> int:
        """Calculate password strength score (0-100)"""
        score = 0
        
        # Length bonus
        score += min(len(password) * 2, 50)
        
        # Character diversity bonus
        if re.search(r'[a-z]', password):
            score += 10
        if re.search(r'[A-Z]', password):
            score += 10
        if re.search(r'\d', password):
            score += 10
        if re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            score += 15
        
        # Penalty for common patterns
        if self._has_sequential_chars(password):
            score -= 20
        
        return max(0, min(100, score))
    
    def hash_password(self, password: str) -> str:
        """Securely hash password using PBKDF2"""
        salt = secrets.token_bytes(32)
        key = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 100000)
        return salt.hex() + key.hex()
    
    def verify_password(self, password: str, hashed: str) -> bool:
        """Verify password against hash"""
        try:
            salt = bytes.fromhex(hashed[:64])
            key = bytes.fromhex(hashed[64:])
            new_key = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 100000)
            return hmac.compare_digest(key, new_key)
        except (ValueError, TypeError):
            return False
    
    def validate_email(self, email: str) -> Dict[str, Any]:
        """Validate email address with comprehensive checks"""
        errors = []
        
        # Basic format validation
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, email):
            errors.append("Invalid email format")
        
        # Length check
        if len(email) > 254:
            errors.append("Email address is too long")
        
        # Domain validation
        if '@' in email:
            local, domain = email.rsplit('@', 1)
            
            # Local part validation
            if len(local) > 64:
                errors.append("Email local part is too long")
            
            # Domain part validation
            if len(domain) > 253:
                errors.append("Email domain is too long")
            
            # Check for dangerous domains
            dangerous_domains = ['tempmail.com', 'guerrillamail.com', '10minutemail.com']
            if domain.lower() in dangerous_domains:
                errors.append("Temporary email addresses are not allowed")
        
        return {
            'is_valid': len(errors) == 0,
            'errors': errors,
            'normalized': email.lower().strip()
        }
    
    def sanitize_input(self, input_data: str, max_length: int = 1000) -> str:
        """Sanitize user input to prevent injection attacks"""
        if not isinstance(input_data, str):
            input_data = str(input_data)
        
        # Truncate if too long
        if len(input_data) > max_length:
            input_data = input_data[:max_length]
        
        # Remove null bytes
        input_data = input_data.replace('\x00', '')
        
        # HTML encode dangerous characters
        html_chars = {
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '/': '&#x2F;',
            '&': '&amp;'
        }
        
        for char, encoded in html_chars.items():
            input_data = input_data.replace(char, encoded)
        
        return input_data.strip()
    
    def check_rate_limit(self, identifier: str, max_requests: int = None) -> Dict[str, Any]:
        """Check if identifier has exceeded rate limit"""
        max_requests = max_requests or self.config.rate_limit_max_requests
        current_time = time.time()
        window_start = current_time - self.config.rate_limit_window
        
        # Clean old entries
        if identifier in self.rate_limits:
            self.rate_limits[identifier] = [
                timestamp for timestamp in self.rate_limits[identifier]
                if timestamp > window_start
            ]
        else:
            self.rate_limits[identifier] = []
        
        # Check current count
        current_count = len(self.rate_limits[identifier])
        
        if current_count >= max_requests:
            logger.warning(f"Rate limit exceeded for {identifier}")
            return {
                'allowed': False,
                'current_count': current_count,
                'max_requests': max_requests,
                'reset_time': window_start + self.config.rate_limit_window
            }
        
        # Add current request
        self.rate_limits[identifier].append(current_time)
        
        return {
            'allowed': True,
            'current_count': current_count + 1,
            'max_requests': max_requests,
            'remaining': max_requests - current_count - 1
        }
    
    def check_login_attempts(self, identifier: str) -> Dict[str, Any]:
        """Check failed login attempts and account lockout"""
        current_time = time.time()
        
        if identifier not in self.failed_attempts:
            return {'locked': False, 'attempts': 0}
        
        attempts_data = self.failed_attempts[identifier]
        
        # Check if lockout period has expired
        if attempts_data['locked_until'] and current_time < attempts_data['locked_until']:
            remaining_lockout = attempts_data['locked_until'] - current_time
            return {
                'locked': True,
                'attempts': attempts_data['count'],
                'lockout_remaining': remaining_lockout
            }
        
        # Reset if lockout expired
        if attempts_data['locked_until'] and current_time >= attempts_data['locked_until']:
            self.failed_attempts[identifier] = {'count': 0, 'locked_until': None}
        
        return {
            'locked': False,
            'attempts': attempts_data['count']
        }
    
    def record_failed_login(self, identifier: str) -> Dict[str, Any]:
        """Record failed login attempt and apply lockout if necessary"""
        current_time = time.time()
        
        if identifier not in self.failed_attempts:
            self.failed_attempts[identifier] = {'count': 0, 'locked_until': None}
        
        self.failed_attempts[identifier]['count'] += 1
        attempt_count = self.failed_attempts[identifier]['count']
        
        # Apply lockout after max attempts
        if attempt_count >= self.config.max_login_attempts:
            lockout_until = current_time + self.config.lockout_duration
            self.failed_attempts[identifier]['locked_until'] = lockout_until
            
            logger.warning(f"Account locked for {identifier} due to failed login attempts")
            
            return {
                'locked': True,
                'attempts': attempt_count,
                'lockout_duration': self.config.lockout_duration
            }
        
        return {
            'locked': False,
            'attempts': attempt_count,
            'remaining_attempts': self.config.max_login_attempts - attempt_count
        }
    
    def reset_login_attempts(self, identifier: str):
        """Reset failed login attempts after successful login"""
        if identifier in self.failed_attempts:
            del self.failed_attempts[identifier]
    
    def generate_csrf_token(self) -> str:
        """Generate cryptographically secure CSRF token"""
        return secrets.token_urlsafe(self.config.csrf_token_length)
    
    def validate_csrf_token(self, token: str, session_token: str) -> bool:
        """Validate CSRF token against session"""
        if not token or not session_token:
            return False
        
        return hmac.compare_digest(token, session_token)

# Usage example
if __name__ == "__main__":
    security = SecurityValidator()
    
    # Password validation
    password_result = security.validate_password("MySecure123!")
    print(f"Password valid: {password_result['is_valid']}")
    print(f"Strength score: {password_result['strength_score']}")
    
    # Email validation
    email_result = security.validate_email("user@example.com")
    print(f"Email valid: {email_result['is_valid']}")
    
    # Rate limiting
    rate_result = security.check_rate_limit("user123")
    print(f"Rate limit OK: {rate_result['allowed']}")
```

---

### 3. **Performance & Resource Management**

#### ⚡ Performance Optimization
```java
// Best Practice: Performance optimization patterns in Java

import java.util.*;
import java.util.concurrent.*;
import java.util.stream.Collectors;
import java.time.Duration;
import java.time.Instant;
import java.lang.management.ManagementFactory;
import java.lang.management.MemoryMXBean;
import java.lang.management.GarbageCollectorMXBean;

/**
 * Comprehensive performance optimization and monitoring utilities
 */
public class PerformanceOptimizer {
    
    private static final int DEFAULT_CACHE_SIZE = 1000;
    private static final Duration DEFAULT_CACHE_TTL = Duration.ofMinutes(30);
    
    // Thread-safe LRU cache implementation
    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();
    private final ScheduledExecutorService cacheCleanup = Executors.newScheduledThreadPool(1);
    
    // Connection pool for database connections
    private final ExecutorService threadPool;
    private final BlockingQueue<Connection> connectionPool;
    
    // Performance monitoring
    private final PerformanceMonitor monitor = new PerformanceMonitor();
    
    public PerformanceOptimizer(int maxThreads, int maxConnections) {
        this.threadPool = Executors.newFixedThreadPool(maxThreads);
        this.connectionPool = new LinkedBlockingQueue<>(maxConnections);
        
        // Initialize connection pool
        initializeConnectionPool(maxConnections);
        
        // Schedule cache cleanup
        cacheCleanup.scheduleAtFixedRate(this::cleanExpiredEntries, 5, 5, TimeUnit.MINUTES);
    }
    
    /**
     * High-performance data processing with streaming and parallel processing
     */
    public <T, R> List<R> processLargeDataset(List<T> data, Function<T, R> processor, int batchSize) {
        Instant start = Instant.now();
        
        try {
            // Process in parallel batches to optimize memory usage
            List<R> results = data.parallelStream()
                .collect(Collectors.groupingBy(item -> data.indexOf(item) / batchSize))
                .values()
                .parallelStream()
                .flatMap(batch -> batch.stream().map(processor))
                .collect(Collectors.toList());
            
            Duration processingTime = Duration.between(start, Instant.now());
            monitor.recordProcessingTime("large_dataset_processing", processingTime);
            
            return results;
            
        } catch (Exception e) {
            monitor.recordError("large_dataset_processing", e);
            throw new RuntimeException("Data processing failed", e);
        }
    }
    
    /**
     * Efficient caching with TTL and size limits
     */
    public <T> T getFromCache(String key, Supplier<T> supplier) {
        CacheEntry entry = cache.get(key);
        
        // Check if entry exists and is not expired
        if (entry != null && !entry.isExpired()) {
            monitor.recordCacheHit(key);
            return (T) entry.getValue();
        }
        
        // Cache miss - compute value
        monitor.recordCacheMiss(key);
        T value = supplier.get();
        
        // Store in cache with size limit check
        if (cache.size() >= DEFAULT_CACHE_SIZE) {
            evictOldestEntries();
        }
        
        cache.put(key, new CacheEntry(value, Instant.now().plus(DEFAULT_CACHE_TTL)));
        return value;
    }
    
    /**
     * Async processing with proper resource management
     */
    public <T> CompletableFuture<T> processAsync(Callable<T> task) {
        return CompletableFuture.supplyAsync(() -> {
            Instant start = Instant.now();
            String taskName = task.getClass().getSimpleName();
            
            try {
                T result = task.call();
                
                Duration processingTime = Duration.between(start, Instant.now());
                monitor.recordProcessingTime(taskName, processingTime);
                
                return result;
                
            } catch (Exception e) {
                monitor.recordError(taskName, e);
                throw new RuntimeException("Async task failed", e);
            }
        }, threadPool);
    }
    
    /**
     * Database operations with connection pooling
     */
    public <T> T executeWithConnection(Function<Connection, T> operation) {
        Connection connection = null;
        Instant start = Instant.now();
        
        try {
            // Get connection from pool with timeout
            connection = connectionPool.poll(5, TimeUnit.SECONDS);
            if (connection == null) {
                throw new RuntimeException("Unable to obtain database connection");
            }
            
            T result = operation.apply(connection);
            
            Duration operationTime = Duration.between(start, Instant.now());
            monitor.recordDatabaseOperation(operationTime);
            
            return result;
            
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Database operation interrupted", e);
        } catch (Exception e) {
            monitor.recordError("database_operation", e);
            throw new RuntimeException("Database operation failed", e);
        } finally {
            // Return connection to pool
            if (connection != null) {
                try {
                    connectionPool.offer(connection, 1, TimeUnit.SECONDS);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    // Log warning but don't fail the operation
                    System.err.println("Failed to return connection to pool");
                }
            }
        }
    }
    
    /**
     * Memory-efficient batch processing
     */
    public <T> void processBatches(Iterator<T> dataIterator, int batchSize, Consumer<List<T>> batchProcessor) {
        List<T> batch = new ArrayList<>(batchSize);
        int processedCount = 0;
        
        while (dataIterator.hasNext()) {
            batch.add(dataIterator.next());
            
            if (batch.size() >= batchSize) {
                processBatch(batch, batchProcessor);
                batch.clear();
                processedCount += batchSize;
                
                // Periodic memory cleanup
                if (processedCount % (batchSize * 10) == 0) {
                    suggestGarbageCollection();
                }
            }
        }
        
        // Process remaining items
        if (!batch.isEmpty()) {
            processBatch(batch, batchProcessor);
        }
    }
    
    private <T> void processBatch(List<T> batch, Consumer<List<T>> processor) {
        Instant start = Instant.now();
        
        try {
            processor.accept(batch);
            
            Duration processingTime = Duration.between(start, Instant.now());
            monitor.recordBatchProcessing(batch.size(), processingTime);
            
        } catch (Exception e) {
            monitor.recordError("batch_processing", e);
            throw new RuntimeException("Batch processing failed", e);
        }
    }
    
    private void initializeConnectionPool(int maxConnections) {
        // Initialize database connections (implementation specific)
        for (int i = 0; i < maxConnections; i++) {
            Connection connection = createDatabaseConnection();
            connectionPool.offer(connection);
        }
    }
    
    private Connection createDatabaseConnection() {
        // Implementation specific - create actual database connection
        return new MockConnection();
    }
    
    private void cleanExpiredEntries() {
        Instant now = Instant.now();
        cache.entrySet().removeIf(entry -> entry.getValue().isExpired(now));
    }
    
    private void evictOldestEntries() {
        // Remove 10% of oldest entries when cache is full
        int entriesToRemove = (int) (DEFAULT_CACHE_SIZE * 0.1);
        
        cache.entrySet().stream()
            .sorted(Map.Entry.comparingByValue((a, b) -> a.getCreatedAt().compareTo(b.getCreatedAt())))
            .limit(entriesToRemove)
            .forEach(entry -> cache.remove(entry.getKey()));
    }
    
    private void suggestGarbageCollection() {
        MemoryMXBean memoryBean = ManagementFactory.getMemoryMXBean();
        long usedMemory = memoryBean.getHeapMemoryUsage().getUsed();
        long maxMemory = memoryBean.getHeapMemoryUsage().getMax();
        
        // Suggest GC if memory usage is above 80%
        if (usedMemory > maxMemory * 0.8) {
            System.gc();
        }
    }
    
    /**
     * Get performance statistics
     */
    public PerformanceStats getPerformanceStats() {
        return monitor.getStats();
    }
    
    /**
     * Shutdown and cleanup resources
     */
    public void shutdown() {
        try {
            threadPool.shutdown();
            if (!threadPool.awaitTermination(30, TimeUnit.SECONDS)) {
                threadPool.shutdownNow();
            }
            
            cacheCleanup.shutdown();
            
            // Close all database connections
            Connection conn;
            while ((conn = connectionPool.poll()) != null) {
                conn.close();
            }
            
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            threadPool.shutdownNow();
        } catch (Exception e) {
            System.err.println("Error during shutdown: " + e.getMessage());
        }
    }
    
    // Supporting classes
    private static class CacheEntry {
        private final Object value;
        private final Instant createdAt;
        private final Instant expiresAt;
        
        public CacheEntry(Object value, Instant expiresAt) {
            this.value = value;
            this.createdAt = Instant.now();
            this.expiresAt = expiresAt;
        }
        
        public Object getValue() { return value; }
        public Instant getCreatedAt() { return createdAt; }
        public boolean isExpired() { return isExpired(Instant.now()); }
        public boolean isExpired(Instant now) { return now.isAfter(expiresAt); }
    }
    
    private static class PerformanceMonitor {
        private final Map<String, List<Duration>> processingTimes = new ConcurrentHashMap<>();
        private final Map<String, AtomicLong> cacheHits = new ConcurrentHashMap<>();
        private final Map<String, AtomicLong> cacheMisses = new ConcurrentHashMap<>();
        private final List<Duration> databaseOperations = Collections.synchronizedList(new ArrayList<>());
        private final Map<String, AtomicLong> errorCounts = new ConcurrentHashMap<>();
        
        public void recordProcessingTime(String operation, Duration duration) {
            processingTimes.computeIfAbsent(operation, k -> Collections.synchronizedList(new ArrayList<>()))
                          .add(duration);
        }
        
        public void recordCacheHit(String key) {
            cacheHits.computeIfAbsent(key, k -> new AtomicLong(0)).incrementAndGet();
        }
        
        public void recordCacheMiss(String key) {
            cacheMisses.computeIfAbsent(key, k -> new AtomicLong(0)).incrementAndGet();
        }
        
        public void recordDatabaseOperation(Duration duration) {
            databaseOperations.add(duration);
        }
        
        public void recordBatchProcessing(int batchSize, Duration duration) {
            recordProcessingTime("batch_" + batchSize, duration);
        }
        
        public void recordError(String operation, Exception error) {
            errorCounts.computeIfAbsent(operation, k -> new AtomicLong(0)).incrementAndGet();
        }
        
        public PerformanceStats getStats() {
            return new PerformanceStats(
                processingTimes,
                cacheHits,
                cacheMisses,
                databaseOperations,
                errorCounts
            );
        }
    }
    
    private static class MockConnection implements Connection {
        public void close() throws Exception {
            // Mock implementation
        }
    }
    
    private interface Connection extends AutoCloseable {
        // Database connection interface
    }
    
    // Performance statistics container
    public static class PerformanceStats {
        private final Map<String, List<Duration>> processingTimes;
        private final Map<String, AtomicLong> cacheHits;
        private final Map<String, AtomicLong> cacheMisses;
        private final List<Duration> databaseOperations;
        private final Map<String, AtomicLong> errorCounts;
        
        public PerformanceStats(
            Map<String, List<Duration>> processingTimes,
            Map<String, AtomicLong> cacheHits,
            Map<String, AtomicLong> cacheMisses,
            List<Duration> databaseOperations,
            Map<String, AtomicLong> errorCounts
        ) {
            this.processingTimes = processingTimes;
            this.cacheHits = cacheHits;
            this.cacheMisses = cacheMisses;
            this.databaseOperations = databaseOperations;
            this.errorCounts = errorCounts;
        }
        
        public double getCacheHitRate() {
            long totalHits = cacheHits.values().stream().mapToLong(AtomicLong::get).sum();
            long totalMisses = cacheMisses.values().stream().mapToLong(AtomicLong::get).sum();
            long total = totalHits + totalMisses;
            
            return total > 0 ? (double) totalHits / total : 0.0;
        }
        
        public Duration getAverageProcessingTime(String operation) {
            List<Duration> times = processingTimes.get(operation);
            if (times == null || times.isEmpty()) {
                return Duration.ZERO;
            }
            
            long totalMillis = times.stream().mapToLong(Duration::toMillis).sum();
            return Duration.ofMillis(totalMillis / times.size());
        }
        
        public long getErrorCount(String operation) {
            AtomicLong count = errorCounts.get(operation);
            return count != null ? count.get() : 0;
        }
    }
}
```

---

## 📊 Generic Health Metrics

### Code Quality
- **Security Implementation**: ⭐⭐⭐⭐⭐ (X/5)
- **Performance Optimization**: ⭐⭐⭐⭐⭐ (X/5)
- **Error Handling**: ⭐⭐⭐⭐⭐ (X/5)
- **Code Structure**: ⭐⭐⭐⭐⭐ (X/5)
- **Testing Coverage**: ⭐⭐⭐⭐⭐ (X/5)

### Overall Code Score: ⭐⭐⭐⭐⭐ (X/10)

---

## 🎯 Generic Action Items

### 🔴 Critical (Security/Performance)
1. [ ] Fix hardcoded secrets and credentials
2. [ ] Implement proper input validation and sanitization
3. [ ] Add comprehensive error handling
4. [ ] Fix resource management and memory leaks
5. [ ] Implement security best practices

### 🟡 Important (Best Practices)
1. [ ] Improve code organization and modularity
2. [ ] Add comprehensive logging and monitoring
3. [ ] Implement proper caching strategies
4. [ ] Add performance optimization techniques
5. [ ] Improve documentation and comments

### 🟢 Improvements (Code Quality)
1. [ ] Add comprehensive test coverage
2. [ ] Implement proper design patterns
3. [ ] Add static analysis and linting
4. [ ] Improve code maintainability
5. [ ] Add proper CI/CD pipeline

---

## 💡 General Upgrade Recommendations

### Code Quality Improvements
- Implement static code analysis tools
- Add comprehensive test coverage
- Improve documentation and code comments
- Implement proper design patterns
- Add code review processes

### Security Enhancements
- Implement comprehensive security scanning
- Add penetration testing
- Improve authentication and authorization
- Implement secure coding practices
- Add security monitoring and alerting

### Performance Optimizations
- Implement performance monitoring
- Add caching strategies
- Optimize database queries
- Implement proper resource management
- Add load testing and capacity planning