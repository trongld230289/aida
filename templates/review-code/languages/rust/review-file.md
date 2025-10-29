<!-- AIDA - AI Development Assistant v1.0.0 -->
<!-- Advanced AI-powered code review and analysis -->

# Rust Framework Review Template

## 🎯 Rust-Specific Review Guidelines

This template focuses specifically on Rust framework best practices, patterns, and common pitfalls. Use this for reviewing Rust modules, functions, structs, traits, and configuration files.

---

<!-- 
📝 NOTE: The following CRITICAL CHECKS section applies to REVIEW-FILE only.
These comprehensive checks are for complete file analysis, not incremental changes.
For PR/change reviews, use review-pr.md or review-changes.md templates.
-->

## ⚡ RUST CRITICAL CHECKS (Auto-FAIL if found)

**Scan EVERY line for these RUST-SPECIFIC CRITICAL issues:**

### 🚨 MEMORY SAFETY VIOLATIONS:
- Unsafe blocks without proper documentation
- Raw pointer dereferencing without bounds checking
- Memory leaks from forgetting to drop resources
- Use-after-free through unsafe transmutation
- Buffer overflows in unsafe array access
- Double-free through manual memory management
- Data races in unsafe concurrent code
- Dangling pointer creation through lifetime violations
- Unaligned memory access in unsafe code
- Stack overflow from infinite recursion

### 🚨 OWNERSHIP & BORROWING VIOLATIONS:
- Lifetime annotations that are too restrictive
- Unnecessary cloning for performance-critical code
- Reference cycles causing memory leaks
- Borrowing rules violations in complex scenarios
- Lifetime elision causing unclear ownership
- Move semantics not utilized properly
- Shared ownership overused (Rc/Arc abuse)
- Interior mutability patterns misused
- Borrow checker circumvention through unsafe
- Ownership transfer without proper documentation

### 🚨 CONCURRENCY VIOLATIONS:
- Data races in multi-threaded code
- Deadlocks from improper lock ordering
- Race conditions in async code
- Channel operations without proper error handling
- Shared mutable state without synchronization
- Thread spawning without proper cleanup
- Async/await misuse causing blocking
- Send/Sync trait violations
- Atomic operations used incorrectly
- Lock-free algorithms implemented incorrectly

### 🚨 ERROR HANDLING VIOLATIONS:
- Panic usage in library code
- Unwrap/expect calls without proper justification
- Error types not implementing proper traits
- Error propagation missing context
- Result types ignored without handling
- Option types handled unsafely
- Custom error types without proper display
- Error recovery strategies missing
- Panic boundaries not properly handled
- Error information loss during propagation

### 🚨 PERFORMANCE VIOLATIONS:
- Unnecessary allocations in hot paths
- String operations creating excessive copies
- Vec reallocations from poor capacity planning
- Inefficient iterators and closures
- Blocking operations in async contexts
- Expensive computations without memoization
- Cache misses from poor data layout
- Inefficient serialization/deserialization
- Unoptimized algorithms and data structures
- Resource contention from poor design

### 🚨 TYPE SYSTEM VIOLATIONS:
- Trait bounds that are too restrictive
- Generic parameters without proper constraints
- Type erasure losing important information
- Phantom types used incorrectly
- Associated types misused in trait design
- Lifetime parameters unnecessary complexity
- Type conversions without error handling
- Enum variants not handled exhaustively
- Pattern matching incomplete cases
- Type inference failures from ambiguity

### 🚨 API DESIGN VIOLATIONS:
- Public APIs without proper documentation
- Breaking changes without version bumping
- Resource management not following RAII
- Function signatures with too many parameters
- Return types not utilizing Result/Option
- Trait methods with default implementations abused
- Public types exposing internal implementation
- API surface area too large without modularity
- Zero-cost abstractions violated
- API stability guarantees not documented

### 🚨 CARGO & MODULE VIOLATIONS:
- Dependencies without proper version constraints
- Circular dependencies between modules
- Unused dependencies in Cargo.toml
- Missing feature flags for optional functionality
- Module visibility not properly controlled
- Re-exports creating confusing APIs
- Version conflicts in dependency tree
- Build scripts with unsafe operations
- Procedural macros without proper error handling
- Documentation missing for public items

### 🚨 ASYNC/AWAIT VIOLATIONS:
- Blocking operations in async functions
- Async functions that don't need to be async
- Future trait implementation errors
- Async runtime misuse (multiple runtimes)
- Stream processing without proper backpressure
- Async trait objects without proper lifetimes
- Spawned tasks without proper error handling
- Resource cleanup in async destructors
- Select operations without proper cancellation
- Async channels used incorrectly

### 🚨 SPECIFIC PROJECT RULES:
<!-- ADD PROJECT-SPECIFIC RULES HERE - These will be checked alongside Rust rules -->
<!-- Additional project rules can be added here:
- Framework-specific patterns (Actix-web, Axum, Warp)
- Database patterns (Diesel, SQLx, SeaORM)
- Serialization patterns (Serde, bincode)
- Web assembly patterns
- Embedded development patterns
-->

---

## 🔍 Rust Code Analysis

### 1. **Ownership & Memory Safety**

#### 🦀 Memory Management
- **Ownership Rules**
  - Single ownership principle followed?
  - Borrowing rules respected?
  - Lifetime annotations appropriate?
  - Move semantics utilized correctly?

#### 🔒 Safety Guarantees
- Memory safety maintained
- Thread safety ensured
- Zero-cost abstractions utilized
- RAII patterns implemented

#### 🛡️ Safe Patterns
```rust
// Best Practice: Safe Rust patterns with proper ownership

use std::collections::HashMap;
use std::sync::{Arc, Mutex, RwLock};
use std::thread;
use std::time::{Duration, Instant};
use tokio::time::sleep;
use serde::{Deserialize, Serialize};
use anyhow::{Context, Result};

/// User entity with proper ownership semantics
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct User {
    pub id: u64,
    pub name: String,
    pub email: String,
    pub created_at: std::time::SystemTime,
}

impl User {
    /// Create a new user with validation
    pub fn new(id: u64, name: String, email: String) -> Result<Self> {
        if name.trim().is_empty() {
            anyhow::bail!("Name cannot be empty");
        }
        
        if !email.contains('@') {
            anyhow::bail!("Invalid email format");
        }
        
        Ok(Self {
            id,
            name: name.trim().to_string(),
            email: email.to_lowercase(),
            created_at: std::time::SystemTime::now(),
        })
    }
    
    /// Update user name with ownership transfer
    pub fn update_name(mut self, new_name: String) -> Result<Self> {
        if new_name.trim().is_empty() {
            anyhow::bail!("Name cannot be empty");
        }
        
        self.name = new_name.trim().to_string();
        Ok(self)
    }
    
    /// Get user display name (borrowing)
    pub fn display_name(&self) -> &str {
        &self.name
    }
    
    /// Validate email format
    pub fn validate_email(&self) -> bool {
        self.email.contains('@') && !self.email.is_empty()
    }
}

/// Thread-safe user repository with proper synchronization
#[derive(Debug)]
pub struct UserRepository {
    users: Arc<RwLock<HashMap<u64, User>>>,
    next_id: Arc<Mutex<u64>>,
}

impl UserRepository {
    /// Create a new repository
    pub fn new() -> Self {
        Self {
            users: Arc::new(RwLock::new(HashMap::new())),
            next_id: Arc::new(Mutex::new(1)),
        }
    }
    
    /// Add a user with proper error handling
    pub fn add_user(&self, name: String, email: String) -> Result<User> {
        // Generate ID safely
        let id = {
            let mut next_id = self.next_id.lock()
                .map_err(|_| anyhow::anyhow!("Lock poisoned"))?;
            let id = *next_id;
            *next_id += 1;
            id
        };
        
        // Create user
        let user = User::new(id, name, email)
            .context("Failed to create user")?;
        
        // Store user safely
        {
            let mut users = self.users.write()
                .map_err(|_| anyhow::anyhow!("Lock poisoned"))?;
            
            if users.contains_key(&id) {
                anyhow::bail!("User with ID {} already exists", id);
            }
            
            users.insert(id, user.clone());
        }
        
        Ok(user)
    }
    
    /// Get user by ID with safe borrowing
    pub fn get_user(&self, id: u64) -> Result<Option<User>> {
        let users = self.users.read()
            .map_err(|_| anyhow::anyhow!("Lock poisoned"))?;
        
        Ok(users.get(&id).cloned())
    }
    
    /// Update user with optimistic locking
    pub fn update_user(&self, id: u64, name: Option<String>, email: Option<String>) -> Result<User> {
        let mut users = self.users.write()
            .map_err(|_| anyhow::anyhow!("Lock poisoned"))?;
        
        let user = users.get_mut(&id)
            .ok_or_else(|| anyhow::anyhow!("User not found"))?;
        
        if let Some(new_name) = name {
            if new_name.trim().is_empty() {
                anyhow::bail!("Name cannot be empty");
            }
            user.name = new_name.trim().to_string();
        }
        
        if let Some(new_email) = email {
            if !new_email.contains('@') {
                anyhow::bail!("Invalid email format");
            }
            user.email = new_email.to_lowercase();
        }
        
        Ok(user.clone())
    }
    
    /// Get all users with pagination
    pub fn get_users(&self, offset: usize, limit: usize) -> Result<Vec<User>> {
        let users = self.users.read()
            .map_err(|_| anyhow::anyhow!("Lock poisoned"))?;
        
        let mut user_list: Vec<_> = users.values().cloned().collect();
        user_list.sort_by_key(|u| u.id);
        
        Ok(user_list.into_iter()
            .skip(offset)
            .take(limit)
            .collect())
    }
    
    /// Count total users
    pub fn count_users(&self) -> Result<usize> {
        let users = self.users.read()
            .map_err(|_| anyhow::anyhow!("Lock poisoned"))?;
        
        Ok(users.len())
    }
}

/// RAII resource wrapper for automatic cleanup
#[derive(Debug)]
pub struct DatabaseConnection {
    connection_id: u64,
    connected: bool,
}

impl DatabaseConnection {
    pub fn connect(host: &str, port: u16) -> Result<Self> {
        // Simulate connection logic
        if host.is_empty() {
            anyhow::bail!("Host cannot be empty");
        }
        
        println!("Connecting to {}:{}", host, port);
        
        Ok(Self {
            connection_id: rand::random(),
            connected: true,
        })
    }
    
    pub fn execute_query(&self, query: &str) -> Result<String> {
        if !self.connected {
            anyhow::bail!("Connection is closed");
        }
        
        if query.is_empty() {
            anyhow::bail!("Query cannot be empty");
        }
        
        // Simulate query execution
        Ok(format!("Result for: {}", query))
    }
    
    pub fn is_connected(&self) -> bool {
        self.connected
    }
}

impl Drop for DatabaseConnection {
    fn drop(&mut self) {
        if self.connected {
            println!("Closing database connection {}", self.connection_id);
            self.connected = false;
        }
    }
}

/// Smart pointer usage with proper reference counting
#[derive(Debug)]
pub struct SharedResource {
    data: Arc<RwLock<String>>,
}

impl SharedResource {
    pub fn new(initial_data: String) -> Self {
        Self {
            data: Arc::new(RwLock::new(initial_data)),
        }
    }
    
    pub fn read_data(&self) -> Result<String> {
        let data = self.data.read()
            .map_err(|_| anyhow::anyhow!("Lock poisoned"))?;
        
        Ok(data.clone())
    }
    
    pub fn update_data(&self, new_data: String) -> Result<()> {
        let mut data = self.data.write()
            .map_err(|_| anyhow::anyhow!("Lock poisoned"))?;
        
        *data = new_data;
        Ok(())
    }
    
    pub fn clone_handle(&self) -> Self {
        Self {
            data: Arc::clone(&self.data),
        }
    }
}

// ❌ Bad: Unsafe patterns and poor ownership
struct BadExample {
    data: *mut u8, // Raw pointer without proper safety
}

impl BadExample {
    unsafe fn dangerous_operation(&self) -> u8 {
        // No bounds checking or null checks
        *self.data
    }
    
    fn memory_leak(&self) -> Vec<String> {
        let mut vec = Vec::new();
        loop {
            vec.push("leak".to_string()); // Infinite allocation
        }
    }
    
    fn panic_in_library(&self, value: Option<i32>) -> i32 {
        value.unwrap() // Can panic in library code
    }
}
```

#### ❌ Common Issues
- Unsafe blocks without documentation
- Memory leaks from resource mismanagement
- Panic usage in library code
- Lifetime annotation complexity

---

### 2. **Async Programming & Concurrency**

#### ⚡ Async Best Practices
```rust
// Best Practice: Async programming with proper patterns

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{Mutex, RwLock, Semaphore, mpsc, oneshot};
use tokio::time::{sleep, timeout, Instant};
use futures::future::{join_all, try_join_all};
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

/// Async user service with proper concurrency patterns
#[derive(Debug)]
pub struct AsyncUserService {
    repository: Arc<AsyncUserRepository>,
    cache: Arc<RwLock<HashMap<u64, CachedUser>>>,
    semaphore: Arc<Semaphore>, // Rate limiting
}

#[derive(Debug, Clone)]
struct CachedUser {
    user: User,
    cached_at: Instant,
}

impl AsyncUserService {
    pub fn new(repository: AsyncUserRepository) -> Self {
        Self {
            repository: Arc::new(repository),
            cache: Arc::new(RwLock::new(HashMap::new())),
            semaphore: Arc::new(Semaphore::new(10)), // Max 10 concurrent operations
        }
    }
    
    /// Get user with caching and rate limiting
    pub async fn get_user(&self, id: u64) -> Result<Option<User>> {
        // Rate limiting
        let _permit = self.semaphore.acquire().await
            .context("Failed to acquire semaphore")?;
        
        // Check cache first
        if let Some(cached) = self.get_from_cache(id).await {
            return Ok(Some(cached));
        }
        
        // Fetch from repository
        let user = self.repository.get_user(id).await
            .context("Failed to get user from repository")?;
        
        // Cache the result
        if let Some(ref user) = user {
            self.cache_user(user.clone()).await;
        }
        
        Ok(user)
    }
    
    /// Create user with validation and caching
    pub async fn create_user(&self, name: String, email: String) -> Result<User> {
        let _permit = self.semaphore.acquire().await
            .context("Failed to acquire semaphore")?;
        
        // Validate input
        if name.trim().is_empty() {
            anyhow::bail!("Name cannot be empty");
        }
        
        if !email.contains('@') {
            anyhow::bail!("Invalid email format");
        }
        
        // Check for existing email
        if self.repository.email_exists(&email).await? {
            anyhow::bail!("Email already exists");
        }
        
        // Create user
        let user = self.repository.create_user(name, email).await
            .context("Failed to create user")?;
        
        // Cache the new user
        self.cache_user(user.clone()).await;
        
        Ok(user)
    }
    
    /// Batch get users with concurrency control
    pub async fn get_users_batch(&self, ids: Vec<u64>) -> Result<Vec<User>> {
        const BATCH_SIZE: usize = 5;
        
        let mut results = Vec::new();
        
        // Process in batches to avoid overwhelming the system
        for batch in ids.chunks(BATCH_SIZE) {
            let futures: Vec<_> = batch.iter()
                .map(|&id| self.get_user(id))
                .collect();
            
            let batch_results = try_join_all(futures).await?;
            
            for result in batch_results {
                if let Some(user) = result {
                    results.push(user);
                }
            }
            
            // Small delay between batches
            sleep(Duration::from_millis(10)).await;
        }
        
        Ok(results)
    }
    
    /// Search users with timeout
    pub async fn search_users(&self, query: &str) -> Result<Vec<User>> {
        let search_future = self.repository.search_users(query);
        
        timeout(Duration::from_secs(5), search_future).await
            .context("Search timeout")?
            .context("Search failed")
    }
    
    async fn get_from_cache(&self, id: u64) -> Option<User> {
        let cache = self.cache.read().await;
        
        if let Some(cached) = cache.get(&id) {
            // Check if cache is still valid (5 minutes)
            if cached.cached_at.elapsed() < Duration::from_secs(300) {
                return Some(cached.user.clone());
            }
        }
        
        None
    }
    
    async fn cache_user(&self, user: User) {
        let mut cache = self.cache.write().await;
        
        cache.insert(user.id, CachedUser {
            user,
            cached_at: Instant::now(),
        });
        
        // Prevent cache from growing too large
        if cache.len() > 1000 {
            let cutoff = Instant::now() - Duration::from_secs(300);
            cache.retain(|_, cached| cached.cached_at > cutoff);
        }
    }
}

/// Async repository with proper error handling
#[derive(Debug)]
pub struct AsyncUserRepository {
    users: Arc<RwLock<HashMap<u64, User>>>,
    next_id: Arc<Mutex<u64>>,
}

impl AsyncUserRepository {
    pub fn new() -> Self {
        Self {
            users: Arc::new(RwLock::new(HashMap::new())),
            next_id: Arc::new(Mutex::new(1)),
        }
    }
    
    pub async fn get_user(&self, id: u64) -> Result<Option<User>> {
        // Simulate async database operation
        sleep(Duration::from_millis(10)).await;
        
        let users = self.users.read().await;
        Ok(users.get(&id).cloned())
    }
    
    pub async fn create_user(&self, name: String, email: String) -> Result<User> {
        // Generate ID
        let id = {
            let mut next_id = self.next_id.lock().await;
            let id = *next_id;
            *next_id += 1;
            id
        };
        
        // Simulate async database operation
        sleep(Duration::from_millis(50)).await;
        
        let user = User::new(id, name, email)?;
        
        // Store user
        {
            let mut users = self.users.write().await;
            users.insert(id, user.clone());
        }
        
        Ok(user)
    }
    
    pub async fn email_exists(&self, email: &str) -> Result<bool> {
        sleep(Duration::from_millis(20)).await;
        
        let users = self.users.read().await;
        
        Ok(users.values().any(|u| u.email == email))
    }
    
    pub async fn search_users(&self, query: &str) -> Result<Vec<User>> {
        sleep(Duration::from_millis(100)).await;
        
        let users = self.users.read().await;
        
        let results: Vec<_> = users.values()
            .filter(|u| u.name.contains(query) || u.email.contains(query))
            .cloned()
            .collect();
        
        Ok(results)
    }
}

/// Message passing patterns with channels
pub struct MessageProcessor {
    sender: mpsc::UnboundedSender<ProcessingTask>,
}

#[derive(Debug)]
pub enum ProcessingTask {
    ProcessUser { user_id: u64, response: oneshot::Sender<Result<String>> },
    ProcessBatch { user_ids: Vec<u64>, response: oneshot::Sender<Result<Vec<String>>> },
    Shutdown,
}

impl MessageProcessor {
    pub fn new() -> (Self, MessageProcessorHandle) {
        let (sender, receiver) = mpsc::unbounded_channel();
        
        let handle = MessageProcessorHandle::new(receiver);
        
        (Self { sender }, handle)
    }
    
    pub async fn process_user(&self, user_id: u64) -> Result<String> {
        let (response_tx, response_rx) = oneshot::channel();
        
        self.sender.send(ProcessingTask::ProcessUser {
            user_id,
            response: response_tx,
        }).context("Failed to send task")?;
        
        response_rx.await
            .context("Failed to receive response")?
    }
    
    pub async fn process_batch(&self, user_ids: Vec<u64>) -> Result<Vec<String>> {
        let (response_tx, response_rx) = oneshot::channel();
        
        self.sender.send(ProcessingTask::ProcessBatch {
            user_ids,
            response: response_tx,
        }).context("Failed to send batch task")?;
        
        response_rx.await
            .context("Failed to receive batch response")?
    }
    
    pub fn shutdown(&self) -> Result<()> {
        self.sender.send(ProcessingTask::Shutdown)
            .context("Failed to send shutdown signal")
    }
}

pub struct MessageProcessorHandle {
    receiver: mpsc::UnboundedReceiver<ProcessingTask>,
}

impl MessageProcessorHandle {
    fn new(receiver: mpsc::UnboundedReceiver<ProcessingTask>) -> Self {
        Self { receiver }
    }
    
    pub async fn run(mut self) -> Result<()> {
        while let Some(task) = self.receiver.recv().await {
            match task {
                ProcessingTask::ProcessUser { user_id, response } => {
                    let result = self.process_single_user(user_id).await;
                    let _ = response.send(result);
                }
                
                ProcessingTask::ProcessBatch { user_ids, response } => {
                    let result = self.process_user_batch(user_ids).await;
                    let _ = response.send(result);
                }
                
                ProcessingTask::Shutdown => {
                    println!("Processor shutting down");
                    break;
                }
            }
        }
        
        Ok(())
    }
    
    async fn process_single_user(&self, user_id: u64) -> Result<String> {
        // Simulate processing
        sleep(Duration::from_millis(100)).await;
        Ok(format!("Processed user {}", user_id))
    }
    
    async fn process_user_batch(&self, user_ids: Vec<u64>) -> Result<Vec<String>> {
        // Process in parallel with limited concurrency
        let semaphore = Arc::new(Semaphore::new(3));
        
        let futures: Vec<_> = user_ids.into_iter()
            .map(|user_id| {
                let semaphore = Arc::clone(&semaphore);
                async move {
                    let _permit = semaphore.acquire().await.unwrap();
                    self.process_single_user(user_id).await
                }
            })
            .collect();
        
        try_join_all(futures).await
    }
}

/// Stream processing with backpressure
use futures::stream::{Stream, StreamExt};
use std::pin::Pin;

pub struct DataProcessor;

impl DataProcessor {
    pub async fn process_stream<S>(&self, mut stream: S) -> Result<Vec<String>>
    where
        S: Stream<Item = u64> + Unpin,
    {
        let mut results = Vec::new();
        let mut buffer = Vec::new();
        const BUFFER_SIZE: usize = 10;
        
        while let Some(item) = stream.next().await {
            buffer.push(item);
            
            if buffer.len() >= BUFFER_SIZE {
                let batch = std::mem::take(&mut buffer);
                let processed = self.process_batch(batch).await?;
                results.extend(processed);
                
                // Backpressure: small delay
                sleep(Duration::from_millis(10)).await;
            }
        }
        
        // Process remaining items
        if !buffer.is_empty() {
            let processed = self.process_batch(buffer).await?;
            results.extend(processed);
        }
        
        Ok(results)
    }
    
    async fn process_batch(&self, items: Vec<u64>) -> Result<Vec<String>> {
        // Simulate processing
        sleep(Duration::from_millis(50)).await;
        
        Ok(items.into_iter()
            .map(|item| format!("Processed: {}", item))
            .collect())
    }
}
```

---

### 3. **Error Handling & Result Types**

#### 🚨 Robust Error Handling
```rust
// Best Practice: Comprehensive error handling patterns

use std::fmt;
use std::io;
use serde::{Deserialize, Serialize};
use thiserror::Error;
use anyhow::{Context, Result};

/// Custom error types with proper traits
#[derive(Error, Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum UserError {
    #[error("User not found with ID: {id}")]
    NotFound { id: u64 },
    
    #[error("Invalid email format: {email}")]
    InvalidEmail { email: String },
    
    #[error("Username too short: {name} (minimum {min_length} characters)")]
    UsernameTooShort { name: String, min_length: usize },
    
    #[error("Email already exists: {email}")]
    EmailExists { email: String },
    
    #[error("Validation failed: {message}")]
    ValidationFailed { message: String },
    
    #[error("Database operation failed")]
    DatabaseError {
        #[source]
        source: DatabaseError,
    },
    
    #[error("Network operation failed")]
    NetworkError {
        #[source]
        source: NetworkError,
    },
    
    #[error("Permission denied for user {user_id}")]
    PermissionDenied { user_id: u64 },
    
    #[error("Rate limit exceeded for user {user_id}")]
    RateLimitExceeded { user_id: u64 },
}

#[derive(Error, Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum DatabaseError {
    #[error("Connection failed: {message}")]
    ConnectionFailed { message: String },
    
    #[error("Query failed: {query}")]
    QueryFailed { query: String },
    
    #[error("Transaction failed")]
    TransactionFailed,
    
    #[error("Constraint violation: {constraint}")]
    ConstraintViolation { constraint: String },
}

#[derive(Error, Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum NetworkError {
    #[error("Request timeout after {timeout_ms}ms")]
    Timeout { timeout_ms: u64 },
    
    #[error("Connection refused to {host}:{port}")]
    ConnectionRefused { host: String, port: u16 },
    
    #[error("DNS resolution failed for {hostname}")]
    DnsResolutionFailed { hostname: String },
    
    #[error("Invalid response format")]
    InvalidResponse,
}

/// Result type aliases for cleaner APIs
pub type UserResult<T> = Result<T, UserError>;
pub type DatabaseResult<T> = Result<T, DatabaseError>;
pub type NetworkResult<T> = Result<T, NetworkError>;

/// Service with comprehensive error handling
#[derive(Debug)]
pub struct UserService {
    repository: UserRepository,
    validator: UserValidator,
}

impl UserService {
    pub fn new(repository: UserRepository, validator: UserValidator) -> Self {
        Self { repository, validator }
    }
    
    /// Create user with detailed error handling
    pub async fn create_user(&self, name: String, email: String) -> UserResult<User> {
        // Validate input
        self.validator.validate_name(&name)
            .map_err(|e| UserError::ValidationFailed { message: e })?;
        
        self.validator.validate_email(&email)
            .map_err(|_| UserError::InvalidEmail { email: email.clone() })?;
        
        // Check for existing email
        match self.repository.find_by_email(&email).await {
            Ok(Some(_)) => return Err(UserError::EmailExists { email }),
            Ok(None) => {}, // Email doesn't exist, good to proceed
            Err(e) => return Err(UserError::DatabaseError { source: e }),
        }
        
        // Create user
        let user = User::new(name, email)
            .map_err(|e| UserError::ValidationFailed { message: e.to_string() })?;
        
        // Save to repository
        self.repository.save(user).await
            .map_err(|e| UserError::DatabaseError { source: e })
    }
    
    /// Get user with proper error propagation
    pub async fn get_user(&self, id: u64) -> UserResult<User> {
        self.repository.find_by_id(id).await
            .map_err(|e| UserError::DatabaseError { source: e })?
            .ok_or(UserError::NotFound { id })
    }
    
    /// Update user with optimistic error handling
    pub async fn update_user(&self, id: u64, updates: UserUpdates) -> UserResult<User> {
        // Get existing user
        let mut user = self.get_user(id).await?;
        
        // Apply updates with validation
        if let Some(name) = updates.name {
            self.validator.validate_name(&name)
                .map_err(|e| UserError::ValidationFailed { message: e })?;
            user.name = name;
        }
        
        if let Some(email) = updates.email {
            self.validator.validate_email(&email)
                .map_err(|_| UserError::InvalidEmail { email: email.clone() })?;
            
            // Check if email is already taken by another user
            if let Ok(Some(existing)) = self.repository.find_by_email(&email).await {
                if existing.id != id {
                    return Err(UserError::EmailExists { email });
                }
            }
            
            user.email = email;
        }
        
        // Save updated user
        self.repository.save(user).await
            .map_err(|e| UserError::DatabaseError { source: e })
    }
    
    /// Delete user with cascade handling
    pub async fn delete_user(&self, id: u64) -> UserResult<()> {
        // Verify user exists
        self.get_user(id).await?;
        
        // Delete with cascade
        self.repository.delete(id).await
            .map_err(|e| UserError::DatabaseError { source: e })
    }
    
    /// Batch operations with partial success handling
    pub async fn create_users_batch(&self, users_data: Vec<CreateUserData>) -> BatchResult<User> {
        let mut results = Vec::new();
        let mut errors = Vec::new();
        
        for (index, user_data) in users_data.into_iter().enumerate() {
            match self.create_user(user_data.name, user_data.email).await {
                Ok(user) => results.push(BatchSuccess { index, item: user }),
                Err(error) => errors.push(BatchError { index, error }),
            }
        }
        
        BatchResult { results, errors }
    }
}

/// Batch operation result types
#[derive(Debug, Clone)]
pub struct BatchResult<T> {
    pub results: Vec<BatchSuccess<T>>,
    pub errors: Vec<BatchError<UserError>>,
}

#[derive(Debug, Clone)]
pub struct BatchSuccess<T> {
    pub index: usize,
    pub item: T,
}

#[derive(Debug, Clone)]
pub struct BatchError<E> {
    pub index: usize,
    pub error: E,
}

impl<T> BatchResult<T> {
    pub fn is_partial_success(&self) -> bool {
        !self.results.is_empty() && !self.errors.is_empty()
    }
    
    pub fn is_complete_success(&self) -> bool {
        self.errors.is_empty()
    }
    
    pub fn is_complete_failure(&self) -> bool {
        self.results.is_empty()
    }
    
    pub fn success_count(&self) -> usize {
        self.results.len()
    }
    
    pub fn error_count(&self) -> usize {
        self.errors.len()
    }
}

/// Validation with detailed error reporting
#[derive(Debug)]
pub struct UserValidator;

impl UserValidator {
    pub fn validate_name(&self, name: &str) -> Result<(), String> {
        let trimmed = name.trim();
        
        if trimmed.is_empty() {
            return Err("Name cannot be empty".to_string());
        }
        
        if trimmed.len() < 2 {
            return Err(format!("Name too short: {} (minimum 2 characters)", trimmed));
        }
        
        if trimmed.len() > 100 {
            return Err(format!("Name too long: {} (maximum 100 characters)", trimmed));
        }
        
        if !trimmed.chars().all(|c| c.is_alphabetic() || c.is_whitespace()) {
            return Err("Name can only contain letters and spaces".to_string());
        }
        
        Ok(())
    }
    
    pub fn validate_email(&self, email: &str) -> Result<(), String> {
        let trimmed = email.trim().to_lowercase();
        
        if trimmed.is_empty() {
            return Err("Email cannot be empty".to_string());
        }
        
        if !trimmed.contains('@') {
            return Err("Email must contain @ symbol".to_string());
        }
        
        let parts: Vec<&str> = trimmed.split('@').collect();
        if parts.len() != 2 {
            return Err("Email must have exactly one @ symbol".to_string());
        }
        
        if parts[0].is_empty() {
            return Err("Email local part cannot be empty".to_string());
        }
        
        if parts[1].is_empty() {
            return Err("Email domain part cannot be empty".to_string());
        }
        
        if !parts[1].contains('.') {
            return Err("Email domain must contain at least one dot".to_string());
        }
        
        Ok(())
    }
}

/// Error recovery and fallback patterns
#[derive(Debug)]
pub struct ResilientUserService {
    primary_service: UserService,
    fallback_service: Option<UserService>,
    circuit_breaker: CircuitBreaker,
}

impl ResilientUserService {
    pub fn new(primary: UserService, fallback: Option<UserService>) -> Self {
        Self {
            primary_service: primary,
            fallback_service: fallback,
            circuit_breaker: CircuitBreaker::new(5, std::time::Duration::from_secs(60)),
        }
    }
    
    pub async fn get_user_with_fallback(&self, id: u64) -> UserResult<User> {
        // Try primary service
        if self.circuit_breaker.can_execute() {
            match self.primary_service.get_user(id).await {
                Ok(user) => {
                    self.circuit_breaker.record_success();
                    return Ok(user);
                }
                Err(e) => {
                    self.circuit_breaker.record_failure();
                    
                    // Only try fallback for certain types of errors
                    if matches!(e, UserError::DatabaseError { .. } | UserError::NetworkError { .. }) {
                        if let Some(ref fallback) = self.fallback_service {
                            match fallback.get_user(id).await {
                                Ok(user) => return Ok(user),
                                Err(_) => {} // Continue to return original error
                            }
                        }
                    }
                    
                    return Err(e);
                }
            }
        }
        
        // Circuit breaker is open, try fallback only
        if let Some(ref fallback) = self.fallback_service {
            fallback.get_user(id).await
        } else {
            Err(UserError::DatabaseError {
                source: DatabaseError::ConnectionFailed {
                    message: "Primary service unavailable and no fallback".to_string(),
                },
            })
        }
    }
}

/// Simple circuit breaker implementation
#[derive(Debug)]
pub struct CircuitBreaker {
    failure_count: std::sync::Arc<std::sync::Mutex<u32>>,
    failure_threshold: u32,
    recovery_timeout: std::time::Duration,
    last_failure_time: std::sync::Arc<std::sync::Mutex<Option<std::time::Instant>>>,
}

impl CircuitBreaker {
    pub fn new(failure_threshold: u32, recovery_timeout: std::time::Duration) -> Self {
        Self {
            failure_count: std::sync::Arc::new(std::sync::Mutex::new(0)),
            failure_threshold,
            recovery_timeout,
            last_failure_time: std::sync::Arc::new(std::sync::Mutex::new(None)),
        }
    }
    
    pub fn can_execute(&self) -> bool {
        let failure_count = *self.failure_count.lock().unwrap();
        
        if failure_count < self.failure_threshold {
            return true;
        }
        
        // Check if recovery timeout has passed
        if let Some(last_failure) = *self.last_failure_time.lock().unwrap() {
            if last_failure.elapsed() > self.recovery_timeout {
                // Reset and allow execution
                *self.failure_count.lock().unwrap() = 0;
                return true;
            }
        }
        
        false
    }
    
    pub fn record_success(&self) {
        *self.failure_count.lock().unwrap() = 0;
        *self.last_failure_time.lock().unwrap() = None;
    }
    
    pub fn record_failure(&self) {
        *self.failure_count.lock().unwrap() += 1;
        *self.last_failure_time.lock().unwrap() = Some(std::time::Instant::now());
    }
}

#[derive(Debug, Clone)]
pub struct CreateUserData {
    pub name: String,
    pub email: String,
}

#[derive(Debug, Clone, Default)]
pub struct UserUpdates {
    pub name: Option<String>,
    pub email: Option<String>,
}
```

---

## 📊 Rust Health Metrics

### Framework Compliance
- **Memory Safety**: ⭐⭐⭐⭐⭐ (X/5)
- **Concurrency Safety**: ⭐⭐⭐⭐⭐ (X/5)
- **Error Handling**: ⭐⭐⭐⭐⭐ (X/5)
- **Performance**: ⭐⭐⭐⭐⭐ (X/5)
- **API Design**: ⭐⭐⭐⭐⭐ (X/5)

### Overall Rust Score: ⭐⭐⭐⭐⭐ (X/10)

---

## 🎯 Rust-Specific Action Items

### 🔴 Critical (Safety/Performance)
1. [ ] Remove all unsafe blocks without proper documentation
2. [ ] Fix memory safety violations and potential leaks
3. [ ] Add proper error handling for all Result types
4. [ ] Fix concurrency issues and data races
5. [ ] Add proper lifetime annotations where needed

### 🟡 Important (Best Practices)
1. [ ] Implement proper async patterns and avoid blocking
2. [ ] Add comprehensive error types with context
3. [ ] Optimize performance-critical paths and allocations
4. [ ] Implement proper resource management with RAII
5. [ ] Add proper testing for error conditions

### 🟢 Improvements (Code Quality)
1. [ ] Add comprehensive documentation with examples
2. [ ] Implement proper logging and observability
3. [ ] Add benchmarking for performance-critical code
4. [ ] Improve API ergonomics and usability
5. [ ] Add property-based testing where appropriate

---

## 💡 Rust Upgrade Recommendations

### Migration Opportunities
- Rust 2021 edition features and async improvements
- const generics for compile-time optimizations
- GATs (Generic Associated Types) for advanced trait design
- Pattern matching improvements and let-else syntax
- Improved async trait support
- SIMD operations for performance-critical code

### Ecosystem Upgrades
- Tokio 1.x for async runtime
- Serde for serialization with zero-copy features
- Anyhow/thiserror for error handling
- Tracing for structured logging
- Criterion for benchmarking
- Proptest for property-based testing