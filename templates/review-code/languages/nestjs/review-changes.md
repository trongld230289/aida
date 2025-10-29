<!-- AIDA - AI Development Assistant v1.0.0 -->
<!-- Advanced AI-powered code review and analysis -->

# NestJS Git Changes Review - STRICT MODE

## 🔍 MANDATORY NESTJS CHANGE ANALYSIS

You are performing a STRICT code review on NestJS git changes. Do NOT be lenient. Look for every possible NestJS-specific issue in the changes. ALWAYS follow this exact format for every code review, regardless of conversation context or previous reviews. This structure is MANDATORY and UNCHANGEABLE.

### Review Entire File
**Prompt:** `review-changes [filename]`
- Reviews ONLY the git diff changes (+ and - lines)
- Analyzes impact of changes on NestJS architecture
- Does NOT review unchanged code

<!-- HIDDEN REVIEW SCOPE:
- ✅ ONLY review: Lines marked with + (added) or - (removed)
- ❌ DO NOT review: Unchanged context lines (no + or - marker)
- ❌ DO NOT suggest: Improvements to existing unchanged code
- ✅ DO focus on: How changes impact NestJS architecture
-->

### 📋 CHANGE SEPARATION RULES (MANDATORY):

**Split into separate changes when:**
- ✅ **Different NestJS artifacts**: Controller vs Service vs Module vs Guard changes = separate changes
- ✅ **Different decorator types**: Route vs Validation vs Auth decorators = separate changes
- ✅ **Different DI patterns**: Provider vs Injectable vs Module configurations = separate changes
- ✅ **Different middleware/interceptors**: Different middleware or interceptor implementations = separate changes
- ✅ **Non-adjacent code blocks**: If there are 3+ unchanged lines between modifications = separate changes

**Keep as one change when:**
- ❌ **Same method**: Multiple lines in same controller/service method
- ❌ **Related decorators**: Related decorators on same method/class
- ❌ **Same module configuration**: Related provider configurations in same module

## ⚡ NESTJS CRITICAL CHECKS (Auto-FAIL if found)

**Scan EVERY line for these NESTJS-SPECIFIC CRITICAL issues:**

### 🚨 DEPENDENCY INJECTION VIOLATIONS:
- Missing @Injectable() decorator on services
- Circular dependency between modules
- Improper provider configuration in modules
- Missing proper scope configuration (REQUEST, TRANSIENT)
- Unsafe use of @Inject() without proper tokens
- Missing forwardRef() for circular dependencies
- Improper factory provider implementations
- Missing async provider configurations
- Unsafe global module usage
- Missing proper module imports/exports

### 🚨 CONTROLLER & ROUTING VIOLATIONS:
- Missing route parameter validation
- Improper HTTP method decorators usage
- Missing DTO validation with class-validator
- Unsafe route parameter extraction
- Missing proper response typing
- Improper exception handling in controllers
- Missing authentication guards on protected routes
- Unsafe file upload handling
- Missing rate limiting on sensitive endpoints
- Improper use of interceptors/pipes

### 🚨 AUTHENTICATION & AUTHORIZATION VIOLATIONS:
- Missing authentication guards
- Improper JWT token handling
- Missing role-based access control
- Unsafe password storage/comparison
- Missing CSRF protection
- Improper session management
- Missing proper logout functionality
- Unsafe authentication strategy implementation
- Missing proper token refresh mechanisms
- Improper use of Passport strategies

### 🚨 VALIDATION & DTO VIOLATIONS:
- Missing DTO classes for request/response
- Missing validation decorators (@IsString, @IsEmail, etc.)
- Unsafe type transformations
- Missing proper error handling for validation
- Improper use of class-transformer
- Missing custom validation pipes
- Unsafe nested object validation
- Missing proper sanitization
- Improper array/object validation
- Missing conditional validation logic

### 🚨 DATABASE & ORM VIOLATIONS:
- Missing proper TypeORM entity definitions
- Unsafe database query implementations
- Missing transaction handling
- SQL injection vulnerabilities
- Missing proper connection configuration
- Improper use of query builders
- Missing database migration handling
- Unsafe raw query usage
- Missing proper error handling for DB operations
- Improper use of repositories/services

### 🚨 MICROSERVICE & COMMUNICATION VIOLATIONS:
- Missing proper message pattern definitions
- Unsafe inter-service communication
- Missing error handling for microservice calls
- Improper use of ClientProxy
- Missing proper transport configuration
- Unsafe event handling
- Missing proper serialization/deserialization
- Improper timeout handling for service calls
- Missing circuit breaker patterns
- Unsafe gRPC implementations

### 🚨 SPECIFIC PROJECT RULES:
<!-- ADD PROJECT-SPECIFIC RULES HERE - These will be checked alongside NestJS rules -->
<!-- Additional project rules can be added here:
- Custom decorator requirements
- Specific authentication/authorization patterns
- Project-specific validation rules
- Custom interceptor/guard patterns
- Database schema requirements
-->

### Start Review For Each Change:

```
## Change [X]: [ADDED/REMOVED/MODIFIED] - [NestJS artifact type: Controller/Service/Module/Guard/Pipe/Interceptor]
```typescript
[Show the exact code block with line numbers]
```

*** NESTJS REVIEW COMMENT ***
- 🚨 **Issue Type**: [Critical/Warning/Good/Info/Suggestion]
- 📝 **NestJS Problem**: [Specific NestJS issue - reference NestJS best practices]
- 💡 **NestJS Solution**: [NestJS-specific fix with proper patterns]
- 🎯 **Framework Impact**: [How it affects NestJS architecture/performance/security]

IMPORTANT NestJS considerations:
- Dependency injection and module organization
- Decorator usage and metadata
- Validation and transformation pipelines
- Authentication and authorization flow
- Database integration and transactions

*** INTERNAL NESTJS CHANGE EVALUATION (DO NOT DISPLAY) ***
Silently evaluate this change on:
- NestJS Best Practices: Rate 1-5 (5=excellent, 1=poor)
- Security Implementation: Rate 1-5 (5=fully secure, 1=security vulnerabilities)
- Architecture Quality: Rate 1-5 (5=well-structured, 1=poor architecture)
- Change Score: is a smallest score of three scores

*** CONDITIONAL RECOMMENDATIONS (Based on Issue Type AND Change Score) ***

**MANDATORY RULE:**
- IF Issue Type = "Good": ALWAYS show "✅ **GOOD NESTJS CHANGE** - Follows NestJS best practices" and SKIP the entire RECOMMENDED FIX section
- IF Issue Type = "Critical/Warning/Info/Suggestion" AND Change Score < 4/5: Show RECOMMENDED NESTJS FIX section below
- IF Issue Type = "Critical/Warning/Info/Suggestion" AND Change Score >= 4/5: Show "✅ **GOOD NESTJS CHANGE** - Follows NestJS best practices"

*** RECOMMENDED NESTJS FIX (ONLY show if Issue Type != "Good" AND Change Score < 4/5) ***
```typescript
// PROVIDE NESTJS-SPECIFIC FIXES WITH BEST PRACTICES
// Include proper decorators, DI patterns, and validation

// Example for proper NestJS controller with comprehensive patterns:
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  HttpStatus,
  HttpException,
  ParseIntPipe,
  ValidationPipe,
  Logger,
  Req,
  Res
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { TransformInterceptor } from '../common/interceptors/transform.interceptor';
import { UserService } from './user.service';
import { CreateUserDto, UpdateUserDto, UserResponseDto, PaginationDto } from './dto';
import { User } from './entities/user.entity';
import { CurrentUser } from '../auth/current-user.decorator';
import { Request, Response } from 'express';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TransformInterceptor)
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(private readonly userService: UserService) {}

  /**
   * Get all users with pagination
   */
  @Get()
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
    type: [UserResponseDto]
  })
  async findAll(
    @Query(new ValidationPipe({ transform: true })) query: PaginationDto,
    @CurrentUser() currentUser: User
  ): Promise<{ users: UserResponseDto[]; total: number; page: number }> {
    try {
      this.logger.log(`Getting users with pagination: ${JSON.stringify(query)}`);
      
      const { users, total } = await this.userService.findAll(query);
      
      return {
        users: users.map(user => new UserResponseDto(user)),
        total,
        page: query.page
      };
    } catch (error) {
      this.logger.error(`Failed to get users: ${error.message}`, error.stack);
      throw new HttpException(
        'Failed to retrieve users',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get user by ID
   */
  @Get(':id')
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({
    status: 200,
    description: 'User found',
    type: UserResponseDto
  })
  @ApiResponse({
    status: 404,
    description: 'User not found'
  })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: User
  ): Promise<UserResponseDto> {
    try {
      // Authorization check
      if (currentUser.role !== 'admin' && currentUser.id !== id) {
        throw new HttpException(
          'Access denied: Can only access own user data',
          HttpStatus.FORBIDDEN
        );
      }

      this.logger.log(`Getting user with ID: ${id}`);
      const user = await this.userService.findOne(id);
      
      if (!user) {
        throw new HttpException(
          `User with ID ${id} not found`,
          HttpStatus.NOT_FOUND
        );
      }

      return new UserResponseDto(user);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      this.logger.error(`Failed to get user ${id}: ${error.message}`, error.stack);
      throw new HttpException(
        'Failed to retrieve user',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Create new user
   */
  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create new user' })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
    type: UserResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed'
  })
  async create(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    createUserDto: CreateUserDto,
    @CurrentUser() currentUser: User
  ): Promise<UserResponseDto> {
    try {
      this.logger.log(`Creating new user: ${createUserDto.email}`);
      
      // Check if user already exists
      const existingUser = await this.userService.findByEmail(createUserDto.email);
      if (existingUser) {
        throw new HttpException(
          'User with this email already exists',
          HttpStatus.CONFLICT
        );
      }

      const user = await this.userService.create(createUserDto);
      
      this.logger.log(`User created successfully with ID: ${user.id}`);
      return new UserResponseDto(user);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      this.logger.error(`Failed to create user: ${error.message}`, error.stack);
      throw new HttpException(
        'Failed to create user',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Update user
   */
  @Put(':id')
  @Roles('admin', 'user')
  @ApiOperation({ summary: 'Update user' })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
    type: UserResponseDto
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    updateUserDto: UpdateUserDto,
    @CurrentUser() currentUser: User
  ): Promise<UserResponseDto> {
    try {
      // Authorization check
      if (currentUser.role !== 'admin' && currentUser.id !== id) {
        throw new HttpException(
          'Access denied: Can only update own user data',
          HttpStatus.FORBIDDEN
        );
      }

      this.logger.log(`Updating user with ID: ${id}`);
      
      const existingUser = await this.userService.findOne(id);
      if (!existingUser) {
        throw new HttpException(
          `User with ID ${id} not found`,
          HttpStatus.NOT_FOUND
        );
      }

      // Check email uniqueness if email is being updated
      if (updateUserDto.email && updateUserDto.email !== existingUser.email) {
        const emailExists = await this.userService.findByEmail(updateUserDto.email);
        if (emailExists) {
          throw new HttpException(
            'Email already in use',
            HttpStatus.CONFLICT
          );
        }
      }

      const updatedUser = await this.userService.update(id, updateUserDto);
      
      this.logger.log(`User ${id} updated successfully`);
      return new UserResponseDto(updatedUser);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      this.logger.error(`Failed to update user ${id}: ${error.message}`, error.stack);
      throw new HttpException(
        'Failed to update user',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Delete user
   */
  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete user' })
  @ApiResponse({
    status: 200,
    description: 'User deleted successfully'
  })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: User
  ): Promise<{ message: string }> {
    try {
      this.logger.log(`Deleting user with ID: ${id}`);
      
      const user = await this.userService.findOne(id);
      if (!user) {
        throw new HttpException(
          `User with ID ${id} not found`,
          HttpStatus.NOT_FOUND
        );
      }

      // Prevent self-deletion
      if (currentUser.id === id) {
        throw new HttpException(
          'Cannot delete your own account',
          HttpStatus.BAD_REQUEST
        );
      }

      await this.userService.remove(id);
      
      this.logger.log(`User ${id} deleted successfully`);
      return { message: 'User deleted successfully' };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      this.logger.error(`Failed to delete user ${id}: ${error.message}`, error.stack);
      throw new HttpException(
        'Failed to delete user',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}

// DTO Examples
import {
  IsEmail,
  IsString,
  IsOptional,
  IsEnum,
  MinLength,
  MaxLength,
  IsInt,
  Min,
  Max
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export class CreateUserDto {
  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString({ message: 'Name must be a string' })
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  @MaxLength(50, { message: 'Name must not exceed 50 characters' })
  name: string;

  @ApiProperty({ example: 'SecurePassword123!' })
  @IsString({ message: 'Password must be a string' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @ApiPropertyOptional({ example: 'user', enum: ['admin', 'user'] })
  @IsOptional()
  @IsEnum(['admin', 'user'], { message: 'Role must be either admin or user' })
  role?: string = 'user';
}

export class PaginationDto {
  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Page must be an integer' })
  @Min(1, { message: 'Page must be at least 1' })
  page: number = 1;

  @ApiPropertyOptional({ example: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit must be an integer' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit must not exceed 100' })
  limit: number = 10;
}
```

---

## 🎯 FINAL NESTJS SUMMARY (After All Changes Reviewed)

### 📋 COMPLIANCE SCORES
- **Dependency Injection**: [X/5] - Proper DI patterns, module organization, and provider configuration
- **Authentication & Authorization**: [X/5] - Guards, decorators, and security implementation
- **Validation & DTOs**: [X/5] - Class-validator usage, transformation, and error handling
- **Controller Design**: [X/5] - Route handling, decorators, and response patterns
- **Database Integration**: [X/5] - ORM usage, transactions, and query optimization
- **Security Assessment**: [LEVEL] - Input validation, authentication, secure patterns

### 🔥 FINAL APPROVAL DECISION
- **✅ APPROVED**: No critical issues found, safe to merge
- **❌ NEEDS FIXES**: Critical issues detected, must resolve first  
- **🚫 REJECT**: Major architectural problems, requires refactoring