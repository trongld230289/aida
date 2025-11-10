<!-- AIDA - AI Development Assistant v1.0.15 -->
<!-- Advanced AI-powered code review and analysis -->

# Python Framework Review Template

## 🎯 Python-Specific Review Guidelines

This template focuses specifically on Python framework best practices, patterns, and common pitfalls. Use this for reviewing Python modules, classes, functions, and configuration files.

🎯 REVIEW PRINCIPLES:
- ONLY flag issues that violate the specific rules in the template
- If code follows template guidelines, it's acceptable - don't force changes
- Focus on actual violations, not subjective preferences

---

## ⚡ PYTHON CRITICAL CHECKS (Auto-FAIL if found)

**Scan EVERY line for these PYTHON-SPECIFIC CRITICAL issues:**

{{REVIEW_BASE}}

### 🚨 IMPORT VIOLATIONS:
- Circular imports between modules
- Star imports (from module import *)
- Importing at function level without justification
- Missing __all__ in public modules
- Incorrect relative import usage
- Import order not following PEP 8
- Missing imports for type checking
- Unused imports not removed
- Importing entire modules when specific items needed
- Missing proper namespace organization

### 🚨 CODE QUALITY VIOLATIONS:
- Magic numbers without named constants
- Functions with too many parameters (>5)
- Classes with too many public methods
- Missing docstrings for public APIs
- Inconsistent naming conventions (not snake_case)
- Deep nesting levels (>4 levels)
- Large functions (>50 lines)
- Duplicate code without refactoring
- Missing unit tests for critical functionality
- No code analysis rule compliance (pylint, flake8)

---

## 🔍 Python Code Analysis

### 1. **Code Style & Pythonic Patterns**

#### 🐍 Pythonic Code
- **PEP 8 Compliance**
  - Snake_case naming conventions?
  - Proper indentation and spacing?
  - Import organization and order?
  - Line length and formatting?

#### 📦 Modern Python Features
- f-strings for string formatting
- Type hints for better code clarity
- Dataclasses for data containers
- Context managers for resource handling

#### 🔄 Idiomatic Patterns
```python
# Example: Pythonic patterns
from typing import List, Dict, Optional, Union
from dataclasses import dataclass
from pathlib import Path
import logging

# ✅ Good: Proper type hints and dataclass
@dataclass
class User:
    id: int
    name: str
    email: str
    age: Optional[int] = None
    is_active: bool = True
    
    def __post_init__(self):
        if self.email:
            self.email = self.email.lower().strip()

# ✅ Good: Pythonic iteration and comprehensions
def process_users(users: List[User]) -> Dict[str, List[User]]:
    """Group active users by domain."""
    active_users = [user for user in users if user.is_active]
    
    domain_groups = {}
    for user in active_users:
        domain = user.email.split('@')[1] if '@' in user.email else 'unknown'
        domain_groups.setdefault(domain, []).append(user)
    
    return domain_groups

# ✅ Good: Using enumerate and zip
def compare_lists(list1: List[str], list2: List[str]) -> List[tuple]:
    """Compare two lists element by element."""
    differences = []
    
    for index, (item1, item2) in enumerate(zip(list1, list2)):
        if item1 != item2:
            differences.append((index, item1, item2))
    
    return differences

# ❌ Bad: Non-pythonic patterns
def bad_example(users):
    result = {}
    for i in range(len(users)):  # Should use enumerate
        user = users[i]
        domain = user.email.split('@')[1]
        if domain in result:
            result[domain].append(user)
        else:
            result[domain] = [user]  # Should use defaultdict
    return result
```

#### ❌ Common Issues
- Not using comprehensions
- Manual index tracking
- Mutable default arguments
- String concatenation in loops

---

### 2. **Type System & Safety**

#### 🔒 Type Hints & Validation
```python
# Best Practice: Comprehensive type hints
from typing import Protocol, TypeVar, Generic, Union, Literal, overload
from abc import ABC, abstractmethod

T = TypeVar('T')
K = TypeVar('K')
V = TypeVar('V')

# Good: Protocol for duck typing
class Serializable(Protocol):
    def to_dict(self) -> Dict[str, Any]: ...
    def from_dict(self, data: Dict[str, Any]) -> None: ...

# Good: Generic repository pattern
class Repository(ABC, Generic[T]):
    @abstractmethod
    async def get_by_id(self, id: int) -> Optional[T]:
        """Get entity by ID."""
        pass
    
    @abstractmethod
    async def save(self, entity: T) -> T:
        """Save entity and return updated version."""
        pass
    
    @abstractmethod
    async def delete(self, id: int) -> bool:
        """Delete entity by ID."""
        pass

# Good: Literal types for constants
Status = Literal['pending', 'approved', 'rejected']

class Order:
    def __init__(self, id: int, status: Status):
        self.id = id
        self.status = status
    
    def update_status(self, new_status: Status) -> None:
        """Update order status with type safety."""
        self.status = new_status

# Good: Union types and overloads
@overload
def process_data(data: str) -> str: ...

@overload
def process_data(data: List[str]) -> List[str]: ...

def process_data(data: Union[str, List[str]]) -> Union[str, List[str]]:
    """Process string or list of strings."""
    if isinstance(data, str):
        return data.upper()
    return [item.upper() for item in data]

# Good: Runtime type validation
def validate_user_data(data: Dict[str, Any]) -> User:
    """Validate and convert dict to User object."""
    if not isinstance(data, dict):
        raise TypeError("Data must be a dictionary")
    
    required_fields = {'id', 'name', 'email'}
    missing_fields = required_fields - data.keys()
    if missing_fields:
        raise ValueError(f"Missing required fields: {missing_fields}")
    
    if not isinstance(data['id'], int):
        raise TypeError("ID must be an integer")
    
    if not isinstance(data['name'], str) or not data['name'].strip():
        raise ValueError("Name must be a non-empty string")
    
    if not isinstance(data['email'], str) or '@' not in data['email']:
        raise ValueError("Email must be a valid email address")
    
    return User(
        id=data['id'],
        name=data['name'].strip(),
        email=data['email'].lower().strip(),
        age=data.get('age'),
        is_active=data.get('is_active', True)
    )
```

#### 🔍 Type Checking Tools
- mypy for static type checking
- pydantic for runtime validation
- typing_extensions for newer features
- Protocol for structural typing

---

### 3. **Async Programming & Concurrency**

#### ⚡ Async Best Practices
```python
# Best Practice: Proper async patterns
import asyncio
import aiohttp
import logging
from typing import AsyncGenerator, AsyncContextManager
from contextlib import asynccontextmanager

class AsyncUserService:
    def __init__(self, base_url: str, timeout: float = 30.0):
        self.base_url = base_url
        self.timeout = aiohttp.ClientTimeout(total=timeout)
        self._session: Optional[aiohttp.ClientSession] = None
    
    @asynccontextmanager
    async def get_session(self) -> AsyncGenerator[aiohttp.ClientSession, None]:
        """Get or create HTTP session with proper cleanup."""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(timeout=self.timeout)
        
        try:
            yield self._session
        except Exception:
            await self._session.close()
            self._session = None
            raise
    
    async def fetch_user(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Fetch user data with proper error handling."""
        try:
            async with self.get_session() as session:
                url = f"{self.base_url}/users/{user_id}"
                
                async with session.get(url) as response:
                    if response.status == 404:
                        return None
                    
                    response.raise_for_status()
                    return await response.json()
                    
        except asyncio.TimeoutError:
            logging.error(f"Timeout fetching user {user_id}")
            raise
        except aiohttp.ClientError as e:
            logging.error(f"HTTP error fetching user {user_id}: {e}")
            raise
        except Exception as e:
            logging.error(f"Unexpected error fetching user {user_id}: {e}")
            raise
    
    async def fetch_multiple_users(self, user_ids: List[int]) -> Dict[int, Optional[Dict[str, Any]]]:
        """Fetch multiple users concurrently."""
        tasks = [self.fetch_user(user_id) for user_id in user_ids]
        
        try:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            user_data = {}
            for user_id, result in zip(user_ids, results):
                if isinstance(result, Exception):
                    logging.error(f"Error fetching user {user_id}: {result}")
                    user_data[user_id] = None
                else:
                    user_data[user_id] = result
            
            return user_data
            
        except Exception as e:
            logging.error(f"Error in batch user fetch: {e}")
            raise
    
    async def cleanup(self) -> None:
        """Clean up resources."""
        if self._session and not self._session.closed:
            await self._session.close()

# Good: Async context manager for database
@asynccontextmanager
async def get_db_connection() -> AsyncGenerator[asyncpg.Connection, None]:
    """Get database connection with automatic cleanup."""
    connection = None
    try:
        connection = await asyncpg.connect(DATABASE_URL)
        yield connection
    except Exception as e:
        if connection:
            await connection.close()
        logging.error(f"Database error: {e}")
        raise
    finally:
        if connection:
            await connection.close()

# Good: Async generator for streaming data
async def stream_users() -> AsyncGenerator[User, None]:
    """Stream users from database."""
    async with get_db_connection() as conn:
        query = "SELECT * FROM users ORDER BY id"
        
        async with conn.transaction():
            async for record in conn.cursor(query):
                yield User(
                    id=record['id'],
                    name=record['name'],
                    email=record['email'],
                    age=record['age'],
                    is_active=record['is_active']
                )

# ❌ Bad: Blocking operations in async code
async def bad_async_example():
    # Bad: Using blocking sleep
    time.sleep(1)  # Should use await asyncio.sleep(1)
    
    # Bad: Blocking file operations
    with open('file.txt', 'r') as f:  # Should use aiofiles
        content = f.read()
    
    # Bad: No error handling
    response = await fetch_data()  # What if this fails?
    return response
```

#### 🚨 Async Anti-patterns
- Blocking operations in async functions
- Missing error handling
- Resource leaks from unclosed connections
- Mixing sync and async incorrectly

---

### 4. **Error Handling & Logging**

#### 🛡️ Robust Error Handling
```python
# Best Practice: Custom exception hierarchy
class AppError(Exception):
    """Base application error."""
    def __init__(self, message: str, code: str = None):
        super().__init__(message)
        self.message = message
        self.code = code or self.__class__.__name__.upper()

class ValidationError(AppError):
    """Data validation error."""
    def __init__(self, message: str, field: str = None, value: Any = None):
        super().__init__(message, 'VALIDATION_ERROR')
        self.field = field
        self.value = value

class NotFoundError(AppError):
    """Resource not found error."""
    def __init__(self, resource: str, identifier: Any):
        message = f"{resource} with identifier {identifier} not found"
        super().__init__(message, 'NOT_FOUND')
        self.resource = resource
        self.identifier = identifier

class BusinessRuleError(AppError):
    """Business rule violation error."""
    def __init__(self, rule: str, context: Dict[str, Any] = None):
        message = f"Business rule violation: {rule}"
        super().__init__(message, 'BUSINESS_RULE_ERROR')
        self.rule = rule
        self.context = context or {}

# Good: Comprehensive error handling
async def process_order(order_data: Dict[str, Any]) -> Order:
    """Process order with comprehensive error handling."""
    try:
        # Validate input data
        validated_data = validate_order_data(order_data)
        
        # Check business rules
        await validate_business_rules(validated_data)
        
        # Process the order
        order = await create_order(validated_data)
        
        # Send notifications
        try:
            await send_order_notification(order)
        except Exception as e:
            # Log but don't fail the order
            logging.warning(f"Failed to send notification for order {order.id}: {e}")
        
        return order
        
    except ValidationError as e:
        logging.warning(f"Order validation failed: {e.message}", extra={
            'field': e.field,
            'value': e.value,
            'order_data': order_data
        })
        raise
        
    except BusinessRuleError as e:
        logging.error(f"Business rule violation: {e.rule}", extra={
            'context': e.context,
            'order_data': order_data
        })
        raise
        
    except Exception as e:
        logging.error(f"Unexpected error processing order: {e}", extra={
            'order_data': order_data
        }, exc_info=True)
        raise AppError("Failed to process order") from e

# Good: Context manager for error handling
@contextmanager
def handle_database_errors():
    """Context manager for database error handling."""
    try:
        yield
    except asyncpg.UniqueViolationError as e:
        raise ValidationError("Duplicate entry") from e
    except asyncpg.ForeignKeyViolationError as e:
        raise ValidationError("Referenced entity does not exist") from e
    except asyncpg.PostgresError as e:
        logging.error(f"Database error: {e}")
        raise AppError("Database operation failed") from e

# Good: Structured logging
import structlog

logger = structlog.get_logger()

async def user_login(email: str, password: str) -> Optional[User]:
    """User login with structured logging."""
    log = logger.bind(email=email)
    
    try:
        log.info("User login attempt")
        
        user = await get_user_by_email(email)
        if not user:
            log.warning("User not found")
            return None
        
        if not verify_password(password, user.password_hash):
            log.warning("Invalid password")
            return None
        
        await update_last_login(user.id)
        log.info("User login successful", user_id=user.id)
        
        return user
        
    except Exception as e:
        log.error("Login error", error=str(e), exc_info=True)
        raise
```

#### ✅ Error Handling Best Practices
- Specific exception types
- Proper exception chaining
- Structured logging
- Context preservation

---

### 5. **Database & ORM Patterns**

#### 🗄️ Database Best Practices
```python
# Best Practice: Repository pattern with SQLAlchemy
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy import Column, Integer, String, Boolean, DateTime, select
from typing import Optional, List

Base = declarative_base()

class UserModel(Base):
    __tablename__ = 'users'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def get_by_id(self, user_id: int) -> Optional[User]:
        """Get user by ID with proper error handling."""
        try:
            stmt = select(UserModel).where(UserModel.id == user_id)
            result = await self.session.execute(stmt)
            user_model = result.scalar_one_or_none()
            
            if user_model:
                return self._model_to_entity(user_model)
            return None
            
        except Exception as e:
            logging.error(f"Error fetching user {user_id}: {e}")
            raise
    
    async def get_by_email(self, email: str) -> Optional[User]:
        """Get user by email."""
        try:
            stmt = select(UserModel).where(UserModel.email == email.lower())
            result = await self.session.execute(stmt)
            user_model = result.scalar_one_or_none()
            
            if user_model:
                return self._model_to_entity(user_model)
            return None
            
        except Exception as e:
            logging.error(f"Error fetching user by email {email}: {e}")
            raise
    
    async def create(self, user: User) -> User:
        """Create new user."""
        try:
            user_model = UserModel(
                name=user.name,
                email=user.email.lower(),
                is_active=user.is_active
            )
            
            self.session.add(user_model)
            await self.session.flush()  # Get the ID
            await self.session.refresh(user_model)
            
            return self._model_to_entity(user_model)
            
        except Exception as e:
            logging.error(f"Error creating user: {e}")
            raise
    
    async def update(self, user_id: int, updates: Dict[str, Any]) -> Optional[User]:
        """Update user with partial data."""
        try:
            stmt = select(UserModel).where(UserModel.id == user_id)
            result = await self.session.execute(stmt)
            user_model = result.scalar_one_or_none()
            
            if not user_model:
                return None
            
            for key, value in updates.items():
                if hasattr(user_model, key):
                    setattr(user_model, key, value)
            
            await self.session.flush()
            await self.session.refresh(user_model)
            
            return self._model_to_entity(user_model)
            
        except Exception as e:
            logging.error(f"Error updating user {user_id}: {e}")
            raise
    
    async def list_active(self, limit: int = 100, offset: int = 0) -> List[User]:
        """List active users with pagination."""
        try:
            stmt = (
                select(UserModel)
                .where(UserModel.is_active == True)
                .order_by(UserModel.created_at.desc())
                .limit(limit)
                .offset(offset)
            )
            
            result = await self.session.execute(stmt)
            user_models = result.scalars().all()
            
            return [self._model_to_entity(model) for model in user_models]
            
        except Exception as e:
            logging.error(f"Error listing users: {e}")
            raise
    
    def _model_to_entity(self, model: UserModel) -> User:
        """Convert database model to domain entity."""
        return User(
            id=model.id,
            name=model.name,
            email=model.email,
            is_active=model.is_active
        )

# Good: Unit of Work pattern
class UnitOfWork:
    def __init__(self, session_factory: sessionmaker):
        self.session_factory = session_factory
        self._session: Optional[AsyncSession] = None
    
    async def __aenter__(self):
        self._session = self.session_factory()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            await self._session.rollback()
        else:
            await self._session.commit()
        
        await self._session.close()
        self._session = None
    
    @property
    def users(self) -> UserRepository:
        return UserRepository(self._session)
    
    async def commit(self):
        await self._session.commit()
    
    async def rollback(self):
        await self._session.rollback()
```

---

### 6. **Testing Strategies**

#### 🧪 Comprehensive Testing
```python
# Best Practice: Test utilities and fixtures
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock
from typing import AsyncGenerator

class UserTestFactory:
    """Factory for creating test user objects."""
    
    @staticmethod
    def create_user(
        id: int = 1,
        name: str = "Test User",
        email: str = "test@example.com",
        is_active: bool = True,
        **overrides
    ) -> User:
        """Create a test user with optional overrides."""
        data = {
            'id': id,
            'name': name,
            'email': email,
            'is_active': is_active,
            **overrides
        }
        return User(**data)
    
    @staticmethod
    def create_users(count: int = 3) -> List[User]:
        """Create multiple test users."""
        return [
            UserTestFactory.create_user(
                id=i,
                email=f"user{i}@example.com",
                name=f"User {i}"
            )
            for i in range(1, count + 1)
        ]

@pytest.fixture
async def mock_session() -> AsyncMock:
    """Mock database session."""
    session = AsyncMock(spec=AsyncSession)
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.close = AsyncMock()
    return session

@pytest.fixture
def user_repository(mock_session) -> UserRepository:
    """User repository with mocked session."""
    return UserRepository(mock_session)

@pytest.fixture
async def test_user() -> User:
    """Test user fixture."""
    return UserTestFactory.create_user()

# Good: Async test patterns
@pytest_asyncio.async_test
class TestUserRepository:
    
    async def test_get_by_id_success(self, user_repository, mock_session, test_user):
        """Test successful user retrieval by ID."""
        # Arrange
        user_id = test_user.id
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = self._create_user_model(test_user)
        mock_session.execute.return_value = mock_result
        
        # Act
        result = await user_repository.get_by_id(user_id)
        
        # Assert
        assert result is not None
        assert result.id == test_user.id
        assert result.name == test_user.name
        assert result.email == test_user.email
        mock_session.execute.assert_called_once()
    
    async def test_get_by_id_not_found(self, user_repository, mock_session):
        """Test user not found scenario."""
        # Arrange
        user_id = 999
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_result
        
        # Act
        result = await user_repository.get_by_id(user_id)
        
        # Assert
        assert result is None
        mock_session.execute.assert_called_once()
    
    async def test_create_user_success(self, user_repository, mock_session, test_user):
        """Test successful user creation."""
        # Arrange
        user_model = self._create_user_model(test_user)
        mock_session.add = MagicMock()
        mock_session.flush = AsyncMock()
        mock_session.refresh = AsyncMock()
        
        # Act
        result = await user_repository.create(test_user)
        
        # Assert
        assert result.name == test_user.name
        assert result.email == test_user.email
        mock_session.add.assert_called_once()
        mock_session.flush.assert_called_once()
        mock_session.refresh.assert_called_once()
    
    async def test_create_user_duplicate_email(self, user_repository, mock_session, test_user):
        """Test user creation with duplicate email."""
        # Arrange
        mock_session.add = MagicMock()
        mock_session.flush = AsyncMock(side_effect=IntegrityError("Duplicate", None, None))
        
        # Act & Assert
        with pytest.raises(IntegrityError):
            await user_repository.create(test_user)
    
    def _create_user_model(self, user: User) -> UserModel:
        """Helper to create user model for testing."""
        model = UserModel()
        model.id = user.id
        model.name = user.name
        model.email = user.email
        model.is_active = user.is_active
        return model

# Good: Integration tests with test database
@pytest.fixture(scope="session")
async def test_engine():
    """Create test database engine."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    await engine.dispose()

@pytest.fixture
async def test_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create test database session."""
    async_session = sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with async_session() as session:
        async with session.begin():
            yield session
            await session.rollback()

@pytest.mark.integration
class TestUserRepositoryIntegration:
    
    async def test_full_user_lifecycle(self, test_session):
        """Test complete user CRUD operations."""
        repo = UserRepository(test_session)
        
        # Create user
        test_user = UserTestFactory.create_user(id=None)  # No ID for creation
        created_user = await repo.create(test_user)
        
        assert created_user.id is not None
        assert created_user.name == test_user.name
        
        # Retrieve user
        retrieved_user = await repo.get_by_id(created_user.id)
        assert retrieved_user is not None
        assert retrieved_user.email == test_user.email
        
        # Update user
        updates = {'name': 'Updated Name'}
        updated_user = await repo.update(created_user.id, updates)
        assert updated_user.name == 'Updated Name'
        
        # List users
        users = await repo.list_active(limit=10)
        assert len(users) >= 1
        assert any(u.id == created_user.id for u in users)
```

---

## 📊 Python Health Metrics

### Framework Compliance
- **Pythonic Code**: ⭐⭐⭐⭐⭐ (X/5)
- **Type Safety**: ⭐⭐⭐⭐⭐ (X/5)
- **Async Patterns**: ⭐⭐⭐⭐⭐ (X/5)
- **Error Handling**: ⭐⭐⭐⭐⭐ (X/5)
- **Testing**: ⭐⭐⭐⭐⭐ (X/5)

### Overall Python Score: ⭐⭐⭐⭐⭐ (X/10)

---

## 🎯 Python-Specific Action Items

### 🔴 Critical (Security/Safety)
1. [ ] Fix all security vulnerabilities (SQL injection, path traversal)
2. [ ] Add proper async error handling and resource cleanup
3. [ ] Fix bare except clauses and improve exception handling
4. [ ] Add type hints for all public functions and methods
5. [ ] Remove debugging code and print statements

### 🟡 Important (Performance/Best Practices)
1. [ ] Migrate to modern Python features (f-strings, dataclasses)
2. [ ] Implement proper async patterns and context managers
3. [ ] Add comprehensive input validation
4. [ ] Optimize database queries and add connection pooling
5. [ ] Add proper logging with structured data

### 🟢 Improvements (Code Quality)
1. [ ] Add comprehensive docstrings and type documentation
2. [ ] Implement proper testing strategies
3. [ ] Add code linting (pylint, flake8, black)
4. [ ] Improve code organization and module structure
5. [ ] Add performance monitoring and profiling

---

## 💡 Python Upgrade Recommendations

### Migration Opportunities
- Modern Python features (Python 3.10+: pattern matching, union types)
- Pydantic v2 for data validation
- FastAPI for high-performance APIs
- SQLAlchemy 2.0 for better async support
- Asyncio improvements and context variables
- Performance optimizations with Cython or PyPy

### Tooling Improvements
- Pre-commit hooks with black, isort, mypy
- pytest with comprehensive test coverage
- Continuous integration with GitHub Actions
- Code quality monitoring with SonarQube
- Performance profiling with cProfile
- Security scanning with bandit
