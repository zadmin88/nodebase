# Workflow Editor Implementation - Change Documentation

## Overview

This document explains all the staged changes for implementing the workflow editor feature. The changes introduce a new editor interface for individual workflows, including a header with breadcrumb navigation, inline name editing, and a save button.

## Branch Information

**Branch:** `14-workflow-page`
**Base Branch:** `main`

---

## Architecture Overview

The implementation follows the project's established patterns:
- **Server Components** for data fetching and routing
- **Client Components** for interactive UI elements
- **tRPC** for type-safe API calls
- **React Query** for data caching and state management
- **React Suspense** for async boundary handling
- **Error Boundaries** for graceful error handling

---

## File Changes Summary

### 1. New Files Created

#### `src/features/editor/components/editor-header.tsx`
A new client component module containing the editor header UI.

#### `src/features/editor/components/editor.tsx`
A new client component module for the main editor interface.

### 2. Modified Files

#### `src/app/(dashboard)/(editor)/workflows/[workflowId]/page.tsx`
The workflow detail page route - transformed from a placeholder to a full-featured editor page.

#### `src/features/workflows/hooks/use-workflows.ts`
Added new React hooks for fetching single workflows and updating workflow names.

#### `src/features/workflows/server/prefetch.ts`
Added server-side data prefetching for individual workflows.

#### `src/features/workflows/server/routers.ts`
Modified the `getOne` query to throw errors when workflow not found.

---

## Detailed Change Analysis

### 1. Workflow Detail Page (`page.tsx`)

**Location:** `src/app/(dashboard)/(editor)/workflows/[workflowId]/page.tsx`

#### Before
```tsx
const Page = async ({ params }: PageProps) => {
  await requireAuth();
  const { workflowId } = await params;
  return <div>workflow Id: {workflowId}</div>;
};
```

#### After
```tsx
const Page = async ({ params }: PageProps) => {
  await requireAuth();
  const { workflowId } = await params;
  prefetchWorkflow(workflowId);
  return (
    <HydrateClient>
      <ErrorBoundary fallback={<EditorError />}>
        <Suspense fallback={<EditorLoading />}>
          <EditorHeader workflowId={workflowId} />
          <main className="flex-1">
            <Editor workflowId={workflowId} />
          </main>
        </Suspense>
      </ErrorBoundary>
    </HydrateClient>
  );
};
```

#### Key Changes
1. **Data Prefetching**: `prefetchWorkflow(workflowId)` runs on the server before rendering
2. **HydrateClient**: Wraps the page to ensure React Query state is properly hydrated from server to client
3. **ErrorBoundary**: Catches any errors from child components and displays `<EditorError />`
4. **Suspense**: Shows `<EditorLoading />` while async data is being fetched
5. **Layout Structure**: Header + main content area

#### Flow
```
Server Component (Page)
    ↓
1. requireAuth() - Verify user is authenticated
    ↓
2. prefetchWorkflow() - Fetch workflow data on server
    ↓
3. Return JSX with HydrateClient wrapper
    ↓
Client Side Hydration
    ↓
4. Suspense boundary activates
    ↓
5. Client components fetch data (already cached from prefetch)
    ↓
6. Components render with data
```

---

### 2. Editor Header Component (`editor-header.tsx`)

**Location:** `src/features/editor/components/editor-header.tsx`

This is a client component module with four exported components:

#### Component Breakdown

##### `EditorSaveButton`
```tsx
export const EditorSaveButton = ({ workflowId }: { workflowId: string }) => {
  return (
    <div className="ml-auto">
      <Button size="sm" onClick={() => {}} disabled={false}>
        <SaveIcon className="size-4" />
        Save
      </Button>
    </div>
  );
};
```
- **Purpose**: Renders a save button (currently non-functional placeholder)
- **Position**: Right side of header (`ml-auto`)
- **Future**: Will trigger workflow save functionality

##### `EditorNameInput`
```tsx
export const EditorNameInput = ({ workflowId }: { workflowId: string }) => {
  const { data: workflow } = useSuspenseWorkflow(workflowId);
  const updateWorkflow = useUpdateWorkflowName();

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(workflow.name);
  const inputRef = useRef<HTMLInputElement>(null);
  // ... implementation
};
```

**Purpose**: Inline editable workflow name in breadcrumb

**State Management**:
- `isEditing`: Toggles between display and edit mode
- `name`: Local state for the input value
- `inputRef`: Reference for focus management

**Data Fetching**:
- Uses `useSuspenseWorkflow(workflowId)` to get workflow data
- Uses `useUpdateWorkflowName()` mutation to update name on server

**User Interactions**:
1. **Click to Edit**: Clicking the breadcrumb item enters edit mode
2. **Auto Focus**: Input is automatically focused and text selected
3. **Save Triggers**:
   - Press **Enter** → Save changes
   - Click **outside** (onBlur) → Save changes
   - Press **Escape** → Cancel and revert to original name
4. **Optimistic Updates**: Local state updates immediately, then syncs with server

**Flow**:
```
User clicks workflow name
    ↓
setIsEditing(true)
    ↓
useEffect runs → input.focus() + input.select()
    ↓
User types new name
    ↓
User presses Enter or clicks away
    ↓
handleSave() called
    ↓
Check if name changed
    ↓
If changed → updateWorkflow.mutateAsync()
    ↓
On success → React Query invalidates cache
    ↓
useSuspenseWorkflow refetches → UI updates
    ↓
On error → Revert to original name
```

##### `EditorBreadcrumbs`
```tsx
export const EditorBreadcrumbs = ({ workflowId }: { workflowId: string }) => {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link prefetch href="/workflows">
              Workflows
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <EditorNameInput workflowId={workflowId} />
      </BreadcrumbList>
    </Breadcrumb>
  );
};
```
- **Purpose**: Navigation breadcrumb trail
- **Structure**: "Workflows" → "/" → "[Workflow Name]"
- **Navigation**: Link back to workflows list page
- **Dynamic**: Workflow name is editable inline

##### `EditorHeader` (Main Export)
```tsx
export const EditorHeader = ({ workflowId }: { workflowId: string }) => {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 bg-background">
      <SidebarTrigger />
      <div className="flex flex-row items-center justify-between gap-x-4 w-full">
        <EditorBreadcrumbs workflowId={workflowId} />
        <EditorSaveButton workflowId={workflowId} />
      </div>
    </header>
  );
};
```
- **Layout**: Fixed height (h-14), border bottom, padding
- **Structure**: `[SidebarTrigger] [Breadcrumbs ... SaveButton]`
- **Responsive**: Full width with space-between for breadcrumbs and button

---

### 3. Editor Component (`editor.tsx`)

**Location:** `src/features/editor/components/editor.tsx`

#### Component Breakdown

##### `EditorLoading`
```tsx
export const EditorLoading = () => {
  return <LoadingView message="Loading editor..." />;
};
```
- **Purpose**: Shown by Suspense boundary while data is loading
- **Uses**: Shared `LoadingView` component from `@/components/entity-components`

##### `EditorError`
```tsx
export const EditorError = () => {
  return <ErrorView message="Error loading editor" />;
};
```
- **Purpose**: Shown by ErrorBoundary when data fetching fails
- **Uses**: Shared `ErrorView` component from `@/components/entity-components`

##### `Editor` (Main Component)
```tsx
export const Editor = ({ workflowId }: { workflowId: string }) => {
  const { data: workflow } = useSuspenseWorkflow(workflowId);
  return <p>{JSON.stringify(workflow, null, 2)}</p>;
};
```
- **Current State**: Debug placeholder showing raw workflow JSON
- **Data**: Uses `useSuspenseWorkflow` for automatic suspense handling
- **Future**: Will be replaced with visual workflow editor UI

---

### 4. Workflow Hooks (`use-workflows.ts`)

**Location:** `src/features/workflows/hooks/use-workflows.ts`

#### New Hook 1: `useSuspenseWorkflow`

```tsx
export const useSuspenseWorkflow = (id: string) => {
  const trpc = useTRPC();
  return useSuspenseQuery(trpc.workflows.getOne.queryOptions({ id }));
};
```

**Purpose**: Fetch a single workflow with React Suspense integration

**Key Features**:
- Uses `useSuspenseQuery` instead of `useQuery`
- Automatically throws promises to nearest Suspense boundary
- No need for manual loading states
- Data is guaranteed to be available (no undefined checks)

**Type Safety**: Return type is automatically inferred from tRPC router

#### New Hook 2: `useUpdateWorkflowName`

```tsx
export const useUpdateWorkflowName = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.workflows.updateName.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Workflow "${data.name}" updated`);
        queryClient.invalidateQueries(trpc.workflows.getMany.queryOptions({}));
        queryClient.invalidateQueries(
          trpc.workflows.getOne.queryOptions({ id: data.id })
        );
      },
      onError: (error) => {
        toast.error(`Failed to update workflow: ${error.message}`);
      },
    })
  );
};
```

**Purpose**: Update workflow name with optimistic UI and cache management

**Flow**:
1. **Mutation Call**: `updateWorkflow.mutateAsync({ id, name })`
2. **API Request**: tRPC calls `workflows.updateName` procedure
3. **Success Path**:
   - Show success toast notification
   - Invalidate `getMany` query (workflows list updates)
   - Invalidate `getOne` query (current workflow updates)
   - React Query automatically refetches invalidated queries
4. **Error Path**:
   - Show error toast notification
   - Component can handle error (e.g., revert local state)

**Cache Invalidation Strategy**:
- Invalidates both the list view and detail view
- Ensures consistency across all parts of the application
- Triggers automatic refetch of stale data

---

### 5. Workflow Prefetch (`prefetch.ts`)

**Location:** `src/features/workflows/server/prefetch.ts`

#### New Function: `prefetchWorkflow`

```tsx
export const prefetchWorkflow = (id: string) => {
  return prefetch(trpc.workflows.getOne.queryOptions({ id }));
};
```

**Purpose**: Server-side data prefetching for individual workflows

**How It Works**:
1. Called in Server Component (page.tsx)
2. Fetches workflow data on the server
3. Populates React Query cache
4. Cache is serialized and sent to client
5. Client-side queries hit cache instantly (no loading state)

**Benefits**:
- Eliminates loading spinners on initial page load
- Improves perceived performance
- SEO-friendly (data available on server render)
- Reduces client-server roundtrips

---

### 6. Workflow Router (`routers.ts`)

**Location:** `src/features/workflows/server/routers.ts`

#### Modified Procedure: `getOne`

**Before:**
```typescript
getOne: protectedProcedure
  .input(z.object({ id: z.string() }))
  .query(({ ctx, input }) => {
    return prisma.workflow.findUnique({
      where: { id: input.id, userId: ctx.auth.user.id },
    });
  }),
```

**After:**
```typescript
getOne: protectedProcedure
  .input(z.object({ id: z.string() }))
  .query(({ ctx, input }) => {
    return prisma.workflow.findUniqueOrThrow({
      where: { id: input.id, userId: ctx.auth.user.id },
    });
  }),
```

#### Key Change: `findUnique` → `findUniqueOrThrow`

**Why This Change?**

1. **Error Handling**:
   - `findUnique` returns `null` if not found
   - `findUniqueOrThrow` throws an error if not found

2. **Type Safety**:
   - With `findUnique`: Return type is `Workflow | null`
   - With `findUniqueOrThrow`: Return type is `Workflow` (never null)

3. **Client Benefits**:
   - No need for null checks in components
   - ErrorBoundary catches the error automatically
   - Cleaner component code

4. **User Experience**:
   - Missing workflows trigger error UI
   - Clear feedback when accessing invalid workflow IDs
   - Prevents rendering partial UI with missing data

---

## Complete Data Flow

### Initial Page Load

```
1. User navigates to /workflows/[workflowId]
    ↓
2. Next.js Server renders page.tsx
    ↓
3. requireAuth() verifies authentication
    ↓
4. prefetchWorkflow(workflowId) fetches data
    ↓
    ├─→ tRPC calls workflows.getOne
    ├─→ Prisma queries database
    ├─→ Data stored in React Query cache
    └─→ Cache serialized for client
    ↓
5. Server returns HTML + serialized cache
    ↓
6. Client hydrates React components
    ↓
7. HydrateClient deserializes cache
    ↓
8. Suspense boundary resolves immediately (cache hit)
    ↓
9. Components render with data
    ↓
10. User sees fully loaded page (no loading state!)
```

### Workflow Name Update Flow

```
1. User clicks workflow name in breadcrumb
    ↓
2. EditorNameInput enters edit mode
    ↓
3. Input focused and text selected
    ↓
4. User types new name
    ↓
5. User presses Enter or clicks away
    ↓
6. handleSave() called
    ↓
7. updateWorkflow.mutateAsync({ id, name })
    ↓
    ├─→ tRPC POST to /api/trpc/workflows.updateName
    ├─→ Server validates input with Zod
    ├─→ Prisma updates database
    ├─→ Returns updated workflow object
    └─→ Client receives response
    ↓
8. onSuccess handler runs
    ↓
    ├─→ Show success toast
    ├─→ Invalidate workflows.getMany cache
    ├─→ Invalidate workflows.getOne cache
    └─→ React Query refetches stale queries
    ↓
9. useSuspenseWorkflow receives new data
    ↓
10. Component re-renders with updated name
    ↓
11. Breadcrumb shows new name
```

### Error Handling Flow

```
Scenario 1: Workflow Not Found
    ↓
prefetchWorkflow() or useSuspenseWorkflow()
    ↓
tRPC calls workflows.getOne
    ↓
Prisma findUniqueOrThrow() throws error
    ↓
tRPC catches error, returns error response
    ↓
React Query throws error
    ↓
ErrorBoundary catches error
    ↓
<EditorError /> displayed to user

Scenario 2: Network Failure on Name Update
    ↓
updateWorkflow.mutateAsync()
    ↓
Network request fails
    ↓
onError handler runs
    ↓
Error toast displayed
    ↓
Component reverts to original name
    ↓
User can retry
```

---

## React Patterns Used

### 1. Server Components
- `page.tsx` is a Server Component
- Runs on server, can directly access database
- No JavaScript shipped to client for this component

### 2. Client Components
- `editor-header.tsx` and `editor.tsx` use `"use client"`
- Required for interactivity (state, events, hooks)
- Hydrated on client after server render

### 3. Suspense Boundaries
- Wraps async components
- Shows fallback (`<EditorLoading />`) while data loads
- Automatically resolves when data is ready

### 4. Error Boundaries
- Catches errors from child components
- Shows error UI (`<EditorError />`)
- Prevents entire page crash

### 5. Optimistic Updates
- Name updates immediately in local state
- Server sync happens in background
- Reverts on error for consistency

---

## tRPC Integration

### Type Safety Flow

```
Server (routers.ts)
    ↓
Define procedure with input/output types
    ↓
tRPC generates types
    ↓
Client (hooks)
    ↓
Import tRPC client
    ↓
TypeScript knows exact types
    ↓
No manual type definitions needed!
```

### Example Type Inference

```typescript
// Server
getOne: protectedProcedure
  .input(z.object({ id: z.string() }))
  .query(() => { ... })

// Client - TypeScript knows:
useSuspenseWorkflow(id: string) // id must be string
  returns { data: Workflow }     // Workflow type inferred

// No need to write:
// interface GetOneInput { id: string }
// interface GetOneOutput { ... }
```

---

## React Query Integration

### Cache Management

```
Cache Key Structure:
[
  ["workflows", "getOne", { id: "abc123" }],
  ["workflows", "getMany", { page: 1, pageSize: 10, search: "" }]
]
```

### Cache Invalidation Strategy

When workflow name is updated:
1. Invalidate `getOne` for specific workflow (detail page updates)
2. Invalidate `getMany` (list page updates if name is visible)
3. React Query automatically refetches active queries
4. Inactive queries are marked stale (refetch on next mount)

---

## UI/UX Features

### Inline Editing Pattern

1. **Display Mode**:
   - Workflow name shown as breadcrumb item
   - Hover effect indicates it's clickable

2. **Edit Mode**:
   - Transforms into an input field
   - Auto-focus and text selection
   - Minimum width to prevent layout shift

3. **Save Mechanisms**:
   - **Enter**: Immediate save
   - **Blur**: Save when clicking away
   - **Escape**: Cancel and revert

4. **Loading State**:
   - Input disabled during save
   - User can't edit while request is pending

5. **Error Recovery**:
   - Local state reverts on error
   - Toast notification explains what happened
   - User can immediately retry

---

## Future Enhancements

Based on the placeholder implementations:

### 1. EditorSaveButton
Currently has empty onClick handler. Future implementation will:
- Save workflow definition/state
- Show loading state while saving
- Trigger autosave on changes

### 2. Editor Component
Currently shows JSON dump. Future implementation will:
- Visual workflow builder/canvas
- Drag-and-drop nodes
- Connection lines between nodes
- Node configuration panels
- Real-time validation

---

## Testing Considerations

### Unit Tests
- `EditorNameInput`: Test edit mode, save, cancel, error handling
- `useUpdateWorkflowName`: Mock tRPC calls, test cache invalidation
- `useSuspenseWorkflow`: Test suspense behavior

### Integration Tests
- Full page load with prefetch
- Name update end-to-end
- Error boundary triggers
- Cache synchronization

### E2E Tests
- Navigate to workflow editor
- Edit workflow name
- Verify name updates in list and detail views
- Test invalid workflow ID handling

---

## Performance Optimizations

1. **Server-Side Prefetch**: Eliminates loading spinners
2. **Suspense**: Parallel data fetching
3. **Cache Invalidation**: Only refetch what changed
4. **Optimistic Updates**: Instant UI feedback
5. **Ref for Input**: Avoid re-renders during typing

---

## Security Considerations

1. **Authentication**: `requireAuth()` on server component
2. **Authorization**: `userId` check in Prisma queries
3. **Input Validation**: Zod schemas on all tRPC procedures
4. **XSS Prevention**: React escapes all rendered content
5. **CSRF**: tRPC uses POST requests with proper headers

---

## Summary

This implementation adds a comprehensive workflow editor page with:
- ✅ Server-side data prefetching for instant page loads
- ✅ Type-safe API calls with tRPC
- ✅ Inline editable workflow names
- ✅ Proper error and loading states
- ✅ Optimistic UI updates
- ✅ Automatic cache management
- ✅ Navigation breadcrumbs
- ✅ Placeholder for save functionality
- ✅ Foundation for visual workflow editor

The architecture follows Next.js 15 best practices with Server Components, proper separation of concerns, and excellent developer experience through end-to-end type safety.
