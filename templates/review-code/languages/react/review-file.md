<!-- AIDA - AI Development Assistant v1.0.0 -->
<!-- Advanced AI-powered code review and analysis -->

# React Framework Review Template

## 🎯 React-Specific Review Guidelines

This template focuses specifically on React framework best practices, patterns, and common pitfalls. Use this for reviewing React components, hooks, context providers, and application architecture.

---

<!-- 
📝 NOTE: The following CRITICAL CHECKS section applies to REVIEW-FILE only.
These comprehensive checks are for complete file analysis, not incremental changes.
For PR/change reviews, use review-pr.md or review-changes.md templates.
-->

## ⚡ REACT CRITICAL CHECKS (Auto-FAIL if found)

**Scan EVERY line for these REACT-SPECIFIC CRITICAL issues:**

### 🚨 HOOKS VIOLATIONS:
- Using hooks inside loops, conditions, or nested functions
- Calling hooks after early returns
- Missing dependency arrays in useEffect/useCallback/useMemo
- Stale closures in useEffect without proper dependencies
- useState setters called during render phase
- useEffect without cleanup for subscriptions/timers
- Custom hooks not starting with 'use' prefix
- Hooks called conditionally or in nested functions
- useLayoutEffect used incorrectly causing layout thrashing
- Infinite loops in useEffect due to missing dependencies

### 🚨 COMPONENT DESIGN VIOLATIONS:
- Components mutating props directly
- Components with too many responsibilities (> 200 lines)
- Missing React.memo for expensive re-renders
- Keys missing or using array indices as keys
- Components not handling error boundaries
- Ref forwarding not implemented where needed
- Components not properly typed with TypeScript
- State lifted too high causing unnecessary re-renders
- Props drilling more than 2-3 levels deep
- Components tightly coupled to external dependencies

### 🚨 STATE MANAGEMENT VIOLATIONS:
- Direct state mutations instead of immutable updates
- useState for complex state that should use useReducer
- State updates not batched properly
- Race conditions in async state updates
- State not normalized for complex data structures
- Context overused for non-global state
- Redux/Zustand state mutations outside reducers/actions
- State updates causing unnecessary re-renders
- Local state when global state should be used
- Missing state persistence for critical data

### 🚨 PERFORMANCE VIOLATIONS:
- Missing React.memo for expensive components
- useCallback/useMemo without proper dependency arrays
- Expensive operations in render function
- Creating objects/functions during render
- Not code-splitting large components
- Images not optimized or lazy loaded
- Bundle size not optimized
- Unnecessary re-renders due to reference equality
- Event handlers recreated on every render
- Large lists without virtualization

### 🚨 SIDE EFFECTS VIOLATIONS:
- API calls directly in component body
- Side effects in render function
- Event listeners not cleaned up
- Timers/intervals not cleared
- Memory leaks from uncleaned subscriptions
- DOM manipulation outside useEffect/useLayoutEffect
- Global variables modified during render
- LocalStorage/SessionStorage accessed during SSR
- Network requests not cancelled on unmount
- Third-party integrations not properly cleaned up

### 🚨 ACCESSIBILITY VIOLATIONS:
- Missing alt attributes on images
- Form elements without proper labels
- Interactive elements without keyboard support
- Missing ARIA attributes for complex components
- Color as the only means of conveying information
- Focus management not implemented properly
- Screen reader announcements missing
- Tab order not logical
- Semantic HTML not used appropriately
- Contrast ratios not meeting WCAG standards

### 🚨 SECURITY VIOLATIONS:
- XSS vulnerabilities through dangerouslySetInnerHTML
- User input not sanitized before rendering
- API keys or secrets exposed in client code
- HTTPS not enforced for sensitive operations
- Authentication tokens stored insecurely
- CSRF protection not implemented
- File uploads not properly validated
- Third-party scripts not from trusted sources
- Content Security Policy not configured
- Sensitive data logged to console in production

### 🚨 ERROR HANDLING VIOLATIONS:
- Missing error boundaries for error catching
- Async errors not properly handled
- Network request errors not handled
- Promise rejections not caught
- Error states not displayed to users
- Fallback UI not implemented
- Error reporting not implemented
- Critical errors not logged
- Recovery mechanisms not implemented
- Error boundaries not granular enough

### 🚨 TESTING VIOLATIONS:
- Components not properly isolated in tests
- Mock implementations not matching real APIs
- Async behavior not properly tested
- User interactions not tested
- Error states not tested
- Accessibility not tested
- Performance characteristics not tested
- Integration between components not tested
- Test coverage below acceptable threshold
- Tests not maintainable or readable

### 🚨 ROUTING VIOLATIONS:
- Route components not lazy loaded
- Route parameters not validated
- Navigation state not preserved
- Back button functionality broken
- Deep linking not supported
- Route guards not implemented where needed
- Loading states not shown during route transitions
- Route-based code splitting not implemented
- URL state not synchronized with component state
- Route transitions not accessible

### 🚨 SPECIFIC PROJECT RULES:
<!-- ADD PROJECT-SPECIFIC RULES HERE - These will be checked alongside React rules -->
<!-- Additional project rules can be added here:
- Design system component usage patterns
- State management architecture (Redux, Zustand, Context)
- API integration patterns
- Authentication and authorization patterns
- Performance requirements
-->

---

## 🔍 React Code Analysis

### 1. **Component Architecture & Design Patterns**

#### 🧩 Component Composition
- **Single Responsibility**
  - Components focused on single concern?
  - Proper component decomposition?
  - Clear component boundaries?
  - Reusable component patterns?

#### ⚡ Modern React Patterns
- Hooks composition and reusability
- Component composition over inheritance
- Render props and children patterns
- Higher-order components usage

#### 🎯 Best Practice Implementation
```tsx
// Best Practice: Well-structured React component with TypeScript and proper patterns

import React, { 
  useState, 
  useEffect, 
  useCallback, 
  useMemo, 
  useRef,
  forwardRef,
  useImperativeHandle,
  type ReactNode,
  type ForwardedRef,
} from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/hooks/useNotifications'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useDebounce } from '@/hooks/useDebounce'
import { userAPI } from '@/api/userAPI'

import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { EmptyState } from '@/components/ui/EmptyState'
import { UserCard } from './components/UserCard'
import { UserForm } from './components/UserForm'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

import type { User, UserFilters, CreateUserData, UpdateUserData } from '@/types/user'

// Component props interface with proper typing
interface UserListProps {
  /** Initial filters to apply */
  initialFilters?: UserFilters
  /** Whether to show create user button */
  canCreate?: boolean
  /** Whether to show edit/delete actions */
  canEdit?: boolean
  /** Custom empty state message */
  emptyMessage?: string
  /** Custom error fallback component */
  errorFallback?: ReactNode
  /** Callback when user is selected */
  onUserSelect?: (user: User) => void
  /** Callback when user list changes */
  onUsersChange?: (users: User[]) => void
  /** Custom item renderer */
  renderUser?: (user: User, index: number) => ReactNode
  /** Additional CSS classes */
  className?: string
  /** Test ID for testing */
  'data-testid'?: string
}

// Ref interface for imperative actions
interface UserListRef {
  refresh: () => void
  clearFilters: () => void
  selectUser: (userId: string) => void
  createUser: () => void
}

// Main component with forwardRef for ref access
export const UserList = forwardRef<UserListRef, UserListProps>(
  function UserList(
    {
      initialFilters = {},
      canCreate = false,
      canEdit = false,
      emptyMessage = 'No users found',
      errorFallback,
      onUserSelect,
      onUsersChange,
      renderUser,
      className = '',
      'data-testid': testId = 'user-list',
    },
    ref: ForwardedRef<UserListRef>
  ) {
    // Auth context
    const { user: currentUser, hasPermission } = useAuth()
    const { addNotification } = useNotifications()
    const queryClient = useQueryClient()

    // Local state
    const [filters, setFilters] = useLocalStorage<UserFilters>('userListFilters', initialFilters)
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
    const [isCreating, setIsCreating] = useState(false)
    const [editingUser, setEditingUser] = useState<User | null>(null)
    const [deletingUserId, setDeletingUserId] = useState<string | null>(null)

    // Refs
    const listRef = useRef<HTMLDivElement>(null)
    const createFormRef = useRef<HTMLFormElement>(null)

    // Debounced search
    const debouncedSearchTerm = useDebounce(filters.search || '', 300)

    // Memoized query key
    const queryKey = useMemo(
      () => ['users', { ...filters, search: debouncedSearchTerm }],
      [filters, debouncedSearchTerm]
    )

    // Data fetching with React Query
    const {
      data: usersResponse,
      isLoading,
      error,
      refetch,
    } = useQuery({
      queryKey,
      queryFn: ({ signal }) => userAPI.getUsers({ ...filters, search: debouncedSearchTerm }, signal),
      keepPreviousData: true,
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: (failureCount, error) => {
        // Don't retry on 401/403 errors
        if (error instanceof Error && error.message.includes('401|403')) {
          return false
        }
        return failureCount < 3
      },
    })

    const users = usersResponse?.data || []

    // Mutations
    const createUserMutation = useMutation({
      mutationFn: (userData: CreateUserData) => userAPI.createUser(userData),
      onSuccess: (newUser) => {
        queryClient.invalidateQueries(['users'])
        setIsCreating(false)
        setSelectedUserId(newUser.id)
        addNotification({
          type: 'success',
          message: 'User created successfully',
        })
        onUsersChange?.(users)
      },
      onError: (error) => {
        addNotification({
          type: 'error',
          message: error instanceof Error ? error.message : 'Failed to create user',
        })
      },
    })

    const updateUserMutation = useMutation({
      mutationFn: ({ id, data }: { id: string; data: UpdateUserData }) =>
        userAPI.updateUser(id, data),
      onSuccess: (updatedUser) => {
        queryClient.invalidateQueries(['users'])
        setEditingUser(null)
        addNotification({
          type: 'success',
          message: 'User updated successfully',
        })
        onUsersChange?.(users)
      },
      onError: (error) => {
        addNotification({
          type: 'error',
          message: error instanceof Error ? error.message : 'Failed to update user',
        })
      },
    })

    const deleteUserMutation = useMutation({
      mutationFn: (userId: string) => userAPI.deleteUser(userId),
      onSuccess: () => {
        queryClient.invalidateQueries(['users'])
        setDeletingUserId(null)
        if (selectedUserId === deletingUserId) {
          setSelectedUserId(null)
        }
        addNotification({
          type: 'success',
          message: 'User deleted successfully',
        })
        onUsersChange?.(users)
      },
      onError: (error) => {
        setDeletingUserId(null)
        addNotification({
          type: 'error',
          message: error instanceof Error ? error.message : 'Failed to delete user',
        })
      },
    })

    // Computed values
    const canUserCreate = useMemo(
      () => canCreate && hasPermission('users:create'),
      [canCreate, hasPermission]
    )

    const canUserEdit = useMemo(
      () => canEdit && hasPermission('users:edit'),
      [canEdit, hasPermission]
    )

    const selectedUser = useMemo(
      () => users.find(user => user.id === selectedUserId) || null,
      [users, selectedUserId]
    )

    // Event handlers
    const handleUserSelect = useCallback((user: User) => {
      setSelectedUserId(user.id)
      onUserSelect?.(user)
    }, [onUserSelect])

    const handleCreateUser = useCallback(() => {
      if (!canUserCreate) return
      setIsCreating(true)
    }, [canUserCreate])

    const handleEditUser = useCallback((user: User) => {
      if (!canUserEdit) return
      setEditingUser(user)
    }, [canUserEdit])

    const handleDeleteUser = useCallback((user: User) => {
      if (!canUserEdit) return
      setDeletingUserId(user.id)
    }, [canUserEdit])

    const handleCreateSubmit = useCallback(async (userData: CreateUserData) => {
      await createUserMutation.mutateAsync(userData)
    }, [createUserMutation])

    const handleEditSubmit = useCallback(async (userData: UpdateUserData) => {
      if (!editingUser) return
      await updateUserMutation.mutateAsync({ id: editingUser.id, data: userData })
    }, [editingUser, updateUserMutation])

    const handleDeleteConfirm = useCallback(async () => {
      if (!deletingUserId) return
      await deleteUserMutation.mutateAsync(deletingUserId)
    }, [deletingUserId, deleteUserMutation])

    const handleFiltersChange = useCallback((newFilters: Partial<UserFilters>) => {
      setFilters(prev => ({ ...prev, ...newFilters }))
    }, [setFilters])

    const handleClearFilters = useCallback(() => {
      setFilters({})
    }, [setFilters])

    // Effects
    useEffect(() => {
      // Notify parent when users change
      onUsersChange?.(users)
    }, [users, onUsersChange])

    useEffect(() => {
      // Auto-select first user if none selected
      if (users.length > 0 && !selectedUserId) {
        setSelectedUserId(users[0].id)
      }
    }, [users, selectedUserId])

    // Imperative handle for ref
    useImperativeHandle(ref, () => ({
      refresh: () => {
        refetch()
      },
      clearFilters: handleClearFilters,
      selectUser: (userId: string) => {
        setSelectedUserId(userId)
      },
      createUser: handleCreateUser,
    }), [refetch, handleClearFilters, handleCreateUser])

    // Error fallback component
    const errorFallbackComponent = errorFallback || (
      <ErrorMessage
        error={error instanceof Error ? error : new Error('Failed to load users')}
        onRetry={refetch}
      />
    )

    // Loading state
    if (isLoading && users.length === 0) {
      return (
        <div className={`user-list ${className}`} data-testid={testId}>
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        </div>
      )
    }

    // Error state
    if (error && users.length === 0) {
      return (
        <div className={`user-list ${className}`} data-testid={testId}>
          <div className="flex items-center justify-center py-12">
            {errorFallbackComponent}
          </div>
        </div>
      )
    }

    // Empty state
    if (!isLoading && users.length === 0) {
      return (
        <div className={`user-list ${className}`} data-testid={testId}>
          <div className="flex items-center justify-center py-12">
            <EmptyState
              icon="users"
              title="No Users Found"
              description={emptyMessage}
              action={canUserCreate ? {
                label: 'Create User',
                onClick: handleCreateUser,
              } : undefined}
            />
          </div>
        </div>
      )
    }

    return (
      <div className={`user-list ${className}`} data-testid={testId}>
        {/* Header with filters and actions */}
        <div className="user-list-header">
          <UserListFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onClearFilters={handleClearFilters}
          />
          
          {canUserCreate && (
            <button
              type="button"
              onClick={handleCreateUser}
              className="btn btn-primary"
              data-testid="create-user-button"
            >
              Create User
            </button>
          )}
        </div>

        {/* User list */}
        <div ref={listRef} className="user-list-content">
          {users.map((user, index) => {
            if (renderUser) {
              return (
                <div key={user.id} data-testid={`user-item-${user.id}`}>
                  {renderUser(user, index)}
                </div>
              )
            }

            return (
              <UserCard
                key={user.id}
                user={user}
                isSelected={user.id === selectedUserId}
                canEdit={canUserEdit}
                onSelect={() => handleUserSelect(user)}
                onEdit={() => handleEditUser(user)}
                onDelete={() => handleDeleteUser(user)}
                data-testid={`user-card-${user.id}`}
              />
            )
          })}
        </div>

        {/* Loading overlay for updates */}
        {isLoading && users.length > 0 && (
          <div className="user-list-loading-overlay">
            <LoadingSpinner size="sm" />
          </div>
        )}

        {/* Create user modal */}
        {isCreating && (
          <UserForm
            mode="create"
            onSubmit={handleCreateSubmit}
            onCancel={() => setIsCreating(false)}
            isLoading={createUserMutation.isLoading}
            ref={createFormRef}
          />
        )}

        {/* Edit user modal */}
        {editingUser && (
          <UserForm
            mode="edit"
            initialData={editingUser}
            onSubmit={handleEditSubmit}
            onCancel={() => setEditingUser(null)}
            isLoading={updateUserMutation.isLoading}
          />
        )}

        {/* Delete confirmation dialog */}
        {deletingUserId && (
          <ConfirmDialog
            title="Delete User"
            message="Are you sure you want to delete this user? This action cannot be undone."
            confirmLabel="Delete"
            confirmVariant="danger"
            onConfirm={handleDeleteConfirm}
            onCancel={() => setDeletingUserId(null)}
            isLoading={deleteUserMutation.isLoading}
          />
        )}
      </div>
    )
  }
)

// Error boundary wrapper component
export const UserListWithErrorBoundary: React.FC<UserListProps> = (props) => {
  return (
    <ErrorBoundary
      FallbackComponent={({ error, resetErrorBoundary }) => (
        <div className="error-boundary">
          <ErrorMessage
            error={error}
            onRetry={resetErrorBoundary}
            title="Something went wrong with the user list"
          />
        </div>
      )}
      onError={(error, errorInfo) => {
        console.error('UserList Error:', error, errorInfo)
        // Report to error tracking service
      }}
    >
      <UserList {...props} />
    </ErrorBoundary>
  )
}

// Display name for debugging
UserList.displayName = 'UserList'
UserListWithErrorBoundary.displayName = 'UserListWithErrorBoundary'

// Default export with error boundary
export default UserListWithErrorBoundary
```

#### 🎣 Custom Hooks Patterns
```typescript
// Best Practice: Reusable custom hooks with proper typing and error handling

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { DependencyList } from 'react'

// Auth hook with comprehensive functionality
export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Memoized auth state
  const authState = useMemo(() => ({
    isAuthenticated: user !== null,
    isLoading,
    error,
    user,
  }), [user, isLoading, error])

  // Permission checking
  const hasPermission = useCallback((permission: string): boolean => {
    if (!user) return false
    return user.permissions.includes(permission) || user.roles.includes('admin')
  }, [user])

  const hasRole = useCallback((role: string): boolean => {
    if (!user) return false
    return user.roles.includes(role)
  }, [user])

  // Auth actions
  const login = useCallback(async (credentials: LoginCredentials): Promise<User | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await authAPI.login(credentials)
      setUser(response.user)
      
      // Store token securely
      tokenManager.setToken(response.token)
      
      return response.user
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Login failed')
      setError(error)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true)

    try {
      await authAPI.logout()
    } catch (err) {
      // Log error but don't prevent logout
      console.warn('Logout API call failed:', err)
    } finally {
      setUser(null)
      tokenManager.clearToken()
      setIsLoading(false)
    }
  }, [])

  const refreshUser = useCallback(async (): Promise<User | null> => {
    const token = tokenManager.getToken()
    if (!token) {
      setUser(null)
      setIsLoading(false)
      return null
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await authAPI.getCurrentUser()
      setUser(response.user)
      return response.user
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to refresh user')
      setError(error)
      setUser(null)
      tokenManager.clearToken()
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Initialize auth state
  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  return {
    ...authState,
    hasPermission,
    hasRole,
    login,
    logout,
    refreshUser,
  }
}

// Local storage hook with SSR support and type safety
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options: {
    serializer?: {
      read: (value: string) => T
      write: (value: T) => string
    }
    syncAcrossTabs?: boolean
  } = {}
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const {
    serializer = {
      read: JSON.parse,
      write: JSON.stringify,
    },
    syncAcrossTabs = true,
  } = options

  // State to store our value with lazy initialization
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue
    }

    try {
      const item = window.localStorage.getItem(key)
      return item ? serializer.read(item) : initialValue
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error)
      return initialValue
    }
  })

  // Return a wrapped version of useState's setter function that persists the new value to localStorage
  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    try {
      // Allow value to be a function so we have the same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value
      
      // Save state
      setStoredValue(valueToStore)
      
      // Save to local storage
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, serializer.write(valueToStore))
      }
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error)
    }
  }, [key, storedValue, serializer])

  // Remove from localStorage
  const removeValue = useCallback(() => {
    try {
      setStoredValue(initialValue)
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key)
      }
    } catch (error) {
      console.warn(`Error removing localStorage key "${key}":`, error)
    }
  }, [key, initialValue])

  // Sync across tabs
  useEffect(() => {
    if (!syncAcrossTabs || typeof window === 'undefined') return

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key !== key || e.storageArea !== localStorage) return

      try {
        if (e.newValue === null) {
          setStoredValue(initialValue)
        } else {
          setStoredValue(serializer.read(e.newValue))
        }
      } catch (error) {
        console.warn(`Error syncing localStorage key "${key}":`, error)
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [key, initialValue, serializer, syncAcrossTabs])

  return [storedValue, setValue, removeValue]
}

// Debounce hook for performance optimization
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// Previous hook for comparing previous values
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>()
  useEffect(() => {
    ref.current = value
  })
  return ref.current
}

// Async hook for handling async operations
export function useAsync<T, E = Error>(
  asyncFunction: () => Promise<T>,
  dependencies: DependencyList = []
) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<E | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const execute = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await asyncFunction()
      setData(result)
      return result
    } catch (err) {
      setError(err as E)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, dependencies)

  useEffect(() => {
    execute()
  }, [execute])

  return { data, error, isLoading, execute }
}

// Event listener hook
export function useEventListener<T extends keyof WindowEventMap>(
  eventType: T,
  handler: (event: WindowEventMap[T]) => void,
  element: Window | Document | HTMLElement = window,
  options?: boolean | AddEventListenerOptions
) {
  const savedHandler = useRef(handler)

  useEffect(() => {
    savedHandler.current = handler
  }, [handler])

  useEffect(() => {
    if (!element?.addEventListener) return

    const eventListener = (event: Event) => savedHandler.current(event as WindowEventMap[T])
    element.addEventListener(eventType, eventListener, options)

    return () => {
      element.removeEventListener(eventType, eventListener, options)
    }
  }, [eventType, element, options])
}

// Intersection observer hook
export function useIntersectionObserver(
  elementRef: React.RefObject<Element>,
  options: IntersectionObserverInit = {},
  freezeOnceVisible = false
) {
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null)

  const frozen = entry?.isIntersecting && freezeOnceVisible

  const updateEntry = ([entry]: IntersectionObserverEntry[]) => {
    setEntry(entry)
  }

  useEffect(() => {
    const node = elementRef?.current
    const hasIOSupport = !!window.IntersectionObserver

    if (!hasIOSupport || frozen || !node) return

    const observerParams = { threshold: 0, ...options }
    const observer = new IntersectionObserver(updateEntry, observerParams)

    observer.observe(node)

    return () => observer.disconnect()
  }, [elementRef, options, frozen])

  return entry
}

// Media query hook
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const media = window.matchMedia(query)
    setMatches(media.matches)

    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches)
    }

    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [query])

  return matches
}

// Copy to clipboard hook
export function useClipboard(timeout = 2000) {
  const [isCopied, setIsCopied] = useState(false)

  const copy = useCallback(async (text: string) => {
    if (!navigator?.clipboard) {
      console.warn('Clipboard not supported')
      return false
    }

    try {
      await navigator.clipboard.writeText(text)
      setIsCopied(true)
      return true
    } catch (error) {
      console.warn('Copy failed', error)
      setIsCopied(false)
      return false
    }
  }, [])

  useEffect(() => {
    if (isCopied) {
      const timer = setTimeout(() => setIsCopied(false), timeout)
      return () => clearTimeout(timer)
    }
  }, [isCopied, timeout])

  return { isCopied, copy }
}

// Form validation hook
export function useFormValidation<T extends Record<string, any>>(
  initialValues: T,
  validationRules: Record<keyof T, ValidationRule[]>
) {
  const [values, setValues] = useState<T>(initialValues)
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({})
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({})

  interface ValidationRule {
    test: (value: any) => boolean
    message: string
  }

  const validateField = useCallback((name: keyof T, value: any) => {
    const fieldRules = validationRules[name]
    if (!fieldRules) return ''

    for (const rule of fieldRules) {
      if (!rule.test(value)) {
        return rule.message
      }
    }
    return ''
  }, [validationRules])

  const validateForm = useCallback(() => {
    const newErrors: Partial<Record<keyof T, string>> = {}
    let isValid = true

    for (const [name, value] of Object.entries(values)) {
      const error = validateField(name as keyof T, value)
      if (error) {
        newErrors[name as keyof T] = error
        isValid = false
      }
    }

    setErrors(newErrors)
    return isValid
  }, [values, validateField])

  const handleChange = useCallback((name: keyof T, value: any) => {
    setValues(prev => ({ ...prev, [name]: value }))
    
    if (touched[name]) {
      const error = validateField(name, value)
      setErrors(prev => ({ ...prev, [name]: error || undefined }))
    }
  }, [touched, validateField])

  const handleBlur = useCallback((name: keyof T) => {
    setTouched(prev => ({ ...prev, [name]: true }))
    
    const error = validateField(name, values[name])
    setErrors(prev => ({ ...prev, [name]: error || undefined }))
  }, [values, validateField])

  const reset = useCallback(() => {
    setValues(initialValues)
    setErrors({})
    setTouched({})
  }, [initialValues])

  return {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    validateForm,
    reset,
    isValid: Object.keys(errors).length === 0,
  }
}
```

---

### 2. **State Management & Data Flow**

#### 🏪 Context & Global State
```tsx
// Best Practice: Well-structured React Context with TypeScript

import React, { 
  createContext, 
  useContext, 
  useReducer, 
  useCallback, 
  useMemo,
  type ReactNode,
  type Dispatch,
} from 'react'

// Theme context for global theming
interface ThemeState {
  theme: 'light' | 'dark' | 'system'
  primaryColor: string
  fontSize: 'small' | 'medium' | 'large'
  animations: boolean
}

type ThemeAction =
  | { type: 'SET_THEME'; payload: 'light' | 'dark' | 'system' }
  | { type: 'SET_PRIMARY_COLOR'; payload: string }
  | { type: 'SET_FONT_SIZE'; payload: 'small' | 'medium' | 'large' }
  | { type: 'TOGGLE_ANIMATIONS' }
  | { type: 'RESET_THEME' }

interface ThemeContextType {
  state: ThemeState
  dispatch: Dispatch<ThemeAction>
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  setPrimaryColor: (color: string) => void
  setFontSize: (size: 'small' | 'medium' | 'large') => void
  toggleAnimations: () => void
  resetTheme: () => void
  isDark: boolean
}

const initialThemeState: ThemeState = {
  theme: 'system',
  primaryColor: '#3b82f6',
  fontSize: 'medium',
  animations: true,
}

const themeReducer = (state: ThemeState, action: ThemeAction): ThemeState => {
  switch (action.type) {
    case 'SET_THEME':
      return { ...state, theme: action.payload }
    case 'SET_PRIMARY_COLOR':
      return { ...state, primaryColor: action.payload }
    case 'SET_FONT_SIZE':
      return { ...state, fontSize: action.payload }
    case 'TOGGLE_ANIMATIONS':
      return { ...state, animations: !state.animations }
    case 'RESET_THEME':
      return initialThemeState
    default:
      return state
  }
}

const ThemeContext = createContext<ThemeContextType | null>(null)

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

interface ThemeProviderProps {
  children: ReactNode
  initialState?: Partial<ThemeState>
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ 
  children, 
  initialState = {} 
}) => {
  const [state, dispatch] = useReducer(themeReducer, {
    ...initialThemeState,
    ...initialState,
  })

  // Action creators
  const setTheme = useCallback((theme: 'light' | 'dark' | 'system') => {
    dispatch({ type: 'SET_THEME', payload: theme })
  }, [])

  const setPrimaryColor = useCallback((color: string) => {
    dispatch({ type: 'SET_PRIMARY_COLOR', payload: color })
  }, [])

  const setFontSize = useCallback((size: 'small' | 'medium' | 'large') => {
    dispatch({ type: 'SET_FONT_SIZE', payload: size })
  }, [])

  const toggleAnimations = useCallback(() => {
    dispatch({ type: 'TOGGLE_ANIMATIONS' })
  }, [])

  const resetTheme = useCallback(() => {
    dispatch({ type: 'RESET_THEME' })
  }, [])

  // Computed values
  const isDark = useMemo(() => {
    if (state.theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return state.theme === 'dark'
  }, [state.theme])

  // Context value with memoization
  const contextValue = useMemo(() => ({
    state,
    dispatch,
    setTheme,
    setPrimaryColor,
    setFontSize,
    toggleAnimations,
    resetTheme,
    isDark,
  }), [state, setTheme, setPrimaryColor, setFontSize, toggleAnimations, resetTheme, isDark])

  // Apply theme to document
  React.useEffect(() => {
    const root = document.documentElement
    
    // Set CSS custom properties
    root.style.setProperty('--primary-color', state.primaryColor)
    root.classList.toggle('dark', isDark)
    root.classList.toggle('light', !isDark)
    root.classList.toggle('animations-disabled', !state.animations)
    
    // Set font size class
    root.className = root.className.replace(/font-size-\w+/, '')
    root.classList.add(`font-size-${state.fontSize}`)
  }, [state, isDark])

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  )
}

// Shopping cart context with complex state
interface CartItem {
  id: string
  productId: string
  name: string
  price: number
  quantity: number
  variant?: string
  image?: string
}

interface CartState {
  items: CartItem[]
  isOpen: boolean
  lastUpdated: number
}

type CartAction =
  | { type: 'ADD_ITEM'; payload: Omit<CartItem, 'quantity'> & { quantity?: number } }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'UPDATE_QUANTITY'; payload: { id: string; quantity: number } }
  | { type: 'CLEAR_CART' }
  | { type: 'TOGGLE_CART' }
  | { type: 'SET_CART_OPEN'; payload: boolean }
  | { type: 'LOAD_CART'; payload: CartItem[] }

interface CartContextType {
  state: CartState
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void
  removeItem: (itemId: string) => void
  updateQuantity: (itemId: string, quantity: number) => void
  clearCart: () => void
  toggleCart: () => void
  setCartOpen: (isOpen: boolean) => void
  totalItems: number
  totalPrice: number
  getItem: (itemId: string) => CartItem | undefined
}

const initialCartState: CartState = {
  items: [],
  isOpen: false,
  lastUpdated: Date.now(),
}

const cartReducer = (state: CartState, action: CartAction): CartState => {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existingItem = state.items.find(item => 
        item.productId === action.payload.productId && 
        item.variant === action.payload.variant
      )

      if (existingItem) {
        return {
          ...state,
          items: state.items.map(item =>
            item.id === existingItem.id
              ? { ...item, quantity: item.quantity + (action.payload.quantity || 1) }
              : item
          ),
          lastUpdated: Date.now(),
        }
      }

      const newItem: CartItem = {
        ...action.payload,
        id: crypto.randomUUID(),
        quantity: action.payload.quantity || 1,
      }

      return {
        ...state,
        items: [...state.items, newItem],
        lastUpdated: Date.now(),
      }
    }

    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter(item => item.id !== action.payload),
        lastUpdated: Date.now(),
      }

    case 'UPDATE_QUANTITY': {
      if (action.payload.quantity <= 0) {
        return cartReducer(state, { type: 'REMOVE_ITEM', payload: action.payload.id })
      }

      return {
        ...state,
        items: state.items.map(item =>
          item.id === action.payload.id
            ? { ...item, quantity: action.payload.quantity }
            : item
        ),
        lastUpdated: Date.now(),
      }
    }

    case 'CLEAR_CART':
      return {
        ...state,
        items: [],
        lastUpdated: Date.now(),
      }

    case 'TOGGLE_CART':
      return {
        ...state,
        isOpen: !state.isOpen,
      }

    case 'SET_CART_OPEN':
      return {
        ...state,
        isOpen: action.payload,
      }

    case 'LOAD_CART':
      return {
        ...state,
        items: action.payload,
        lastUpdated: Date.now(),
      }

    default:
      return state
  }
}

const CartContext = createContext<CartContextType | null>(null)

export const useCart = () => {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}

interface CartProviderProps {
  children: ReactNode
  persistKey?: string
}

export const CartProvider: React.FC<CartProviderProps> = ({ 
  children, 
  persistKey = 'shopping-cart' 
}) => {
  // Load initial state from localStorage
  const [state, dispatch] = useReducer(cartReducer, initialCartState, (initial) => {
    if (typeof window === 'undefined') return initial

    try {
      const stored = localStorage.getItem(persistKey)
      if (stored) {
        const parsed = JSON.parse(stored)
        return { ...initial, items: parsed.items || [] }
      }
    } catch (error) {
      console.warn('Failed to load cart from localStorage:', error)
    }
    return initial
  })

  // Persist to localStorage
  React.useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      localStorage.setItem(persistKey, JSON.stringify({ items: state.items }))
    } catch (error) {
      console.warn('Failed to save cart to localStorage:', error)
    }
  }, [state.items, persistKey])

  // Action creators
  const addItem = useCallback((item: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
    dispatch({ type: 'ADD_ITEM', payload: item })
  }, [])

  const removeItem = useCallback((itemId: string) => {
    dispatch({ type: 'REMOVE_ITEM', payload: itemId })
  }, [])

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { id: itemId, quantity } })
  }, [])

  const clearCart = useCallback(() => {
    dispatch({ type: 'CLEAR_CART' })
  }, [])

  const toggleCart = useCallback(() => {
    dispatch({ type: 'TOGGLE_CART' })
  }, [])

  const setCartOpen = useCallback((isOpen: boolean) => {
    dispatch({ type: 'SET_CART_OPEN', payload: isOpen })
  }, [])

  // Computed values
  const totalItems = useMemo(() => 
    state.items.reduce((total, item) => total + item.quantity, 0), 
    [state.items]
  )

  const totalPrice = useMemo(() => 
    state.items.reduce((total, item) => total + (item.price * item.quantity), 0), 
    [state.items]
  )

  const getItem = useCallback((itemId: string) => 
    state.items.find(item => item.id === itemId), 
    [state.items]
  )

  // Context value
  const contextValue = useMemo(() => ({
    state,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    toggleCart,
    setCartOpen,
    totalItems,
    totalPrice,
    getItem,
  }), [state, addItem, removeItem, updateQuantity, clearCart, toggleCart, setCartOpen, totalItems, totalPrice, getItem])

  return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  )
}
```

---

### 3. **Performance Optimization**

#### ⚡ React Performance Patterns
```tsx
// Best Practice: Performance-optimized React components

import React, { 
  memo, 
  useMemo, 
  useCallback, 
  useState, 
  useEffect,
  lazy,
  Suspense,
  type ComponentType,
} from 'react'
import { FixedSizeList as List } from 'react-window'
import { ErrorBoundary } from 'react-error-boundary'

// Memoized list item component
interface ListItemProps {
  item: {
    id: string
    name: string
    description: string
    price: number
    category: string
    updatedAt: string
  }
  isSelected: boolean
  onSelect: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

const ListItem = memo<ListItemProps>(function ListItem({
  item,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}) {
  // Memoized click handlers to prevent re-renders
  const handleSelect = useCallback(() => {
    onSelect(item.id)
  }, [item.id, onSelect])

  const handleEdit = useCallback(() => {
    onEdit(item.id)
  }, [item.id, onEdit])

  const handleDelete = useCallback(() => {
    onDelete(item.id)
  }, [item.id, onDelete])

  // Memoized derived values
  const formattedPrice = useMemo(() => 
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(item.price),
    [item.price]
  )

  const formattedDate = useMemo(() => 
    new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(item.updatedAt)),
    [item.updatedAt]
  )

  return (
    <div 
      className={`list-item ${isSelected ? 'selected' : ''}`}
      onClick={handleSelect}
    >
      <div className="item-content">
        <h3 className="item-name">{item.name}</h3>
        <p className="item-description">{item.description}</p>
        <div className="item-meta">
          <span className="item-price">{formattedPrice}</span>
          <span className="item-category">{item.category}</span>
          <span className="item-date">{formattedDate}</span>
        </div>
      </div>
      
      <div className="item-actions">
        <button
          type="button"
          onClick={handleEdit}
          className="btn btn-sm btn-secondary"
          aria-label={`Edit ${item.name}`}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="btn btn-sm btn-danger"
          aria-label={`Delete ${item.name}`}
        >
          Delete
        </button>
      </div>
    </div>
  )
})

// Virtual list component for performance
interface VirtualizedListProps {
  items: ListItemProps['item'][]
  selectedId?: string
  onItemSelect: (id: string) => void
  onItemEdit: (id: string) => void
  onItemDelete: (id: string) => void
  height?: number
  itemHeight?: number
}

const VirtualizedList = memo<VirtualizedListProps>(function VirtualizedList({
  items,
  selectedId,
  onItemSelect,
  onItemEdit,
  onItemDelete,
  height = 600,
  itemHeight = 120,
}) {
  // Memoized row renderer
  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const item = items[index]
    
    return (
      <div style={style}>
        <ListItem
          item={item}
          isSelected={item.id === selectedId}
          onSelect={onItemSelect}
          onEdit={onItemEdit}
          onDelete={onItemDelete}
        />
      </div>
    )
  }, [items, selectedId, onItemSelect, onItemEdit, onItemDelete])

  return (
    <List
      height={height}
      itemCount={items.length}
      itemSize={itemHeight}
      itemData={items}
      className="virtualized-list"
    >
      {Row}
    </List>
  )
})

// Lazy loaded components with error boundaries
const LazyModal = lazy(() => import('@/components/Modal'))
const LazyChart = lazy(() => import('@/components/Chart'))
const LazyMap = lazy(() => import('@/components/Map'))

// HOC for performance monitoring
function withPerformanceMonitoring<P extends object>(
  Component: ComponentType<P>,
  componentName: string
) {
  return memo(function PerformanceMonitoredComponent(props: P) {
    useEffect(() => {
      const startTime = performance.now()
      
      return () => {
        const endTime = performance.now()
        const renderTime = endTime - startTime
        
        if (renderTime > 16) { // Longer than one frame
          console.warn(`${componentName} rendered in ${renderTime}ms`)
        }
      }
    })

    return <Component {...props} />
  })
}

// Main optimized component
interface OptimizedComponentProps {
  items: ListItemProps['item'][]
  filters: {
    search: string
    category: string
    priceRange: [number, number]
  }
  onFiltersChange: (filters: any) => void
}

export const OptimizedComponent = memo<OptimizedComponentProps>(
  function OptimizedComponent({
    items,
    filters,
    onFiltersChange,
  }) {
    const [selectedId, setSelectedId] = useState<string>()
    const [showModal, setShowModal] = useState(false)
    const [showChart, setShowChart] = useState(false)

    // Memoized filtered items with complex filtering logic
    const filteredItems = useMemo(() => {
      let filtered = items

      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        filtered = filtered.filter(item =>
          item.name.toLowerCase().includes(searchLower) ||
          item.description.toLowerCase().includes(searchLower)
        )
      }

      // Category filter
      if (filters.category && filters.category !== 'all') {
        filtered = filtered.filter(item => item.category === filters.category)
      }

      // Price range filter
      filtered = filtered.filter(item =>
        item.price >= filters.priceRange[0] && item.price <= filters.priceRange[1]
      )

      // Sort by name
      filtered.sort((a, b) => a.name.localeCompare(b.name))

      return filtered
    }, [items, filters])

    // Memoized statistics
    const statistics = useMemo(() => {
      const totalItems = filteredItems.length
      const averagePrice = totalItems > 0 
        ? filteredItems.reduce((sum, item) => sum + item.price, 0) / totalItems
        : 0
      const categories = new Set(filteredItems.map(item => item.category)).size

      return {
        totalItems,
        averagePrice,
        categories,
      }
    }, [filteredItems])

    // Stable callback references
    const handleItemSelect = useCallback((id: string) => {
      setSelectedId(id)
    }, [])

    const handleItemEdit = useCallback((id: string) => {
      setSelectedId(id)
      setShowModal(true)
    }, [])

    const handleItemDelete = useCallback((id: string) => {
      // Optimistic update - remove from UI immediately
      onFiltersChange({
        ...filters,
        // Trigger parent to remove item
        deleteId: id,
      })
    }, [filters, onFiltersChange])

    const handleSearchChange = useCallback((search: string) => {
      onFiltersChange({
        ...filters,
        search,
      })
    }, [filters, onFiltersChange])

    const handleCategoryChange = useCallback((category: string) => {
      onFiltersChange({
        ...filters,
        category,
      })
    }, [filters, onFiltersChange])

    const handlePriceRangeChange = useCallback((priceRange: [number, number]) => {
      onFiltersChange({
        ...filters,
        priceRange,
      })
    }, [filters, onFiltersChange])

    return (
      <div className="optimized-component">
        {/* Filters section */}
        <div className="filters-section">
          <SearchInput
            value={filters.search}
            onChange={handleSearchChange}
            placeholder="Search items..."
            debounceMs={300}
          />
          
          <CategorySelect
            value={filters.category}
            onChange={handleCategoryChange}
            options={['all', 'electronics', 'clothing', 'books']}
          />
          
          <PriceRangeSlider
            value={filters.priceRange}
            onChange={handlePriceRangeChange}
            min={0}
            max={1000}
          />
        </div>

        {/* Statistics */}
        <div className="statistics">
          <StatCard title="Total Items" value={statistics.totalItems} />
          <StatCard 
            title="Average Price" 
            value={`$${statistics.averagePrice.toFixed(2)}`} 
          />
          <StatCard title="Categories" value={statistics.categories} />
        </div>

        {/* Main content */}
        <div className="main-content">
          {/* Items list with virtualization */}
          <div className="items-section">
            <h2>Items ({filteredItems.length})</h2>
            
            {filteredItems.length > 100 ? (
              <VirtualizedList
                items={filteredItems}
                selectedId={selectedId}
                onItemSelect={handleItemSelect}
                onItemEdit={handleItemEdit}
                onItemDelete={handleItemDelete}
              />
            ) : (
              <div className="simple-list">
                {filteredItems.map(item => (
                  <ListItem
                    key={item.id}
                    item={item}
                    isSelected={item.id === selectedId}
                    onSelect={handleItemSelect}
                    onEdit={handleItemEdit}
                    onDelete={handleItemDelete}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Side panel */}
          <div className="side-panel">
            <button
              type="button"
              onClick={() => setShowChart(!showChart)}
              className="btn btn-primary"
            >
              {showChart ? 'Hide' : 'Show'} Chart
            </button>

            {/* Lazy loaded chart */}
            {showChart && (
              <Suspense fallback={<div>Loading chart...</div>}>
                <ErrorBoundary
                  fallback={<div>Chart failed to load</div>}
                  onError={(error) => console.error('Chart error:', error)}
                >
                  <LazyChart data={filteredItems} />
                </ErrorBoundary>
              </Suspense>
            )}
          </div>
        </div>

        {/* Modal */}
        {showModal && (
          <Suspense fallback={<div>Loading modal...</div>}>
            <LazyModal
              isOpen={showModal}
              onClose={() => setShowModal(false)}
              title="Edit Item"
            >
              <p>Edit item with ID: {selectedId}</p>
            </LazyModal>
          </Suspense>
        )}
      </div>
    )
  }
)

// Performance monitoring HOC usage
export const MonitoredOptimizedComponent = withPerformanceMonitoring(
  OptimizedComponent,
  'OptimizedComponent'
)

// Additional performance utilities
export const useOptimizedSelector = <T, R>(
  selector: (state: T) => R,
  state: T,
  dependencies: any[] = []
): R => {
  return useMemo(() => selector(state), [state, ...dependencies])
}

export const useStableCallback = <T extends (...args: any[]) => any>(
  callback: T,
  dependencies: any[]
): T => {
  return useCallback(callback, dependencies)
}

export const useDeepMemo = <T>(value: T, dependencies: any[]): T => {
  return useMemo(() => value, dependencies)
}
```

---

## 📊 React Health Metrics

### Framework Compliance
- **Hooks Implementation**: ⭐⭐⭐⭐⭐ (X/5)
- **Component Architecture**: ⭐⭐⭐⭐⭐ (X/5)
- **Performance Optimization**: ⭐⭐⭐⭐⭐ (X/5)
- **State Management**: ⭐⭐⭐⭐⭐ (X/5)
- **Developer Experience**: ⭐⭐⭐⭐⭐ (X/5)

### Overall React Score: ⭐⭐⭐⭐⭐ (X/10)

---

## 🎯 React-Specific Action Items

### 🔴 Critical (Hooks/Performance)
1. [ ] Fix hooks rules violations and dependency arrays
2. [ ] Add React.memo to expensive components
3. [ ] Implement proper error boundaries
4. [ ] Fix XSS vulnerabilities in dangerouslySetInnerHTML
5. [ ] Add proper accessibility attributes and ARIA labels

### 🟡 Important (Best Practices)
1. [ ] Implement proper component composition patterns
2. [ ] Add comprehensive PropTypes or TypeScript definitions
3. [ ] Optimize performance with useMemo/useCallback
4. [ ] Implement proper state management architecture
5. [ ] Add comprehensive testing coverage

### 🟢 Improvements (Code Quality)
1. [ ] Add comprehensive TypeScript typing
2. [ ] Implement proper code splitting and lazy loading
3. [ ] Add accessibility testing and WCAG compliance
4. [ ] Optimize bundle size and performance monitoring
5. [ ] Add proper documentation and Storybook stories

---

## 💡 React Upgrade Recommendations

### Migration Opportunities
- React 18+ features (concurrent rendering, automatic batching)
- React Server Components for improved SSR
- Enhanced TypeScript support with better inference
- Improved developer tools and profiling capabilities
- Better testing utilities with React Testing Library v13+
- Enhanced performance with React DevTools Profiler

### Performance Improvements
- Code splitting with React.lazy and Suspense
- Virtual scrolling for large datasets
- Bundle analysis and tree shaking optimization
- Image optimization and lazy loading
- Service workers for offline capabilities
- Performance monitoring and Core Web Vitals tracking