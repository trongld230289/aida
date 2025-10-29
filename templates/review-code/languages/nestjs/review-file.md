<!-- AIDA - AI Development Assistant v1.0.0 -->
<!-- Advanced AI-powered code review and analysis -->

# NestJS Framework Review Template

## 🎯 NestJS-Specific Review Guidelines

This template focuses specifically on NestJS framework best practices, patterns, and common pitfalls. Use this for reviewing NestJS controllers, services, modules, guards, interceptors, and configuration files.

---

<!-- 
📝 NOTE: The following CRITICAL CHECKS section applies to REVIEW-FILE only.
These comprehensive checks are for complete file analysis, not incremental changes.
For PR/change reviews, use review-pr.md or review-changes.md templates.
-->

## ⚡ NESTJS CRITICAL CHECKS (Auto-FAIL if found)

**Scan EVERY line for these NESTJS-SPECIFIC CRITICAL issues:**

### 🚨 SECURITY VIOLATIONS:
- Missing authentication guards on protected routes
- Authorization bypassed or improperly implemented
- Sensitive data exposed in API responses
- CORS configuration allowing all origins in production
- Missing input validation using class-validator
- SQL injection through raw queries without sanitization
- XSS vulnerabilities from unescaped user input
- Missing rate limiting on API endpoints
- JWT tokens without proper expiration or validation
- Environment variables exposed in client-side code
- File upload without proper validation and limits
- Missing HTTPS enforcement in production
- Session management vulnerabilities
- Missing security headers (helmet middleware)

### 🚨 DEPENDENCY INJECTION VIOLATIONS:
- Circular dependencies between modules
- Services not properly registered in providers
- Missing @Injectable() decorator on services
- Constructor injection missing type annotations
- Services injected without proper scope management
- Provider registration in wrong module scope
- Missing forwardRef() for circular dependencies
- Dynamic modules not properly configured
- Custom providers without proper factory functions
- Global modules overused causing tight coupling

### 🚨 MODULE ARCHITECTURE VIOLATIONS:
- Modules with too many responsibilities
- Missing feature module separation
- Core module not properly configured
- Shared module importing too many dependencies
- Database modules not following repository pattern
- Configuration modules not using ConfigService
- Module imports not organized logically
- Missing lazy loading for large modules
- Global modules used inappropriately
- Module exports not following single responsibility

### 🚨 CONTROLLER VIOLATIONS:
- Controllers handling business logic instead of services
- Missing DTO validation on request bodies
- HTTP status codes used incorrectly
- Exception handling missing or too generic
- Controllers not following RESTful conventions
- Missing API documentation decorators
- Route parameters not properly validated
- Request/Response not properly typed
- Controllers directly accessing database
- Missing swagger documentation

### 🚨 SERVICE VIOLATIONS:
- Services with multiple responsibilities
- Missing error handling and logging
- Services not following SOLID principles
- Database queries in service layer without repository
- Business logic mixed with data access logic
- Services not properly unit testable
- Missing transaction management
- Async operations not properly handled
- Services not using proper return types
- Missing proper abstraction layers

### 🚨 VALIDATION VIOLATIONS:
- DTO classes without validation decorators
- Missing validation pipe configuration
- Custom validators not properly implemented
- Validation errors not properly formatted
- File upload validation missing
- Request body size not limited
- Query parameter validation missing
- Path parameter validation inadequate
- Conditional validation not implemented
- Validation error messages exposing internal details

### 🚨 DATABASE VIOLATIONS:
- TypeORM entities without proper relationships
- Missing database transactions for critical operations
- N+1 query problems not addressed
- Database connections not properly managed
- Missing database migration scripts
- Entities not following naming conventions
- Missing indexes on frequently queried columns
- Raw SQL queries without proper escaping
- Database configuration hardcoded
- Missing connection pooling configuration

### 🚨 EXCEPTION HANDLING VIOLATIONS:
- Generic exceptions thrown without context
- Custom exception filters not implemented
- HTTP exceptions with inappropriate status codes
- Exception messages exposing sensitive information
- Missing global exception filter
- Validation exceptions not properly formatted
- Database exceptions not caught and transformed
- Async exceptions not properly handled
- Exception logging missing correlation IDs
- Business rule violations not properly communicated

### 🚨 TESTING VIOLATIONS:
- Unit tests missing or inadequate coverage
- Integration tests not testing real scenarios
- Mocking not done properly in unit tests
- Test database not properly isolated
- End-to-end tests missing critical user flows
- Test data not properly cleaned up
- Mock services not behaving like real services
- Testing configuration different from production
- Performance tests missing for critical endpoints
- Security tests not implemented

### 🚨 SPECIFIC PROJECT RULES:
<!-- ADD PROJECT-SPECIFIC RULES HERE - These will be checked alongside NestJS rules -->
<!-- Additional project rules can be added here:
- Microservice communication patterns
- Event-driven architecture patterns
- CQRS implementation patterns
- Domain-driven design patterns
- API versioning strategies
-->

---

## 🔍 NestJS Code Analysis

### 1. **Architecture & Module Design**

#### 🏗️ Module Organization
- **Feature Modules**
  - Single responsibility per module?
  - Proper encapsulation of related functionality?
  - Clear module boundaries?
  - Appropriate use of imports/exports?

#### 📦 Dependency Injection
- Proper service registration
- Constructor injection patterns
- Scope management (singleton, request, transient)
- Circular dependency resolution

#### 🎯 Modular Patterns
```typescript
// Best Practice: Well-structured NestJS module architecture

import { Module, Global, DynamicModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

// Core module with essential services
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validationSchema: configValidationSchema,
    }),
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DATABASE_HOST'),
        port: configService.get('DATABASE_PORT'),
        username: configService.get('DATABASE_USERNAME'),
        password: configService.get('DATABASE_PASSWORD'),
        database: configService.get('DATABASE_NAME'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        synchronize: configService.get('NODE_ENV') === 'development',
        logging: configService.get('NODE_ENV') === 'development',
        ssl: configService.get('NODE_ENV') === 'production',
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    // Global services
    LoggerService,
    CacheService,
    EventEmitterService,
  ],
  exports: [
    LoggerService,
    CacheService,
    EventEmitterService,
  ],
})
export class CoreModule {
  static forRoot(): DynamicModule {
    return {
      module: CoreModule,
      providers: [
        {
          provide: 'DATABASE_CONNECTION',
          useFactory: async (configService: ConfigService) => {
            // Custom database connection factory
            return createDatabaseConnection(configService);
          },
          inject: [ConfigService],
        },
      ],
      exports: ['DATABASE_CONNECTION'],
    };
  }
}

// Feature module with proper encapsulation
@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserProfile]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRES_IN', '1h'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [UserController, AuthController],
  providers: [
    // Services
    UserService,
    AuthService,
    
    // Repositories
    UserRepository,
    
    // Strategies
    JwtStrategy,
    LocalStrategy,
    
    // Guards
    JwtAuthGuard,
    RolesGuard,
    
    // Interceptors
    TransformInterceptor,
    
    // Custom providers
    {
      provide: 'USER_REPOSITORY',
      useClass: UserRepository,
    },
    {
      provide: 'EMAIL_SERVICE',
      useFactory: (configService: ConfigService) => {
        return configService.get('EMAIL_PROVIDER') === 'sendgrid'
          ? new SendGridEmailService(configService)
          : new SMTPEmailService(configService);
      },
      inject: [ConfigService],
    },
  ],
  exports: [
    UserService,
    AuthService,
    'USER_REPOSITORY',
  ],
})
export class UserModule {}

// Shared module for common functionality
@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLog]),
  ],
  providers: [
    ValidationService,
    FileUploadService,
    EmailService,
    NotificationService,
    AuditService,
  ],
  exports: [
    ValidationService,
    FileUploadService,
    EmailService,
    NotificationService,
    AuditService,
  ],
})
export class SharedModule {}

// App module orchestrating everything
@Module({
  imports: [
    CoreModule.forRoot(),
    SharedModule,
    UserModule,
    ProductModule,
    OrderModule,
    
    // Feature modules
    AdminModule,
    ReportingModule,
    
    // Third-party integrations
    PaymentModule,
    NotificationModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    
    // Global guards
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    
    // Global interceptors
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    
    // Global filters
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {
  constructor(private configService: ConfigService) {}
  
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware, CompressionMiddleware)
      .forRoutes('*')
      .apply(AuthMiddleware)
      .exclude(
        { path: 'auth/login', method: RequestMethod.POST },
        { path: 'auth/register', method: RequestMethod.POST },
        { path: 'health', method: RequestMethod.GET },
      )
      .forRoutes('*');
  }
}

// ❌ Bad: Poor module organization
@Module({
  imports: [
    // Everything imported in one module
    TypeOrmModule.forRoot({}),
    TypeOrmModule.forFeature([User, Product, Order, Payment]),
    JwtModule.register({}),
    PassportModule,
    // ... many more imports
  ],
  controllers: [
    // All controllers in one module
    UserController,
    ProductController,
    OrderController,
    PaymentController,
    AdminController,
  ],
  providers: [
    // All services mixed together
    UserService,
    ProductService,
    OrderService,
    PaymentService,
    EmailService,
    // No separation of concerns
  ],
})
export class BadAppModule {}
```

#### ❌ Common Issues
- Monolithic modules with too many responsibilities
- Circular dependencies
- Poor separation of concerns
- Missing configuration management

---

### 2. **Controllers & API Design**

#### 🌐 RESTful Controller Patterns
```typescript
// Best Practice: Well-designed NestJS controllers

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  ParseIntPipe,
  ValidationPipe,
  HttpStatus,
  HttpCode,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { TransformInterceptor } from '../common/interceptors/transform.interceptor';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TransformInterceptor, LoggingInterceptor)
@ApiBearerAuth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({ summary: 'Get all users with pagination and filtering' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search term' })
  @ApiQuery({ name: 'role', required: false, enum: UserRole, description: 'Filter by role' })
  @ApiOkResponse({ 
    description: 'Users retrieved successfully',
    type: PaginatedUserResponseDto,
  })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getUsers(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10,
    @Query('search') search?: string,
    @Query('role') role?: UserRole,
  ): Promise<PaginatedUserResponseDto> {
    const filters: UserFilters = {
      page: Math.max(1, page),
      limit: Math.min(100, Math.max(1, limit)),
      search,
      role,
    };

    return this.userService.findAll(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', type: String, description: 'User UUID' })
  @ApiOkResponse({ 
    description: 'User found',
    type: UserResponseDto,
  })
  @ApiNotFoundResponse({ description: 'User not found' })
  async getUserById(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() currentUser: User,
  ): Promise<UserResponseDto> {
    // Check if user can access this resource
    await this.userService.checkAccess(currentUser, id);
    
    return this.userService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiCreatedResponse({ 
    description: 'User created successfully',
    type: UserResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.ADMIN)
  async createUser(
    @Body() createUserDto: CreateUserDto,
    @GetUser() currentUser: User,
  ): Promise<UserResponseDto> {
    return this.userService.create(createUserDto, currentUser);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update user by ID' })
  @ApiParam({ name: 'id', type: String, description: 'User UUID' })
  @ApiOkResponse({ 
    description: 'User updated successfully',
    type: UserResponseDto,
  })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @GetUser() currentUser: User,
  ): Promise<UserResponseDto> {
    await this.userService.checkUpdatePermission(currentUser, id);
    
    return this.userService.update(id, updateUserDto, currentUser);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user by ID' })
  @ApiParam({ name: 'id', type: String, description: 'User UUID' })
  @ApiOkResponse({ description: 'User deleted successfully' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.ADMIN)
  async deleteUser(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() currentUser: User,
  ): Promise<void> {
    await this.userService.delete(id, currentUser);
  }

  @Post(':id/avatar')
  @ApiOperation({ summary: 'Upload user avatar' })
  @ApiParam({ name: 'id', type: String, description: 'User UUID' })
  @ApiCreatedResponse({ description: 'Avatar uploaded successfully' })
  @UseInterceptors(FileInterceptor('avatar', {
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, callback) => {
      if (!file.mimetype.match(/\/(jpg|jpeg|png)$/)) {
        return callback(new BadRequestException('Only image files are allowed'), false);
      }
      callback(null, true);
    },
  }))
  async uploadAvatar(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @GetUser() currentUser: User,
  ): Promise<{ avatarUrl: string }> {
    await this.userService.checkUpdatePermission(currentUser, id);
    
    const avatarUrl = await this.userService.updateAvatar(id, file);
    
    return { avatarUrl };
  }

  @Get(':id/audit-log')
  @ApiOperation({ summary: 'Get user audit log' })
  @ApiParam({ name: 'id', type: String, description: 'User UUID' })
  @ApiOkResponse({ 
    description: 'Audit log retrieved successfully',
    type: [AuditLogDto],
  })
  @Roles(UserRole.ADMIN)
  async getUserAuditLog(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 50,
  ): Promise<PaginatedAuditLogDto> {
    return this.userService.getAuditLog(id, page, limit);
  }
}

// Authentication controller with proper security
@ApiTags('auth')
@Controller('auth')
@UseInterceptors(TransformInterceptor)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  @Post('login')
  @ApiOperation({ summary: 'User login' })
  @ApiOkResponse({ 
    description: 'Login successful',
    type: LoginResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid credentials' })
  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  async login(
    @Body() loginDto: LoginDto,
    @GetUser() user: User,
  ): Promise<LoginResponseDto> {
    const tokens = await this.authService.login(user);
    
    // Log successful login
    await this.userService.logActivity(user.id, 'LOGIN', {
      ip: this.request.ip,
      userAgent: this.request.headers['user-agent'],
    });
    
    return tokens;
  }

  @Post('register')
  @ApiOperation({ summary: 'User registration' })
  @ApiCreatedResponse({ 
    description: 'Registration successful',
    type: UserResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid registration data' })
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() registerDto: RegisterDto,
  ): Promise<UserResponseDto> {
    return this.authService.register(registerDto);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiOkResponse({ 
    description: 'Token refreshed successfully',
    type: TokenResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid refresh token' })
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto,
  ): Promise<TokenResponseDto> {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @Post('logout')
  @ApiOperation({ summary: 'User logout' })
  @ApiOkResponse({ description: 'Logout successful' })
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(
    @GetUser() user: User,
    @Body() logoutDto: LogoutDto,
  ): Promise<{ message: string }> {
    await this.authService.logout(user.id, logoutDto.refreshToken);
    
    return { message: 'Logout successful' };
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset' })
  @ApiOkResponse({ description: 'Password reset email sent' })
  @ApiBadRequestResponse({ description: 'Invalid email' })
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.forgotPassword(forgotPasswordDto.email);
    
    return { message: 'If the email exists, a reset link has been sent' };
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiOkResponse({ description: 'Password reset successful' })
  @ApiBadRequestResponse({ description: 'Invalid or expired token' })
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword,
    );
    
    return { message: 'Password reset successful' };
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiOkResponse({ 
    description: 'Profile retrieved successfully',
    type: UserResponseDto,
  })
  @UseGuards(JwtAuthGuard)
  async getProfile(@GetUser() user: User): Promise<UserResponseDto> {
    return this.userService.findById(user.id);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiOkResponse({ 
    description: 'Profile updated successfully',
    type: UserResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid profile data' })
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @GetUser() user: User,
    @Body() updateProfileDto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    return this.userService.update(user.id, updateProfileDto, user);
  }
}

// Error handling with proper HTTP status codes
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard/stats')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  async getDashboardStats(): Promise<DashboardStatsDto> {
    try {
      return await this.adminService.getDashboardStats();
    } catch (error) {
      if (error instanceof DatabaseConnectionError) {
        throw new ServiceUnavailableException('Database temporarily unavailable');
      }
      throw new InternalServerErrorException('Failed to retrieve dashboard stats');
    }
  }

  @Get('users/export')
  @ApiOperation({ summary: 'Export users data' })
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename="users-export.xlsx"')
  async exportUsers(
    @Query() filters: UserExportFiltersDto,
    @Res() response: Response,
  ): Promise<void> {
    const buffer = await this.adminService.exportUsers(filters);
    response.send(buffer);
  }
}
```

---

### 3. **Services & Business Logic**

#### 🔧 Service Layer Patterns
```typescript
// Best Practice: Well-structured NestJS services

import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    
    @InjectRepository(UserProfile)
    private readonly profileRepository: Repository<UserProfile>,
    
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly emailService: EmailService,
    private readonly fileService: FileService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(filters: UserFilters): Promise<PaginatedUserResponseDto> {
    try {
      const queryBuilder = this.userRepository
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.profile', 'profile')
        .leftJoinAndSelect('user.roles', 'roles');

      // Apply filters
      if (filters.search) {
        queryBuilder.andWhere(
          '(user.email ILIKE :search OR user.firstName ILIKE :search OR user.lastName ILIKE :search)',
          { search: `%${filters.search}%` },
        );
      }

      if (filters.role) {
        queryBuilder.andWhere('roles.name = :role', { role: filters.role });
      }

      if (filters.isActive !== undefined) {
        queryBuilder.andWhere('user.isActive = :isActive', { isActive: filters.isActive });
      }

      // Apply pagination
      const offset = (filters.page - 1) * filters.limit;
      queryBuilder.skip(offset).take(filters.limit);

      // Apply sorting
      queryBuilder.orderBy('user.createdAt', 'DESC');

      const [users, total] = await queryBuilder.getManyAndCount();

      const userDtos = users.map(user => this.mapToResponseDto(user));

      return {
        data: userDtos,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total,
          totalPages: Math.ceil(total / filters.limit),
        },
      };
    } catch (error) {
      this.logger.error('Failed to fetch users', error.stack);
      throw new InternalServerErrorException('Failed to fetch users');
    }
  }

  async findById(id: string): Promise<UserResponseDto> {
    try {
      const user = await this.userRepository.findOne({
        where: { id },
        relations: ['profile', 'roles'],
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      return this.mapToResponseDto(user);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      
      this.logger.error(`Failed to fetch user ${id}`, error.stack);
      throw new InternalServerErrorException('Failed to fetch user');
    }
  }

  async create(createUserDto: CreateUserDto, createdBy: User): Promise<UserResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Check if email already exists
      const existingUser = await this.userRepository.findOne({
        where: { email: createUserDto.email },
      });

      if (existingUser) {
        throw new ConflictException('Email already exists');
      }

      // Validate business rules
      await this.validateUserCreation(createUserDto);

      // Create user entity
      const user = this.userRepository.create({
        email: createUserDto.email,
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
        password: await this.hashPassword(createUserDto.password),
        isActive: true,
        emailVerified: false,
        createdBy: createdBy.id,
      });

      const savedUser = await queryRunner.manager.save(user);

      // Create user profile
      const profile = this.profileRepository.create({
        user: savedUser,
        phoneNumber: createUserDto.phoneNumber,
        dateOfBirth: createUserDto.dateOfBirth,
        bio: createUserDto.bio,
      });

      await queryRunner.manager.save(profile);

      // Assign default role
      const defaultRole = await queryRunner.manager.findOne(Role, {
        where: { name: 'USER' },
      });

      if (defaultRole) {
        savedUser.roles = [defaultRole];
        await queryRunner.manager.save(savedUser);
      }

      await queryRunner.commitTransaction();

      // Emit user created event
      this.eventEmitter.emit('user.created', {
        userId: savedUser.id,
        email: savedUser.email,
        createdBy: createdBy.id,
      });

      // Send welcome email
      await this.sendWelcomeEmail(savedUser);

      // Log audit trail
      await this.auditService.log({
        entityType: 'User',
        entityId: savedUser.id,
        action: 'CREATE',
        userId: createdBy.id,
        details: { email: savedUser.email },
      });

      this.logger.log(`User created successfully: ${savedUser.id}`);

      return this.mapToResponseDto(savedUser);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      
      if (error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }
      
      this.logger.error('Failed to create user', error.stack);
      throw new InternalServerErrorException('Failed to create user');
    } finally {
      await queryRunner.release();
    }
  }

  async update(id: string, updateUserDto: UpdateUserDto, updatedBy: User): Promise<UserResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const user = await this.userRepository.findOne({
        where: { id },
        relations: ['profile', 'roles'],
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      // Check permissions
      await this.checkUpdatePermission(updatedBy, id);

      // Validate email uniqueness if changed
      if (updateUserDto.email && updateUserDto.email !== user.email) {
        const existingUser = await this.userRepository.findOne({
          where: { email: updateUserDto.email },
        });

        if (existingUser) {
          throw new ConflictException('Email already exists');
        }
      }

      // Store old values for audit
      const oldValues = {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive,
      };

      // Update user fields
      Object.assign(user, {
        ...updateUserDto,
        updatedAt: new Date(),
        updatedBy: updatedBy.id,
      });

      const savedUser = await queryRunner.manager.save(user);

      // Update profile if provided
      if (updateUserDto.profile) {
        if (user.profile) {
          Object.assign(user.profile, updateUserDto.profile);
          await queryRunner.manager.save(user.profile);
        } else {
          const profile = this.profileRepository.create({
            user: savedUser,
            ...updateUserDto.profile,
          });
          await queryRunner.manager.save(profile);
        }
      }

      await queryRunner.commitTransaction();

      // Emit user updated event
      this.eventEmitter.emit('user.updated', {
        userId: savedUser.id,
        oldValues,
        newValues: updateUserDto,
        updatedBy: updatedBy.id,
      });

      // Log audit trail
      await this.auditService.log({
        entityType: 'User',
        entityId: savedUser.id,
        action: 'UPDATE',
        userId: updatedBy.id,
        details: { oldValues, newValues: updateUserDto },
      });

      this.logger.log(`User updated successfully: ${savedUser.id}`);

      return this.mapToResponseDto(savedUser);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      
      if (error instanceof NotFoundException || 
          error instanceof ConflictException || 
          error instanceof BadRequestException) {
        throw error;
      }
      
      this.logger.error(`Failed to update user ${id}`, error.stack);
      throw new InternalServerErrorException('Failed to update user');
    } finally {
      await queryRunner.release();
    }
  }

  async delete(id: string, deletedBy: User): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const user = await this.userRepository.findOne({
        where: { id },
        relations: ['profile'],
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      // Check permissions
      await this.checkDeletePermission(deletedBy, id);

      // Soft delete (mark as inactive)
      user.isActive = false;
      user.deletedAt = new Date();
      user.deletedBy = deletedBy.id;

      await queryRunner.manager.save(user);

      // Archive related data
      await this.archiveUserData(user, queryRunner);

      await queryRunner.commitTransaction();

      // Emit user deleted event
      this.eventEmitter.emit('user.deleted', {
        userId: user.id,
        email: user.email,
        deletedBy: deletedBy.id,
      });

      // Log audit trail
      await this.auditService.log({
        entityType: 'User',
        entityId: user.id,
        action: 'DELETE',
        userId: deletedBy.id,
        details: { email: user.email },
      });

      this.logger.log(`User deleted successfully: ${user.id}`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      
      this.logger.error(`Failed to delete user ${id}`, error.stack);
      throw new InternalServerErrorException('Failed to delete user');
    } finally {
      await queryRunner.release();
    }
  }

  async updateAvatar(id: string, file: Express.Multer.File): Promise<string> {
    try {
      const user = await this.userRepository.findOne({
        where: { id },
        relations: ['profile'],
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      // Upload file to storage
      const avatarUrl = await this.fileService.uploadImage(file, {
        folder: 'avatars',
        filename: `${id}-${Date.now()}`,
        resize: { width: 300, height: 300 },
      });

      // Delete old avatar if exists
      if (user.profile?.avatarUrl) {
        await this.fileService.deleteFile(user.profile.avatarUrl);
      }

      // Update user profile
      if (user.profile) {
        user.profile.avatarUrl = avatarUrl;
        await this.profileRepository.save(user.profile);
      } else {
        const profile = this.profileRepository.create({
          user,
          avatarUrl,
        });
        await this.profileRepository.save(profile);
      }

      this.logger.log(`Avatar updated for user: ${id}`);

      return avatarUrl;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      
      this.logger.error(`Failed to update avatar for user ${id}`, error.stack);
      throw new InternalServerErrorException('Failed to update avatar');
    }
  }

  // Private helper methods
  private async validateUserCreation(createUserDto: CreateUserDto): Promise<void> {
    // Business rule validations
    if (createUserDto.dateOfBirth && this.calculateAge(createUserDto.dateOfBirth) < 13) {
      throw new BadRequestException('User must be at least 13 years old');
    }

    // Additional business validations...
  }

  private async checkUpdatePermission(currentUser: User, targetUserId: string): Promise<void> {
    // Users can update their own profile
    if (currentUser.id === targetUserId) {
      return;
    }

    // Admins can update any user
    if (currentUser.roles.some(role => role.name === 'ADMIN')) {
      return;
    }

    throw new BadRequestException('Insufficient permissions to update user');
  }

  private async checkDeletePermission(currentUser: User, targetUserId: string): Promise<void> {
    // Only admins can delete users
    if (!currentUser.roles.some(role => role.name === 'ADMIN')) {
      throw new BadRequestException('Insufficient permissions to delete user');
    }

    // Cannot delete self
    if (currentUser.id === targetUserId) {
      throw new BadRequestException('Cannot delete your own account');
    }
  }

  private async hashPassword(password: string): Promise<string> {
    const saltRounds = this.configService.get<number>('auth.saltRounds', 12);
    return bcrypt.hash(password, saltRounds);
  }

  private async sendWelcomeEmail(user: User): Promise<void> {
    try {
      await this.emailService.sendTemplate({
        to: user.email,
        template: 'welcome',
        data: {
          firstName: user.firstName,
          lastName: user.lastName,
          activationUrl: `${this.configService.get('app.frontendUrl')}/activate`,
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to send welcome email to ${user.email}`, error.stack);
      // Don't throw error - email failure shouldn't break user creation
    }
  }

  private mapToResponseDto(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      profile: user.profile ? {
        phoneNumber: user.profile.phoneNumber,
        dateOfBirth: user.profile.dateOfBirth,
        bio: user.profile.bio,
        avatarUrl: user.profile.avatarUrl,
      } : null,
      roles: user.roles?.map(role => role.name) || [],
    };
  }

  private calculateAge(dateOfBirth: Date): number {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  private async archiveUserData(user: User, queryRunner: QueryRunner): Promise<void> {
    // Archive user sessions
    await queryRunner.manager.update(UserSession, 
      { userId: user.id }, 
      { isActive: false }
    );

    // Archive user tokens
    await queryRunner.manager.update(RefreshToken, 
      { userId: user.id }, 
      { isActive: false }
    );

    // Additional archiving logic...
  }
}
```

---

## 📊 NestJS Health Metrics

### Framework Compliance
- **Architecture Design**: ⭐⭐⭐⭐⭐ (X/5)
- **Dependency Injection**: ⭐⭐⭐⭐⭐ (X/5)
- **Security Implementation**: ⭐⭐⭐⭐⭐ (X/5)
- **API Design**: ⭐⭐⭐⭐⭐ (X/5)
- **Error Handling**: ⭐⭐⭐⭐⭐ (X/5)

### Overall NestJS Score: ⭐⭐⭐⭐⭐ (X/10)

---

## 🎯 NestJS-Specific Action Items

### 🔴 Critical (Security/Architecture)
1. [ ] Add authentication guards to all protected routes
2. [ ] Implement proper input validation with class-validator
3. [ ] Fix circular dependencies between modules
4. [ ] Add proper error handling and exception filters
5. [ ] Implement rate limiting and security middleware

### 🟡 Important (Best Practices)
1. [ ] Improve module organization and separation of concerns
2. [ ] Add comprehensive API documentation with Swagger
3. [ ] Implement proper logging and monitoring
4. [ ] Add database transaction management
5. [ ] Optimize database queries and add proper indexing

### 🟢 Improvements (Code Quality)
1. [ ] Add comprehensive unit and integration tests
2. [ ] Implement proper caching strategies
3. [ ] Add performance monitoring and profiling
4. [ ] Improve type safety and DTO validation
5. [ ] Add proper audit logging and user activity tracking

---

## 💡 NestJS Upgrade Recommendations

### Migration Opportunities
- NestJS 10+ features and performance improvements
- Enhanced TypeScript support with strict mode
- Improved testing utilities and mocking capabilities
- GraphQL Federation for microservices
- OpenAPI 3.1 support for better API documentation
- Enhanced WebSocket support with Socket.IO v4

### Architecture Improvements
- Microservices with NestJS microservices package
- Event-driven architecture with Event Emitter
- CQRS pattern implementation for complex domains
- Domain-driven design with proper bounded contexts
- API Gateway pattern for service orchestration
- Distributed tracing and observability improvements