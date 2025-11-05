<!-- AIDA - AI Development Assistant v1.0.0 -->
<!-- Advanced AI-powered code review and analysis -->

# Vue.js Framework Review Template

## 🎯 Vue.js-Specific Review Guidelines

This template focuses specifically on Vue.js framework best practices, patterns, and common pitfalls. Use this for reviewing Vue.js components, composables, stores, and configuration files.

🎯 REVIEW PRINCIPLES:
- ONLY flag issues that violate the specific rules in the template
- If code follows template guidelines, it's acceptable - don't force changes
- Focus on actual violations, not subjective preferences

---

<!-- 
📝 NOTE: The following CRITICAL CHECKS section applies to REVIEW-FILE only.
These comprehensive checks are for complete file analysis, not incremental changes.
For PR/change reviews, use review-pr.md or review-changes.md templates.
-->

## ⚡ VUE.JS CRITICAL CHECKS (Auto-FAIL if found)

**Scan EVERY line for these VUE.JS-SPECIFIC CRITICAL issues:**

{{REVIEW_BASE}}

### 🚨 TESTING VIOLATIONS:
- Components not properly isolated in tests
- Test utils not using Vue Test Utils properly
- Async behavior not properly tested
- Store interactions not mocked correctly
- Component props and events not tested
- User interactions not properly simulated
- Error states not tested
- Accessibility not tested
- Performance characteristics not tested
- Integration tests missing for critical flows

### 🚨 SECURITY VIOLATIONS:
- XSS vulnerabilities through v-html or dynamic templates
- CSRF tokens not included in API requests
- Sensitive data stored in client-side state
- API keys or secrets exposed in client code
- User input not properly sanitized before display
- File uploads not properly validated
- Authentication tokens stored insecurely
- HTTPS not enforced for sensitive operations
- Content Security Policy not properly configured
- Third-party dependencies with known vulnerabilities

---

## 🔍 Vue.js Code Analysis

### 1. **Component Architecture & Composition API**

#### 🧩 Component Design
- **Single Responsibility**
  - Components focused on single concern?
  - Proper component decomposition?
  - Clear component boundaries?
  - Reusable component patterns?

#### ⚡ Composition API Best Practices
- Setup function organization
- Reactive state management
- Composables extraction
- Lifecycle hook usage

#### 🎯 Modern Vue Patterns
```vue
<!-- Best Practice: Well-structured Vue 3 component with Composition API -->

<template>
  <div class="user-profile">
    <!-- Loading state -->
    <div v-if="isLoading" class="loading">
      <UserProfileSkeleton />
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="error">
      <ErrorMessage 
        :error="error" 
        @retry="loadUserProfile" 
      />
    </div>

    <!-- Main content -->
    <div v-else-if="user" class="profile-content">
      <!-- Profile header -->
      <ProfileHeader 
        :user="user"
        :is-editing="isEditing"
        @edit="startEditing"
        @cancel="cancelEditing"
        @save="saveProfile"
      />

      <!-- Profile form -->
      <ProfileForm
        v-if="isEditing"
        v-model:user="editingUser"
        :validation-errors="validationErrors"
        :is-saving="isSaving"
        @submit="saveProfile"
        @cancel="cancelEditing"
      />

      <!-- Profile display -->
      <ProfileDisplay
        v-else
        :user="user"
        @edit="startEditing"
      />

      <!-- Activity feed -->
      <ActivityFeed
        v-if="showActivityFeed"
        :user-id="user.id"
        :activities="activities"
        :is-loading="isLoadingActivities"
        @load-more="loadMoreActivities"
      />
    </div>

    <!-- Empty state -->
    <div v-else class="empty-state">
      <EmptyState
        icon="user"
        title="No Profile Found"
        description="The requested user profile could not be found."
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'

import { useUserStore } from '@/stores/userStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { useUserProfile } from '@/composables/useUserProfile'
import { useFormValidation } from '@/composables/useFormValidation'
import { useAsyncState } from '@/composables/useAsyncState'

import ProfileHeader from './components/ProfileHeader.vue'
import ProfileForm from './components/ProfileForm.vue'
import ProfileDisplay from './components/ProfileDisplay.vue'
import ActivityFeed from './components/ActivityFeed.vue'
import UserProfileSkeleton from './components/UserProfileSkeleton.vue'
import ErrorMessage from '@/components/ui/ErrorMessage.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

import type { User, UserUpdateData, ValidationErrors } from '@/types/user'

// Props with proper validation
interface Props {
  userId?: string
  showActivityFeed?: boolean
  canEdit?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showActivityFeed: true,
  canEdit: true,
})

// Emits with proper typing
interface Emits {
  profileUpdated: [user: User]
  editingStateChanged: [isEditing: boolean]
}

const emit = defineEmits<Emits>()

// Stores
const userStore = useUserStore()
const notificationStore = useNotificationStore()
const { currentUser } = storeToRefs(userStore)

// Router
const route = useRoute()
const router = useRouter()

// Composables
const {
  user,
  activities,
  isLoading,
  isLoadingActivities,
  error,
  loadUserProfile,
  loadMoreActivities,
  updateUserProfile,
} = useUserProfile()

const {
  isLoading: isSaving,
  error: saveError,
  execute: executeSave,
} = useAsyncState()

const {
  errors: validationErrors,
  validateField,
  validateForm,
  clearErrors,
} = useFormValidation()

// Reactive state
const isEditing = ref(false)
const editingUser = ref<UserUpdateData>({})

// Computed properties
const targetUserId = computed(() => {
  return props.userId || (route.params.id as string) || currentUser.value?.id || ''
})

const canUserEdit = computed(() => {
  if (!props.canEdit || !currentUser.value || !user.value) return false
  
  return currentUser.value.id === user.value.id || 
         currentUser.value.roles.includes('admin')
})

const hasUnsavedChanges = computed(() => {
  if (!isEditing.value || !user.value) return false
  
  return Object.keys(editingUser.value).some(key => 
    editingUser.value[key as keyof UserUpdateData] !== user.value![key as keyof User]
  )
})

// Watchers
watch(
  () => targetUserId.value,
  async (newUserId, oldUserId) => {
    if (newUserId && newUserId !== oldUserId) {
      await loadUserProfile(newUserId)
    }
  },
  { immediate: true }
)

watch(
  () => isEditing.value,
  (newValue) => {
    emit('editingStateChanged', newValue)
    
    if (newValue) {
      // Initialize editing state
      editingUser.value = { ...user.value } as UserUpdateData
      clearErrors()
    }
  }
)

// Lifecycle hooks
onMounted(() => {
  // Set up keyboard shortcuts
  document.addEventListener('keydown', handleKeydown)
  
  // Set up beforeunload handler for unsaved changes
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onUnmounted(() => {
  // Clean up event listeners
  document.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('beforeunload', handleBeforeUnload)
})

// Methods
const startEditing = () => {
  if (!canUserEdit.value) {
    notificationStore.addNotification({
      type: 'error',
      message: 'You do not have permission to edit this profile',
    })
    return
  }
  
  isEditing.value = true
}

const cancelEditing = () => {
  if (hasUnsavedChanges.value) {
    const confirmed = window.confirm(
      'You have unsaved changes. Are you sure you want to cancel?'
    )
    if (!confirmed) return
  }
  
  isEditing.value = false
  editingUser.value = {}
  clearErrors()
}

const saveProfile = async () => {
  if (!user.value || !editingUser.value) return
  
  // Validate form
  const validation = await validateForm(editingUser.value)
  if (!validation.isValid) {
    notificationStore.addNotification({
      type: 'error',
      message: 'Please fix the validation errors before saving',
    })
    return
  }
  
  // Save profile
  const result = await executeSave(async () => {
    const updatedUser = await updateUserProfile(user.value!.id, editingUser.value)
    
    // Update local user state
    if (currentUser.value?.id === updatedUser.id) {
      userStore.setCurrentUser(updatedUser)
    }
    
    return updatedUser
  })
  
  if (result) {
    isEditing.value = false
    emit('profileUpdated', result)
    
    notificationStore.addNotification({
      type: 'success',
      message: 'Profile updated successfully',
    })
  } else if (saveError.value) {
    notificationStore.addNotification({
      type: 'error',
      message: saveError.value.message || 'Failed to save profile',
    })
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  // ESC to cancel editing
  if (event.key === 'Escape' && isEditing.value) {
    cancelEditing()
  }
  
  // Ctrl+S to save
  if (event.ctrlKey && event.key === 's' && isEditing.value) {
    event.preventDefault()
    saveProfile()
  }
}

const handleBeforeUnload = (event: BeforeUnloadEvent) => {
  if (hasUnsavedChanges.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}

// Expose methods for testing
defineExpose({
  startEditing,
  cancelEditing,
  saveProfile,
  loadUserProfile,
})
</script>

<style scoped>
.user-profile {
  @apply max-w-4xl mx-auto p-6;
}

.loading,
.error,
.empty-state {
  @apply flex items-center justify-center min-h-[400px];
}

.profile-content {
  @apply space-y-6;
}

.error {
  @apply flex-col space-y-4;
}

/* Responsive design */
@media (max-width: 768px) {
  .user-profile {
    @apply p-4;
  }
  
  .profile-content {
    @apply space-y-4;
  }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .user-profile {
    @apply bg-gray-900 text-white;
  }
}

/* Print styles */
@media print {
  .user-profile {
    @apply shadow-none;
  }
}
</style>
```

#### 🔧 Composables Pattern
```typescript
// Best Practice: Reusable composables with proper typing and error handling

import { ref, computed, watch, onUnmounted } from 'vue'
import type { Ref } from 'vue'

import { userAPI } from '@/api/userAPI'
import { useNotificationStore } from '@/stores/notificationStore'
import type { User, UserUpdateData, Activity, PaginatedResponse } from '@/types/user'

// User profile composable
export function useUserProfile() {
  // State
  const user = ref<User | null>(null)
  const activities = ref<Activity[]>([])
  const isLoading = ref(false)
  const isLoadingActivities = ref(false)
  const error = ref<Error | null>(null)
  const hasMoreActivities = ref(true)
  const currentPage = ref(1)

  // Store
  const notificationStore = useNotificationStore()

  // Computed
  const userFullName = computed(() => {
    if (!user.value) return ''
    return `${user.value.firstName} ${user.value.lastName}`.trim()
  })

  const userInitials = computed(() => {
    if (!user.value) return ''
    const first = user.value.firstName?.[0] || ''
    const last = user.value.lastName?.[0] || ''
    return (first + last).toUpperCase()
  })

  const isVerified = computed(() => {
    return user.value?.emailVerified && user.value?.phoneVerified
  })

  // Methods
  const loadUserProfile = async (userId: string): Promise<User | null> => {
    if (!userId) {
      error.value = new Error('User ID is required')
      return null
    }

    isLoading.value = true
    error.value = null

    try {
      const response = await userAPI.getUserProfile(userId)
      user.value = response.data
      
      // Reset activities when loading new user
      activities.value = []
      currentPage.value = 1
      hasMoreActivities.value = true
      
      return user.value
    } catch (err) {
      error.value = err instanceof Error ? err : new Error('Failed to load user profile')
      user.value = null
      return null
    } finally {
      isLoading.value = false
    }
  }

  const updateUserProfile = async (
    userId: string, 
    updateData: UserUpdateData
  ): Promise<User | null> => {
    if (!userId || !updateData) {
      throw new Error('User ID and update data are required')
    }

    try {
      const response = await userAPI.updateUserProfile(userId, updateData)
      
      // Update local state
      if (user.value && user.value.id === userId) {
        user.value = { ...user.value, ...response.data }
      }
      
      return response.data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update profile'
      throw new Error(errorMessage)
    }
  }

  const loadMoreActivities = async (): Promise<void> => {
    if (!user.value || isLoadingActivities.value || !hasMoreActivities.value) {
      return
    }

    isLoadingActivities.value = true

    try {
      const response = await userAPI.getUserActivities(user.value.id, {
        page: currentPage.value + 1,
        limit: 20,
      })

      const newActivities = response.data.items
      
      if (newActivities.length > 0) {
        activities.value.push(...newActivities)
        currentPage.value += 1
      }
      
      hasMoreActivities.value = response.data.hasNext
    } catch (err) {
      notificationStore.addNotification({
        type: 'error',
        message: 'Failed to load more activities',
      })
    } finally {
      isLoadingActivities.value = false
    }
  }

  const refreshProfile = async (): Promise<void> => {
    if (user.value) {
      await loadUserProfile(user.value.id)
    }
  }

  const deleteUserProfile = async (userId: string): Promise<boolean> => {
    if (!userId) {
      throw new Error('User ID is required')
    }

    try {
      await userAPI.deleteUserProfile(userId)
      
      // Clear local state if deleted user is current user
      if (user.value?.id === userId) {
        user.value = null
        activities.value = []
      }
      
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete profile'
      throw new Error(errorMessage)
    }
  }

  // Cleanup
  const cleanup = () => {
    user.value = null
    activities.value = []
    error.value = null
    isLoading.value = false
    isLoadingActivities.value = false
    hasMoreActivities.value = true
    currentPage.value = 1
  }

  return {
    // State
    user: readonly(user),
    activities: readonly(activities),
    isLoading: readonly(isLoading),
    isLoadingActivities: readonly(isLoadingActivities),
    error: readonly(error),
    hasMoreActivities: readonly(hasMoreActivities),
    
    // Computed
    userFullName,
    userInitials,
    isVerified,
    
    // Methods
    loadUserProfile,
    updateUserProfile,
    loadMoreActivities,
    refreshProfile,
    deleteUserProfile,
    cleanup,
  }
}

// Form validation composable
export function useFormValidation<T extends Record<string, any>>() {
  const errors = ref<Record<keyof T, string>>({} as Record<keyof T, string>)
  const isValidating = ref(false)

  const rules = ref<Record<keyof T, ValidationRule[]>>({} as Record<keyof T, ValidationRule[]>)

  interface ValidationRule {
    validator: (value: any) => boolean | Promise<boolean>
    message: string
  }

  const setRules = (newRules: Record<keyof T, ValidationRule[]>) => {
    rules.value = newRules
  }

  const validateField = async (field: keyof T, value: any): Promise<boolean> => {
    const fieldRules = rules.value[field]
    if (!fieldRules) return true

    for (const rule of fieldRules) {
      const isValid = await rule.validator(value)
      if (!isValid) {
        errors.value[field] = rule.message
        return false
      }
    }

    delete errors.value[field]
    return true
  }

  const validateForm = async (formData: T): Promise<{ isValid: boolean; errors: Record<keyof T, string> }> => {
    isValidating.value = true
    const newErrors: Record<keyof T, string> = {} as Record<keyof T, string>

    try {
      for (const [field, value] of Object.entries(formData)) {
        const isValid = await validateField(field as keyof T, value)
        if (!isValid && errors.value[field as keyof T]) {
          newErrors[field as keyof T] = errors.value[field as keyof T]
        }
      }

      errors.value = newErrors
      return {
        isValid: Object.keys(newErrors).length === 0,
        errors: newErrors,
      }
    } finally {
      isValidating.value = false
    }
  }

  const clearErrors = () => {
    errors.value = {} as Record<keyof T, string>
  }

  const clearFieldError = (field: keyof T) => {
    delete errors.value[field]
  }

  return {
    errors: readonly(errors),
    isValidating: readonly(isValidating),
    setRules,
    validateField,
    validateForm,
    clearErrors,
    clearFieldError,
  }
}

// Async state management composable
export function useAsyncState<T = any>() {
  const isLoading = ref(false)
  const error = ref<Error | null>(null)
  const data = ref<T | null>(null)

  const execute = async <TResult = T>(
    asyncFn: () => Promise<TResult>
  ): Promise<TResult | null> => {
    isLoading.value = true
    error.value = null

    try {
      const result = await asyncFn()
      data.value = result as any
      return result
    } catch (err) {
      error.value = err instanceof Error ? err : new Error('An error occurred')
      return null
    } finally {
      isLoading.value = false
    }
  }

  const reset = () => {
    isLoading.value = false
    error.value = null
    data.value = null
  }

  return {
    isLoading: readonly(isLoading),
    error: readonly(error),
    data: readonly(data),
    execute,
    reset,
  }
}

// Local storage composable with SSR support
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  options: {
    serializer?: {
      read: (value: string) => T
      write: (value: T) => string
    }
  } = {}
) {
  const {
    serializer = {
      read: JSON.parse,
      write: JSON.stringify,
    },
  } = options

  const storedValue = ref<T>(defaultValue)

  // Read from localStorage on client side
  if (typeof window !== 'undefined') {
    try {
      const item = window.localStorage.getItem(key)
      if (item !== null) {
        storedValue.value = serializer.read(item)
      }
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error)
    }
  }

  // Update localStorage when value changes
  watch(
    storedValue,
    (newValue) => {
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(key, serializer.write(newValue))
        } catch (error) {
          console.warn(`Error setting localStorage key "${key}":`, error)
        }
      }
    },
    { deep: true }
  )

  const removeItem = () => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(key)
        storedValue.value = defaultValue
      } catch (error) {
        console.warn(`Error removing localStorage key "${key}":`, error)
      }
    }
  }

  return {
    value: storedValue,
    removeItem,
  }
}

// Media query composable
export function useMediaQuery(query: string): Ref<boolean> {
  const matches = ref(false)

  if (typeof window !== 'undefined') {
    const mediaQuery = window.matchMedia(query)
    matches.value = mediaQuery.matches

    const updateMatches = (event: MediaQueryListEvent) => {
      matches.value = event.matches
    }

    mediaQuery.addEventListener('change', updateMatches)

    onUnmounted(() => {
      mediaQuery.removeEventListener('change', updateMatches)
    })
  }

  return readonly(matches)
}

// Debounce composable
export function useDebounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): T {
  let timeoutId: number | undefined

  const debouncedFn = ((...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = window.setTimeout(() => fn(...args), delay)
  }) as T

  onUnmounted(() => {
    clearTimeout(timeoutId)
  })

  return debouncedFn
}
```

---

### 2. **State Management & Reactivity**

#### 🏪 Pinia Store Patterns
```typescript
// Best Practice: Well-structured Pinia store with proper typing

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { userAPI } from '@/api/userAPI'
import type { User, UserFilters, PaginatedResponse, CreateUserData, UpdateUserData } from '@/types/user'

export const useUserStore = defineStore('user', () => {
  // State
  const currentUser = ref<User | null>(null)
  const users = ref<Map<string, User>>(new Map())
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const lastFetchTime = ref<number>(0)

  // Cache settings
  const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  // Getters (computed)
  const isAuthenticated = computed(() => currentUser.value !== null)

  const userFullName = computed(() => {
    if (!currentUser.value) return ''
    return `${currentUser.value.firstName} ${currentUser.value.lastName}`.trim()
  })

  const userRoles = computed(() => {
    return currentUser.value?.roles || []
  })

  const isAdmin = computed(() => {
    return userRoles.value.includes('admin')
  })

  const isManager = computed(() => {
    return userRoles.value.includes('manager') || isAdmin.value
  })

  const getUserById = computed(() => {
    return (id: string): User | undefined => {
      return users.value.get(id)
    }
  })

  const isCacheValid = computed(() => {
    return Date.now() - lastFetchTime.value < CACHE_DURATION
  })

  // Actions
  const setCurrentUser = (user: User | null) => {
    currentUser.value = user
    if (user) {
      users.value.set(user.id, user)
    }
  }

  const updateCurrentUser = (updates: Partial<User>) => {
    if (currentUser.value) {
      const updatedUser = { ...currentUser.value, ...updates }
      setCurrentUser(updatedUser)
    }
  }

  const addUser = (user: User) => {
    users.value.set(user.id, user)
  }

  const updateUser = (id: string, updates: Partial<User>) => {
    const existingUser = users.value.get(id)
    if (existingUser) {
      const updatedUser = { ...existingUser, ...updates }
      users.value.set(id, updatedUser)
      
      // Update current user if it's the same user
      if (currentUser.value?.id === id) {
        currentUser.value = updatedUser
      }
    }
  }

  const removeUser = (id: string) => {
    users.value.delete(id)
    
    // Clear current user if it's the same user
    if (currentUser.value?.id === id) {
      currentUser.value = null
    }
  }

  const fetchCurrentUser = async (): Promise<User | null> => {
    isLoading.value = true
    error.value = null

    try {
      const response = await userAPI.getCurrentUser()
      setCurrentUser(response.data)
      return response.data
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch current user'
      setCurrentUser(null)
      return null
    } finally {
      isLoading.value = false
    }
  }

  const fetchUsers = async (filters: UserFilters = {}): Promise<PaginatedResponse<User> | null> => {
    // Return cached data if valid and no filters
    if (isCacheValid.value && Object.keys(filters).length === 0) {
      return {
        items: Array.from(users.value.values()),
        total: users.value.size,
        page: 1,
        limit: users.value.size,
        hasNext: false,
        hasPrev: false,
      }
    }

    isLoading.value = true
    error.value = null

    try {
      const response = await userAPI.getUsers(filters)
      
      // Update cache
      response.data.items.forEach(user => {
        users.value.set(user.id, user)
      })
      
      lastFetchTime.value = Date.now()
      
      return response.data
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch users'
      return null
    } finally {
      isLoading.value = false
    }
  }

  const createUser = async (userData: CreateUserData): Promise<User | null> => {
    isLoading.value = true
    error.value = null

    try {
      const response = await userAPI.createUser(userData)
      addUser(response.data)
      return response.data
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create user'
      return null
    } finally {
      isLoading.value = false
    }
  }

  const updateUserProfile = async (
    id: string,
    updateData: UpdateUserData
  ): Promise<User | null> => {
    isLoading.value = true
    error.value = null

    try {
      const response = await userAPI.updateUser(id, updateData)
      updateUser(id, response.data)
      return response.data
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update user'
      return null
    } finally {
      isLoading.value = false
    }
  }

  const deleteUser = async (id: string): Promise<boolean> => {
    isLoading.value = true
    error.value = null

    try {
      await userAPI.deleteUser(id)
      removeUser(id)
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete user'
      return false
    } finally {
      isLoading.value = false
    }
  }

  const login = async (credentials: { email: string; password: string }): Promise<User | null> => {
    isLoading.value = true
    error.value = null

    try {
      const response = await userAPI.login(credentials)
      setCurrentUser(response.data.user)
      
      // Store token in localStorage or httpOnly cookie
      localStorage.setItem('authToken', response.data.token)
      
      return response.data.user
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Login failed'
      return null
    } finally {
      isLoading.value = false
    }
  }

  const logout = async (): Promise<void> => {
    isLoading.value = true
    error.value = null

    try {
      await userAPI.logout()
    } catch (err) {
      // Log error but don't prevent logout
      console.warn('Logout API call failed:', err)
    } finally {
      // Clear local state regardless of API call result
      setCurrentUser(null)
      users.value.clear()
      localStorage.removeItem('authToken')
      isLoading.value = false
    }
  }

  const refreshToken = async (): Promise<boolean> => {
    try {
      const response = await userAPI.refreshToken()
      setCurrentUser(response.data.user)
      localStorage.setItem('authToken', response.data.token)
      return true
    } catch (err) {
      // Token refresh failed, user needs to login again
      await logout()
      return false
    }
  }

  const clearError = () => {
    error.value = null
  }

  const clearCache = () => {
    users.value.clear()
    lastFetchTime.value = 0
  }

  const resetStore = () => {
    currentUser.value = null
    users.value.clear()
    isLoading.value = false
    error.value = null
    lastFetchTime.value = 0
  }

  // Persist state
  const $persist = {
    storage: localStorage,
    paths: ['currentUser'],
    beforeRestore: (context: any) => {
      console.log('Restoring user store state')
    },
    afterRestore: (context: any) => {
      console.log('User store state restored')
    },
  }

  return {
    // State
    currentUser: readonly(currentUser),
    users: readonly(users),
    isLoading: readonly(isLoading),
    error: readonly(error),
    
    // Getters
    isAuthenticated,
    userFullName,
    userRoles,
    isAdmin,
    isManager,
    getUserById,
    isCacheValid,
    
    // Actions
    setCurrentUser,
    updateCurrentUser,
    addUser,
    updateUser,
    removeUser,
    fetchCurrentUser,
    fetchUsers,
    createUser,
    updateUserProfile,
    deleteUser,
    login,
    logout,
    refreshToken,
    clearError,
    clearCache,
    resetStore,
    
    // Persistence
    $persist,
  }
})

// Notification store for global notifications
export const useNotificationStore = defineStore('notification', () => {
  interface Notification {
    id: string
    type: 'success' | 'error' | 'warning' | 'info'
    message: string
    title?: string
    duration?: number
    persistent?: boolean
    actions?: Array<{
      label: string
      handler: () => void
      style?: 'primary' | 'secondary'
    }>
  }

  const notifications = ref<Notification[]>([])

  const addNotification = (notification: Omit<Notification, 'id'>) => {
    const id = crypto.randomUUID()
    const newNotification: Notification = {
      id,
      duration: 5000, // 5 seconds default
      persistent: false,
      ...notification,
    }

    notifications.value.push(newNotification)

    // Auto-remove non-persistent notifications
    if (!newNotification.persistent && newNotification.duration) {
      setTimeout(() => {
        removeNotification(id)
      }, newNotification.duration)
    }

    return id
  }

  const removeNotification = (id: string) => {
    const index = notifications.value.findIndex(n => n.id === id)
    if (index > -1) {
      notifications.value.splice(index, 1)
    }
  }

  const clearAllNotifications = () => {
    notifications.value = []
  }

  const updateNotification = (id: string, updates: Partial<Notification>) => {
    const notification = notifications.value.find(n => n.id === id)
    if (notification) {
      Object.assign(notification, updates)
    }
  }

  // Convenience methods
  const showSuccess = (message: string, options?: Partial<Notification>) => {
    return addNotification({ type: 'success', message, ...options })
  }

  const showError = (message: string, options?: Partial<Notification>) => {
    return addNotification({ type: 'error', message, persistent: true, ...options })
  }

  const showWarning = (message: string, options?: Partial<Notification>) => {
    return addNotification({ type: 'warning', message, ...options })
  }

  const showInfo = (message: string, options?: Partial<Notification>) => {
    return addNotification({ type: 'info', message, ...options })
  }

  return {
    notifications: readonly(notifications),
    addNotification,
    removeNotification,
    clearAllNotifications,
    updateNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  }
})
```

---

### 3. **Performance & Optimization**

#### ⚡ Performance Best Practices
```vue
<!-- Best Practice: Performance-optimized Vue components -->

<template>
  <div class="optimized-list">
    <!-- Virtual scrolling for large lists -->
    <VirtualList
      v-if="useVirtualScrolling"
      :items="filteredItems"
      :item-height="itemHeight"
      :container-height="containerHeight"
      #default="{ item, index }"
    >
      <ListItem
        :key="item.id"
        :item="item"
        :index="index"
        @click="handleItemClick"
      />
    </VirtualList>

    <!-- Regular list with v-memo optimization -->
    <div v-else class="list-container">
      <TransitionGroup
        name="list"
        tag="div"
        class="list"
      >
        <ListItem
          v-for="(item, index) in filteredItems"
          v-memo="[item.id, item.updatedAt, selectedItems.has(item.id)]"
          :key="item.id"
          :item="item"
          :index="index"
          :is-selected="selectedItems.has(item.id)"
          @click="handleItemClick"
          @select="handleItemSelect"
        />
      </TransitionGroup>
    </div>

    <!-- Loading skeleton with proper transitions -->
    <div v-if="isLoading" class="loading-container">
      <SkeletonLoader
        v-for="n in skeletonCount"
        :key="`skeleton-${n}`"
        :height="itemHeight"
        class="skeleton-item"
      />
    </div>

    <!-- Empty state -->
    <EmptyState
      v-else-if="!isLoading && filteredItems.length === 0"
      :icon="emptyStateIcon"
      :title="emptyStateTitle"
      :description="emptyStateDescription"
    />

    <!-- Load more trigger with intersection observer -->
    <div
      v-if="hasMore && !isLoading"
      ref="loadMoreTrigger"
      class="load-more-trigger"
    >
      <LoadingSpinner v-if="isLoadingMore" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'
import { useDebounceFn, useThrottleFn } from '@vueuse/core'

// Lazy load heavy components
const VirtualList = defineAsyncComponent(() => import('@/components/VirtualList.vue'))
const ListItem = defineAsyncComponent(() => import('./ListItem.vue'))
const SkeletonLoader = defineAsyncComponent(() => import('@/components/SkeletonLoader.vue'))
const EmptyState = defineAsyncComponent(() => import('@/components/EmptyState.vue'))
const LoadingSpinner = defineAsyncComponent(() => import('@/components/LoadingSpinner.vue'))

interface Item {
  id: string
  name: string
  updatedAt: string
  // ... other properties
}

interface Props {
  items: Item[]
  isLoading?: boolean
  hasMore?: boolean
  searchQuery?: string
  useVirtualScrolling?: boolean
  itemHeight?: number
  containerHeight?: number
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
  hasMore: false,
  searchQuery: '',
  useVirtualScrolling: false,
  itemHeight: 60,
  containerHeight: 400,
})

interface Emits {
  loadMore: []
  itemClick: [item: Item]
  itemSelect: [item: Item, selected: boolean]
}

const emit = defineEmits<Emits>()

// State
const loadMoreTrigger = ref<HTMLElement>()
const isLoadingMore = ref(false)
const selectedItems = ref<Set<string>>(new Set())
const skeletonCount = computed(() => Math.ceil(props.containerHeight / props.itemHeight))

// Computed with memoization
const filteredItems = computed(() => {
  if (!props.searchQuery) return props.items
  
  const query = props.searchQuery.toLowerCase()
  return props.items.filter(item => 
    item.name.toLowerCase().includes(query)
  )
})

// Empty state computed
const emptyStateIcon = computed(() => {
  return props.searchQuery ? 'search' : 'list'
})

const emptyStateTitle = computed(() => {
  return props.searchQuery ? 'No results found' : 'No items available'
})

const emptyStateDescription = computed(() => {
  return props.searchQuery 
    ? `No items match "${props.searchQuery}"`
    : 'There are no items to display'
})

// Debounced and throttled handlers
const handleItemClick = useDebounceFn((item: Item) => {
  emit('itemClick', item)
}, 200)

const handleItemSelect = useThrottleFn((item: Item, selected: boolean) => {
  if (selected) {
    selectedItems.value.add(item.id)
  } else {
    selectedItems.value.delete(item.id)
  }
  emit('itemSelect', item, selected)
}, 100)

const handleLoadMore = useDebounceFn(async () => {
  if (isLoadingMore.value || !props.hasMore) return
  
  isLoadingMore.value = true
  try {
    emit('loadMore')
  } finally {
    // Reset loading state after a delay to prevent rapid successive calls
    setTimeout(() => {
      isLoadingMore.value = false
    }, 500)
  }
}, 300)

// Intersection observer for infinite scrolling
const { stop: stopObserver } = useIntersectionObserver(
  loadMoreTrigger,
  ([{ isIntersecting }]) => {
    if (isIntersecting && props.hasMore && !isLoadingMore.value) {
      handleLoadMore()
    }
  },
  {
    threshold: 0.1,
    rootMargin: '100px',
  }
)

// Watchers
watch(
  () => props.searchQuery,
  () => {
    // Clear selection when search changes
    selectedItems.value.clear()
  }
)

// Lifecycle
onMounted(() => {
  // Preload critical resources
  nextTick(() => {
    // Warm up intersection observer
    if (loadMoreTrigger.value) {
      // Observer is already set up via useIntersectionObserver
    }
  })
})

onUnmounted(() => {
  stopObserver()
})

// Expose for testing
defineExpose({
  selectedItems,
  handleLoadMore,
  filteredItems,
})
</script>

<style scoped>
.optimized-list {
  @apply relative;
}

.list-container {
  @apply relative;
}

.list {
  @apply space-y-2;
}

.loading-container {
  @apply space-y-2;
}

.skeleton-item {
  @apply animate-pulse;
}

.load-more-trigger {
  @apply flex justify-center py-4;
}

/* List transitions */
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.list-leave-to {
  opacity: 0;
  transform: translateX(-100%);
}

.list-move {
  transition: transform 0.3s ease;
}

/* Optimize for animations */
.list-item {
  transform: translateZ(0); /* Enable hardware acceleration */
  backface-visibility: hidden;
}

/* Performance optimizations */
.optimized-list {
  contain: layout style paint;
}

/* Responsive optimizations */
@media (max-width: 768px) {
  .list {
    @apply space-y-1;
  }
}

/* Reduce motion for accessibility */
@media (prefers-reduced-motion: reduce) {
  .list-enter-active,
  .list-leave-active,
  .list-move {
    transition: none;
  }
  
  .skeleton-item {
    animation: none;
  }
}
</style>
```

---

## 📊 Vue.js Health Metrics

### Framework Compliance
- **Reactivity Implementation**: ⭐⭐⭐⭐⭐ (X/5)
- **Component Architecture**: ⭐⭐⭐⭐⭐ (X/5)
- **Performance Optimization**: ⭐⭐⭐⭐⭐ (X/5)
- **State Management**: ⭐⭐⭐⭐⭐ (X/5)
- **Developer Experience**: ⭐⭐⭐⭐⭐ (X/5)

### Overall Vue.js Score: ⭐⭐⭐⭐⭐ (X/10)

---

## 🎯 Vue.js-Specific Action Items

### 🔴 Critical (Reactivity/Performance)
1. [ ] Fix reactivity violations and data mutation issues
2. [ ] Add proper key attributes to all v-for loops
3. [ ] Implement proper error boundaries and error handling
4. [ ] Fix XSS vulnerabilities in v-html usage
5. [ ] Add proper form validation and accessibility

### 🟡 Important (Best Practices)
1. [ ] Implement proper component composition and reusability
2. [ ] Add comprehensive prop validation and typing
3. [ ] Optimize performance with v-memo and virtual scrolling
4. [ ] Implement proper state management patterns
5. [ ] Add proper testing coverage for components

### 🟢 Improvements (Code Quality)
1. [ ] Add comprehensive TypeScript typing
2. [ ] Implement proper documentation and examples
3. [ ] Add accessibility features and ARIA attributes
4. [ ] Optimize bundle size with code splitting
5. [ ] Add proper performance monitoring and profiling

---

## 💡 Vue.js Upgrade Recommendations

### Migration Opportunities
- Vue 3.4+ features and performance improvements
- Composition API with `<script setup>` syntax
- Enhanced TypeScript support with better inference
- Improved developer tools and debugging capabilities
- Better SSR and hydration with Nuxt 3
- Enhanced testing utilities with Vue Test Utils v2

### Performance Improvements
- Vite for faster development and build times
- Virtual scrolling for large lists
- Code splitting with dynamic imports
- Bundle analysis and optimization
- Image optimization and lazy loading
- Service worker for offline capabilities