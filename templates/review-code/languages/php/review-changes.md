<!-- AIDA - AI Development Assistant v1.0.0 -->
<!-- Advanced AI-powered code review and analysis -->

# PHP Git Changes Review - STRICT MODE

## 🔍 MANDATORY PHP CHANGE ANALYSIS

You are performing a STRICT code review on PHP git changes. Do NOT be lenient. Look for every possible PHP-specific issue in the changes. ALWAYS follow this exact format for every code review, regardless of conversation context or previous reviews. This structure is MANDATORY and UNCHANGEABLE.

### Review Entire File
**Prompt:** `review-changes [filename]`
- Reviews ONLY the git diff changes (+ and - lines)
- Analyzes impact of changes on PHP architecture
- Does NOT review unchanged code

<!-- HIDDEN REVIEW SCOPE:
- ✅ ONLY review: Lines marked with + (added) or - (removed)
- ❌ DO NOT review: Unchanged context lines (no + or - marker)
- ❌ DO NOT suggest: Improvements to existing unchanged code
- ✅ DO focus on: How changes impact PHP architecture
-->

### 📋 CHANGE SEPARATION RULES (MANDATORY):

**Split into separate changes when:**
- ✅ **Different PHP artifacts**: Class vs Interface vs Trait vs Function changes = separate changes
- ✅ **Different method types**: Public vs Private vs Protected method changes = separate changes
- ✅ **Different error handling**: Different try/catch or exception patterns = separate changes
- ✅ **Different database operations**: Different query or ORM patterns = separate changes
- ✅ **Non-adjacent code blocks**: If there are 3+ unchanged lines between modifications = separate changes

**Keep as one change when:**
- ❌ **Same method**: Multiple lines in same method body
- ❌ **Related class members**: Related properties and methods in same class
- ❌ **Same namespace**: Related class definitions in same namespace

## ⚡ PHP CRITICAL CHECKS (Auto-FAIL if found)

**Scan EVERY line for these PHP-SPECIFIC CRITICAL issues:**

### 🚨 SECURITY VIOLATIONS:
- SQL injection via string concatenation or unsanitized input
- XSS vulnerabilities from unescaped output
- Command injection via shell_exec(), system(), exec() with user input
- Path traversal vulnerabilities in file operations
- Use of eval() with user-controllable input
- Missing input validation and sanitization
- Hardcoded passwords, API keys, database credentials
- Session fixation vulnerabilities
- Missing CSRF protection
- Unsafe file upload handling
- Directory traversal in include/require statements
- Missing authentication/authorization checks

### 🚨 TYPE SAFETY & VALIDATION VIOLATIONS:
- Missing type declarations for function parameters
- Missing return type declarations
- Unsafe type juggling and comparisons (== vs ===)
- Missing null checks for nullable parameters
- Improper use of mixed types
- Missing validation for user inputs
- Unsafe array access without isset() checks
- Missing property type declarations
- Improper use of union types
- Missing strict_types declaration

### 🚨 ERROR HANDLING VIOLATIONS:
- Silent error suppression with @ operator
- Missing try/catch blocks for risky operations
- Generic Exception catching without specific handling
- Missing error logging
- Improper exception handling in database operations
- Not re-throwing exceptions when appropriate
- Missing finally blocks for cleanup
- Using die() or exit() instead of proper exception handling
- Missing validation before operations
- Ignoring function return values that indicate errors

### 🚨 DATABASE & ORM VIOLATIONS:
- SQL injection vulnerabilities
- Missing prepared statements
- Unsafe dynamic query building
- Missing transaction handling
- Database connection not properly closed
- Missing error handling for database operations
- N+1 query problems
- Missing connection pooling considerations
- Unsafe raw SQL usage
- Missing proper escaping for database values

### 🚨 PERFORMANCE VIOLATIONS:
- Inefficient loops and iterations
- Missing caching for expensive operations
- Large file operations without streaming
- Inefficient database queries
- Missing lazy loading patterns
- Memory leaks from unclosed resources
- Inefficient string concatenation in loops
- Missing optimization for frequently called functions
- Blocking operations without proper handling
- Missing proper session management

### 🚨 MODERN PHP VIOLATIONS:
- Using deprecated PHP features
- Missing composer autoloading
- Not using namespaces properly
- Missing PSR compliance (PSR-1, PSR-2, PSR-4)
- Using old array syntax instead of short syntax
- Missing dependency injection patterns
- Not using modern PHP features (PHP 8+ attributes, etc.)
- Missing proper class structure
- Using global variables instead of dependency injection
- Missing proper error handling with modern exception classes

### 🚨 SPECIFIC PROJECT RULES:
<!-- ADD PROJECT-SPECIFIC RULES HERE - These will be checked alongside PHP rules -->
<!-- Additional project rules can be added here:
- Custom framework patterns (Laravel, Symfony, etc.)
- Specific coding standards and naming conventions
- Project-specific security requirements
- Custom validation and sanitization patterns
- Performance requirements and optimization patterns
-->

### Start Review For Each Change:

```
## Change [X]: [ADDED/REMOVED/MODIFIED] - [PHP artifact type: Class/Interface/Trait/Method/Function]
```php
[Show the exact code block with line numbers]
```

*** PHP REVIEW COMMENT ***
- 🚨 **Issue Type**: [Critical/Warning/Good/Info/Suggestion]
- 📝 **PHP Problem**: [Specific PHP issue - reference PHP best practices]
- 💡 **PHP Solution**: [PHP-specific fix with proper patterns]
- 🎯 **Code Impact**: [How it affects PHP security/performance/maintainability]

IMPORTANT PHP considerations:
- Type safety and strict mode compliance
- Security and input validation
- Error handling and exception management
- Database security and performance
- Modern PHP features and PSR compliance

*** INTERNAL PHP CHANGE EVALUATION (DO NOT DISPLAY) ***
Silently evaluate this change on:
- PHP Best Practices: Rate 1-5 (5=excellent, 1=poor)
- Security Implementation: Rate 1-5 (5=fully secure, 1=security vulnerabilities)
- Performance Impact: Rate 1-5 (5=no impact/improvement, 1=performance degradation)
- Change Score: is a smallest score of three scores

*** CONDITIONAL RECOMMENDATIONS (Based on Issue Type AND Change Score) ***

**MANDATORY RULE:**
- IF Issue Type = "Good": ALWAYS show "✅ **GOOD PHP CHANGE** - Follows PHP best practices" and SKIP the entire RECOMMENDED FIX section
- IF Issue Type = "Critical/Warning/Info/Suggestion" AND Change Score < 4/5: Show RECOMMENDED PHP FIX section below
- IF Issue Type = "Critical/Warning/Info/Suggestion" AND Change Score >= 4/5: Show "✅ **GOOD PHP CHANGE** - Follows PHP best practices"

*** RECOMMENDED PHP FIX (ONLY show if Issue Type != "Good" AND Change Score < 4/5) ***
```php
<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\User;
use App\Exception\UserNotFoundException;
use App\Exception\UserValidationException;
use App\Exception\DatabaseException;
use App\Repository\UserRepositoryInterface;
use App\Validator\UserValidator;
use Psr\Log\LoggerInterface;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\DBAL\Exception\UniqueConstraintViolationException;

/**
 * User service with comprehensive error handling and security
 */
final class UserService
{
    public function __construct(
        private readonly UserRepositoryInterface $userRepository,
        private readonly UserValidator $validator,
        private readonly LoggerInterface $logger,
        private readonly EntityManagerInterface $entityManager
    ) {
    }

    /**
     * Get user by ID with proper validation and error handling
     *
     * @param int $userId User ID to fetch
     * @return User Found user entity
     * @throws UserNotFoundException When user is not found
     * @throws DatabaseException When database operation fails
     */
    public function getUserById(int $userId): User
    {
        // Input validation
        if ($userId <= 0) {
            throw new UserValidationException('User ID must be a positive integer');
        }

        try {
            $user = $this->userRepository->findById($userId);
            
            if ($user === null) {
                $this->logger->info('User not found', ['user_id' => $userId]);
                throw new UserNotFoundException(sprintf('User with ID %d not found', $userId));
            }

            $this->logger->debug('User retrieved successfully', ['user_id' => $userId]);
            return $user;

        } catch (UserNotFoundException $e) {
            throw $e;
        } catch (\Throwable $e) {
            $this->logger->error('Database error while fetching user', [
                'user_id' => $userId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            throw new DatabaseException('Failed to retrieve user', 0, $e);
        }
    }

    /**
     * Create new user with validation and transaction handling
     *
     * @param array<string, mixed> $userData User data array
     * @return User Created user entity
     * @throws UserValidationException When validation fails
     * @throws DatabaseException When database operation fails
     */
    public function createUser(array $userData): User
    {
        // Comprehensive input validation
        $validatedData = $this->validator->validate($userData);
        
        // Check if user already exists
        if ($this->userRepository->findByEmail($validatedData['email']) !== null) {
            throw new UserValidationException(
                sprintf('User with email %s already exists', $validatedData['email'])
            );
        }

        $this->entityManager->beginTransaction();
        
        try {
            // Create user entity with validated data
            $user = new User(
                name: $this->sanitizeString($validatedData['name']),
                email: filter_var($validatedData['email'], FILTER_VALIDATE_EMAIL),
                password: password_hash($validatedData['password'], PASSWORD_ARGON2ID)
            );

            // Persist user
            $this->entityManager->persist($user);
            $this->entityManager->flush();
            $this->entityManager->commit();

            $this->logger->info('User created successfully', [
                'user_id' => $user->getId(),
                'email' => $user->getEmail()
            ]);

            return $user;

        } catch (UniqueConstraintViolationException $e) {
            $this->entityManager->rollback();
            throw new UserValidationException('User with this email already exists');
            
        } catch (\Throwable $e) {
            $this->entityManager->rollback();
            
            $this->logger->error('Failed to create user', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'user_data' => array_intersect_key($userData, ['name' => '', 'email' => ''])
            ]);
            
            throw new DatabaseException('Failed to create user', 0, $e);
        }
    }

    /**
     * Update user with partial data and validation
     *
     * @param int $userId User ID to update
     * @param array<string, mixed> $updateData Partial update data
     * @return User Updated user entity
     * @throws UserNotFoundException When user is not found
     * @throws UserValidationException When validation fails
     * @throws DatabaseException When database operation fails
     */
    public function updateUser(int $userId, array $updateData): User
    {
        // Get existing user first
        $user = $this->getUserById($userId);
        
        // Validate update data
        $validatedData = $this->validator->validatePartial($updateData);
        
        $this->entityManager->beginTransaction();
        
        try {
            // Update only provided fields
            if (isset($validatedData['name'])) {
                $user->setName($this->sanitizeString($validatedData['name']));
            }
            
            if (isset($validatedData['email'])) {
                $email = filter_var($validatedData['email'], FILTER_VALIDATE_EMAIL);
                if ($email === false) {
                    throw new UserValidationException('Invalid email format');
                }
                
                // Check email uniqueness
                $existingUser = $this->userRepository->findByEmail($email);
                if ($existingUser !== null && $existingUser->getId() !== $userId) {
                    throw new UserValidationException('Email already in use');
                }
                
                $user->setEmail($email);
            }
            
            if (isset($validatedData['password'])) {
                $hashedPassword = password_hash($validatedData['password'], PASSWORD_ARGON2ID);
                $user->setPassword($hashedPassword);
            }

            $this->entityManager->flush();
            $this->entityManager->commit();

            $this->logger->info('User updated successfully', [
                'user_id' => $userId,
                'updated_fields' => array_keys($validatedData)
            ]);

            return $user;

        } catch (UserValidationException $e) {
            $this->entityManager->rollback();
            throw $e;
            
        } catch (\Throwable $e) {
            $this->entityManager->rollback();
            
            $this->logger->error('Failed to update user', [
                'user_id' => $userId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            throw new DatabaseException('Failed to update user', 0, $e);
        }
    }

    /**
     * Delete user with proper validation and logging
     *
     * @param int $userId User ID to delete
     * @throws UserNotFoundException When user is not found
     * @throws DatabaseException When database operation fails
     */
    public function deleteUser(int $userId): void
    {
        // Verify user exists first
        $user = $this->getUserById($userId);
        
        $this->entityManager->beginTransaction();
        
        try {
            $this->entityManager->remove($user);
            $this->entityManager->flush();
            $this->entityManager->commit();

            $this->logger->info('User deleted successfully', [
                'user_id' => $userId,
                'email' => $user->getEmail()
            ]);

        } catch (\Throwable $e) {
            $this->entityManager->rollback();
            
            $this->logger->error('Failed to delete user', [
                'user_id' => $userId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            throw new DatabaseException('Failed to delete user', 0, $e);
        }
    }

    /**
     * Get paginated users with filtering
     *
     * @param int $page Page number (1-based)
     * @param int $limit Items per page
     * @param array<string, mixed> $filters Optional filters
     * @return array{users: User[], total: int, page: int, limit: int}
     * @throws UserValidationException When pagination parameters are invalid
     * @throws DatabaseException When database operation fails
     */
    public function getUsers(int $page = 1, int $limit = 10, array $filters = []): array
    {
        // Validate pagination parameters
        if ($page < 1) {
            throw new UserValidationException('Page must be greater than 0');
        }
        
        if ($limit < 1 || $limit > 100) {
            throw new UserValidationException('Limit must be between 1 and 100');
        }

        try {
            $offset = ($page - 1) * $limit;
            
            $users = $this->userRepository->findWithPagination($offset, $limit, $filters);
            $total = $this->userRepository->countWithFilters($filters);

            $this->logger->debug('Users retrieved with pagination', [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'filters' => $filters
            ]);

            return [
                'users' => $users,
                'total' => $total,
                'page' => $page,
                'limit' => $limit
            ];

        } catch (\Throwable $e) {
            $this->logger->error('Failed to retrieve users', [
                'page' => $page,
                'limit' => $limit,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            throw new DatabaseException('Failed to retrieve users', 0, $e);
        }
    }

    /**
     * Sanitize string input to prevent XSS
     */
    private function sanitizeString(string $input): string
    {
        return htmlspecialchars(trim($input), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }
}

/**
 * User validator with comprehensive validation rules
 */
final class UserValidator
{
    /**
     * Validate complete user data for creation
     *
     * @param array<string, mixed> $data Input data
     * @return array<string, mixed> Validated data
     * @throws UserValidationException When validation fails
     */
    public function validate(array $data): array
    {
        $errors = [];
        
        // Validate name
        if (!isset($data['name']) || !is_string($data['name'])) {
            $errors[] = 'Name is required and must be a string';
        } elseif (strlen(trim($data['name'])) < 2) {
            $errors[] = 'Name must be at least 2 characters long';
        } elseif (strlen($data['name']) > 100) {
            $errors[] = 'Name must not exceed 100 characters';
        }
        
        // Validate email
        if (!isset($data['email']) || !is_string($data['email'])) {
            $errors[] = 'Email is required and must be a string';
        } elseif (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            $errors[] = 'Invalid email format';
        }
        
        // Validate password
        if (!isset($data['password']) || !is_string($data['password'])) {
            $errors[] = 'Password is required and must be a string';
        } elseif (strlen($data['password']) < 8) {
            $errors[] = 'Password must be at least 8 characters long';
        } elseif (!preg_match('/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/', $data['password'])) {
            $errors[] = 'Password must contain uppercase, lowercase, number and special character';
        }
        
        if (!empty($errors)) {
            throw new UserValidationException('Validation failed: ' . implode(', ', $errors));
        }
        
        return [
            'name' => trim($data['name']),
            'email' => strtolower(trim($data['email'])),
            'password' => $data['password']
        ];
    }

    /**
     * Validate partial user data for updates
     *
     * @param array<string, mixed> $data Input data
     * @return array<string, mixed> Validated data
     * @throws UserValidationException When validation fails
     */
    public function validatePartial(array $data): array
    {
        $errors = [];
        $validated = [];
        
        // Validate name if provided
        if (isset($data['name'])) {
            if (!is_string($data['name'])) {
                $errors[] = 'Name must be a string';
            } elseif (strlen(trim($data['name'])) < 2) {
                $errors[] = 'Name must be at least 2 characters long';
            } elseif (strlen($data['name']) > 100) {
                $errors[] = 'Name must not exceed 100 characters';
            } else {
                $validated['name'] = trim($data['name']);
            }
        }
        
        // Validate email if provided
        if (isset($data['email'])) {
            if (!is_string($data['email'])) {
                $errors[] = 'Email must be a string';
            } elseif (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
                $errors[] = 'Invalid email format';
            } else {
                $validated['email'] = strtolower(trim($data['email']));
            }
        }
        
        // Validate password if provided
        if (isset($data['password'])) {
            if (!is_string($data['password'])) {
                $errors[] = 'Password must be a string';
            } elseif (strlen($data['password']) < 8) {
                $errors[] = 'Password must be at least 8 characters long';
            } elseif (!preg_match('/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/', $data['password'])) {
                $errors[] = 'Password must contain uppercase, lowercase, number and special character';
            } else {
                $validated['password'] = $data['password'];
            }
        }
        
        if (!empty($errors)) {
            throw new UserValidationException('Validation failed: ' . implode(', ', $errors));
        }
        
        return $validated;
    }
}
```

---

## 🎯 FINAL PHP SUMMARY (After All Changes Reviewed)

### 📋 COMPLIANCE SCORES
- **Security Implementation**: [X/5] - Input validation, SQL injection prevention, XSS protection
- **Type Safety**: [X/5] - Type declarations, strict mode, proper validation
- **Error Handling**: [X/5] - Exception handling, logging, transaction management
- **Database Security**: [X/5] - Prepared statements, transaction handling, ORM usage
- **Modern PHP**: [X/5] - PSR compliance, modern features, dependency injection
- **Security Assessment**: [LEVEL] - Input validation, injection prevention, secure patterns

### 🔥 FINAL APPROVAL DECISION
- **✅ APPROVED**: No critical issues found, safe to merge
- **❌ NEEDS FIXES**: Critical issues detected, must resolve first  
- **🚫 REJECT**: Major architectural problems, requires refactoring