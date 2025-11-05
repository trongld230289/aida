<!-- AIDA - AI Development Assistant v1.0.0 -->
<!-- Advanced AI-powered code review and analysis -->

# Go Framework Review Template

## 🎯 Go-Specific Review Guidelines

This template focuses specifically on Go framework best practices, patterns, and common pitfalls. Use this for reviewing Go packages, functions, structs, interfaces, and configuration files.

🎯 REVIEW PRINCIPLES:
- ONLY flag issues that violate the specific rules in the template
- If code follows template guidelines, it's acceptable - don't force changes
- Focus on actual violations, not subjective preferences

---

## ⚡ GO CRITICAL CHECKS (Auto-FAIL if found)

**Scan EVERY line for these GO-SPECIFIC CRITICAL issues:**

{{REVIEW_BASE}}

### 🚨 TESTING VIOLATIONS:
- Missing table-driven tests for multiple cases
- Tests without proper setup/teardown
- Missing benchmark tests for performance-critical code
- Integration tests without proper isolation
- Missing error case testing
- Test code duplication without helper functions
- Tests depending on external resources
- Missing race condition testing (-race flag)
- Test names not following conventions
- Missing example tests for public APIs

### 🚨 MEMORY SAFETY VIOLATIONS:
- Slice bounds not checked
- Map access without comma ok idiom
- Type assertions without safety checks
- Nil pointer dereferences
- Memory leaks from retain cycles
- Large objects not being garbage collected
- Unsafe package usage without justification
- Buffer overflows in slice operations
- Missing bounds checking for arrays
- Pointer arithmetic in unsafe code

---

## 🔍 Go Code Analysis

### 1. **Idiomatic Go & Code Style**

#### 🐹 Go Conventions
- **Naming Conventions**
  - CamelCase for exported identifiers?
  - Lowercase for private identifiers?
  - Package names are lowercase?
  - Interface names ending with -er?

#### 📦 Package Organization
- Single responsibility per package
- Logical package hierarchy
- Proper import organization
- Dependency management with modules

#### 🔄 Idiomatic Patterns
```go
// Example: Idiomatic Go patterns
package user

import (
    "context"
    "fmt"
    "time"
)

// Good: Simple struct with proper tags
type User struct {
    ID        int       `json:"id" db:"id"`
    Name      string    `json:"name" db:"name"`
    Email     string    `json:"email" db:"email"`
    CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// Good: Interface defines behavior
type UserRepository interface {
    GetByID(ctx context.Context, id int) (*User, error)
    Create(ctx context.Context, user *User) error
    Update(ctx context.Context, user *User) error
    Delete(ctx context.Context, id int) error
}

// Good: Constructor function
func NewUser(name, email string) *User {
    return &User{
        Name:      name,
        Email:     email,
        CreatedAt: time.Now(),
    }
}

// Good: Method with receiver
func (u *User) Validate() error {
    if u.Name == "" {
        return fmt.Errorf("name is required")
    }
    if u.Email == "" {
        return fmt.Errorf("email is required")
    }
    if !isValidEmail(u.Email) {
        return fmt.Errorf("invalid email format")
    }
    return nil
}

// Good: Error handling with context
func (r *userRepo) GetByID(ctx context.Context, id int) (*User, error) {
    if id <= 0 {
        return nil, fmt.Errorf("invalid user ID: %d", id)
    }
    
    query := "SELECT id, name, email, created_at FROM users WHERE id = $1"
    var user User
    
    err := r.db.QueryRowContext(ctx, query, id).Scan(
        &user.ID, &user.Name, &user.Email, &user.CreatedAt,
    )
    if err != nil {
        if err == sql.ErrNoRows {
            return nil, ErrUserNotFound
        }
        return nil, fmt.Errorf("failed to get user %d: %w", id, err)
    }
    
    return &user, nil
}

// ❌ Bad: Non-idiomatic patterns
func badExample(userId int) *User {
    if userId > 0 {
        // Missing error handling
        user, _ := getUser(userId)
        return user
    }
    return nil
}
```

#### ❌ Common Issues
- Not following Go naming conventions
- Missing error handling
- Large functions without decomposition
- Mixing concerns in single package

---

### 2. **Error Handling & Validation**

#### 🛡️ Robust Error Handling
```go
// Best Practice: Custom error types
package errors

import (
    "fmt"
    "time"
)

// AppError represents application-specific errors
type AppError struct {
    Code      string    `json:"code"`
    Message   string    `json:"message"`
    Timestamp time.Time `json:"timestamp"`
    Context   map[string]interface{} `json:"context,omitempty"`
}

func (e *AppError) Error() string {
    return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

// Specific error types
type ValidationError struct {
    *AppError
    Field string `json:"field"`
    Value string `json:"value"`
}

type NotFoundError struct {
    *AppError
    Resource   string `json:"resource"`
    Identifier string `json:"identifier"`
}

// Good: Error constructors
func NewValidationError(field, value, message string) *ValidationError {
    return &ValidationError{
        AppError: &AppError{
            Code:      "VALIDATION_ERROR",
            Message:   message,
            Timestamp: time.Now(),
            Context: map[string]interface{}{
                "field": field,
                "value": value,
            },
        },
        Field: field,
        Value: value,
    }
}

func NewNotFoundError(resource, identifier string) *NotFoundError {
    return &NotFoundError{
        AppError: &AppError{
            Code:      "NOT_FOUND",
            Message:   fmt.Sprintf("%s not found", resource),
            Timestamp: time.Now(),
            Context: map[string]interface{}{
                "resource":   resource,
                "identifier": identifier,
            },
        },
        Resource:   resource,
        Identifier: identifier,
    }
}

// Good: Error handling with wrapping
func (s *UserService) CreateUser(ctx context.Context, req *CreateUserRequest) (*User, error) {
    // Validate input
    if err := req.Validate(); err != nil {
        return nil, fmt.Errorf("validation failed: %w", err)
    }
    
    // Check if user exists
    existing, err := s.repo.GetByEmail(ctx, req.Email)
    if err != nil && !errors.Is(err, ErrUserNotFound) {
        return nil, fmt.Errorf("failed to check existing user: %w", err)
    }
    if existing != nil {
        return nil, NewValidationError("email", req.Email, "email already exists")
    }
    
    // Create user
    user := &User{
        Name:      req.Name,
        Email:     req.Email,
        CreatedAt: time.Now(),
    }
    
    if err := s.repo.Create(ctx, user); err != nil {
        return nil, fmt.Errorf("failed to create user: %w", err)
    }
    
    return user, nil
}

// Good: Input validation
type CreateUserRequest struct {
    Name  string `json:"name" validate:"required,min=2,max=100"`
    Email string `json:"email" validate:"required,email"`
}

func (r *CreateUserRequest) Validate() error {
    var errs []error
    
    if r.Name == "" {
        errs = append(errs, NewValidationError("name", r.Name, "name is required"))
    } else if len(r.Name) < 2 {
        errs = append(errs, NewValidationError("name", r.Name, "name must be at least 2 characters"))
    } else if len(r.Name) > 100 {
        errs = append(errs, NewValidationError("name", r.Name, "name must not exceed 100 characters"))
    }
    
    if r.Email == "" {
        errs = append(errs, NewValidationError("email", r.Email, "email is required"))
    } else if !isValidEmail(r.Email) {
        errs = append(errs, NewValidationError("email", r.Email, "invalid email format"))
    }
    
    if len(errs) > 0 {
        return &MultiError{Errors: errs}
    }
    
    return nil
}

// Good: Multiple error handling
type MultiError struct {
    Errors []error `json:"errors"`
}

func (m *MultiError) Error() string {
    if len(m.Errors) == 1 {
        return m.Errors[0].Error()
    }
    return fmt.Sprintf("multiple errors: %d errors occurred", len(m.Errors))
}
```

#### ✅ Error Handling Best Practices
- Always check errors
- Wrap errors with context
- Custom error types for different scenarios
- Proper error logging and monitoring

---

### 3. **Concurrency & Goroutines**

#### ⚡ Safe Concurrency Patterns
```go
// Best Practice: Safe concurrency patterns
package concurrent

import (
    "context"
    "fmt"
    "sync"
    "time"
)

// Good: Worker pool pattern
type WorkerPool struct {
    workerCount int
    jobQueue    chan Job
    wg          sync.WaitGroup
    ctx         context.Context
    cancel      context.CancelFunc
}

type Job func(ctx context.Context) error

func NewWorkerPool(workerCount int) *WorkerPool {
    ctx, cancel := context.WithCancel(context.Background())
    
    return &WorkerPool{
        workerCount: workerCount,
        jobQueue:    make(chan Job, workerCount*2), // Buffered channel
        ctx:         ctx,
        cancel:      cancel,
    }
}

func (wp *WorkerPool) Start() {
    for i := 0; i < wp.workerCount; i++ {
        wp.wg.Add(1)
        go wp.worker(i)
    }
}

func (wp *WorkerPool) worker(id int) {
    defer wp.wg.Done()
    
    for {
        select {
        case job := <-wp.jobQueue:
            if err := job(wp.ctx); err != nil {
                fmt.Printf("Worker %d: job failed: %v\n", id, err)
            }
        case <-wp.ctx.Done():
            fmt.Printf("Worker %d: shutting down\n", id)
            return
        }
    }
}

func (wp *WorkerPool) Submit(job Job) error {
    select {
    case wp.jobQueue <- job:
        return nil
    case <-wp.ctx.Done():
        return fmt.Errorf("worker pool is shutting down")
    default:
        return fmt.Errorf("job queue is full")
    }
}

func (wp *WorkerPool) Shutdown(timeout time.Duration) error {
    wp.cancel()
    
    done := make(chan struct{})
    go func() {
        wp.wg.Wait()
        close(done)
    }()
    
    select {
    case <-done:
        return nil
    case <-time.After(timeout):
        return fmt.Errorf("shutdown timeout exceeded")
    }
}

// Good: Safe concurrent cache
type SafeCache struct {
    mu    sync.RWMutex
    items map[string]CacheItem
}

type CacheItem struct {
    Value     interface{}
    ExpiresAt time.Time
}

func NewSafeCache() *SafeCache {
    return &SafeCache{
        items: make(map[string]CacheItem),
    }
}

func (c *SafeCache) Get(key string) (interface{}, bool) {
    c.mu.RLock()
    defer c.mu.RUnlock()
    
    item, exists := c.items[key]
    if !exists || time.Now().After(item.ExpiresAt) {
        return nil, false
    }
    
    return item.Value, true
}

func (c *SafeCache) Set(key string, value interface{}, ttl time.Duration) {
    c.mu.Lock()
    defer c.mu.Unlock()
    
    c.items[key] = CacheItem{
        Value:     value,
        ExpiresAt: time.Now().Add(ttl),
    }
}

func (c *SafeCache) Delete(key string) {
    c.mu.Lock()
    defer c.mu.Unlock()
    
    delete(c.items, key)
}

// Good: Channel-based pipeline
func ProcessDataPipeline(ctx context.Context, input <-chan []byte) <-chan ProcessedData {
    output := make(chan ProcessedData)
    
    go func() {
        defer close(output)
        
        for {
            select {
            case data, ok := <-input:
                if !ok {
                    return
                }
                
                processed, err := processData(data)
                if err != nil {
                    fmt.Printf("Processing error: %v\n", err)
                    continue
                }
                
                select {
                case output <- processed:
                case <-ctx.Done():
                    return
                }
                
            case <-ctx.Done():
                return
            }
        }
    }()
    
    return output
}

// Good: Fan-out/fan-in pattern
func FanOutFanIn(ctx context.Context, input <-chan Task, workerCount int) <-chan Result {
    // Fan-out: distribute work to multiple workers
    results := make([]<-chan Result, workerCount)
    
    for i := 0; i < workerCount; i++ {
        results[i] = worker(ctx, input)
    }
    
    // Fan-in: merge results from all workers
    return merge(ctx, results...)
}

func worker(ctx context.Context, input <-chan Task) <-chan Result {
    output := make(chan Result)
    
    go func() {
        defer close(output)
        
        for {
            select {
            case task, ok := <-input:
                if !ok {
                    return
                }
                
                result := processTask(task)
                
                select {
                case output <- result:
                case <-ctx.Done():
                    return
                }
                
            case <-ctx.Done():
                return
            }
        }
    }()
    
    return output
}

func merge(ctx context.Context, inputs ...<-chan Result) <-chan Result {
    output := make(chan Result)
    var wg sync.WaitGroup
    
    wg.Add(len(inputs))
    
    for _, input := range inputs {
        go func(ch <-chan Result) {
            defer wg.Done()
            
            for {
                select {
                case result, ok := <-ch:
                    if !ok {
                        return
                    }
                    
                    select {
                    case output <- result:
                    case <-ctx.Done():
                        return
                    }
                    
                case <-ctx.Done():
                    return
                }
            }
        }(input)
    }
    
    go func() {
        wg.Wait()
        close(output)
    }()
    
    return output
}
```

#### 🚨 Concurrency Anti-patterns
- Race conditions
- Deadlocks from improper locking
- Goroutine leaks
- Channel misuse

---

### 4. **HTTP Servers & APIs**

#### 🌐 HTTP Best Practices
```go
// Best Practice: HTTP server with proper patterns
package server

import (
    "context"
    "encoding/json"
    "fmt"
    "log"
    "net/http"
    "strconv"
    "time"

    "github.com/gorilla/mux"
)

// Server represents HTTP server
type Server struct {
    router      *mux.Router
    userService UserService
    server      *http.Server
}

// UserService interface
type UserService interface {
    GetUser(ctx context.Context, id int) (*User, error)
    CreateUser(ctx context.Context, req *CreateUserRequest) (*User, error)
    UpdateUser(ctx context.Context, id int, req *UpdateUserRequest) (*User, error)
    DeleteUser(ctx context.Context, id int) error
}

// NewServer creates a new HTTP server
func NewServer(userService UserService) *Server {
    s := &Server{
        router:      mux.NewRouter(),
        userService: userService,
    }
    
    s.setupRoutes()
    s.setupMiddleware()
    
    return s
}

func (s *Server) setupRoutes() {
    api := s.router.PathPrefix("/api/v1").Subrouter()
    
    // User routes
    api.HandleFunc("/users", s.handleCreateUser).Methods("POST")
    api.HandleFunc("/users/{id:[0-9]+}", s.handleGetUser).Methods("GET")
    api.HandleFunc("/users/{id:[0-9]+}", s.handleUpdateUser).Methods("PUT")
    api.HandleFunc("/users/{id:[0-9]+}", s.handleDeleteUser).Methods("DELETE")
    
    // Health check
    s.router.HandleFunc("/health", s.handleHealthCheck).Methods("GET")
}

func (s *Server) setupMiddleware() {
    s.router.Use(s.loggingMiddleware)
    s.router.Use(s.recoveryMiddleware)
    s.router.Use(s.corsMiddleware)
    s.router.Use(s.timeoutMiddleware(30 * time.Second))
}

// Good: Middleware patterns
func (s *Server) loggingMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        start := time.Now()
        
        // Wrap response writer to capture status code
        wrapped := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}
        
        next.ServeHTTP(wrapped, r)
        
        log.Printf(
            "method=%s path=%s status=%d duration=%v",
            r.Method,
            r.URL.Path,
            wrapped.statusCode,
            time.Since(start),
        )
    })
}

func (s *Server) recoveryMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        defer func() {
            if err := recover(); err != nil {
                log.Printf("Panic recovered: %v", err)
                s.writeErrorResponse(w, http.StatusInternalServerError, "Internal server error")
            }
        }()
        
        next.ServeHTTP(w, r)
    })
}

func (s *Server) timeoutMiddleware(timeout time.Duration) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            ctx, cancel := context.WithTimeout(r.Context(), timeout)
            defer cancel()
            
            r = r.WithContext(ctx)
            next.ServeHTTP(w, r)
        })
    }
}

// Good: Handler patterns
func (s *Server) handleGetUser(w http.ResponseWriter, r *http.Request) {
    // Extract and validate path parameter
    vars := mux.Vars(r)
    idStr := vars["id"]
    
    id, err := strconv.Atoi(idStr)
    if err != nil {
        s.writeErrorResponse(w, http.StatusBadRequest, "Invalid user ID")
        return
    }
    
    // Call service
    user, err := s.userService.GetUser(r.Context(), id)
    if err != nil {
        if IsNotFoundError(err) {
            s.writeErrorResponse(w, http.StatusNotFound, "User not found")
            return
        }
        
        log.Printf("Error getting user %d: %v", id, err)
        s.writeErrorResponse(w, http.StatusInternalServerError, "Internal server error")
        return
    }
    
    // Write response
    s.writeJSONResponse(w, http.StatusOK, user)
}

func (s *Server) handleCreateUser(w http.ResponseWriter, r *http.Request) {
    // Parse request body
    var req CreateUserRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        s.writeErrorResponse(w, http.StatusBadRequest, "Invalid request body")
        return
    }
    
    // Validate request
    if err := req.Validate(); err != nil {
        s.writeValidationErrorResponse(w, err)
        return
    }
    
    // Call service
    user, err := s.userService.CreateUser(r.Context(), &req)
    if err != nil {
        if IsValidationError(err) {
            s.writeValidationErrorResponse(w, err)
            return
        }
        
        log.Printf("Error creating user: %v", err)
        s.writeErrorResponse(w, http.StatusInternalServerError, "Internal server error")
        return
    }
    
    // Write response
    s.writeJSONResponse(w, http.StatusCreated, user)
}

// Good: Response helpers
func (s *Server) writeJSONResponse(w http.ResponseWriter, statusCode int, data interface{}) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(statusCode)
    
    if err := json.NewEncoder(w).Encode(data); err != nil {
        log.Printf("Error encoding JSON response: %v", err)
    }
}

func (s *Server) writeErrorResponse(w http.ResponseWriter, statusCode int, message string) {
    response := ErrorResponse{
        Error:   message,
        Code:    statusCode,
        Timestamp: time.Now(),
    }
    
    s.writeJSONResponse(w, statusCode, response)
}

func (s *Server) writeValidationErrorResponse(w http.ResponseWriter, err error) {
    if multiErr, ok := err.(*MultiError); ok {
        response := ValidationErrorResponse{
            Error:   "Validation failed",
            Code:    http.StatusBadRequest,
            Details: make([]ValidationDetail, len(multiErr.Errors)),
            Timestamp: time.Now(),
        }
        
        for i, e := range multiErr.Errors {
            if valErr, ok := e.(*ValidationError); ok {
                response.Details[i] = ValidationDetail{
                    Field:   valErr.Field,
                    Message: valErr.Message,
                    Value:   valErr.Value,
                }
            }
        }
        
        s.writeJSONResponse(w, http.StatusBadRequest, response)
        return
    }
    
    s.writeErrorResponse(w, http.StatusBadRequest, err.Error())
}

// Good: Server lifecycle management
func (s *Server) Start(addr string) error {
    s.server = &http.Server{
        Addr:         addr,
        Handler:      s.router,
        ReadTimeout:  15 * time.Second,
        WriteTimeout: 15 * time.Second,
        IdleTimeout:  60 * time.Second,
    }
    
    log.Printf("Server starting on %s", addr)
    return s.server.ListenAndServe()
}

func (s *Server) Shutdown(ctx context.Context) error {
    if s.server == nil {
        return nil
    }
    
    log.Println("Server shutting down...")
    return s.server.Shutdown(ctx)
}

// Response types
type ErrorResponse struct {
    Error     string    `json:"error"`
    Code      int       `json:"code"`
    Timestamp time.Time `json:"timestamp"`
}

type ValidationErrorResponse struct {
    Error     string             `json:"error"`
    Code      int                `json:"code"`
    Details   []ValidationDetail `json:"details"`
    Timestamp time.Time          `json:"timestamp"`
}

type ValidationDetail struct {
    Field   string `json:"field"`
    Message string `json:"message"`
    Value   string `json:"value"`
}

type responseWriter struct {
    http.ResponseWriter
    statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
    rw.statusCode = code
    rw.ResponseWriter.WriteHeader(code)
}
```

---

### 5. **Database Operations**

#### 🗄️ Database Best Practices
```go
// Best Practice: Database operations with proper patterns
package repository

import (
    "context"
    "database/sql"
    "fmt"
    "time"

    "github.com/jmoiron/sqlx"
    _ "github.com/lib/pq"
)

// UserRepository implements database operations
type UserRepository struct {
    db *sqlx.DB
}

// NewUserRepository creates a new user repository
func NewUserRepository(db *sqlx.DB) *UserRepository {
    return &UserRepository{db: db}
}

// Good: Repository with proper error handling
func (r *UserRepository) GetByID(ctx context.Context, id int) (*User, error) {
    query := `
        SELECT id, name, email, created_at, updated_at 
        FROM users 
        WHERE id = $1 AND deleted_at IS NULL
    `
    
    var user User
    err := r.db.GetContext(ctx, &user, query, id)
    if err != nil {
        if err == sql.ErrNoRows {
            return nil, NewNotFoundError("user", fmt.Sprintf("%d", id))
        }
        return nil, fmt.Errorf("failed to get user %d: %w", id, err)
    }
    
    return &user, nil
}

func (r *UserRepository) Create(ctx context.Context, user *User) error {
    query := `
        INSERT INTO users (name, email, created_at, updated_at)
        VALUES ($1, $2, $3, $4)
        RETURNING id
    `
    
    now := time.Now()
    err := r.db.QueryRowContext(
        ctx, 
        query, 
        user.Name, 
        user.Email, 
        now, 
        now,
    ).Scan(&user.ID)
    
    if err != nil {
        if isDuplicateKeyError(err) {
            return NewValidationError("email", user.Email, "email already exists")
        }
        return fmt.Errorf("failed to create user: %w", err)
    }
    
    user.CreatedAt = now
    user.UpdatedAt = now
    
    return nil
}

func (r *UserRepository) Update(ctx context.Context, user *User) error {
    query := `
        UPDATE users 
        SET name = $1, email = $2, updated_at = $3
        WHERE id = $4 AND deleted_at IS NULL
    `
    
    user.UpdatedAt = time.Now()
    
    result, err := r.db.ExecContext(
        ctx,
        query,
        user.Name,
        user.Email,
        user.UpdatedAt,
        user.ID,
    )
    if err != nil {
        if isDuplicateKeyError(err) {
            return NewValidationError("email", user.Email, "email already exists")
        }
        return fmt.Errorf("failed to update user %d: %w", user.ID, err)
    }
    
    rowsAffected, err := result.RowsAffected()
    if err != nil {
        return fmt.Errorf("failed to get rows affected: %w", err)
    }
    
    if rowsAffected == 0 {
        return NewNotFoundError("user", fmt.Sprintf("%d", user.ID))
    }
    
    return nil
}

func (r *UserRepository) Delete(ctx context.Context, id int) error {
    query := `
        UPDATE users 
        SET deleted_at = $1 
        WHERE id = $2 AND deleted_at IS NULL
    `
    
    result, err := r.db.ExecContext(ctx, query, time.Now(), id)
    if err != nil {
        return fmt.Errorf("failed to delete user %d: %w", id, err)
    }
    
    rowsAffected, err := result.RowsAffected()
    if err != nil {
        return fmt.Errorf("failed to get rows affected: %w", err)
    }
    
    if rowsAffected == 0 {
        return NewNotFoundError("user", fmt.Sprintf("%d", id))
    }
    
    return nil
}

// Good: Pagination and filtering
func (r *UserRepository) List(ctx context.Context, filter UserFilter) (*PaginatedUsers, error) {
    query := `
        SELECT id, name, email, created_at, updated_at 
        FROM users 
        WHERE deleted_at IS NULL
    `
    
    args := []interface{}{}
    argIndex := 1
    
    // Add filters
    if filter.Name != "" {
        query += fmt.Sprintf(" AND name ILIKE $%d", argIndex)
        args = append(args, "%"+filter.Name+"%")
        argIndex++
    }
    
    if filter.Email != "" {
        query += fmt.Sprintf(" AND email ILIKE $%d", argIndex)
        args = append(args, "%"+filter.Email+"%")
        argIndex++
    }
    
    // Count total records
    countQuery := "SELECT COUNT(*) FROM (" + query + ") AS filtered"
    var total int
    err := r.db.GetContext(ctx, &total, countQuery, args...)
    if err != nil {
        return nil, fmt.Errorf("failed to count users: %w", err)
    }
    
    // Add pagination
    query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", argIndex, argIndex+1)
    args = append(args, filter.Limit, filter.Offset)
    
    var users []User
    err = r.db.SelectContext(ctx, &users, query, args...)
    if err != nil {
        return nil, fmt.Errorf("failed to list users: %w", err)
    }
    
    return &PaginatedUsers{
        Users: users,
        Total: total,
        Page:  filter.Page,
        Limit: filter.Limit,
    }, nil
}

// Good: Transaction support
func (r *UserRepository) CreateWithProfile(ctx context.Context, user *User, profile *UserProfile) error {
    tx, err := r.db.BeginTxx(ctx, nil)
    if err != nil {
        return fmt.Errorf("failed to begin transaction: %w", err)
    }
    defer tx.Rollback() // Safe to call even if committed
    
    // Create user
    userQuery := `
        INSERT INTO users (name, email, created_at, updated_at)
        VALUES ($1, $2, $3, $4)
        RETURNING id
    `
    
    now := time.Now()
    err = tx.QueryRowContext(
        ctx,
        userQuery,
        user.Name,
        user.Email,
        now,
        now,
    ).Scan(&user.ID)
    if err != nil {
        return fmt.Errorf("failed to create user: %w", err)
    }
    
    // Create profile
    profileQuery := `
        INSERT INTO user_profiles (user_id, bio, avatar_url, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5)
    `
    
    _, err = tx.ExecContext(
        ctx,
        profileQuery,
        user.ID,
        profile.Bio,
        profile.AvatarURL,
        now,
        now,
    )
    if err != nil {
        return fmt.Errorf("failed to create user profile: %w", err)
    }
    
    // Commit transaction
    if err = tx.Commit(); err != nil {
        return fmt.Errorf("failed to commit transaction: %w", err)
    }
    
    user.CreatedAt = now
    user.UpdatedAt = now
    
    return nil
}

// Database models
type User struct {
    ID        int       `json:"id" db:"id"`
    Name      string    `json:"name" db:"name"`
    Email     string    `json:"email" db:"email"`
    CreatedAt time.Time `json:"created_at" db:"created_at"`
    UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type UserProfile struct {
    UserID    int    `json:"user_id" db:"user_id"`
    Bio       string `json:"bio" db:"bio"`
    AvatarURL string `json:"avatar_url" db:"avatar_url"`
}

type UserFilter struct {
    Name   string `json:"name"`
    Email  string `json:"email"`
    Page   int    `json:"page"`
    Limit  int    `json:"limit"`
    Offset int    `json:"offset"`
}

type PaginatedUsers struct {
    Users []User `json:"users"`
    Total int    `json:"total"`
    Page  int    `json:"page"`
    Limit int    `json:"limit"`
}

// Helper functions
func isDuplicateKeyError(err error) bool {
    // Implementation depends on database driver
    // For PostgreSQL with pq driver:
    if pqErr, ok := err.(*pq.Error); ok {
        return pqErr.Code == "23505" // unique_violation
    }
    return false
}
```

---

## 📊 Go Health Metrics

### Framework Compliance
- **Idiomatic Go**: ⭐⭐⭐⭐⭐ (X/5)
- **Concurrency Safety**: ⭐⭐⭐⭐⭐ (X/5)
- **Error Handling**: ⭐⭐⭐⭐⭐ (X/5)
- **Resource Management**: ⭐⭐⭐⭐⭐ (X/5)
- **Performance**: ⭐⭐⭐⭐⭐ (X/5)

### Overall Go Score: ⭐⭐⭐⭐⭐ (X/10)

---

## 🎯 Go-Specific Action Items

### 🔴 Critical (Security/Concurrency)
1. [ ] Fix all race conditions and add proper synchronization
2. [ ] Add proper error handling for all operations
3. [ ] Fix resource leaks with defer statements
4. [ ] Add context cancellation handling
5. [ ] Fix goroutine leaks and proper cleanup

### 🟡 Important (Performance/Best Practices)
1. [ ] Implement proper interface design patterns
2. [ ] Add connection pooling for database operations
3. [ ] Optimize memory allocations in hot paths
4. [ ] Add proper timeout handling
5. [ ] Implement graceful shutdown patterns

### 🟢 Improvements (Code Quality)
1. [ ] Add comprehensive documentation and examples
2. [ ] Implement proper testing strategies
3. [ ] Add benchmarking for performance-critical code
4. [ ] Improve package organization
5. [ ] Add monitoring and observability

---

## 💡 Go Upgrade Recommendations

### Migration Opportunities
- Modern Go features (Go 1.21+ features: slices, maps, cmp packages)
- Generics for type-safe collections and algorithms
- Structured logging with slog package
- Context-aware HTTP client and server patterns
- Improved error handling with errors.Join
- Performance improvements with PGO (Profile-Guided Optimization)

### Tooling Improvements
- Go modules for dependency management
- golangci-lint for comprehensive linting
- Go fuzzing for security testing
- pprof for performance profiling
- go:embed for asset embedding
- Air for live reloading during development