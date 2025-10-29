<!-- AIDA - AI Development Assistant v1.0.0 -->
<!-- Advanced AI-powered code review and analysis -->

# Node.js Backend Review Template

## 🎯 Node.js-Specific Review Guidelines

This template focuses specifically on Node.js backend development best practices, patterns, and common pitfalls. Use this for reviewing Node.js applications, APIs, middleware, and server-side architecture.

---

<!-- 
📝 NOTE: The following CRITICAL CHECKS section applies to REVIEW-FILE only.
These comprehensive checks are for complete file analysis, not incremental changes.
For PR/change reviews, use review-pr.md or review-changes.md templates.
-->

## ⚡ NODE.JS CRITICAL CHECKS (Auto-FAIL if found)

**Scan EVERY line for these NODE.JS-SPECIFIC CRITICAL issues:**

### 🚨 SECURITY VIOLATIONS:
- SQL injection vulnerabilities in database queries
- NoSQL injection vulnerabilities in MongoDB queries
- Command injection through exec/spawn with user input
- Path traversal vulnerabilities in file operations
- XSS vulnerabilities through unsanitized output
- CSRF protection not implemented for state-changing operations
- Authentication tokens stored insecurely
- Secrets and API keys hardcoded in source code
- Missing input validation and sanitization
- Unsafe deserialization of user data

### 🚨 ASYNC/PROMISE VIOLATIONS:
- Unhandled promise rejections
- Missing error handling in async operations
- Callback hell instead of promises/async-await
- Race conditions in concurrent operations
- Memory leaks from uncleaned async operations
- Blocking the event loop with synchronous operations
- Missing timeout handling for external API calls
- Improper error propagation in async chains
- Using deprecated async patterns
- Not handling backpressure in streams

### 🚨 ERROR HANDLING VIOLATIONS:
- Missing global error handlers
- Errors not properly logged or monitored
- Sensitive information exposed in error messages
- Process crashes not handled gracefully
- Missing error boundaries for critical operations
- Errors swallowed without proper handling
- Stack traces exposed to clients in production
- Custom error types not properly implemented
- Error codes not standardized
- Recovery mechanisms not implemented

### 🚨 PERFORMANCE VIOLATIONS:
- Blocking I/O operations on main thread
- Memory leaks from event listeners not cleaned up
- CPU-intensive operations not offloaded to worker threads
- Database queries not optimized (N+1 queries)
- Missing connection pooling for databases
- Large payloads not streamed
- Missing caching strategies
- Inefficient data structures for large datasets
- Missing compression for responses
- Resource cleanup not properly implemented

### 🚨 API DESIGN VIOLATIONS:
- REST API not following HTTP standards
- Missing API versioning strategy
- Inconsistent response formats
- Missing pagination for large datasets
- Rate limiting not implemented
- CORS not properly configured
- Content-Type headers not properly set
- HTTP status codes used incorrectly
- API documentation not maintained
- Breaking changes without versioning

### 🚨 DATABASE VIOLATIONS:
- Database connections not properly pooled
- Transactions not properly handled
- Database queries vulnerable to injection
- Missing database indexes for performance
- Schema migrations not properly managed
- Connection strings with hardcoded credentials
- Database operations not properly validated
- Missing backup and recovery strategies
- Data integrity constraints not enforced
- Query timeouts not implemented

### 🚨 MIDDLEWARE VIOLATIONS:
- Middleware execution order incorrect
- Missing security middleware (helmet, CORS)
- Request/response not properly validated
- Middleware not handling errors properly
- Authentication middleware not properly secured
- Request logging not implemented securely
- Rate limiting middleware missing
- Compression middleware not configured
- Static file serving not secured
- Body parsing limits not set

### 🚨 CONFIGURATION VIOLATIONS:
- Environment variables not properly validated
- Configuration secrets not encrypted
- Default configurations used in production
- Missing environment-specific configurations
- Configuration files committed to version control
- Runtime configuration changes not handled
- Configuration validation not implemented
- Sensitive data in configuration files
- Missing configuration documentation
- Configuration hot-reloading not secured

### 🚨 LOGGING & MONITORING VIOLATIONS:
- Sensitive data logged in plain text
- Log levels not properly configured
- Missing structured logging
- Log injection vulnerabilities
- Performance metrics not collected
- Health checks not implemented
- Application metrics not monitored
- Error tracking not implemented
- Log rotation not configured
- Debug logs exposed in production

### 🚨 TESTING VIOLATIONS:
- Unit tests not isolated from external dependencies
- Integration tests not properly configured
- Test data not properly managed
- Async tests not properly handled
- Test coverage below acceptable threshold
- Mock implementations not realistic
- Test environments not properly isolated
- Performance tests not implemented
- Security tests not automated
- Test cleanup not properly implemented

### 🚨 SPECIFIC PROJECT RULES:
<!-- ADD PROJECT-SPECIFIC RULES HERE - These will be checked alongside Node.js rules -->
<!-- Additional project rules can be added here:
- Framework-specific patterns (Express, Fastify, Koa)
- Database ORM patterns (Prisma, TypeORM, Mongoose)
- Authentication strategies (JWT, OAuth, Passport)
- Microservices communication patterns
- Container and deployment requirements
-->

---

## 🔍 Node.js Code Analysis

### 1. **Server Architecture & Express.js Patterns**

#### 🏗️ Application Structure
- **Modular Architecture**
  - Routes properly organized and separated?
  - Controllers follow single responsibility?
  - Services layer properly abstracted?
  - Clear separation of concerns?

#### ⚡ Express.js Best Practices
- Middleware composition and ordering
- Route parameter validation
- Error handling middleware
- Security middleware implementation

#### 🎯 Server Implementation
```javascript
// Best Practice: Well-structured Express.js application with comprehensive patterns

const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const compression = require('compression')
const rateLimit = require('express-rate-limit')
const slowDown = require('express-slow-down')
const morgan = require('morgan')
const winston = require('winston')
const { v4: uuidv4 } = require('uuid')

const { errorHandler, notFoundHandler } = require('./middleware/errorHandler')
const { validateRequest } = require('./middleware/validation')
const { authenticate, authorize } = require('./middleware/auth')
const { requestLogger } = require('./middleware/requestLogger')
const config = require('./config')

// Import route modules
const authRoutes = require('./routes/auth')
const userRoutes = require('./routes/users')
const productRoutes = require('./routes/products')
const orderRoutes = require('./routes/orders')

// Initialize Express application
const app = express()

// Trust proxy for accurate IP addresses behind load balancers
app.set('trust proxy', 1)

// Configure logger
const logger = winston.createLogger({
  level: config.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'api-server' },
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
    }),
  ],
})

// Add console transport in development
if (config.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }))
}

// Security middleware - must be early in stack
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}))

// CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true)
    
    if (config.ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true)
    }
    
    const error = new Error('Not allowed by CORS')
    error.status = 403
    callback(error)
  },
  credentials: true,
  optionsSuccessStatus: 200 // For legacy browser support
}))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later',
    retryAfter: Math.ceil(15 * 60) // seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Custom key generator for more sophisticated rate limiting
  keyGenerator: (req) => {
    return req.ip + ':' + (req.user?.id || 'anonymous')
  },
  // Skip successful requests for certain endpoints
  skip: (req, res) => {
    return req.path === '/health' || req.path === '/metrics'
  }
})

// Speed limiting for additional protection
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // Allow 50 requests per windowMs without delay
  delayMs: 500 // Add 500ms delay per request after delayAfter
})

app.use('/api/', limiter)
app.use('/api/', speedLimiter)

// Compression middleware
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false
    }
    return compression.filter(req, res)
  },
  threshold: 1024 // Only compress responses larger than 1KB
}))

// Request parsing middleware
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf
  }
}))
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb',
  parameterLimit: 1000
}))

// Request ID and logging
app.use((req, res, next) => {
  req.id = uuidv4()
  res.setHeader('X-Request-ID', req.id)
  next()
})

// HTTP request logging
app.use(morgan('combined', {
  stream: {
    write: (message) => {
      logger.info(message.trim())
    }
  },
  skip: (req, res) => {
    // Skip health check logs in production
    return config.NODE_ENV === 'production' && req.path === '/health'
  }
}))

// Custom request logger middleware
app.use(requestLogger(logger))

// Health check endpoint (before authentication)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0'
  })
})

// Metrics endpoint for monitoring
app.get('/metrics', authenticate, authorize(['admin']), (req, res) => {
  res.json({
    memory: process.memoryUsage(),
    uptime: process.uptime(),
    cpuUsage: process.cpuUsage(),
    platform: process.platform,
    nodeVersion: process.version
  })
})

// API routes with authentication and validation
app.use('/api/auth', authRoutes)
app.use('/api/users', authenticate, userRoutes)
app.use('/api/products', productRoutes)
app.use('/api/orders', authenticate, orderRoutes)

// Static file serving with security headers
app.use('/static', express.static('public', {
  maxAge: '1d',
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
  }
}))

// API documentation (only in development)
if (config.NODE_ENV === 'development') {
  const swaggerUi = require('swagger-ui-express')
  const swaggerDocument = require('./docs/swagger.json')
  
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }'
  }))
}

// 404 handler for undefined routes
app.use(notFoundHandler)

// Global error handler (must be last)
app.use(errorHandler(logger))

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`)
  
  server.close((err) => {
    if (err) {
      logger.error('Error during server shutdown:', err)
      process.exit(1)
    }
    
    logger.info('Server closed successfully')
    
    // Close database connections
    require('./config/database').close()
      .then(() => {
        logger.info('Database connections closed')
        process.exit(0)
      })
      .catch((err) => {
        logger.error('Error closing database connections:', err)
        process.exit(1)
      })
  })
  
  // Force close after 10 seconds
  setTimeout(() => {
    logger.error('Forcing shutdown after 10 seconds')
    process.exit(1)
  }, 10000)
}

// Handle process signals for graceful shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err)
  gracefulShutdown('uncaughtException')
})

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason)
  gracefulShutdown('unhandledRejection')
})

// Start server
const PORT = config.PORT || 3000
const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} in ${config.NODE_ENV} mode`)
})

// Configure server timeouts
server.keepAliveTimeout = 65000 // Slightly higher than ALB idle timeout
server.headersTimeout = 66000 // Slightly higher than keepAliveTimeout

module.exports = { app, server }
```

#### 🛡️ Security Middleware Implementation
```javascript
// Best Practice: Comprehensive security middleware with proper error handling

const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const rateLimit = require('express-rate-limit')
const slowDown = require('express-slow-down')
const validator = require('validator')
const xss = require('xss')
const { body, param, query, validationResult } = require('express-validator')

const User = require('../models/User')
const config = require('../config')
const logger = require('../utils/logger')

// Enhanced authentication middleware
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
        message: 'Please provide a valid authentication token'
      })
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix
    
    if (!token) {
      return res.status(401).json({
        error: 'Invalid token format',
        code: 'INVALID_TOKEN_FORMAT'
      })
    }

    let decoded
    try {
      decoded = jwt.verify(token, config.JWT_SECRET)
    } catch (jwtError) {
      let errorCode = 'INVALID_TOKEN'
      let message = 'Invalid or expired token'
      
      if (jwtError.name === 'TokenExpiredError') {
        errorCode = 'TOKEN_EXPIRED'
        message = 'Token has expired'
      } else if (jwtError.name === 'JsonWebTokenError') {
        errorCode = 'MALFORMED_TOKEN'
        message = 'Malformed token'
      }
      
      return res.status(401).json({
        error: message,
        code: errorCode
      })
    }

    // Verify user still exists and is active
    const user = await User.findById(decoded.userId).select('+isActive +roles +permissions')
    
    if (!user) {
      return res.status(401).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      })
    }

    if (!user.isActive) {
      return res.status(401).json({
        error: 'Account is deactivated',
        code: 'ACCOUNT_DEACTIVATED'
      })
    }

    // Check if token was issued before any password changes
    if (user.passwordChangedAt && decoded.iat < user.passwordChangedAt.getTime() / 1000) {
      return res.status(401).json({
        error: 'Token is invalid due to password change',
        code: 'TOKEN_INVALIDATED'
      })
    }

    // Attach user to request
    req.user = user
    req.token = token
    
    // Log authentication for audit trail
    logger.info('User authenticated', {
      userId: user._id,
      email: user.email,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.id
    })

    next()
  } catch (error) {
    logger.error('Authentication error:', error)
    res.status(500).json({
      error: 'Authentication service unavailable',
      code: 'AUTH_SERVICE_ERROR'
    })
  }
}

// Authorization middleware with role and permission checking
const authorize = (requiredRoles = [], requiredPermissions = []) => {
  return (req, res, next) => {
    try {
      const user = req.user
      
      if (!user) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        })
      }

      // Check roles
      const hasRequiredRole = requiredRoles.length === 0 || 
        requiredRoles.some(role => user.roles.includes(role))
      
      // Check permissions
      const hasRequiredPermission = requiredPermissions.length === 0 || 
        requiredPermissions.some(permission => user.permissions.includes(permission))

      if (!hasRequiredRole && !hasRequiredPermission) {
        logger.warn('Authorization failed', {
          userId: user._id,
          requiredRoles,
          userRoles: user.roles,
          requiredPermissions,
          userPermissions: user.permissions,
          requestId: req.id
        })
        
        return res.status(403).json({
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'You do not have the required permissions to access this resource'
        })
      }

      next()
    } catch (error) {
      logger.error('Authorization error:', error)
      res.status(500).json({
        error: 'Authorization service unavailable',
        code: 'AUTH_SERVICE_ERROR'
      })
    }
  }
}

// Input validation and sanitization middleware
const validateAndSanitize = (validations) => {
  return [
    ...validations,
    (req, res, next) => {
      const errors = validationResult(req)
      
      if (!errors.isEmpty()) {
        const formattedErrors = errors.array().map(error => ({
          field: error.param,
          message: error.msg,
          value: error.value,
          location: error.location
        }))
        
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: formattedErrors
        })
      }

      // Sanitize string inputs to prevent XSS
      const sanitizeObject = (obj) => {
        for (const key in obj) {
          if (typeof obj[key] === 'string') {
            obj[key] = xss(obj[key])
          } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            sanitizeObject(obj[key])
          }
        }
      }

      if (req.body) sanitizeObject(req.body)
      if (req.query) sanitizeObject(req.query)
      if (req.params) sanitizeObject(req.params)

      next()
    }
  ]
}

// Rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many authentication attempts',
    code: 'TOO_MANY_AUTH_ATTEMPTS',
    retryAfter: 15 * 60 // seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // Don't count successful requests
})

// Strict rate limiting for password reset
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit to 3 password reset attempts per hour
  message: {
    error: 'Too many password reset attempts',
    code: 'TOO_MANY_RESET_ATTEMPTS',
    retryAfter: 60 * 60
  }
})

// CSRF protection for state-changing operations
const csrfProtection = (req, res, next) => {
  // Skip CSRF for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next()
  }

  // Skip CSRF for API endpoints with valid JWT
  if (req.headers.authorization && req.user) {
    return next()
  }

  const token = req.headers['x-csrf-token'] || req.body._csrf

  if (!token) {
    return res.status(403).json({
      error: 'CSRF token required',
      code: 'CSRF_TOKEN_REQUIRED'
    })
  }

  // Verify CSRF token
  if (!verifyCsrfToken(token, req.session)) {
    return res.status(403).json({
      error: 'Invalid CSRF token',
      code: 'INVALID_CSRF_TOKEN'
    })
  }

  next()
}

// Common validation rules
const commonValidations = {
  email: body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Must be a valid email address')
    .isLength({ max: 254 })
    .withMessage('Email must be less than 254 characters'),
    
  password: body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one lowercase, one uppercase, one number, and one special character'),
    
  id: param('id')
    .isMongoId()
    .withMessage('Must be a valid ID'),
    
  pagination: [
    query('page')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .toInt()
      .withMessage('Page must be a positive integer between 1 and 1000'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .toInt()
      .withMessage('Limit must be between 1 and 100')
  ],
  
  search: query('search')
    .optional()
    .isLength({ max: 100 })
    .trim()
    .escape()
    .withMessage('Search term must be less than 100 characters')
}

// Helper function to verify CSRF tokens
const verifyCsrfToken = (token, session) => {
  // Implement CSRF token verification logic
  return session && session.csrfToken === token
}

module.exports = {
  authenticate,
  authorize,
  validateAndSanitize,
  authLimiter,
  passwordResetLimiter,
  csrfProtection,
  commonValidations
}
```

---

### 2. **Database Integration & ORM Patterns**

#### 🗄️ Database Configuration
```javascript
// Best Practice: Robust database configuration with connection pooling and monitoring

const mongoose = require('mongoose')
const { MongoClient } = require('mongodb')
const config = require('./index')
const logger = require('../utils/logger')

class DatabaseManager {
  constructor() {
    this.mongoose = null
    this.mongoClient = null
    this.isConnected = false
    this.connectionAttempts = 0
    this.maxRetries = 5
    this.retryDelay = 5000 // 5 seconds
  }

  async connectMongoDB() {
    try {
      // Mongoose connection options
      const mongooseOptions = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: config.DB_MAX_POOL_SIZE || 10,
        minPoolSize: config.DB_MIN_POOL_SIZE || 5,
        maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
        serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
        socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
        family: 4, // Use IPv4, skip trying IPv6
        bufferCommands: false, // Disable mongoose buffering
        bufferMaxEntries: 0 // Disable mongoose buffering
      }

      // Add authentication if provided
      if (config.DB_USERNAME && config.DB_PASSWORD) {
        mongooseOptions.auth = {
          username: config.DB_USERNAME,
          password: config.DB_PASSWORD
        }
        mongooseOptions.authSource = config.DB_AUTH_SOURCE || 'admin'
      }

      // Enable debug mode in development
      if (config.NODE_ENV === 'development') {
        mongoose.set('debug', (collectionName, method, query, doc) => {
          logger.debug('Mongoose Debug', {
            collection: collectionName,
            method,
            query: JSON.stringify(query),
            doc: JSON.stringify(doc)
          })
        })
      }

      // Connect to MongoDB
      this.mongoose = await mongoose.connect(config.DATABASE_URL, mongooseOptions)
      
      // Set up connection event handlers
      mongoose.connection.on('connected', () => {
        logger.info('Mongoose connected to MongoDB')
        this.isConnected = true
        this.connectionAttempts = 0
      })

      mongoose.connection.on('error', (err) => {
        logger.error('Mongoose connection error:', err)
        this.isConnected = false
      })

      mongoose.connection.on('disconnected', () => {
        logger.warn('Mongoose disconnected from MongoDB')
        this.isConnected = false
        
        // Attempt to reconnect
        this.handleReconnection()
      })

      mongoose.connection.on('reconnected', () => {
        logger.info('Mongoose reconnected to MongoDB')
        this.isConnected = true
        this.connectionAttempts = 0
      })

      // Handle process termination
      process.on('SIGINT', this.gracefulShutdown.bind(this))
      process.on('SIGTERM', this.gracefulShutdown.bind(this))

      logger.info('MongoDB connection established successfully')
      return this.mongoose

    } catch (error) {
      logger.error('Failed to connect to MongoDB:', error)
      await this.handleConnectionError(error)
      throw error
    }
  }

  async handleReconnection() {
    if (this.connectionAttempts >= this.maxRetries) {
      logger.error('Max reconnection attempts reached. Exiting...')
      process.exit(1)
    }

    this.connectionAttempts++
    logger.info(`Attempting to reconnect to MongoDB (attempt ${this.connectionAttempts}/${this.maxRetries})`)

    setTimeout(() => {
      this.connectMongoDB().catch(err => {
        logger.error('Reconnection failed:', err)
      })
    }, this.retryDelay * this.connectionAttempts)
  }

  async handleConnectionError(error) {
    if (this.connectionAttempts < this.maxRetries) {
      this.connectionAttempts++
      logger.info(`Retrying connection in ${this.retryDelay}ms (attempt ${this.connectionAttempts}/${this.maxRetries})`)
      
      await new Promise(resolve => setTimeout(resolve, this.retryDelay))
      return this.connectMongoDB()
    } else {
      logger.error('Max connection attempts reached. Unable to connect to MongoDB.')
      throw new Error('Database connection failed after multiple attempts')
    }
  }

  async gracefulShutdown() {
    logger.info('Closing MongoDB connections...')
    
    try {
      if (this.mongoose) {
        await mongoose.connection.close()
        logger.info('Mongoose connection closed')
      }
      
      if (this.mongoClient) {
        await this.mongoClient.close()
        logger.info('MongoDB native client connection closed')
      }
      
      this.isConnected = false
    } catch (error) {
      logger.error('Error closing database connections:', error)
      throw error
    }
  }

  // Health check for database connection
  async healthCheck() {
    try {
      if (!this.isConnected) {
        return { status: 'disconnected', error: 'Database not connected' }
      }

      // Perform a simple operation to verify connection
      await mongoose.connection.db.admin().ping()
      
      const stats = await mongoose.connection.db.stats()
      
      return {
        status: 'connected',
        database: mongoose.connection.name,
        readyState: mongoose.connection.readyState,
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        stats: {
          collections: stats.collections,
          dataSize: stats.dataSize,
          indexSize: stats.indexSize
        }
      }
    } catch (error) {
      logger.error('Database health check failed:', error)
      return { status: 'error', error: error.message }
    }
  }

  // Get connection pool statistics
  getPoolStats() {
    if (!this.mongoose) {
      return null
    }

    const poolStats = mongoose.connection.db.serverConfig.s.pool
    return {
      totalConnections: poolStats.totalConnections,
      availableConnections: poolStats.availableConnections,
      checkedOutConnections: poolStats.checkedOutConnections,
      createdConnections: poolStats.createdConnections,
      destroyedConnections: poolStats.destroyedConnections
    }
  }
}

// Singleton instance
const databaseManager = new DatabaseManager()

module.exports = {
  connect: () => databaseManager.connectMongoDB(),
  close: () => databaseManager.gracefulShutdown(),
  healthCheck: () => databaseManager.healthCheck(),
  getPoolStats: () => databaseManager.getPoolStats(),
  get isConnected() {
    return databaseManager.isConnected
  }
}
```

#### 🏗️ Model Patterns with Mongoose
```javascript
// Best Practice: Comprehensive Mongoose model with validation, middleware, and methods

const mongoose = require('mongoose')
const bcrypt = require('bcrypt')
const validator = require('validator')
const crypto = require('crypto')

// User schema with comprehensive validation and security
const userSchema = new mongoose.Schema({
  // Basic information
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    maxlength: [254, 'Email must be less than 254 characters'],
    validate: {
      validator: validator.isEmail,
      message: 'Please provide a valid email address'
    }
  },
  
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username must be less than 30 characters'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
  },
  
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name must be less than 50 characters'],
    validate: {
      validator: function(v) {
        return /^[a-zA-Z\s'-]+$/.test(v)
      },
      message: 'First name can only contain letters, spaces, hyphens, and apostrophes'
    }
  },
  
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name must be less than 50 characters'],
    validate: {
      validator: function(v) {
        return /^[a-zA-Z\s'-]+$/.test(v)
      },
      message: 'Last name can only contain letters, spaces, hyphens, and apostrophes'
    }
  },
  
  // Authentication
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    maxlength: [128, 'Password must be less than 128 characters'],
    select: false, // Don't include password in queries by default
    validate: {
      validator: function(v) {
        // Password must contain at least one lowercase, one uppercase, one number, and one special character
        return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(v)
      },
      message: 'Password must contain at least one lowercase, one uppercase, one number, and one special character'
    }
  },
  
  passwordChangedAt: {
    type: Date,
    default: Date.now,
    select: false
  },
  
  passwordResetToken: {
    type: String,
    select: false
  },
  
  passwordResetExpires: {
    type: Date,
    select: false
  },
  
  // Account status
  isActive: {
    type: Boolean,
    default: true,
    select: false
  },
  
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  
  emailVerificationToken: {
    type: String,
    select: false
  },
  
  emailVerificationExpires: {
    type: Date,
    select: false
  },
  
  // Authorization
  roles: [{
    type: String,
    enum: ['user', 'admin', 'moderator', 'manager'],
    default: 'user'
  }],
  
  permissions: [{
    type: String,
    enum: [
      'users:read', 'users:write', 'users:delete',
      'products:read', 'products:write', 'products:delete',
      'orders:read', 'orders:write', 'orders:delete',
      'admin:access'
    ]
  }],
  
  // Profile information
  avatar: {
    type: String,
    validate: {
      validator: function(v) {
        return !v || validator.isURL(v)
      },
      message: 'Avatar must be a valid URL'
    }
  },
  
  phone: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        return !v || validator.isMobilePhone(v, 'any')
      },
      message: 'Please provide a valid phone number'
    }
  },
  
  dateOfBirth: {
    type: Date,
    validate: {
      validator: function(v) {
        return !v || v < new Date()
      },
      message: 'Date of birth must be in the past'
    }
  },
  
  // Address information
  address: {
    street: {
      type: String,
      trim: true,
      maxlength: [100, 'Street address must be less than 100 characters']
    },
    city: {
      type: String,
      trim: true,
      maxlength: [50, 'City must be less than 50 characters']
    },
    state: {
      type: String,
      trim: true,
      maxlength: [50, 'State must be less than 50 characters']
    },
    zipCode: {
      type: String,
      trim: true,
      validate: {
        validator: function(v) {
          return !v || /^\d{5}(-\d{4})?$/.test(v)
        },
        message: 'Please provide a valid ZIP code'
      }
    },
    country: {
      type: String,
      trim: true,
      maxlength: [50, 'Country must be less than 50 characters']
    }
  },
  
  // Security and tracking
  loginAttempts: {
    type: Number,
    default: 0,
    max: [5, 'Too many login attempts']
  },
  
  lockUntil: {
    type: Date,
    select: false
  },
  
  lastLogin: {
    type: Date
  },
  
  lastLoginIP: {
    type: String,
    validate: {
      validator: function(v) {
        return !v || validator.isIP(v)
      },
      message: 'Invalid IP address'
    }
  },
  
  // Two-factor authentication
  twoFactorSecret: {
    type: String,
    select: false
  },
  
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  
  // Preferences
  preferences: {
    language: {
      type: String,
      enum: ['en', 'es', 'fr', 'de', 'it'],
      default: 'en'
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      push: {
        type: Boolean,
        default: true
      },
      sms: {
        type: Boolean,
        default: false
      }
    }
  },
  
  // Metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.__v
      delete ret.password
      delete ret.passwordResetToken
      delete ret.passwordResetExpires
      delete ret.emailVerificationToken
      delete ret.emailVerificationExpires
      delete ret.twoFactorSecret
      return ret
    }
  },
  toObject: { virtuals: true }
})

// Indexes for performance
userSchema.index({ email: 1 })
userSchema.index({ username: 1 })
userSchema.index({ 'address.zipCode': 1 })
userSchema.index({ roles: 1 })
userSchema.index({ isActive: 1, isEmailVerified: 1 })
userSchema.index({ createdAt: -1 })

// Compound indexes
userSchema.index({ email: 1, isActive: 1 })
userSchema.index({ roles: 1, permissions: 1 })

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`.trim()
})

// Virtual for account lock status
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now())
})

// Pre-save middleware for password hashing
userSchema.pre('save', async function(next) {
  // Only hash password if it's modified
  if (!this.isModified('password')) return next()
  
  try {
    // Hash password with cost of 12
    const saltRounds = 12
    this.password = await bcrypt.hash(this.password, saltRounds)
    
    // Update password changed timestamp
    if (!this.isNew) {
      this.passwordChangedAt = new Date()
    }
    
    next()
  } catch (error) {
    next(error)
  }
})

// Pre-save middleware for email verification
userSchema.pre('save', function(next) {
  if (this.isModified('email') && !this.isNew) {
    this.isEmailVerified = false
    this.emailVerificationToken = crypto.randomBytes(32).toString('hex')
    this.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  }
  next()
})

// Instance methods
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) {
    throw new Error('User password not available for comparison')
  }
  return bcrypt.compare(candidatePassword, this.password)
}

userSchema.methods.createPasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex')
  
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex')
  
  this.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
  
  return resetToken
}

userSchema.methods.createEmailVerificationToken = function() {
  const verificationToken = crypto.randomBytes(32).toString('hex')
  
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex')
  
  this.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  
  return verificationToken
}

userSchema.methods.hasPermission = function(permission) {
  return this.permissions.includes(permission) || this.roles.includes('admin')
}

userSchema.methods.hasRole = function(role) {
  return this.roles.includes(role)
}

userSchema.methods.incrementLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    })
  }
  
  const updates = { $inc: { loginAttempts: 1 } }
  
  // Lock account after 5 attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 } // 2 hours
  }
  
  return this.updateOne(updates)
}

userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 },
    $set: { 
      lastLogin: new Date(),
      lastLoginIP: this.lastLoginIP 
    }
  })
}

// Static methods
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() }).select('+password +isActive')
}

userSchema.statics.findActiveUsers = function() {
  return this.find({ isActive: true, isEmailVerified: true })
}

userSchema.statics.findByRole = function(role) {
  return this.find({ roles: role, isActive: true })
}

userSchema.statics.findByPermission = function(permission) {
  return this.find({ 
    $or: [
      { permissions: permission },
      { roles: 'admin' }
    ],
    isActive: true 
  })
}

// Query middleware
userSchema.pre(/^find/, function(next) {
  // Exclude inactive users by default
  this.find({ isActive: { $ne: false } })
  next()
})

// Error handling for unique constraints
userSchema.post('save', function(error, doc, next) {
  if (error.name === 'MongoServerError' && error.code === 11000) {
    const field = Object.keys(error.keyPattern)[0]
    const message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`
    next(new Error(message))
  } else {
    next(error)
  }
})

// Create and export model
const User = mongoose.model('User', userSchema)

module.exports = User
```

---

## 📊 Node.js Health Metrics

### Framework Compliance
- **Security Implementation**: ⭐⭐⭐⭐⭐ (X/5)
- **Performance Optimization**: ⭐⭐⭐⭐⭐ (X/5)
- **Error Handling**: ⭐⭐⭐⭐⭐ (X/5)
- **Code Architecture**: ⭐⭐⭐⭐⭐ (X/5)
- **Testing Coverage**: ⭐⭐⭐⭐⭐ (X/5)

### Overall Node.js Score: ⭐⭐⭐⭐⭐ (X/10)

---

## 🎯 Node.js-Specific Action Items

### 🔴 Critical (Security/Performance)
1. [ ] Fix SQL/NoSQL injection vulnerabilities
2. [ ] Implement proper error handling for async operations
3. [ ] Add security middleware (helmet, CORS, rate limiting)
4. [ ] Fix unhandled promise rejections and exceptions
5. [ ] Implement proper input validation and sanitization

### 🟡 Important (Best Practices)
1. [ ] Implement comprehensive logging and monitoring
2. [ ] Add proper authentication and authorization
3. [ ] Optimize database queries and connection pooling
4. [ ] Implement graceful shutdown handling
5. [ ] Add comprehensive API documentation

### 🟢 Improvements (Code Quality)
1. [ ] Add comprehensive TypeScript definitions
2. [ ] Implement proper testing strategies
3. [ ] Add performance monitoring and profiling
4. [ ] Optimize bundle size and memory usage
5. [ ] Add proper CI/CD pipeline configuration

---

## 💡 Node.js Upgrade Recommendations

### Migration Opportunities
- Node.js 18+ LTS with latest performance improvements
- ES Modules adoption for better tree shaking
- Native test runner for improved testing
- Web Streams API for better stream handling
- Enhanced security with built-in test runner
- Improved error handling with AbortController

### Performance Improvements
- Worker threads for CPU-intensive operations
- Cluster mode for multi-core utilization
- HTTP/2 and HTTP/3 support for better networking
- Streaming for large data processing
- Caching strategies with Redis/Memcached
- Database query optimization and indexing
- Container optimization for production deployment