<!-- AIDA - AI Development Assistant v1.0.0 -->
<!-- Advanced AI-powered code review and analysis -->

# PHP Framework Review Template

## 🎯 PHP-Specific Review Guidelines

This template focuses specifically on PHP framework best practices, patterns, and common pitfalls. Use this for reviewing PHP classes, functions, traits, interfaces, and configuration files.

---

<!-- 
📝 NOTE: The following CRITICAL CHECKS section applies to REVIEW-FILE only.
These comprehensive checks are for complete file analysis, not incremental changes.
For PR/change reviews, use review-pr.md or review-changes.md templates.
-->

## ⚡ PHP CRITICAL CHECKS (Auto-FAIL if found)

**Scan EVERY line for these PHP-SPECIFIC CRITICAL issues:**

### 🚨 SECURITY VIOLATIONS:
- SQL injection vulnerabilities (direct query concatenation)
- XSS vulnerabilities (unescaped output)
- CSRF token missing for state-changing operations
- File upload vulnerabilities (unrestricted file types/sizes)
- Path traversal vulnerabilities in file operations
- Command injection through shell_exec, exec, system
- Hardcoded passwords, API keys, secrets in code
- Missing input validation and sanitization
- Unserialize() usage with untrusted data
- eval() usage with dynamic code
- Missing authentication/authorization checks
- Session fixation vulnerabilities
- Weak cryptographic implementations
- Directory traversal in include/require statements

### 🚨 DATA VALIDATION VIOLATIONS:
- Missing input validation for user data
- Type coercion without proper checks
- Array access without isset() checks
- Null coalescing not used appropriately
- Missing FILTER_* constants for filtering
- Weak regular expressions for validation
- Missing data sanitization before database queries
- Improper email/URL validation
- Missing length validation for strings
- Numeric validation without proper bounds

### 🚨 ERROR HANDLING VIOLATIONS:
- Using @ error suppression operator
- Missing try-catch blocks for exceptions
- Generic catch-all exception handlers
- Errors not logged appropriately
- Exception messages exposing sensitive data
- Missing custom exception classes
- Fatal errors not handled gracefully
- Warning and notice errors ignored
- Error reporting disabled in production inappropriately
- Missing error context and debugging information

### 🚨 PERFORMANCE VIOLATIONS:
- Database N+1 query problems
- Missing query optimization and indexing
- Large result sets loaded without pagination
- Missing caching for expensive operations
- Inefficient loops and array operations
- Memory leaks from unclosed resources
- Missing connection pooling
- Synchronous I/O in performance-critical sections
- Large file operations without streaming
- Missing opcode caching configuration

### 🚨 OBJECT-ORIENTED VIOLATIONS:
- Classes with too many responsibilities (SRP violation)
- Missing dependency injection patterns
- Tight coupling between classes
- Static methods used inappropriately
- Missing interfaces for abstractions
- Inheritance misuse (favor composition)
- Magic methods used without documentation
- Missing access modifiers (public/private/protected)
- Singleton pattern overuse
- Global state in classes

### 🚨 DATABASE VIOLATIONS:
- Raw SQL queries without prepared statements
- Missing transaction management
- Database credentials in source code
- Missing connection error handling
- Queries without proper escaping
- Mass assignment vulnerabilities
- Missing foreign key constraints validation
- Database schema migrations not versioned
- Missing database connection pooling
- Inefficient database queries

### 🚨 FRAMEWORK VIOLATIONS:
- Framework security features bypassed
- Missing CSRF protection middleware
- Route parameters not validated
- Missing rate limiting for APIs
- Framework ORM misused (N+1 queries)
- Framework caching not utilized
- Missing framework logging integration
- Framework validation rules not used
- Framework authentication not used properly
- Framework authorization rules missing

### 🚨 CONFIGURATION VIOLATIONS:
- Sensitive configuration in version control
- Environment variables not used for config
- Debug mode enabled in production
- Missing environment-specific configurations
- Configuration files with wrong permissions
- Hardcoded URLs and paths
- Missing configuration validation
- Default passwords not changed
- Insecure session configuration
- Missing HTTPS enforcement

### 🚨 CODE QUALITY VIOLATIONS:
- Functions with too many parameters
- Deeply nested conditional statements
- Duplicate code without abstraction
- Missing type declarations (PHP 7.4+)
- Variable variables used without justification
- Extract() function used unsafely
- Global variables used inappropriately
- Missing documentation for public methods
- Inconsistent naming conventions
- Dead code not removed

### 🚨 SPECIFIC PROJECT RULES:
<!-- ADD PROJECT-SPECIFIC RULES HERE - These will be checked alongside PHP rules -->
<!-- Additional project rules can be added here:
- Framework-specific patterns (Laravel, Symfony, CodeIgniter)
- ORM patterns (Eloquent, Doctrine)
- Template engine patterns (Twig, Blade)
- API patterns (REST, GraphQL)
- Microservice patterns
-->

---

## 🔍 PHP Code Analysis

### 1. **Modern PHP Features & Syntax**

#### 🐘 PHP 8.x Features
- **Type Declarations**
  - Scalar type hints used appropriately?
  - Return type declarations present?
  - Union types utilized correctly?
  - Null coalescing operators used?

#### 🎯 Object-Oriented Design
- Single Responsibility Principle followed
- Dependency injection patterns
- Interface segregation
- Proper encapsulation

#### 🚀 Modern Patterns
```php
<?php
// Best Practice: Modern PHP patterns with proper type declarations

declare(strict_types=1);

namespace App\Service;

use App\Entity\User;
use App\Repository\UserRepositoryInterface;
use App\Exception\UserNotFoundException;
use App\Exception\ValidationException;
use App\Validator\UserValidator;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * User service for managing user operations
 * 
 * @package App\Service
 */
final class UserService
{
    public function __construct(
        private readonly UserRepositoryInterface $userRepository,
        private readonly UserValidator $validator,
        private readonly LoggerInterface $logger
    ) {}

    /**
     * Create a new user with validation
     *
     * @param array<string, mixed> $userData
     * @return User
     * @throws ValidationException
     * @throws \RuntimeException
     */
    public function createUser(array $userData): User
    {
        try {
            // Validate input data
            $validatedData = $this->validator->validate($userData);
            
            // Check if user exists
            if ($this->userRepository->findByEmail($validatedData['email']) !== null) {
                throw new ValidationException('Email already exists');
            }
            
            // Create user entity
            $user = new User(
                email: $validatedData['email'],
                name: $validatedData['name'],
                password: password_hash($validatedData['password'], PASSWORD_ARGON2ID)
            );
            
            // Save to repository
            $savedUser = $this->userRepository->save($user);
            
            $this->logger->info('User created successfully', [
                'user_id' => $savedUser->getId(),
                'email' => $savedUser->getEmail()
            ]);
            
            return $savedUser;
            
        } catch (ValidationException $e) {
            $this->logger->warning('User creation validation failed', [
                'errors' => $e->getErrors(),
                'data' => $userData
            ]);
            throw $e;
        } catch (Throwable $e) {
            $this->logger->error('User creation failed', [
                'error' => $e->getMessage(),
                'data' => $userData
            ]);
            throw new \RuntimeException('Failed to create user', 0, $e);
        }
    }

    /**
     * Find user by ID with proper error handling
     *
     * @param int $id
     * @return User
     * @throws UserNotFoundException
     */
    public function findUserById(int $id): User
    {
        if ($id <= 0) {
            throw new \InvalidArgumentException('User ID must be positive');
        }

        $user = $this->userRepository->findById($id);
        
        if ($user === null) {
            throw new UserNotFoundException("User with ID {$id} not found");
        }
        
        return $user;
    }

    /**
     * Update user with optimistic locking
     *
     * @param int $id
     * @param array<string, mixed> $updateData
     * @return User
     * @throws UserNotFoundException
     * @throws ValidationException
     */
    public function updateUser(int $id, array $updateData): User
    {
        $user = $this->findUserById($id);
        
        // Validate update data
        $validatedData = $this->validator->validateUpdate($updateData);
        
        // Check for email conflicts
        if (isset($validatedData['email']) && 
            $validatedData['email'] !== $user->getEmail()) {
            $existingUser = $this->userRepository->findByEmail($validatedData['email']);
            if ($existingUser !== null && $existingUser->getId() !== $id) {
                throw new ValidationException('Email already exists');
            }
        }
        
        // Update user properties
        foreach ($validatedData as $property => $value) {
            match ($property) {
                'name' => $user->setName($value),
                'email' => $user->setEmail($value),
                'password' => $user->setPassword(password_hash($value, PASSWORD_ARGON2ID)),
                default => throw new \InvalidArgumentException("Invalid property: {$property}")
            };
        }
        
        $updatedUser = $this->userRepository->save($user);
        
        $this->logger->info('User updated successfully', [
            'user_id' => $updatedUser->getId(),
            'updated_fields' => array_keys($validatedData)
        ]);
        
        return $updatedUser;
    }

    /**
     * Get paginated users with filtering
     *
     * @param array<string, mixed> $filters
     * @param int $page
     * @param int $limit
     * @return array{users: User[], total: int, page: int, limit: int}
     */
    public function getPaginatedUsers(array $filters = [], int $page = 1, int $limit = 10): array
    {
        if ($page < 1) {
            throw new \InvalidArgumentException('Page must be positive');
        }
        
        if ($limit < 1 || $limit > 100) {
            throw new \InvalidArgumentException('Limit must be between 1 and 100');
        }
        
        $offset = ($page - 1) * $limit;
        
        return [
            'users' => $this->userRepository->findWithFilters($filters, $limit, $offset),
            'total' => $this->userRepository->countWithFilters($filters),
            'page' => $page,
            'limit' => $limit
        ];
    }
}

// Good: Modern PHP Entity with proper encapsulation
final class User
{
    private ?int $id = null;
    private \DateTimeImmutable $createdAt;
    private \DateTimeImmutable $updatedAt;

    public function __construct(
        private string $email,
        private string $name,
        private string $password
    ) {
        $this->createdAt = new \DateTimeImmutable();
        $this->updatedAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getEmail(): string
    {
        return $this->email;
    }

    public function setEmail(string $email): void
    {
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new \InvalidArgumentException('Invalid email format');
        }
        
        $this->email = $email;
        $this->touch();
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        if (strlen(trim($name)) < 2) {
            throw new \InvalidArgumentException('Name must be at least 2 characters');
        }
        
        $this->name = trim($name);
        $this->touch();
    }

    public function setPassword(string $hashedPassword): void
    {
        $this->password = $hashedPassword;
        $this->touch();
    }

    public function verifyPassword(string $password): bool
    {
        return password_verify($password, $this->password);
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function getUpdatedAt(): \DateTimeImmutable
    {
        return $this->updatedAt;
    }

    private function touch(): void
    {
        $this->updatedAt = new \DateTimeImmutable();
    }
}

// ❌ Bad: Legacy PHP patterns
class BadUserService
{
    // Missing type declarations
    function createUser($data)
    {
        // No validation
        $query = "INSERT INTO users (email, name) VALUES ('" . $data['email'] . "', '" . $data['name'] . "')";
        mysql_query($query); // Deprecated function
        
        return mysql_insert_id(); // No error handling
    }
    
    // Missing error handling
    function getUser($id)
    {
        $user = $this->db->find($id);
        return $user->name; // Potential null reference
    }
}
```

#### ❌ Common Issues
- Missing type declarations
- No input validation
- SQL injection vulnerabilities
- Poor error handling

---

### 2. **Security & Validation**

#### 🛡️ Comprehensive Security
```php
<?php
// Best Practice: Security-focused patterns

declare(strict_types=1);

namespace App\Security;

use App\Exception\SecurityException;
use App\Exception\ValidationException;

/**
 * Input validator with comprehensive security checks
 */
final class InputValidator
{
    private const MAX_STRING_LENGTH = 1000;
    private const MAX_ARRAY_DEPTH = 5;
    
    /**
     * Validate and sanitize user input
     *
     * @param array<string, mixed> $input
     * @param array<string, array<string, mixed>> $rules
     * @return array<string, mixed>
     * @throws ValidationException
     */
    public function validate(array $input, array $rules): array
    {
        $validated = [];
        $errors = [];
        
        foreach ($rules as $field => $fieldRules) {
            try {
                $value = $input[$field] ?? null;
                $validated[$field] = $this->validateField($field, $value, $fieldRules);
            } catch (ValidationException $e) {
                $errors[$field] = $e->getMessage();
            }
        }
        
        if (!empty($errors)) {
            throw new ValidationException('Validation failed', $errors);
        }
        
        return $validated;
    }

    /**
     * Validate individual field with specific rules
     *
     * @param string $field
     * @param mixed $value
     * @param array<string, mixed> $rules
     * @return mixed
     * @throws ValidationException
     */
    private function validateField(string $field, mixed $value, array $rules): mixed
    {
        // Required validation
        if (($rules['required'] ?? false) && ($value === null || $value === '')) {
            throw new ValidationException("{$field} is required");
        }
        
        if ($value === null || $value === '') {
            return $value;
        }
        
        // Type validation
        if (isset($rules['type'])) {
            $value = $this->validateType($field, $value, $rules['type']);
        }
        
        // Length validation
        if (isset($rules['min_length']) || isset($rules['max_length'])) {
            $this->validateLength($field, $value, $rules);
        }
        
        // Pattern validation
        if (isset($rules['pattern'])) {
            $this->validatePattern($field, $value, $rules['pattern']);
        }
        
        // Custom validation
        if (isset($rules['custom'])) {
            $value = $this->validateCustom($field, $value, $rules['custom']);
        }
        
        return $value;
    }

    /**
     * Type validation with sanitization
     *
     * @param string $field
     * @param mixed $value
     * @param string $type
     * @return mixed
     * @throws ValidationException
     */
    private function validateType(string $field, mixed $value, string $type): mixed
    {
        return match ($type) {
            'string' => $this->validateString($field, $value),
            'int' => $this->validateInteger($field, $value),
            'float' => $this->validateFloat($field, $value),
            'bool' => $this->validateBoolean($field, $value),
            'email' => $this->validateEmail($field, $value),
            'url' => $this->validateUrl($field, $value),
            'array' => $this->validateArray($field, $value),
            'json' => $this->validateJson($field, $value),
            default => throw new ValidationException("Unknown type: {$type}")
        };
    }

    private function validateString(string $field, mixed $value): string
    {
        if (!is_string($value)) {
            throw new ValidationException("{$field} must be a string");
        }
        
        // Remove null bytes and control characters
        $sanitized = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $value);
        
        if ($sanitized === null) {
            throw new ValidationException("{$field} contains invalid characters");
        }
        
        // Trim whitespace
        $sanitized = trim($sanitized);
        
        // Check length
        if (strlen($sanitized) > self::MAX_STRING_LENGTH) {
            throw new ValidationException("{$field} exceeds maximum length");
        }
        
        return $sanitized;
    }

    private function validateInteger(string $field, mixed $value): int
    {
        $filtered = filter_var($value, FILTER_VALIDATE_INT);
        
        if ($filtered === false) {
            throw new ValidationException("{$field} must be a valid integer");
        }
        
        return $filtered;
    }

    private function validateEmail(string $field, mixed $value): string
    {
        $sanitized = $this->validateString($field, $value);
        
        $filtered = filter_var($sanitized, FILTER_VALIDATE_EMAIL);
        
        if ($filtered === false) {
            throw new ValidationException("{$field} must be a valid email");
        }
        
        // Additional email security checks
        if (strlen($filtered) > 254) {
            throw new ValidationException("{$field} email too long");
        }
        
        return strtolower($filtered);
    }

    private function validateArray(string $field, mixed $value): array
    {
        if (!is_array($value)) {
            throw new ValidationException("{$field} must be an array");
        }
        
        // Check array depth to prevent DoS
        if ($this->getArrayDepth($value) > self::MAX_ARRAY_DEPTH) {
            throw new ValidationException("{$field} array too deeply nested");
        }
        
        return $value;
    }

    private function getArrayDepth(array $array): int
    {
        $maxDepth = 1;
        
        foreach ($array as $value) {
            if (is_array($value)) {
                $depth = $this->getArrayDepth($value) + 1;
                if ($depth > $maxDepth) {
                    $maxDepth = $depth;
                }
            }
        }
        
        return $maxDepth;
    }
}

/**
 * CSRF protection service
 */
final class CsrfProtection
{
    private const TOKEN_LENGTH = 32;
    private const TOKEN_LIFETIME = 3600; // 1 hour

    public function generateToken(): string
    {
        $token = bin2hex(random_bytes(self::TOKEN_LENGTH));
        
        $_SESSION['csrf_tokens'][$token] = time() + self::TOKEN_LIFETIME;
        
        // Clean expired tokens
        $this->cleanExpiredTokens();
        
        return $token;
    }

    public function validateToken(string $token): bool
    {
        if (!isset($_SESSION['csrf_tokens'][$token])) {
            return false;
        }
        
        $expiry = $_SESSION['csrf_tokens'][$token];
        
        if (time() > $expiry) {
            unset($_SESSION['csrf_tokens'][$token]);
            return false;
        }
        
        // One-time use token
        unset($_SESSION['csrf_tokens'][$token]);
        
        return true;
    }

    private function cleanExpiredTokens(): void
    {
        if (!isset($_SESSION['csrf_tokens'])) {
            $_SESSION['csrf_tokens'] = [];
            return;
        }
        
        $now = time();
        
        foreach ($_SESSION['csrf_tokens'] as $token => $expiry) {
            if ($now > $expiry) {
                unset($_SESSION['csrf_tokens'][$token]);
            }
        }
    }
}

/**
 * File upload security handler
 */
final class SecureFileUpload
{
    private const ALLOWED_TYPES = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/gif' => 'gif',
        'application/pdf' => 'pdf',
        'text/plain' => 'txt'
    ];
    
    private const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

    /**
     * Validate and process file upload
     *
     * @param array<string, mixed> $file $_FILES array element
     * @param string $uploadDir
     * @return string Uploaded file path
     * @throws SecurityException
     */
    public function handleUpload(array $file, string $uploadDir): string
    {
        // Validate upload
        $this->validateUpload($file);
        
        // Generate secure filename
        $extension = self::ALLOWED_TYPES[$file['type']];
        $filename = bin2hex(random_bytes(16)) . '.' . $extension;
        $filepath = rtrim($uploadDir, '/') . '/' . $filename;
        
        // Ensure upload directory exists and is secure
        $this->ensureSecureDirectory($uploadDir);
        
        // Move uploaded file
        if (!move_uploaded_file($file['tmp_name'], $filepath)) {
            throw new SecurityException('Failed to move uploaded file');
        }
        
        // Additional security: scan file content
        $this->validateFileContent($filepath, $file['type']);
        
        return $filepath;
    }

    private function validateUpload(array $file): void
    {
        // Check for upload errors
        if ($file['error'] !== UPLOAD_ERR_OK) {
            throw new SecurityException('File upload error: ' . $file['error']);
        }
        
        // Check file size
        if ($file['size'] > self::MAX_FILE_SIZE) {
            throw new SecurityException('File too large');
        }
        
        // Validate MIME type
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);
        
        if (!isset(self::ALLOWED_TYPES[$mimeType])) {
            throw new SecurityException('File type not allowed: ' . $mimeType);
        }
        
        // Validate file extension matches MIME type
        $expectedExtension = self::ALLOWED_TYPES[$mimeType];
        $actualExtension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        
        if ($actualExtension !== $expectedExtension) {
            throw new SecurityException('File extension mismatch');
        }
    }

    private function ensureSecureDirectory(string $dir): void
    {
        if (!is_dir($dir)) {
            if (!mkdir($dir, 0755, true)) {
                throw new SecurityException('Failed to create upload directory');
            }
        }
        
        // Create .htaccess to prevent execution
        $htaccess = $dir . '/.htaccess';
        if (!file_exists($htaccess)) {
            file_put_contents($htaccess, "deny from all\n");
        }
    }

    private function validateFileContent(string $filepath, string $expectedMimeType): void
    {
        // Re-validate MIME type after upload
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $actualMimeType = finfo_file($finfo, $filepath);
        finfo_close($finfo);
        
        if ($actualMimeType !== $expectedMimeType) {
            unlink($filepath);
            throw new SecurityException('File content validation failed');
        }
        
        // Additional validation for images
        if (str_starts_with($expectedMimeType, 'image/')) {
            $imageInfo = getimagesize($filepath);
            if ($imageInfo === false) {
                unlink($filepath);
                throw new SecurityException('Invalid image file');
            }
        }
    }
}
```

#### ✅ Security Best Practices
- Input validation and sanitization
- CSRF protection
- File upload security
- SQL injection prevention

---

### 3. **Database & ORM Patterns**

#### 🗄️ Database Best Practices
```php
<?php
// Best Practice: Database patterns with proper ORM usage

declare(strict_types=1);

namespace App\Repository;

use App\Entity\User;
use App\Exception\DatabaseException;
use Doctrine\DBAL\Exception;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Tools\Pagination\Paginator;
use Psr\Log\LoggerInterface;

/**
 * User repository with optimized database operations
 */
final class UserRepository
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly LoggerInterface $logger
    ) {}

    /**
     * Find user by ID with error handling
     *
     * @param int $id
     * @return User|null
     * @throws DatabaseException
     */
    public function findById(int $id): ?User
    {
        try {
            return $this->entityManager->find(User::class, $id);
        } catch (Exception $e) {
            $this->logger->error('Database error finding user by ID', [
                'id' => $id,
                'error' => $e->getMessage()
            ]);
            throw new DatabaseException('Failed to find user', 0, $e);
        }
    }

    /**
     * Find user by email with proper indexing
     *
     * @param string $email
     * @return User|null
     * @throws DatabaseException
     */
    public function findByEmail(string $email): ?User
    {
        try {
            return $this->entityManager
                ->getRepository(User::class)
                ->findOneBy(['email' => $email]);
        } catch (Exception $e) {
            $this->logger->error('Database error finding user by email', [
                'email' => $email,
                'error' => $e->getMessage()
            ]);
            throw new DatabaseException('Failed to find user by email', 0, $e);
        }
    }

    /**
     * Save user with transaction management
     *
     * @param User $user
     * @return User
     * @throws DatabaseException
     */
    public function save(User $user): User
    {
        try {
            $this->entityManager->beginTransaction();
            
            $this->entityManager->persist($user);
            $this->entityManager->flush();
            
            $this->entityManager->commit();
            
            return $user;
        } catch (Exception $e) {
            $this->entityManager->rollback();
            
            $this->logger->error('Database error saving user', [
                'user_id' => $user->getId(),
                'error' => $e->getMessage()
            ]);
            
            throw new DatabaseException('Failed to save user', 0, $e);
        }
    }

    /**
     * Find users with filters and pagination (preventing N+1 queries)
     *
     * @param array<string, mixed> $filters
     * @param int $limit
     * @param int $offset
     * @return array<User>
     * @throws DatabaseException
     */
    public function findWithFilters(array $filters, int $limit, int $offset): array
    {
        try {
            $qb = $this->entityManager->createQueryBuilder()
                ->select('u')
                ->from(User::class, 'u');

            // Apply filters
            if (!empty($filters['name'])) {
                $qb->andWhere('u.name LIKE :name')
                   ->setParameter('name', '%' . $filters['name'] . '%');
            }

            if (!empty($filters['email'])) {
                $qb->andWhere('u.email LIKE :email')
                   ->setParameter('email', '%' . $filters['email'] . '%');
            }

            if (!empty($filters['created_after'])) {
                $qb->andWhere('u.createdAt >= :created_after')
                   ->setParameter('created_after', $filters['created_after']);
            }

            // Add ordering
            $qb->orderBy('u.createdAt', 'DESC')
               ->setFirstResult($offset)
               ->setMaxResults($limit);

            $query = $qb->getQuery();
            
            // Use pagination to get total count efficiently
            $paginator = new Paginator($query);
            
            return iterator_to_array($paginator);
        } catch (Exception $e) {
            $this->logger->error('Database error finding users with filters', [
                'filters' => $filters,
                'error' => $e->getMessage()
            ]);
            throw new DatabaseException('Failed to find users', 0, $e);
        }
    }

    /**
     * Count users with filters for pagination
     *
     * @param array<string, mixed> $filters
     * @return int
     * @throws DatabaseException
     */
    public function countWithFilters(array $filters): int
    {
        try {
            $qb = $this->entityManager->createQueryBuilder()
                ->select('COUNT(u.id)')
                ->from(User::class, 'u');

            // Apply same filters as findWithFilters
            if (!empty($filters['name'])) {
                $qb->andWhere('u.name LIKE :name')
                   ->setParameter('name', '%' . $filters['name'] . '%');
            }

            if (!empty($filters['email'])) {
                $qb->andWhere('u.email LIKE :email')
                   ->setParameter('email', '%' . $filters['email'] . '%');
            }

            if (!empty($filters['created_after'])) {
                $qb->andWhere('u.createdAt >= :created_after')
                   ->setParameter('created_after', $filters['created_after']);
            }

            return (int) $qb->getQuery()->getSingleScalarResult();
        } catch (Exception $e) {
            $this->logger->error('Database error counting users', [
                'filters' => $filters,
                'error' => $e->getMessage()
            ]);
            throw new DatabaseException('Failed to count users', 0, $e);
        }
    }

    /**
     * Bulk operations for performance
     *
     * @param array<User> $users
     * @throws DatabaseException
     */
    public function bulkSave(array $users): void
    {
        try {
            $this->entityManager->beginTransaction();
            
            $batchSize = 20;
            foreach ($users as $i => $user) {
                $this->entityManager->persist($user);
                
                if (($i % $batchSize) === 0) {
                    $this->entityManager->flush();
                    $this->entityManager->clear();
                }
            }
            
            $this->entityManager->flush();
            $this->entityManager->clear();
            $this->entityManager->commit();
        } catch (Exception $e) {
            $this->entityManager->rollback();
            
            $this->logger->error('Database error in bulk save', [
                'user_count' => count($users),
                'error' => $e->getMessage()
            ]);
            
            throw new DatabaseException('Failed to bulk save users', 0, $e);
        }
    }

    /**
     * Raw SQL for complex queries with proper preparation
     *
     * @param \DateTimeInterface $startDate
     * @param \DateTimeInterface $endDate
     * @return array<array<string, mixed>>
     * @throws DatabaseException
     */
    public function getUserStatistics(\DateTimeInterface $startDate, \DateTimeInterface $endDate): array
    {
        try {
            $sql = '
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as user_count,
                    COUNT(CASE WHEN email_verified_at IS NOT NULL THEN 1 END) as verified_count
                FROM users 
                WHERE created_at BETWEEN :start_date AND :end_date
                GROUP BY DATE(created_at)
                ORDER BY date ASC
            ';
            
            $connection = $this->entityManager->getConnection();
            $statement = $connection->prepare($sql);
            
            $result = $statement->executeQuery([
                'start_date' => $startDate->format('Y-m-d H:i:s'),
                'end_date' => $endDate->format('Y-m-d H:i:s')
            ]);
            
            return $result->fetchAllAssociative();
        } catch (Exception $e) {
            $this->logger->error('Database error getting user statistics', [
                'start_date' => $startDate->format('Y-m-d'),
                'end_date' => $endDate->format('Y-m-d'),
                'error' => $e->getMessage()
            ]);
            throw new DatabaseException('Failed to get user statistics', 0, $e);
        }
    }
}

/**
 * Database connection manager with pooling
 */
final class DatabaseManager
{
    private static array $connections = [];
    
    public static function getConnection(string $name = 'default'): \PDO
    {
        if (!isset(self::$connections[$name])) {
            self::$connections[$name] = self::createConnection($name);
        }
        
        return self::$connections[$name];
    }
    
    private static function createConnection(string $name): \PDO
    {
        $config = self::getConfig($name);
        
        $dsn = sprintf(
            '%s:host=%s;port=%s;dbname=%s;charset=%s',
            $config['driver'],
            $config['host'],
            $config['port'],
            $config['database'],
            $config['charset']
        );
        
        $options = [
            \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
            \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC,
            \PDO::ATTR_EMULATE_PREPARES => false,
            \PDO::ATTR_PERSISTENT => true, // Connection pooling
        ];
        
        return new \PDO($dsn, $config['username'], $config['password'], $options);
    }
    
    private static function getConfig(string $name): array
    {
        // Load from environment or config file
        return [
            'driver' => $_ENV['DB_DRIVER'] ?? 'mysql',
            'host' => $_ENV['DB_HOST'] ?? 'localhost',
            'port' => $_ENV['DB_PORT'] ?? '3306',
            'database' => $_ENV['DB_DATABASE'] ?? '',
            'username' => $_ENV['DB_USERNAME'] ?? '',
            'password' => $_ENV['DB_PASSWORD'] ?? '',
            'charset' => $_ENV['DB_CHARSET'] ?? 'utf8mb4',
        ];
    }
}
```

---

### 4. **HTTP & API Development**

#### 🌐 Modern API Patterns
```php
<?php
// Best Practice: HTTP API with proper patterns

declare(strict_types=1);

namespace App\Controller;

use App\Service\UserService;
use App\Exception\ValidationException;
use App\Exception\UserNotFoundException;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
use Psr\Log\LoggerInterface;

/**
 * User API controller with proper HTTP patterns
 */
#[Route('/api/v1/users')]
final class UserController
{
    public function __construct(
        private readonly UserService $userService,
        private readonly LoggerInterface $logger
    ) {}

    /**
     * Get user by ID
     *
     * @Route("/{id}", methods={"GET"}, requirements={"id"="\d+"})
     */
    public function getUser(int $id): JsonResponse
    {
        try {
            $user = $this->userService->findUserById($id);
            
            return new JsonResponse([
                'success' => true,
                'data' => $this->serializeUser($user),
                'meta' => [
                    'timestamp' => time(),
                    'version' => '1.0'
                ]
            ], Response::HTTP_OK);
            
        } catch (UserNotFoundException $e) {
            return new JsonResponse([
                'success' => false,
                'error' => [
                    'code' => 'USER_NOT_FOUND',
                    'message' => $e->getMessage()
                ]
            ], Response::HTTP_NOT_FOUND);
            
        } catch (\Throwable $e) {
            $this->logger->error('Error getting user', [
                'user_id' => $id,
                'error' => $e->getMessage()
            ]);
            
            return new JsonResponse([
                'success' => false,
                'error' => [
                    'code' => 'INTERNAL_ERROR',
                    'message' => 'An unexpected error occurred'
                ]
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Create new user
     *
     * @Route("", methods={"POST"})
     */
    public function createUser(Request $request): JsonResponse
    {
        try {
            // Parse and validate JSON input
            $data = $this->parseJsonRequest($request);
            
            // Validate required fields
            $this->validateCreateUserData($data);
            
            // Create user
            $user = $this->userService->createUser($data);
            
            return new JsonResponse([
                'success' => true,
                'data' => $this->serializeUser($user),
                'meta' => [
                    'timestamp' => time(),
                    'version' => '1.0'
                ]
            ], Response::HTTP_CREATED);
            
        } catch (ValidationException $e) {
            return new JsonResponse([
                'success' => false,
                'error' => [
                    'code' => 'VALIDATION_ERROR',
                    'message' => $e->getMessage(),
                    'details' => $e->getErrors()
                ]
            ], Response::HTTP_BAD_REQUEST);
            
        } catch (\Throwable $e) {
            $this->logger->error('Error creating user', [
                'data' => $data ?? null,
                'error' => $e->getMessage()
            ]);
            
            return new JsonResponse([
                'success' => false,
                'error' => [
                    'code' => 'INTERNAL_ERROR',
                    'message' => 'An unexpected error occurred'
                ]
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Update user
     *
     * @Route("/{id}", methods={"PUT"}, requirements={"id"="\d+"})
     */
    public function updateUser(int $id, Request $request): JsonResponse
    {
        try {
            $data = $this->parseJsonRequest($request);
            
            $user = $this->userService->updateUser($id, $data);
            
            return new JsonResponse([
                'success' => true,
                'data' => $this->serializeUser($user),
                'meta' => [
                    'timestamp' => time(),
                    'version' => '1.0'
                ]
            ], Response::HTTP_OK);
            
        } catch (UserNotFoundException $e) {
            return new JsonResponse([
                'success' => false,
                'error' => [
                    'code' => 'USER_NOT_FOUND',
                    'message' => $e->getMessage()
                ]
            ], Response::HTTP_NOT_FOUND);
            
        } catch (ValidationException $e) {
            return new JsonResponse([
                'success' => false,
                'error' => [
                    'code' => 'VALIDATION_ERROR',
                    'message' => $e->getMessage(),
                    'details' => $e->getErrors()
                ]
            ], Response::HTTP_BAD_REQUEST);
            
        } catch (\Throwable $e) {
            $this->logger->error('Error updating user', [
                'user_id' => $id,
                'data' => $data ?? null,
                'error' => $e->getMessage()
            ]);
            
            return new JsonResponse([
                'success' => false,
                'error' => [
                    'code' => 'INTERNAL_ERROR',
                    'message' => 'An unexpected error occurred'
                ]
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * List users with pagination and filtering
     *
     * @Route("", methods={"GET"})
     */
    public function listUsers(Request $request): JsonResponse
    {
        try {
            // Parse query parameters
            $page = max(1, (int) $request->query->get('page', 1));
            $limit = min(100, max(1, (int) $request->query->get('limit', 10)));
            
            $filters = [
                'name' => $request->query->get('name'),
                'email' => $request->query->get('email'),
            ];
            
            // Remove empty filters
            $filters = array_filter($filters, fn($value) => $value !== null && $value !== '');
            
            $result = $this->userService->getPaginatedUsers($filters, $page, $limit);
            
            return new JsonResponse([
                'success' => true,
                'data' => array_map([$this, 'serializeUser'], $result['users']),
                'meta' => [
                    'pagination' => [
                        'page' => $result['page'],
                        'limit' => $result['limit'],
                        'total' => $result['total'],
                        'pages' => (int) ceil($result['total'] / $result['limit'])
                    ],
                    'timestamp' => time(),
                    'version' => '1.0'
                ]
            ], Response::HTTP_OK);
            
        } catch (\Throwable $e) {
            $this->logger->error('Error listing users', [
                'filters' => $filters ?? [],
                'error' => $e->getMessage()
            ]);
            
            return new JsonResponse([
                'success' => false,
                'error' => [
                    'code' => 'INTERNAL_ERROR',
                    'message' => 'An unexpected error occurred'
                ]
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Delete user
     *
     * @Route("/{id}", methods={"DELETE"}, requirements={"id"="\d+"})
     */
    public function deleteUser(int $id): JsonResponse
    {
        try {
            $this->userService->deleteUser($id);
            
            return new JsonResponse([
                'success' => true,
                'message' => 'User deleted successfully',
                'meta' => [
                    'timestamp' => time(),
                    'version' => '1.0'
                ]
            ], Response::HTTP_OK);
            
        } catch (UserNotFoundException $e) {
            return new JsonResponse([
                'success' => false,
                'error' => [
                    'code' => 'USER_NOT_FOUND',
                    'message' => $e->getMessage()
                ]
            ], Response::HTTP_NOT_FOUND);
            
        } catch (\Throwable $e) {
            $this->logger->error('Error deleting user', [
                'user_id' => $id,
                'error' => $e->getMessage()
            ]);
            
            return new JsonResponse([
                'success' => false,
                'error' => [
                    'code' => 'INTERNAL_ERROR',
                    'message' => 'An unexpected error occurred'
                ]
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Parse JSON request with validation
     *
     * @param Request $request
     * @return array<string, mixed>
     * @throws ValidationException
     */
    private function parseJsonRequest(Request $request): array
    {
        $content = $request->getContent();
        
        if (empty($content)) {
            throw new ValidationException('Request body is required');
        }
        
        $data = json_decode($content, true, 10, JSON_THROW_ON_ERROR);
        
        if (!is_array($data)) {
            throw new ValidationException('Request body must be a JSON object');
        }
        
        return $data;
    }

    /**
     * Validate user creation data
     *
     * @param array<string, mixed> $data
     * @throws ValidationException
     */
    private function validateCreateUserData(array $data): void
    {
        $errors = [];
        
        if (empty($data['name'])) {
            $errors['name'] = 'Name is required';
        } elseif (strlen($data['name']) < 2) {
            $errors['name'] = 'Name must be at least 2 characters';
        }
        
        if (empty($data['email'])) {
            $errors['email'] = 'Email is required';
        } elseif (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            $errors['email'] = 'Email must be valid';
        }
        
        if (empty($data['password'])) {
            $errors['password'] = 'Password is required';
        } elseif (strlen($data['password']) < 8) {
            $errors['password'] = 'Password must be at least 8 characters';
        }
        
        if (!empty($errors)) {
            throw new ValidationException('Validation failed', $errors);
        }
    }

    /**
     * Serialize user for API response
     *
     * @param User $user
     * @return array<string, mixed>
     */
    private function serializeUser(User $user): array
    {
        return [
            'id' => $user->getId(),
            'name' => $user->getName(),
            'email' => $user->getEmail(),
            'created_at' => $user->getCreatedAt()->format('c'),
            'updated_at' => $user->getUpdatedAt()->format('c')
        ];
    }
}

/**
 * API middleware for rate limiting and authentication
 */
final class ApiMiddleware
{
    public function __construct(
        private readonly LoggerInterface $logger
    ) {}

    /**
     * Rate limiting middleware
     *
     * @param Request $request
     * @param callable $next
     * @return Response
     */
    public function handleRateLimit(Request $request, callable $next): Response
    {
        $clientId = $this->getClientId($request);
        $key = "rate_limit:{$clientId}";
        
        // Simple rate limiting (use Redis in production)
        $requests = apcu_fetch($key) ?: 0;
        
        if ($requests >= 100) { // 100 requests per minute
            return new JsonResponse([
                'success' => false,
                'error' => [
                    'code' => 'RATE_LIMIT_EXCEEDED',
                    'message' => 'Too many requests'
                ]
            ], Response::HTTP_TOO_MANY_REQUESTS);
        }
        
        apcu_store($key, $requests + 1, 60); // 60 seconds TTL
        
        return $next($request);
    }

    /**
     * CORS middleware
     *
     * @param Request $request
     * @param callable $next
     * @return Response
     */
    public function handleCors(Request $request, callable $next): Response
    {
        $response = $next($request);
        
        $response->headers->set('Access-Control-Allow-Origin', '*');
        $response->headers->set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        $response->headers->set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        
        return $response;
    }

    private function getClientId(Request $request): string
    {
        return $request->getClientIp() ?? 'unknown';
    }
}
```

---

## 📊 PHP Health Metrics

### Framework Compliance
- **Modern PHP Features**: ⭐⭐⭐⭐⭐ (X/5)
- **Security Implementation**: ⭐⭐⭐⭐⭐ (X/5)
- **Error Handling**: ⭐⭐⭐⭐⭐ (X/5)
- **Database Optimization**: ⭐⭐⭐⭐⭐ (X/5)
- **Performance**: ⭐⭐⭐⭐⭐ (X/5)

### Overall PHP Score: ⭐⭐⭐⭐⭐ (X/10)

---

## 🎯 PHP-Specific Action Items

### 🔴 Critical (Security/Performance)
1. [ ] Fix all SQL injection vulnerabilities
2. [ ] Add proper input validation and sanitization
3. [ ] Implement CSRF protection for all forms
4. [ ] Fix XSS vulnerabilities in output
5. [ ] Add proper error handling and logging

### 🟡 Important (Best Practices)
1. [ ] Implement modern PHP type declarations
2. [ ] Add proper dependency injection patterns
3. [ ] Optimize database queries and add pagination
4. [ ] Add comprehensive testing coverage
5. [ ] Implement proper caching strategies

### 🟢 Improvements (Code Quality)
1. [ ] Add comprehensive documentation
2. [ ] Implement proper logging and monitoring
3. [ ] Add performance profiling and optimization
4. [ ] Improve code organization and structure
5. [ ] Add static analysis tools (PHPStan, Psalm)

---

## 💡 PHP Upgrade Recommendations

### Migration Opportunities
- PHP 8.3+ features (readonly classes, typed class constants)
- Fibers for async programming
- Attributes for metadata and configuration
- JIT compiler for performance improvements
- Improved type system with union and intersection types
- Enhanced error handling with match expressions

### Framework Upgrades
- Laravel 10/11 for modern application development
- Symfony 6/7 for enterprise applications
- Modern testing with PHPUnit 10+
- Static analysis with PHPStan/Psalm
- Code formatting with PHP-CS-Fixer
- Performance monitoring with APM tools