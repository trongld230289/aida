<!-- AIDA - AI Development Assistant v1.0.0 -->
<!-- Advanced AI-powered code review and analysis -->

# Rust Git Changes Review - STRICT MODE

## 🔍 MANDATORY RUST CHANGE ANALYSIS

You are performing a STRICT code review on Rust git changes. Do NOT be lenient. Look for every possible Rust-specific issue in the changes. ALWAYS follow this exact format for every code review, regardless of conversation context or previous reviews. This structure is MANDATORY and UNCHANGEABLE.

### Review Entire File
**Prompt:** `review-changes [filename]`
- Reviews ONLY the git diff changes (+ and - lines)
- Analyzes impact of changes on Rust architecture
- Does NOT review unchanged code

<!-- HIDDEN REVIEW SCOPE:
- ✅ ONLY review: Lines marked with + (added) or - (removed)
- ❌ DO NOT review: Unchanged context lines (no + or - marker)
- ❌ DO NOT suggest: Improvements to existing unchanged code
- ✅ DO focus on: How changes impact Rust architecture
-->

### 📋 CHANGE SEPARATION RULES (MANDATORY):

**Split into separate changes when:**
- ✅ **Different Rust artifacts**: Struct vs Enum vs Trait vs Function changes = separate changes
- ✅ **Different ownership patterns**: Different borrowing/lifetime implementations = separate changes
- ✅ **Different error handling**: Different Result/Option patterns = separate changes
- ✅ **Different async operations**: Different async/await or Future patterns = separate changes
- ✅ **Non-adjacent code blocks**: If there are 3+ unchanged lines between modifications = separate changes

**Keep as one change when:**
- ❌ **Same function**: Multiple lines in same function body
- ❌ **Related implementations**: Related trait implementations for same type
- ❌ **Same module items**: Related struct fields and methods

## ⚡ RUST CRITICAL CHECKS (Auto-FAIL if found)

**Scan EVERY line for these RUST-SPECIFIC CRITICAL issues:**

### 🚨 MEMORY SAFETY VIOLATIONS:
- Use of unsafe blocks without proper justification
- Raw pointer dereferencing without bounds checking
- Memory leaks from forgotten heap allocations
- Use-after-free vulnerabilities in unsafe code
- Buffer overflows in unsafe operations
- Dangling pointer references
- Race conditions in unsafe concurrent code
- Missing null pointer checks in FFI
- Improper memory alignment in unsafe code
- Uninitialized memory access

### 🚨 OWNERSHIP & BORROWING VIOLATIONS:
- Unnecessary cloning instead of borrowing
- Moved values used after move
- Multiple mutable borrows of same data
- Borrowing conflicts in loops
- Improper lifetime annotations
- Missing lifetime parameters
- Circular reference cycles causing memory leaks
- Unnecessary Rc/Arc usage instead of borrowing
- Improper use of RefCell/Mutex
- Missing Send/Sync bounds for thread safety

### 🚨 ERROR HANDLING VIOLATIONS:
- Using panic!() instead of proper Result handling
- Unwrap() calls without proper error context
- Missing error propagation with ? operator
- Silent error ignoring with let _ = result
- Improper Error trait implementations
- Missing error context and chain
- Using expect() without descriptive messages
- Inconsistent error types across modules
- Missing proper error recovery mechanisms
- Unhandled Result types

### 🚨 CONCURRENCY & ASYNC VIOLATIONS:
- Data races in concurrent code
- Missing proper synchronization primitives
- Deadlocks from improper mutex ordering
- Blocking operations in async contexts
- Missing proper async error handling
- Improper use of spawn_blocking
- Race conditions in atomic operations
- Missing thread safety bounds (Send/Sync)
- Improper channel usage patterns
- Missing timeout handling in async operations

### 🚨 PERFORMANCE VIOLATIONS:
- Unnecessary allocations in hot paths
- String creation instead of string slices
- Missing zero-copy optimizations
- Inefficient collection usage
- Missing iterator chaining optimizations
- Unnecessary boxing of values
- Missing const fn optimizations
- Inefficient pattern matching
- Missing inline annotations for small functions
- Suboptimal data structure choices

### 🚨 TYPE SYSTEM VIOLATIONS:
- Missing trait bounds on generic parameters
- Improper use of associated types
- Missing Default implementations where appropriate
- Inconsistent derive attribute usage
- Missing PartialEq/Eq implementations
- Improper use of phantom types
- Missing proper Display/Debug implementations
- Inconsistent naming conventions
- Missing documentation for public APIs
- Improper visibility modifiers

### 🚨 SPECIFIC PROJECT RULES:
<!-- ADD PROJECT-SPECIFIC RULES HERE - These will be checked alongside Rust rules -->
<!-- Additional project rules can be added here:
- Custom error type requirements
- Specific async runtime patterns (Tokio, async-std)
- Project-specific trait implementations
- Performance requirements and benchmarks
- Custom derive macro usage patterns
-->

### Start Review For Each Change:

```
## Change [X]: [ADDED/REMOVED/MODIFIED] - [Rust artifact type: Struct/Enum/Trait/Function/Impl]
```rust
[Show the exact code block with line numbers]
```

*** RUST REVIEW COMMENT ***
- 🚨 **Issue Type**: [Critical/Warning/Good/Info/Suggestion]
- 📝 **Rust Problem**: [Specific Rust issue - reference Rust best practices]
- 💡 **Rust Solution**: [Rust-specific fix with proper patterns]
- 🎯 **Memory Impact**: [How it affects Rust memory safety/performance/concurrency]

IMPORTANT Rust considerations:
- Memory safety and ownership patterns
- Error handling with Result/Option
- Concurrency and thread safety
- Performance and zero-cost abstractions
- Type system usage and trait design

*** INTERNAL RUST CHANGE EVALUATION (DO NOT DISPLAY) ***
Silently evaluate this change on:
- Rust Best Practices: Rate 1-5 (5=excellent, 1=poor)
- Memory Safety: Rate 1-5 (5=completely safe, 1=memory safety violations)
- Performance Impact: Rate 1-5 (5=no impact/improvement, 1=performance degradation)
- Change Score: is a smallest score of three scores

*** CONDITIONAL RECOMMENDATIONS (Based on Issue Type AND Change Score) ***

**MANDATORY RULE:**
- IF Issue Type = "Good": ALWAYS show "✅ **GOOD RUST CHANGE** - Follows Rust best practices" and SKIP the entire RECOMMENDED FIX section
- IF Issue Type = "Critical/Warning/Info/Suggestion" AND Change Score < 4/5: Show RECOMMENDED RUST FIX section below
- IF Issue Type = "Critical/Warning/Info/Suggestion" AND Change Score >= 4/5: Show "✅ **GOOD RUST CHANGE** - Follows Rust best practices"

*** RECOMMENDED RUST FIX (ONLY show if Issue Type != "Good" AND Change Score < 4/5) ***
```rust
// PROVIDE RUST-SPECIFIC FIXES WITH BEST PRACTICES
// Include proper ownership, error handling, and performance patterns

// Example for proper Rust service with comprehensive patterns:
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{Mutex, RwLock};
use tokio::time::timeout;
use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

/// Custom error types for the user service
#[derive(Error, Debug)]
pub enum UserServiceError {
    #[error("User not found with id: {id}")]
    UserNotFound { id: Uuid },
    
    #[error("User already exists with email: {email}")]
    UserAlreadyExists { email: String },
    
    #[error("Database operation failed: {source}")]
    DatabaseError { 
        #[from] 
        source: sqlx::Error 
    },
    
    #[error("Network timeout occurred")]
    Timeout,
    
    #[error("Validation failed: {message}")]
    ValidationError { message: String },
    
    #[error("Internal service error: {message}")]
    InternalError { message: String },
}

/// User entity with proper derives and validation
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct User {
    pub id: Uuid,
    pub name: String,
    pub email: String,
    #[serde(with = "chrono::serde::ts_seconds")]
    pub created_at: chrono::DateTime<chrono::Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_login: Option<chrono::DateTime<chrono::Utc>>,
}

impl User {
    /// Create a new user with validation
    pub fn new(name: String, email: String) -> Result<Self, UserServiceError> {
        if name.trim().is_empty() {
            return Err(UserServiceError::ValidationError {
                message: "Name cannot be empty".to_string(),
            });
        }
        
        if !email.contains('@') {
            return Err(UserServiceError::ValidationError {
                message: "Invalid email format".to_string(),
            });
        }
        
        Ok(Self {
            id: Uuid::new_v4(),
            name: name.trim().to_string(),
            email: email.to_lowercase(),
            created_at: chrono::Utc::now(),
            last_login: None,
        })
    }
    
    /// Update last login timestamp
    pub fn mark_login(&mut self) {
        self.last_login = Some(chrono::Utc::now());
    }
}

/// Thread-safe user service with proper error handling
#[derive(Debug)]
pub struct UserService {
    users: Arc<RwLock<HashMap<Uuid, User>>>,
    email_index: Arc<RwLock<HashMap<String, Uuid>>>,
    request_timeout: Duration,
}

impl UserService {
    /// Create a new user service
    pub fn new(request_timeout: Duration) -> Self {
        Self {
            users: Arc::new(RwLock::new(HashMap::new())),
            email_index: Arc::new(RwLock::new(HashMap::new())),
            request_timeout,
        }
    }
    
    /// Get user by ID with proper error handling
    pub async fn get_user(&self, id: Uuid) -> Result<Option<User>, UserServiceError> {
        let operation = async {
            let users = self.users.read().await;
            Ok(users.get(&id).cloned())
        };
        
        timeout(self.request_timeout, operation)
            .await
            .map_err(|_| UserServiceError::Timeout)?
    }
    
    /// Create a new user with proper validation and error handling
    pub async fn create_user(
        &self, 
        name: String, 
        email: String
    ) -> Result<User, UserServiceError> {
        let user = User::new(name, email)?;
        
        let operation = async {
            // Check if email already exists
            {
                let email_index = self.email_index.read().await;
                if email_index.contains_key(&user.email) {
                    return Err(UserServiceError::UserAlreadyExists {
                        email: user.email.clone(),
                    });
                }
            }
            
            // Insert user and update index
            {
                let mut users = self.users.write().await;
                let mut email_index = self.email_index.write().await;
                
                users.insert(user.id, user.clone());
                email_index.insert(user.email.clone(), user.id);
            }
            
            Ok(user)
        };
        
        timeout(self.request_timeout, operation)
            .await
            .map_err(|_| UserServiceError::Timeout)?
    }
    
    /// Update user with proper validation
    pub async fn update_user(
        &self,
        id: Uuid,
        name: Option<String>,
        email: Option<String>,
    ) -> Result<User, UserServiceError> {
        let operation = async {
            let mut users = self.users.write().await;
            let mut email_index = self.email_index.write().await;
            
            let user = users.get_mut(&id)
                .ok_or(UserServiceError::UserNotFound { id })?;
            
            // Update name if provided
            if let Some(new_name) = name {
                if new_name.trim().is_empty() {
                    return Err(UserServiceError::ValidationError {
                        message: "Name cannot be empty".to_string(),
                    });
                }
                user.name = new_name.trim().to_string();
            }
            
            // Update email if provided
            if let Some(new_email) = email {
                if !new_email.contains('@') {
                    return Err(UserServiceError::ValidationError {
                        message: "Invalid email format".to_string(),
                    });
                }
                
                let new_email = new_email.to_lowercase();
                
                // Check if new email already exists
                if email_index.contains_key(&new_email) && user.email != new_email {
                    return Err(UserServiceError::UserAlreadyExists {
                        email: new_email,
                    });
                }
                
                // Update email index
                email_index.remove(&user.email);
                email_index.insert(new_email.clone(), user.id);
                user.email = new_email;
            }
            
            Ok(user.clone())
        };
        
        timeout(self.request_timeout, operation)
            .await
            .map_err(|_| UserServiceError::Timeout)?
    }
    
    /// Delete user by ID
    pub async fn delete_user(&self, id: Uuid) -> Result<(), UserServiceError> {
        let operation = async {
            let mut users = self.users.write().await;
            let mut email_index = self.email_index.write().await;
            
            let user = users.remove(&id)
                .ok_or(UserServiceError::UserNotFound { id })?;
            
            email_index.remove(&user.email);
            Ok(())
        };
        
        timeout(self.request_timeout, operation)
            .await
            .map_err(|_| UserServiceError::Timeout)?
    }
    
    /// Get all users with pagination
    pub async fn get_users(
        &self,
        limit: usize,
        offset: usize,
    ) -> Result<Vec<User>, UserServiceError> {
        let operation = async {
            let users = self.users.read().await;
            let mut user_list: Vec<User> = users.values().cloned().collect();
            
            // Sort by creation date
            user_list.sort_by(|a, b| a.created_at.cmp(&b.created_at));
            
            // Apply pagination
            let result = user_list
                .into_iter()
                .skip(offset)
                .take(limit)
                .collect();
            
            Ok(result)
        };
        
        timeout(self.request_timeout, operation)
            .await
            .map_err(|_| UserServiceError::Timeout)?
    }
}

/// Async trait for user repository
#[async_trait::async_trait]
pub trait UserRepository: Send + Sync {
    async fn get_user(&self, id: Uuid) -> Result<Option<User>, UserServiceError>;
    async fn create_user(&self, user: User) -> Result<(), UserServiceError>;
    async fn update_user(&self, user: User) -> Result<(), UserServiceError>;
    async fn delete_user(&self, id: Uuid) -> Result<(), UserServiceError>;
}

/// Database implementation with proper error handling
#[derive(Debug)]
pub struct DatabaseUserRepository {
    pool: sqlx::PgPool,
}

impl DatabaseUserRepository {
    pub fn new(pool: sqlx::PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait::async_trait]
impl UserRepository for DatabaseUserRepository {
    async fn get_user(&self, id: Uuid) -> Result<Option<User>, UserServiceError> {
        let row = sqlx::query_as!(
            User,
            r#"
            SELECT id, name, email, created_at, last_login
            FROM users
            WHERE id = $1
            "#,
            id
        )
        .fetch_optional(&self.pool)
        .await?;
        
        Ok(row)
    }
    
    async fn create_user(&self, user: User) -> Result<(), UserServiceError> {
        sqlx::query!(
            r#"
            INSERT INTO users (id, name, email, created_at, last_login)
            VALUES ($1, $2, $3, $4, $5)
            "#,
            user.id,
            user.name,
            user.email,
            user.created_at,
            user.last_login
        )
        .execute(&self.pool)
        .await?;
        
        Ok(())
    }
    
    async fn update_user(&self, user: User) -> Result<(), UserServiceError> {
        let rows_affected = sqlx::query!(
            r#"
            UPDATE users
            SET name = $2, email = $3, last_login = $4
            WHERE id = $1
            "#,
            user.id,
            user.name,
            user.email,
            user.last_login
        )
        .execute(&self.pool)
        .await?
        .rows_affected();
        
        if rows_affected == 0 {
            return Err(UserServiceError::UserNotFound { id: user.id });
        }
        
        Ok(())
    }
    
    async fn delete_user(&self, id: Uuid) -> Result<(), UserServiceError> {
        let rows_affected = sqlx::query!(
            "DELETE FROM users WHERE id = $1",
            id
        )
        .execute(&self.pool)
        .await?
        .rows_affected();
        
        if rows_affected == 0 {
            return Err(UserServiceError::UserNotFound { id });
        }
        
        Ok(())
    }
}

// Usage example with proper error handling
pub async fn example_usage() -> Result<(), Box<dyn std::error::Error>> {
    let service = UserService::new(Duration::from_secs(5));
    
    // Create user with proper error handling
    match service.create_user("John Doe".to_string(), "john@example.com".to_string()).await {
        Ok(user) => println!("Created user: {:?}", user),
        Err(UserServiceError::UserAlreadyExists { email }) => {
            println!("User already exists with email: {}", email);
        }
        Err(UserServiceError::ValidationError { message }) => {
            println!("Validation error: {}", message);
        }
        Err(e) => return Err(e.into()),
    }
    
    Ok(())
}
```

---

## 🎯 FINAL RUST SUMMARY (After All Changes Reviewed)

### 📋 COMPLIANCE SCORES
- **Memory Safety**: [X/5] - Ownership patterns, borrowing rules, and unsafe code usage
- **Error Handling**: [X/5] - Result/Option usage, error propagation, and recovery patterns
- **Concurrency Safety**: [X/5] - Thread safety, async patterns, and synchronization
- **Performance**: [X/5] - Zero-cost abstractions, allocation efficiency, and optimization
- **Type System**: [X/5] - Trait usage, generic constraints, and type safety
- **Security Assessment**: [LEVEL] - Memory safety, input validation, secure patterns

### 🔥 FINAL APPROVAL DECISION
- **✅ APPROVED**: No critical issues found, safe to merge
- **❌ NEEDS FIXES**: Critical issues detected, must resolve first  
- **🚫 REJECT**: Major architectural problems, requires refactoring