<!-- AIDA - AI Development Assistant v1.0.0 -->
<!-- Advanced AI-powered code review and analysis -->

# Angular Framework Review Template

## 🎯 Angular-Specific Review Guidelines

This template focuses specifically on Angular framework best practices, patterns, and common pitfalls. Use this for reviewing Angular components, services, directives, pipes, and modules.

## File Information
**File:** [FILE_NAME]
**Path:** [FILE_PATH]
**Angular Version:** [ANGULAR_VERSION]
**Module:** [MODULE_NAME]
**Type:** Component | Service | Directive | Pipe | Module | Guard | Interceptor

---

## 🔍 Angular Code Analysis

### 1. **Angular Architecture & Patterns**

#### 🏗️ Component Architecture
- **Smart vs Presentational Components**
  - Is this component correctly categorized?
  - Does it follow single responsibility principle?
  - Proper use of @Input() and @Output()?

#### 📦 Module Organization
- Feature module structure
- Lazy loading implementation
- Shared module usage
- Core module patterns

#### 🔄 Change Detection Strategy
```typescript
// Example: Optimize with OnPush
@Component({
  selector: 'app-component',
  changeDetection: ChangeDetectionStrategy.OnPush // Missing?
})
```

#### ❌ Common Issues
- Mixed responsibilities in components
- Business logic in templates
- Improper service injection scope
- Missing or incorrect module imports

---

### 2. **Angular Lifecycle & Hooks**

#### 🔄 Lifecycle Implementation
```typescript
// Check for proper lifecycle usage
ngOnInit(): void {
  // Initialization logic - not in constructor
}

ngOnDestroy(): void {
  // Cleanup subscriptions
  this.destroy$.next();
  this.destroy$.complete();
}

ngAfterViewInit(): void {
  // DOM manipulation here, not in ngOnInit
}
```

#### ⚠️ Common Mistakes
- Heavy logic in constructor
- Missing ngOnDestroy cleanup
- Incorrect hook order dependencies
- ViewChild access before ngAfterViewInit

---

### 3. **RxJS & Reactive Programming**

#### 🌊 Observable Management
```typescript
// Best Practice: Subscription management
private destroy$ = new Subject<void>();

ngOnInit() {
  // Good: Auto-unsubscribe pattern
  this.service.data$.pipe(
    takeUntil(this.destroy$),
    // Proper operators
    debounceTime(300),
    distinctUntilChanged(),
    switchMap(query => this.search(query))
  ).subscribe();
}

// Bad: Memory leak
ngOnInit() {
  this.service.data$.subscribe(); // No unsubscribe!
}
```

#### 📊 RxJS Best Practices
- Proper operator usage (switchMap vs mergeMap vs concatMap)
- AsyncPipe in templates when possible
- Subject vs BehaviorSubject vs ReplaySubject
- Error handling with catchError
- Avoiding nested subscriptions

---

### 4. **Template & Data Binding**

#### 🎨 Template Best Practices
```html
<!-- Good: TrackBy for performance -->
<div *ngFor="let item of items; trackBy: trackByFn">

<!-- Good: Async pipe -->
<div *ngIf="data$ | async as data">

<!-- Bad: Function calls in template -->
<div>{{ calculateTotal() }}</div>

<!-- Good: Use pure pipe or getter -->
<div>{{ total | currency }}</div>
```

#### ⚡ Performance Considerations
- TrackBy functions for *ngFor
- OnPush change detection where appropriate
- Avoiding complex expressions in templates
- Using pure pipes over methods
- Lazy loading images and components

---

### 5. **Services & Dependency Injection**

#### 💉 Service Design
```typescript
// Good: Singleton service
@Injectable({
  providedIn: 'root' // Tree-shakeable
})
export class DataService {
  private dataSubject = new BehaviorSubject<Data[]>([]);
  public data$ = this.dataSubject.asObservable();
}

// Check for:
// - Proper injection scope
// - State management patterns
// - API call organization
// - Error handling
```

#### 🏭 Factory Patterns
```typescript
// When needed: Factory providers
{
  provide: CONFIG_TOKEN,
  useFactory: configFactory,
  deps: [HttpClient, AuthService]
}
```

---

### 6. **Forms & Validation**

#### 📝 Reactive Forms Best Practices
```typescript
// Good: Strongly typed forms (Angular 14+)
form = this.fb.group({
  name: ['', [Validators.required]],
  email: ['', [Validators.required, Validators.email]]
});

// Custom validators
emailValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    // Validation logic
  };
}
```

#### ✅ Form Validation Checklist
- Reactive vs Template forms (consistency)
- Custom validators implementation
- Async validators for server validation
- Error message handling
- Form state management

---

### 7. **Routing & Navigation**

#### 🗺️ Route Configuration
```typescript
// Good: Lazy loading with preloading
{
  path: 'feature',
  loadChildren: () => import('./feature/feature.module').then(m => m.FeatureModule),
  canActivate: [AuthGuard],
  data: { preload: true }
}
```

#### 🛡️ Guards & Resolvers
- Proper guard implementation (CanActivate, CanDeactivate)
- Resolver usage for data preloading
- Route parameter handling
- Query parameter management

---

### 8. **Angular Testing**

#### 🧪 Component Testing
```typescript
describe('ComponentName', () => {
  let component: ComponentName;
  let fixture: ComponentFixture<ComponentName>;
  let service: jasmine.SpyObj<ServiceName>;

  beforeEach(() => {
    const spy = jasmine.createSpyObj('ServiceName', ['method']);
    
    TestBed.configureTestingModule({
      declarations: [ComponentName],
      providers: [{ provide: ServiceName, useValue: spy }]
    });
    
    fixture = TestBed.createComponent(ComponentName);
    component = fixture.componentInstance;
    service = TestBed.inject(ServiceName) as jasmine.SpyObj<ServiceName>;
  });

  it('should handle async operations', fakeAsync(() => {
    // Test with tick() for time-based operations
  }));

  it('should test DOM interactions', () => {
    const compiled = fixture.nativeElement;
    // DOM testing
  });
});
```

#### 🎯 Testing Priorities
1. **Critical**: User interactions, form submissions, auth flows
2. **High**: Service methods, guards, interceptors
3. **Medium**: Pipes, directives, validators
4. **Low**: Simple getters/setters, UI-only changes

---

### 9. **Performance & Optimization**

#### ⚡ Angular-Specific Optimizations
- OnPush change detection strategy
- TrackBy functions in *ngFor
- Lazy loading modules
- Preloading strategies
- Tree shaking with providedIn
- Virtual scrolling for large lists
- Web Workers for heavy computations

#### 📦 Bundle Size Optimization
```typescript
// Good: Tree-shakeable providers
@Injectable({ providedIn: 'root' })

// Good: Dynamic imports
const module = await import('./heavy-module');

// Good: Lazy load libraries
if (condition) {
  const { Chart } = await import('chart.js');
}
```

---

### 10. **Accessibility & i18n**

#### ♿ Accessibility Checklist
- ARIA attributes
- Keyboard navigation
- Screen reader support
- Focus management
- Semantic HTML

#### 🌍 Internationalization
```typescript
// i18n pipe usage
{{ 'KEY' | translate }}

// Programmatic translation
this.translate.get('KEY').subscribe();
```

---

## 📊 Angular Health Metrics

### Framework Compliance
- **Angular Style Guide**: ⭐⭐⭐⭐⭐ (X/5)
- **RxJS Best Practices**: ⭐⭐⭐⭐⭐ (X/5)
- **Performance**: ⭐⭐⭐⭐⭐ (X/5)
- **Testing Coverage**: ⭐⭐⭐⭐⭐ (X/5)
- **Accessibility**: ⭐⭐⭐⭐⭐ (X/5)

### Overall Angular Score: ⭐⭐⭐⭐⭐ (X/10)

---

## 🎯 Angular-Specific Action Items

### 🔴 Critical (Security/Memory Leaks)
1. [ ] Fix memory leaks from unsubscribed observables
2. [ ] Implement proper sanitization for dynamic HTML
3. [ ] Add CSRF protection for forms
4. [ ] Fix circular dependencies

### 🟡 Important (Performance/Best Practices)
1. [ ] Implement OnPush change detection
2. [ ] Add trackBy to all *ngFor loops
3. [ ] Convert to standalone components (Angular 14+)
4. [ ] Implement lazy loading for feature modules
5. [ ] Add proper error boundaries

### 🟢 Improvements (Code Quality)
1. [ ] Extract reusable components
2. [ ] Create custom pipes for repeated transforms
3. [ ] Implement proper typing for forms
4. [ ] Add comprehensive unit tests
5. [ ] Improve error handling with interceptors

---

## 💡 Angular Upgrade Recommendations

### Migration Opportunities
- Standalone components (v14+)
- Typed reactive forms (v14+)
- Inject function (v14+)
- Signal-based components (v16+)
- New control flow syntax (v17+)
- Deferred loading (v17+)

### Tooling Improvements
- Angular DevTools usage
- Strict mode enablement
- ESLint with Angular rules
- Prettier configuration
- Husky pre-commit hooks
- Bundle analyzer setup
