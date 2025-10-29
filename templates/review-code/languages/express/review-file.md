<!-- AIDA - AI Development Assistant v1.0.0 -->
<!-- Advanced AI-powered code review and analysis -->

# Express.js Framework Review Template

## 🎯 Express.js-Specific Review Guidelines

This template focuses specifically on Express.js framework best practices, patterns, and common pitfalls. Use this for reviewing Express.js routes, middleware, controllers, and configuration files.

---

<!-- 
📝 NOTE: The following CRITICAL CHECKS section applies to REVIEW-FILE only.
These comprehensive checks are for complete file analysis, not incremental changes.
For PR/change reviews, use review-pr.md or review-changes.md templates.
-->

## ⚡ EXPRESS.JS CRITICAL CHECKS (Auto-FAIL if found)

**Scan EVERY line for these EXPRESS.JS-SPECIFIC CRITICAL issues:**

### 🚨 SECURITY VIOLATIONS:
- Missing authentication middleware on protected routes
- SQL injection through unsanitized user input
- XSS vulnerabilities from unescaped output
- CSRF protection not implemented for state-changing operations
- File upload vulnerabilities (unrestricted file types/sizes)
- Path traversal vulnerabilities in file serving
- Missing input validation and sanitization
- Exposed sensitive data in error messages
- Missing security headers (helmet middleware)
- CORS misconfiguration allowing unauthorized origins
- Session configuration without secure flags
- JWT tokens stored insecurely on client side
- Rate limiting not implemented on API endpoints
- Missing HTTPS enforcement in production

### 🚨 MIDDLEWARE VIOLATIONS:
- Middleware order incorrect (security before routes)
- Missing error handling middleware
- Middleware not handling async errors properly
- Global middleware applied too broadly
- Missing request logging and monitoring
- Body parser limits not configured properly
- Static file serving without proper security
- Middleware chain broken by missing next() calls
- Custom middleware without proper error handling
- Middleware functions not reusable or testable

### 🚨 ROUTING VIOLATIONS:
- Routes not organized into proper modules
- Route handlers with too much business logic
- Missing route parameter validation
- Duplicate route definitions
- Routes not following RESTful conventions
- Missing HTTP method implementations (OPTIONS, HEAD)
- Route handlers not returning proper status codes
- Async route handlers without error catching
- Routes accessing database directly without service layer
- Missing API versioning strategy

### 🚨 ERROR HANDLING VIOLATIONS:
- Unhandled promise rejections in async routes
- Generic error responses exposing internal details
- Missing error logging and monitoring
- Error middleware not positioned correctly
- Custom errors without proper inheritance
- Database errors not properly transformed
- Validation errors not user-friendly
- 500 errors returned for client errors
- Error stack traces exposed in production
- Missing correlation IDs for error tracking

### 🚨 ASYNC/PROMISE VIOLATIONS:
- Promise chains not properly handled
- Async/await without try-catch blocks
- Callback hell in modern Express code
- Missing error propagation in async middleware
- Promises not properly awaited
- Async operations blocking the event loop
- Missing timeout handling for external calls
- Resource leaks from unclosed connections
- Concurrent operations without proper control
- Database connections not properly released

### 🚨 VALIDATION VIOLATIONS:
- User input not validated before processing
- Request body validation missing or inadequate
- Query parameter validation not implemented
- File upload validation insufficient
- Data type validation missing
- Business rule validation not enforced
- Validation error messages too generic
- Validation bypassed in certain conditions
- Custom validation not properly tested
- Validation logic mixed with business logic

### 🚨 DATABASE VIOLATIONS:
- Database queries vulnerable to injection
- Connection pooling not properly configured
- Database connections not properly closed
- N+1 query problems not addressed
- Large result sets loaded without pagination
- Database transactions not used for critical operations
- Missing error handling for database operations
- Database credentials hardcoded in source
- Missing database connection retry logic
- Database operations blocking the event loop

### 🚨 PERFORMANCE VIOLATIONS:
- Synchronous file operations in request handlers
- Missing response compression
- Static assets not properly cached
- Database queries not optimized
- Missing pagination for large datasets
- Memory leaks from event listeners
- CPU-intensive operations blocking event loop
- Missing connection keep-alive configuration
- Inefficient JSON parsing and serialization
- Missing performance monitoring and profiling

### 🚨 TESTING VIOLATIONS:
- Route handlers not unit testable
- Missing integration tests for API endpoints
- Test database not properly isolated
- Mocking not done properly in unit tests
- End-to-end tests missing critical scenarios
- Test coverage inadequate for error conditions
- Test data not properly cleaned up
- Performance tests missing for critical endpoints
- Security tests not implemented
- Load testing not performed

### 🚨 CONFIGURATION VIOLATIONS:
- Environment variables not used for configuration
- Sensitive configuration in version control
- Missing environment-specific configurations
- Configuration validation not implemented
- Default configurations used in production
- Configuration not properly typed
- Missing configuration documentation
- Configuration changes requiring code deployment
- Hardcoded URLs and connection strings
- Missing feature flags and toggles

### 🚨 SPECIFIC PROJECT RULES:
<!-- ADD PROJECT-SPECIFIC RULES HERE - These will be checked alongside Express.js rules -->
<!-- Additional project rules can be added here:
- Microservice communication patterns
- API gateway integration patterns
- Message queue integration
- Real-time features with WebSockets
- File storage and CDN integration
-->

---

## 🔍 Express.js Code Analysis

### 1. **Application Structure & Middleware**

#### 🏗️ App Organization
- **Modular Structure**
  - Routes organized in separate modules?
  - Middleware properly separated by concern?
  - Configuration management centralized?
  - Environment-specific setup handled?

#### 🔧 Middleware Stack
- Security middleware positioned correctly
- Error handling middleware at the end
- Request/response transformation
- Logging and monitoring integration

#### 🎯 Express Patterns
```javascript
// Best Practice: Well-structured Express.js application

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const hpp = require('hpp');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const cookieParser = require('cookie-parser');
const path = require('path');

const config = require('./config');
const logger = require('./utils/logger');
const { errorHandler, notFound } = require('./middleware/errorMiddleware');
const authMiddleware = require('./middleware/authMiddleware');
const validationMiddleware = require('./middleware/validationMiddleware');

// Route imports
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const adminRoutes = require('./routes/adminRoutes');

class App {
  constructor() {
    this.app = express();
    this.setupSecurity();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  setupSecurity() {
    // Security middleware - MUST be first
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:"],
          scriptSrc: ["'self'"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    }));

    // CORS configuration
    this.app.use(cors({
      origin: config.cors.allowedOrigins,
      credentials: true,
      optionsSuccessStatus: 200,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: {
        error: 'Too many requests from this IP, please try again later.',
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/api/', limiter);

    // Stricter rate limiting for auth endpoints
    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 5,
      message: {
        error: 'Too many authentication attempts, please try again later.',
      },
    });
    this.app.use('/api/auth/login', authLimiter);
    this.app.use('/api/auth/register', authLimiter);

    // Data sanitization
    this.app.use(mongoSanitize()); // Against NoSQL query injection
    this.app.use(xss()); // Against XSS attacks
    this.app.use(hpp()); // Against HTTP Parameter Pollution
  }

  setupMiddleware() {
    // Request parsing
    this.app.use(express.json({ 
      limit: '10mb',
      verify: (req, res, buf) => {
        req.rawBody = buf;
      }
    }));
    this.app.use(express.urlencoded({ 
      extended: true, 
      limit: '10mb' 
    }));
    this.app.use(cookieParser());

    // Compression
    this.app.use(compression());

    // Logging
    if (config.env === 'development') {
      this.app.use(morgan('dev'));
    } else {
      this.app.use(morgan('combined', {
        stream: { write: message => logger.info(message.trim()) }
      }));
    }

    // Request correlation ID
    this.app.use((req, res, next) => {
      req.correlationId = req.headers['x-correlation-id'] || 
                         require('crypto').randomUUID();
      res.setHeader('X-Correlation-ID', req.correlationId);
      next();
    });

    // Request timing
    this.app.use((req, res, next) => {
      req.startTime = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - req.startTime;
        logger.info(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`, {
          correlationId: req.correlationId,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
        });
      });
      next();
    });

    // Static files with proper caching
    this.app.use('/static', express.static(path.join(__dirname, 'public'), {
      maxAge: config.env === 'production' ? '7d' : '0',
      etag: true,
      lastModified: true,
      setHeaders: (res, filePath) => {
        if (path.extname(filePath) === '.html') {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    }));

    // Health check endpoint (no auth required)
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.env,
        version: config.version,
      });
    });
  }

  setupRoutes() {
    // API routes with proper versioning
    const apiV1 = express.Router();
    
    // Public routes
    apiV1.use('/auth', authRoutes);
    
    // Protected routes
    apiV1.use('/users', authMiddleware.requireAuth, userRoutes);
    apiV1.use('/products', authMiddleware.requireAuth, productRoutes);
    apiV1.use('/orders', authMiddleware.requireAuth, orderRoutes);
    
    // Admin routes with additional authorization
    apiV1.use('/admin', 
      authMiddleware.requireAuth, 
      authMiddleware.requireRole(['admin']), 
      adminRoutes
    );

    // Mount API routes
    this.app.use('/api/v1', apiV1);

    // API documentation
    if (config.env !== 'production') {
      const swaggerUi = require('swagger-ui-express');
      const swaggerDocument = require('./docs/swagger.json');
      this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
    }
  }

  setupErrorHandling() {
    // 404 handler
    this.app.use(notFound);

    // Global error handler (MUST be last)
    this.app.use(errorHandler);

    // Unhandled promise rejection handler
    process.on('unhandledRejection', (err) => {
      logger.error('Unhandled Promise Rejection:', err);
      // Graceful shutdown
      process.exit(1);
    });

    // Uncaught exception handler
    process.on('uncaughtException', (err) => {
      logger.error('Uncaught Exception:', err);
      // Graceful shutdown
      process.exit(1);
    });
  }

  getApp() {
    return this.app;
  }
}

// Export configured app
module.exports = new App().getApp();

// Server startup with graceful shutdown
const server = require('./server');

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}, starting graceful shutdown...`);
  
  server.close((err) => {
    if (err) {
      logger.error('Error during graceful shutdown:', err);
      process.exit(1);
    }
    
    logger.info('Server closed successfully');
    
    // Close database connections
    require('./config/database').close()
      .then(() => {
        logger.info('Database connections closed');
        process.exit(0);
      })
      .catch((dbErr) => {
        logger.error('Error closing database connections:', dbErr);
        process.exit(1);
      });
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ❌ Bad: Poor app structure
const badApp = express();

// Security issues
badApp.use(cors()); // Allows all origins
badApp.use(express.json()); // No size limit

// No rate limiting
// No helmet
// No input sanitization

// Poor route organization
badApp.get('/users', (req, res) => {
  // Business logic in route handler
  const users = db.query('SELECT * FROM users'); // SQL injection risk
  res.json(users);
});

// No error handling
// No logging
// No graceful shutdown
```

#### ❌ Common Issues
- Security middleware missing or incorrectly ordered
- No rate limiting or input validation
- Poor error handling
- Missing logging and monitoring

---

### 2. **Routing & Controllers**

#### 🌐 RESTful Route Design
```javascript
// Best Practice: Well-structured Express.js routing

const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const { body, param, query, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const validationMiddleware = require('../middleware/validationMiddleware');
const uploadMiddleware = require('../middleware/uploadMiddleware');

// Rate limiting for specific routes
const createUserLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 user creations per hour
  message: 'Too many user creation attempts, please try again later.',
});

// Validation schemas
const createUserValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required')
    .custom(async (email) => {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        throw new Error('Email already in use');
      }
    }),
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number and special character'),
  body('firstName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name is required and must be less than 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('First name can only contain letters and spaces'),
  body('lastName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name is required and must be less than 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Last name can only contain letters and spaces'),
  body('phoneNumber')
    .optional()
    .isMobilePhone()
    .withMessage('Valid phone number is required'),
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .toDate()
    .custom((date) => {
      const age = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24 * 365);
      if (age < 13) {
        throw new Error('User must be at least 13 years old');
      }
      return true;
    }),
];

const updateUserValidation = [
  param('id').isUUID().withMessage('Valid user ID is required'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be less than 50 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be less than 50 characters'),
  body('phoneNumber')
    .optional()
    .isMobilePhone()
    .withMessage('Valid phone number is required'),
];

const getUserValidation = [
  param('id').isUUID().withMessage('Valid user ID is required'),
];

const getUsersValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .toInt()
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .toInt()
    .withMessage('Limit must be between 1 and 100'),
  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters'),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'firstName', 'lastName', 'email'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
];

// Routes with proper middleware chain

/**
 * @route   GET /api/v1/users
 * @desc    Get all users with pagination and filtering
 * @access  Private (Admin/Manager)
 */
router.get('/',
  authMiddleware.requireAuth,
  authMiddleware.requireRole(['admin', 'manager']),
  getUsersValidation,
  validationMiddleware.handleValidationErrors,
  asyncHandler(userController.getUsers)
);

/**
 * @route   GET /api/v1/users/:id
 * @desc    Get user by ID
 * @access  Private
 */
router.get('/:id',
  authMiddleware.requireAuth,
  getUserValidation,
  validationMiddleware.handleValidationErrors,
  authMiddleware.canAccessUser, // Custom middleware to check user access
  asyncHandler(userController.getUserById)
);

/**
 * @route   POST /api/v1/users
 * @desc    Create new user
 * @access  Private (Admin)
 */
router.post('/',
  createUserLimiter,
  authMiddleware.requireAuth,
  authMiddleware.requireRole(['admin']),
  createUserValidation,
  validationMiddleware.handleValidationErrors,
  asyncHandler(userController.createUser)
);

/**
 * @route   PUT /api/v1/users/:id
 * @desc    Update user by ID
 * @access  Private
 */
router.put('/:id',
  authMiddleware.requireAuth,
  updateUserValidation,
  validationMiddleware.handleValidationErrors,
  authMiddleware.canModifyUser,
  asyncHandler(userController.updateUser)
);

/**
 * @route   DELETE /api/v1/users/:id
 * @desc    Delete user by ID
 * @access  Private (Admin)
 */
router.delete('/:id',
  authMiddleware.requireAuth,
  authMiddleware.requireRole(['admin']),
  getUserValidation,
  validationMiddleware.handleValidationErrors,
  asyncHandler(userController.deleteUser)
);

/**
 * @route   POST /api/v1/users/:id/avatar
 * @desc    Upload user avatar
 * @access  Private
 */
router.post('/:id/avatar',
  authMiddleware.requireAuth,
  getUserValidation,
  validationMiddleware.handleValidationErrors,
  authMiddleware.canModifyUser,
  uploadMiddleware.single('avatar', {
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxSize: 5 * 1024 * 1024, // 5MB
    destination: 'uploads/avatars',
  }),
  asyncHandler(userController.uploadAvatar)
);

/**
 * @route   GET /api/v1/users/:id/audit-log
 * @desc    Get user audit log
 * @access  Private (Admin)
 */
router.get('/:id/audit-log',
  authMiddleware.requireAuth,
  authMiddleware.requireRole(['admin']),
  getUserValidation,
  validationMiddleware.handleValidationErrors,
  asyncHandler(userController.getUserAuditLog)
);

/**
 * @route   POST /api/v1/users/bulk
 * @desc    Bulk create users
 * @access  Private (Admin)
 */
router.post('/bulk',
  authMiddleware.requireAuth,
  authMiddleware.requireRole(['admin']),
  body('users').isArray({ min: 1, max: 100 }).withMessage('Users array is required (1-100 items)'),
  body('users.*.email').isEmail().normalizeEmail(),
  body('users.*.firstName').trim().isLength({ min: 1, max: 50 }),
  body('users.*.lastName').trim().isLength({ min: 1, max: 50 }),
  validationMiddleware.handleValidationErrors,
  asyncHandler(userController.bulkCreateUsers)
);

/**
 * @route   GET /api/v1/users/export
 * @desc    Export users data
 * @access  Private (Admin)
 */
router.get('/export',
  authMiddleware.requireAuth,
  authMiddleware.requireRole(['admin']),
  query('format').isIn(['csv', 'xlsx', 'json']).withMessage('Format must be csv, xlsx, or json'),
  query('startDate').optional().isISO8601().toDate(),
  query('endDate').optional().isISO8601().toDate(),
  validationMiddleware.handleValidationErrors,
  asyncHandler(userController.exportUsers)
);

// Error handling for this router
router.use((error, req, res, next) => {
  logger.error('User routes error:', {
    error: error.message,
    stack: error.stack,
    correlationId: req.correlationId,
    path: req.path,
    method: req.method,
  });
  next(error);
});

module.exports = router;

// Controller with proper separation of concerns
const userController = {
  async getUsers(req, res) {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filters = {
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      sortBy,
      sortOrder,
    };

    const result = await userService.findAll(filters);

    res.status(200).json({
      success: true,
      data: result.users,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
      meta: {
        timestamp: new Date().toISOString(),
        correlationId: req.correlationId,
      },
    });
  },

  async getUserById(req, res) {
    const { id } = req.params;
    
    const user = await userService.findById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
        meta: {
          timestamp: new Date().toISOString(),
          correlationId: req.correlationId,
        },
      });
    }

    res.status(200).json({
      success: true,
      data: user,
      meta: {
        timestamp: new Date().toISOString(),
        correlationId: req.correlationId,
      },
    });
  },

  async createUser(req, res) {
    const userData = req.body;
    const createdBy = req.user;

    const user = await userService.create(userData, createdBy);

    // Log user creation
    logger.info('User created successfully', {
      userId: user.id,
      email: user.email,
      createdBy: createdBy.id,
      correlationId: req.correlationId,
    });

    res.status(201).json({
      success: true,
      data: user,
      message: 'User created successfully',
      meta: {
        timestamp: new Date().toISOString(),
        correlationId: req.correlationId,
      },
    });
  },

  async updateUser(req, res) {
    const { id } = req.params;
    const updateData = req.body;
    const updatedBy = req.user;

    const user = await userService.update(id, updateData, updatedBy);

    logger.info('User updated successfully', {
      userId: id,
      updatedFields: Object.keys(updateData),
      updatedBy: updatedBy.id,
      correlationId: req.correlationId,
    });

    res.status(200).json({
      success: true,
      data: user,
      message: 'User updated successfully',
      meta: {
        timestamp: new Date().toISOString(),
        correlationId: req.correlationId,
      },
    });
  },

  async deleteUser(req, res) {
    const { id } = req.params;
    const deletedBy = req.user;

    await userService.delete(id, deletedBy);

    logger.info('User deleted successfully', {
      userId: id,
      deletedBy: deletedBy.id,
      correlationId: req.correlationId,
    });

    res.status(204).send();
  },

  async uploadAvatar(req, res) {
    const { id } = req.params;
    const file = req.file;

    const avatarUrl = await userService.updateAvatar(id, file);

    res.status(200).json({
      success: true,
      data: { avatarUrl },
      message: 'Avatar uploaded successfully',
      meta: {
        timestamp: new Date().toISOString(),
        correlationId: req.correlationId,
      },
    });
  },

  async bulkCreateUsers(req, res) {
    const { users } = req.body;
    const createdBy = req.user;

    const result = await userService.bulkCreate(users, createdBy);

    res.status(201).json({
      success: true,
      data: result,
      message: `${result.successful} users created successfully, ${result.failed} failed`,
      meta: {
        timestamp: new Date().toISOString(),
        correlationId: req.correlationId,
      },
    });
  },

  async exportUsers(req, res) {
    const { format, startDate, endDate } = req.query;
    
    const filters = {
      startDate,
      endDate,
    };

    const exportData = await userService.export(filters, format);

    const filename = `users-export-${Date.now()}.${format}`;
    
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', exportData.mimeType);
    
    res.send(exportData.buffer);
  },

  async getUserAuditLog(req, res) {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const auditLog = await userService.getAuditLog(id, {
      page: parseInt(page),
      limit: parseInt(limit),
    });

    res.status(200).json({
      success: true,
      data: auditLog.logs,
      pagination: {
        page: auditLog.page,
        limit: auditLog.limit,
        total: auditLog.total,
        totalPages: auditLog.totalPages,
      },
      meta: {
        timestamp: new Date().toISOString(),
        correlationId: req.correlationId,
      },
    });
  },
};

module.exports = userController;
```

---

### 3. **Middleware & Security**

#### 🛡️ Security Middleware Patterns
```javascript
// Best Practice: Comprehensive middleware implementations

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const config = require('../config');
const logger = require('../utils/logger');
const User = require('../models/User');
const { AppError } = require('../utils/errors');

// Authentication middleware
const authMiddleware = {
  // JWT authentication
  async requireAuth(req, res, next) {
    try {
      let token;

      // Get token from header
      if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
      } else if (req.cookies.token) {
        token = req.cookies.token;
      }

      if (!token) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Access token is required',
          },
        });
      }

      try {
        // Verify token
        const decoded = jwt.verify(token, config.jwt.secret);
        
        // Check if user still exists
        const user = await User.findById(decoded.id).select('+active');
        if (!user) {
          return res.status(401).json({
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'User no longer exists',
            },
          });
        }

        // Check if user is active
        if (!user.active) {
          return res.status(401).json({
            success: false,
            error: {
              code: 'ACCOUNT_DISABLED',
              message: 'Account has been disabled',
            },
          });
        }

        // Check if user changed password after token was issued
        if (user.passwordChangedAt && decoded.iat < user.passwordChangedAt.getTime() / 1000) {
          return res.status(401).json({
            success: false,
            error: {
              code: 'TOKEN_EXPIRED',
              message: 'Password was recently changed. Please log in again.',
            },
          });
        }

        // Grant access to protected route
        req.user = user;
        next();
      } catch (jwtError) {
        logger.warn('JWT verification failed', {
          error: jwtError.message,
          token: token.substring(0, 20) + '...',
          correlationId: req.correlationId,
        });

        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid or expired token',
          },
        });
      }
    } catch (error) {
      logger.error('Authentication middleware error', {
        error: error.message,
        stack: error.stack,
        correlationId: req.correlationId,
      });

      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Authentication failed',
        },
      });
    }
  },

  // Optional authentication (doesn't fail if no token)
  async optionalAuth(req, res, next) {
    try {
      let token;

      if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
      } else if (req.cookies.token) {
        token = req.cookies.token;
      }

      if (token) {
        try {
          const decoded = jwt.verify(token, config.jwt.secret);
          const user = await User.findById(decoded.id);
          
          if (user && user.active) {
            req.user = user;
          }
        } catch (jwtError) {
          // Ignore JWT errors for optional auth
          logger.debug('Optional auth JWT verification failed', {
            error: jwtError.message,
            correlationId: req.correlationId,
          });
        }
      }

      next();
    } catch (error) {
      logger.error('Optional authentication middleware error', {
        error: error.message,
        correlationId: req.correlationId,
      });
      next(); // Continue even if optional auth fails
    }
  },

  // Role-based authorization
  requireRole(roles) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      const userRoles = req.user.roles || [];
      const hasRequiredRole = roles.some(role => userRoles.includes(role));

      if (!hasRequiredRole) {
        logger.warn('Insufficient permissions', {
          userId: req.user.id,
          userRoles,
          requiredRoles: roles,
          path: req.path,
          method: req.method,
          correlationId: req.correlationId,
        });

        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient permissions',
          },
        });
      }

      next();
    };
  },

  // Resource-based authorization
  async canAccessUser(req, res, next) {
    try {
      const { id } = req.params;
      const currentUser = req.user;

      // Users can access their own data
      if (currentUser.id === id) {
        return next();
      }

      // Admins and managers can access any user
      if (currentUser.roles.includes('admin') || currentUser.roles.includes('manager')) {
        return next();
      }

      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Cannot access this user resource',
        },
      });
    } catch (error) {
      logger.error('Resource authorization error', {
        error: error.message,
        userId: req.user?.id,
        targetUserId: req.params.id,
        correlationId: req.correlationId,
      });

      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Authorization check failed',
        },
      });
    }
  },

  async canModifyUser(req, res, next) {
    try {
      const { id } = req.params;
      const currentUser = req.user;

      // Users can modify their own data
      if (currentUser.id === id) {
        return next();
      }

      // Only admins can modify other users
      if (currentUser.roles.includes('admin')) {
        return next();
      }

      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Cannot modify this user',
        },
      });
    } catch (error) {
      logger.error('Modification authorization error', {
        error: error.message,
        userId: req.user?.id,
        targetUserId: req.params.id,
        correlationId: req.correlationId,
      });

      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Authorization check failed',
        },
      });
    }
  },
};

// Validation middleware
const validationMiddleware = {
  handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      const formattedErrors = errors.array().map(error => ({
        field: error.param,
        message: error.msg,
        value: error.value,
        location: error.location,
      }));

      logger.warn('Validation failed', {
        errors: formattedErrors,
        path: req.path,
        method: req.method,
        correlationId: req.correlationId,
      });

      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: formattedErrors,
        },
      });
    }

    next();
  },

  // Custom validation for business rules
  async validateBusinessRules(req, res, next) {
    try {
      const { body, params } = req;

      // Example: Check if email is already in use during update
      if (body.email && params.id) {
        const existingUser = await User.findOne({ 
          email: body.email, 
          _id: { $ne: params.id } 
        });
        
        if (existingUser) {
          return res.status(409).json({
            success: false,
            error: {
              code: 'EMAIL_ALREADY_EXISTS',
              message: 'Email is already in use by another user',
            },
          });
        }
      }

      // Example: Check user age for certain operations
      if (body.dateOfBirth) {
        const age = Math.floor((Date.now() - new Date(body.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        if (age < 13) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'AGE_RESTRICTION',
              message: 'User must be at least 13 years old',
            },
          });
        }
      }

      next();
    } catch (error) {
      logger.error('Business validation error', {
        error: error.message,
        correlationId: req.correlationId,
      });

      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Validation failed',
        },
      });
    }
  },
};

// File upload middleware
const uploadMiddleware = {
  single(fieldName, options = {}) {
    const {
      allowedTypes = ['image/jpeg', 'image/png'],
      maxSize = 5 * 1024 * 1024, // 5MB
      destination = 'uploads',
    } = options;

    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, destination);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
      },
    });

    const fileFilter = (req, file, cb) => {
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new AppError(`File type ${file.mimetype} is not allowed`, 400), false);
      }
    };

    const upload = multer({
      storage,
      fileFilter,
      limits: {
        fileSize: maxSize,
        files: 1,
      },
    });

    return (req, res, next) => {
      upload.single(fieldName)(req, res, (err) => {
        if (err) {
          logger.warn('File upload error', {
            error: err.message,
            fieldName,
            correlationId: req.correlationId,
          });

          if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
              return res.status(400).json({
                success: false,
                error: {
                  code: 'FILE_TOO_LARGE',
                  message: `File size exceeds ${maxSize / (1024 * 1024)}MB limit`,
                },
              });
            }
            if (err.code === 'LIMIT_FILE_COUNT') {
              return res.status(400).json({
                success: false,
                error: {
                  code: 'TOO_MANY_FILES',
                  message: 'Only one file is allowed',
                },
              });
            }
          }

          return res.status(400).json({
            success: false,
            error: {
              code: 'UPLOAD_ERROR',
              message: err.message || 'File upload failed',
            },
          });
        }

        next();
      });
    };
  },

  // Multiple file upload
  multiple(fieldName, maxCount, options = {}) {
    // Similar implementation for multiple files
    // ...
  },
};

// Security headers middleware
const securityMiddleware = {
  securityHeaders(req, res, next) {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Prevent MIME sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Feature policy
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    next();
  },

  // API key validation
  validateApiKey(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'API_KEY_REQUIRED',
          message: 'API key is required',
        },
      });
    }

    // Validate API key (implement your logic)
    if (!isValidApiKey(apiKey)) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_API_KEY',
          message: 'Invalid API key',
        },
      });
    }

    next();
  },
};

module.exports = {
  authMiddleware,
  validationMiddleware,
  uploadMiddleware,
  securityMiddleware,
};
```

---

## 📊 Express.js Health Metrics

### Framework Compliance
- **Security Implementation**: ⭐⭐⭐⭐⭐ (X/5)
- **Middleware Architecture**: ⭐⭐⭐⭐⭐ (X/5)
- **Error Handling**: ⭐⭐⭐⭐⭐ (X/5)
- **API Design**: ⭐⭐⭐⭐⭐ (X/5)
- **Performance**: ⭐⭐⭐⭐⭐ (X/5)

### Overall Express.js Score: ⭐⭐⭐⭐⭐ (X/10)

---

## 🎯 Express.js-Specific Action Items

### 🔴 Critical (Security/Performance)
1. [ ] Add security middleware (helmet, rate limiting, CORS)
2. [ ] Implement proper input validation and sanitization
3. [ ] Add authentication and authorization middleware
4. [ ] Fix error handling and async error catching
5. [ ] Add proper logging and monitoring

### 🟡 Important (Best Practices)
1. [ ] Organize routes into proper modules
2. [ ] Implement proper database connection pooling
3. [ ] Add comprehensive API documentation
4. [ ] Optimize middleware order and performance
5. [ ] Add proper testing coverage

### 🟢 Improvements (Code Quality)
1. [ ] Add request/response compression
2. [ ] Implement proper caching strategies
3. [ ] Add performance monitoring and profiling
4. [ ] Improve code organization and modularity
5. [ ] Add graceful shutdown handling

---

## 💡 Express.js Upgrade Recommendations

### Migration Opportunities
- Express.js 5.x with improved async support
- Modern ES modules and import/export syntax
- TypeScript integration for better type safety
- GraphQL integration with Apollo Server
- Microservices architecture with service discovery
- WebSocket support for real-time features

### Performance Improvements
- Node.js clustering for multi-core utilization
- Redis for session storage and caching
- Database query optimization and indexing
- CDN integration for static assets
- Load balancing with nginx or HAProxy
- Container orchestration with Docker and Kubernetes