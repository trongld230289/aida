<!-- AIDA - AI Development Assistant v1.0.15 -->
<!-- Advanced AI-powered code review and analysis -->

# C# Framework Review Template

## 🎯 C#-Specific Review Guidelines

This template focuses specifically on C# framework best practices, patterns, and common pitfalls. Use this for reviewing C# classes, methods, interfaces, controllers, services, and configuration files.

🎯 REVIEW PRINCIPLES:
- ONLY flag issues that violate the specific rules in the template
- If code follows template guidelines, it's acceptable - don't force changes
- Focus on actual violations, not subjective preferences

---

## ⚡ C# CRITICAL CHECKS (Auto-FAIL if found)

**Scan EVERY line for these C#-SPECIFIC CRITICAL issues:**

{{REVIEW_BASE}}

### 🚨 ACCESSIBILITY VIOLATIONS:
- Missing accessibility attributes in web applications
- No keyboard navigation support in UI
- Missing screen reader support
- No semantic HTML in Razor views
- Missing alternative text for images
- No ARIA labels for dynamic content
- Missing focus management in SPAs
- No high contrast theme support

### 🚨 TESTING VIOLATIONS:
- Missing unit tests for business logic
- No integration tests for API endpoints
- Missing test coverage for error scenarios
- No performance tests for critical operations
- Missing security tests for authentication
- No load tests for high-traffic endpoints

---

## 🔍 C# Code Analysis

### 1. **Class Design & Architecture**

#### 🏗️ Class Structure
- **Single Responsibility Principle**
  - Does each class have a single, well-defined purpose?
  - Are concerns properly separated?
  - Appropriate use of interfaces and abstractions?

#### 📦 Namespace Organization
- Logical namespace hierarchy
- Proper assembly organization
- Dependency management
- Circular dependency detection

#### 🔄 Inheritance & Polymorphism
```csharp
// Example: Proper inheritance design
public abstract class BaseService<T> where T : class
{
    protected readonly IRepository<T> Repository;
    
    protected BaseService(IRepository<T> repository)
    {
        Repository = repository ?? throw new ArgumentNullException(nameof(repository));
    }
    
    public virtual async Task<T> GetByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        return await Repository.GetByIdAsync(id, cancellationToken);
    }
}
```

#### ❌ Common Issues
- God classes with too many responsibilities
- Improper inheritance hierarchies
- Missing interface segregation
- Tight coupling between classes

---

### 2. **Memory Management & Resources**

#### 🗑️ IDisposable Implementation
```csharp
// Best Practice: Proper disposal pattern
public class ResourceManager : IDisposable
{
    private bool disposed = false;
    private readonly FileStream fileStream;
    
    public ResourceManager(string filePath)
    {
        fileStream = new FileStream(filePath, FileMode.Open);
    }
    
    protected virtual void Dispose(bool disposing)
    {
        if (!disposed)
        {
            if (disposing)
            {
                fileStream?.Dispose();
            }
            disposed = true;
        }
    }
    
    public void Dispose()
    {
        Dispose(true);
        GC.SuppressFinalize(this);
    }
}

// Usage
using var manager = new ResourceManager("file.txt");
// Automatic disposal
```

#### 🔄 Using Statements & Resource Management
- Proper using statement usage
- IAsyncDisposable for async resources
- Resource lifetime management
- Connection pooling strategies

---

### 3. **Async/Await Patterns**

#### ⚡ Async Best Practices
```csharp
// Best Practice: Proper async implementation
public async Task<ApiResponse<User>> GetUserAsync(int userId, CancellationToken cancellationToken = default)
{
    try
    {
        using var httpClient = httpClientFactory.CreateClient();
        using var response = await httpClient.GetAsync($"api/users/{userId}", cancellationToken)
            .ConfigureAwait(false);
        
        response.EnsureSuccessStatusCode();
        
        var json = await response.Content.ReadAsStringAsync()
            .ConfigureAwait(false);
            
        var user = JsonSerializer.Deserialize<User>(json);
        return ApiResponse<User>.Success(user);
    }
    catch (OperationCanceledException)
    {
        throw; // Re-throw cancellation
    }
    catch (HttpRequestException ex)
    {
        logger.LogError(ex, "Failed to fetch user {UserId}", userId);
        return ApiResponse<User>.Error("Failed to fetch user");
    }
}

// Bad: Blocking async code
var result = GetUserAsync(1).Result; // DEADLOCK RISK!

// Good: Proper async chain
var result = await GetUserAsync(1, cancellationToken);
```

#### 🚨 Async Anti-patterns
- Async void (except event handlers)
- Blocking on async code
- Missing ConfigureAwait(false) in libraries
- Fire-and-forget without error handling

---

### 4. **Error Handling & Validation**

#### 🛡️ Exception Handling
```csharp
// Best Practice: Specific exception handling
public async Task<Result<Order>> ProcessOrderAsync(OrderRequest request, CancellationToken cancellationToken)
{
    if (request == null)
        throw new ArgumentNullException(nameof(request));
    
    try
    {
        var validationResult = await ValidateOrderAsync(request, cancellationToken);
        if (!validationResult.IsValid)
            return Result<Order>.Failure(validationResult.Errors);
        
        var order = await orderService.CreateOrderAsync(request, cancellationToken);
        await eventBus.PublishAsync(new OrderCreatedEvent(order.Id), cancellationToken);
        
        return Result<Order>.Success(order);
    }
    catch (ValidationException ex)
    {
        logger.LogWarning(ex, "Order validation failed for request {@Request}", request);
        return Result<Order>.Failure(ex.Message);
    }
    catch (BusinessRuleException ex)
    {
        logger.LogWarning(ex, "Business rule violation in order processing");
        return Result<Order>.Failure(ex.Message);
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Unexpected error processing order {@Request}", request);
        throw; // Re-throw unexpected exceptions
    }
}
```

#### ✅ Validation Patterns
- FluentValidation usage
- Data annotation validation
- Custom validation attributes
- Early parameter validation

---

### 5. **Dependency Injection & IoC**

#### 💉 DI Container Configuration
```csharp
// Good: Proper service registration
public void ConfigureServices(IServiceCollection services)
{
    // Singleton for stateless services
    services.AddSingleton<IMemoryCache, MemoryCache>();
    
    // Scoped for per-request services
    services.AddScoped<IUserService, UserService>();
    services.AddScoped<IOrderService, OrderService>();
    
    // Transient for lightweight services
    services.AddTransient<IEmailSender, EmailSender>();
    
    // Factory patterns
    services.AddTransient<Func<string, IPaymentProcessor>>(provider => key =>
    {
        return key switch
        {
            "stripe" => provider.GetRequiredService<StripePaymentProcessor>(),
            "paypal" => provider.GetRequiredService<PayPalPaymentProcessor>(),
            _ => throw new ArgumentException($"Unknown payment processor: {key}")
        };
    });
}
```

#### 🏭 Factory & Strategy Patterns
- Proper lifetime management
- Avoiding service locator anti-pattern
- Constructor injection over property injection
- Generic factory implementations

---

### 6. **LINQ & Collections**

#### 📊 LINQ Optimization
```csharp
// Good: Efficient LINQ usage
public async Task<PagedResult<ProductDto>> GetProductsAsync(ProductFilter filter, CancellationToken cancellationToken)
{
    var query = context.Products
        .Where(p => !p.IsDeleted)
        .AsQueryable();
    
    if (!string.IsNullOrEmpty(filter.Name))
        query = query.Where(p => p.Name.Contains(filter.Name));
    
    if (filter.CategoryId.HasValue)
        query = query.Where(p => p.CategoryId == filter.CategoryId);
    
    var totalCount = await query.CountAsync(cancellationToken);
    
    var products = await query
        .OrderBy(p => p.Name)
        .Skip(filter.Skip)
        .Take(filter.Take)
        .Select(p => new ProductDto
        {
            Id = p.Id,
            Name = p.Name,
            Price = p.Price,
            CategoryName = p.Category.Name
        })
        .ToListAsync(cancellationToken);
    
    return new PagedResult<ProductDto>(products, totalCount, filter.Page, filter.PageSize);
}

// Bad: Multiple database hits
var products = context.Products.ToList(); // Loads everything into memory
var filtered = products.Where(p => p.IsActive).ToList(); // In-memory filtering
```

#### 🚀 Collection Performance
- Proper collection types for use cases
- Avoiding unnecessary allocations
- Using spans and memory for performance-critical code
- Concurrent collections for thread safety

---

### 7. **Entity Framework & Data Access**

#### 🗄️ EF Best Practices
```csharp
// Good: Proper EF usage
public class OrderRepository : IOrderRepository
{
    private readonly AppDbContext context;
    
    public OrderRepository(AppDbContext context)
    {
        this.context = context ?? throw new ArgumentNullException(nameof(context));
    }
    
    public async Task<Order> GetOrderWithItemsAsync(int orderId, CancellationToken cancellationToken)
    {
        return await context.Orders
            .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Product)
            .Include(o => o.Customer)
            .AsNoTracking() // For read-only operations
            .FirstOrDefaultAsync(o => o.Id == orderId, cancellationToken);
    }
    
    public async Task<int> CreateOrderAsync(Order order, CancellationToken cancellationToken)
    {
        context.Orders.Add(order);
        await context.SaveChangesAsync(cancellationToken);
        return order.Id;
    }
}
```

#### 📈 Performance Considerations
- Proper use of Include vs explicit loading
- AsNoTracking for read-only queries
- Bulk operations for large datasets
- Query splitting for complex includes

---

### 8. **API Design & Web Development**

#### 🌐 Controller Best Practices
```csharp
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class OrdersController : ControllerBase
{
    private readonly IOrderService orderService;
    private readonly ILogger<OrdersController> logger;
    
    public OrdersController(IOrderService orderService, ILogger<OrdersController> logger)
    {
        this.orderService = orderService ?? throw new ArgumentNullException(nameof(orderService));
        this.logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }
    
    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(OrderDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<OrderDto>> GetOrderAsync(int id, CancellationToken cancellationToken)
    {
        if (id <= 0)
            return BadRequest("Invalid order ID");
        
        var result = await orderService.GetOrderAsync(id, cancellationToken);
        
        return result.IsSuccess 
            ? Ok(result.Value) 
            : NotFound($"Order {id} not found");
    }
    
    [HttpPost]
    [ProducesResponseType(typeof(OrderDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<OrderDto>> CreateOrderAsync([FromBody] CreateOrderRequest request, CancellationToken cancellationToken)
    {
        var result = await orderService.CreateOrderAsync(request, cancellationToken);
        
        if (!result.IsSuccess)
            return BadRequest(result.Errors);
        
        return CreatedAtAction(nameof(GetOrderAsync), new { id = result.Value.Id }, result.Value);
    }
}
```

#### 🔒 Security & Validation
- Proper authorization attributes
- Model validation with data annotations
- HTTPS enforcement
- CORS configuration

---

### 9. **Testing Strategies**

#### 🧪 Unit Testing
```csharp
public class OrderServiceTests
{
    private readonly Mock<IOrderRepository> mockRepository;
    private readonly Mock<IEventBus> mockEventBus;
    private readonly Mock<ILogger<OrderService>> mockLogger;
    private readonly OrderService orderService;
    
    public OrderServiceTests()
    {
        mockRepository = new Mock<IOrderRepository>();
        mockEventBus = new Mock<IEventBus>();
        mockLogger = new Mock<ILogger<OrderService>>();
        orderService = new OrderService(mockRepository.Object, mockEventBus.Object, mockLogger.Object);
    }
    
    [Fact]
    public async Task CreateOrderAsync_WithValidRequest_ShouldReturnSuccess()
    {
        // Arrange
        var request = new CreateOrderRequest { CustomerId = 1, Items = new[] { new OrderItemRequest { ProductId = 1, Quantity = 2 } } };
        var expectedOrder = new Order { Id = 1, CustomerId = 1 };
        
        mockRepository.Setup(r => r.CreateOrderAsync(It.IsAny<Order>(), It.IsAny<CancellationToken>()))
                     .ReturnsAsync(expectedOrder);
        
        // Act
        var result = await orderService.CreateOrderAsync(request, CancellationToken.None);
        
        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(expectedOrder.Id, result.Value.Id);
        mockEventBus.Verify(e => e.PublishAsync(It.IsAny<OrderCreatedEvent>(), It.IsAny<CancellationToken>()), Times.Once);
    }
    
    [Fact]
    public async Task CreateOrderAsync_WithNullRequest_ShouldThrowArgumentNullException()
    {
        // Act & Assert
        await Assert.ThrowsAsync<ArgumentNullException>(() => 
            orderService.CreateOrderAsync(null, CancellationToken.None));
    }
}
```

#### 🎯 Testing Priorities
1. **Critical**: Business logic, data validation, security
2. **High**: Service methods, repository operations, API endpoints
3. **Medium**: Utilities, helpers, extension methods
4. **Low**: Simple properties, DTOs, configuration

---

### 10. **Performance & Monitoring**

#### ⚡ Performance Optimization
- Async/await patterns for I/O operations
- Memory-efficient algorithms
- Proper caching strategies
- Connection pooling
- Lazy loading patterns

#### 📊 Monitoring & Logging
```csharp
// Good: Structured logging
public class OrderService : IOrderService
{
    private readonly ILogger<OrderService> logger;
    
    public async Task<Result<Order>> CreateOrderAsync(CreateOrderRequest request, CancellationToken cancellationToken)
    {
        using var scope = logger.BeginScope("Creating order for customer {CustomerId}", request.CustomerId);
        
        logger.LogInformation("Starting order creation process");
        
        try
        {
            var order = await ProcessOrderAsync(request, cancellationToken);
            
            logger.LogInformation("Order {OrderId} created successfully", order.Id);
            return Result<Order>.Success(order);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create order for customer {CustomerId}", request.CustomerId);
            throw;
        }
    }
}
```

---

## 📊 C# Health Metrics

### Framework Compliance
- **SOLID Principles**: ⭐⭐⭐⭐⭐ (X/5)
- **Async/Await Patterns**: ⭐⭐⭐⭐⭐ (X/5)
- **Memory Management**: ⭐⭐⭐⭐⭐ (X/5)
- **Error Handling**: ⭐⭐⭐⭐⭐ (X/5)
- **Performance**: ⭐⭐⭐⭐⭐ (X/5)

### Overall C# Score: ⭐⭐⭐⭐⭐ (X/10)

---

## 🎯 C#-Specific Action Items

### 🔴 Critical (Security/Memory Leaks)
1. [ ] Fix resource leaks with proper using statements
2. [ ] Implement proper async/await patterns
3. [ ] Add input validation and sanitization
4. [ ] Fix null reference vulnerabilities
5. [ ] Implement proper exception handling

### 🟡 Important (Performance/Best Practices)
1. [ ] Add proper dependency injection patterns
2. [ ] Implement caching strategies
3. [ ] Add comprehensive error handling
4. [ ] Optimize LINQ queries and database operations
5. [ ] Add proper logging and monitoring

### 🟢 Improvements (Code Quality)
1. [ ] Refactor large classes and methods
2. [ ] Add comprehensive unit tests
3. [ ] Improve naming conventions
4. [ ] Add XML documentation for public APIs
5. [ ] Implement design patterns where appropriate

---

## 💡 C# Upgrade Recommendations

### Migration Opportunities
- Modern C# language features (pattern matching, records, init-only properties)
- Nullable reference types for null safety
- Source generators for performance
- Minimal APIs for simple endpoints
- Native AOT compilation for cloud scenarios
- Performance improvements with Span<T> and Memory<T>

### Tooling Improvements
- Static code analysis with analyzers
- EditorConfig for consistent formatting
- Code coverage tools integration
- Performance profiling setup
- Security scanning tools
- Dependency vulnerability scanning
