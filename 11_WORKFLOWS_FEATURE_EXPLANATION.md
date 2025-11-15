# Workflows Feature - Complete Data Flow Explanation

## Overview

This document explains the newly added **Workflows** feature in the Nodebase application. The feature allows authenticated users to create, view, update, and delete workflow entities. It demonstrates a complete end-to-end implementation using Next.js 15, tRPC, Prisma, and React Query.

---

## Table of Contents

1. [Database Layer](#1-database-layer)
2. [API Layer (tRPC)](#2-api-layer-trpc)
3. [Server-Side Data Prefetching](#3-server-side-data-prefetching)
4. [Client-Side React Hooks](#4-client-side-react-hooks)
5. [UI Components](#5-ui-components)
6. [Page Implementation](#6-page-implementation)
7. [Complete Data Flow](#7-complete-data-flow)
8. [Supporting Features](#8-supporting-features)
9. [File Organization](#9-file-organization)

---

## 1. Database Layer

### Schema Definition
**File:** [prisma/schema.prisma](prisma/schema.prisma)

```prisma
model Workflow {
  id        String   @id @default(cuid())
  name      String
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @default(now()) @updatedAt

  @@map("workflow")
}
```

**Key Points:**
- Each workflow belongs to a single user
- Uses `cuid()` for unique IDs
- `onDelete: Cascade` means deleting a user automatically deletes their workflows
- Table name in database is `workflow` (lowercase, via `@@map`)

### Database Migration
**File:** [prisma/migrations/20251115153055_workflow_update/migration.sql](prisma/migrations/20251115153055_workflow_update/migration.sql)

Creates the `workflow` table with foreign key constraint to `user` table.

---

## 2. API Layer (tRPC)

### Workflows Router
**File:** [src/features/workflows/server/routers.ts](src/features/workflows/server/routers.ts)

This file defines all API endpoints (procedures) for workflows:

```typescript
export const workflowsRouter = createTRPCRouter({
  create: protectedProcedure.mutation(({ ctx }) => { ... }),
  remove: protectedProcedure.input(...).mutation(({ ctx, input }) => { ... }),
  updateName: protectedProcedure.input(...).mutation(({ ctx, input }) => { ... }),
  getOne: protectedProcedure.input(...).query(({ ctx, input }) => { ... }),
  getMany: protectedProcedure.query(({ ctx }) => { ... }),
});
```

#### Breakdown of Each Procedure:

**1. `create` - Create a new workflow**
- Type: `mutation` (modifies data)
- Auth: Protected (requires authentication via `protectedProcedure`)
- Input: None
- Action: Creates a workflow with a random name (using `random-word-slugs` package)
- Returns: The newly created workflow object

**2. `remove` - Delete a workflow**
- Type: `mutation`
- Auth: Protected
- Input: `{ id: string }` (workflow ID)
- Action: Deletes the workflow only if it belongs to the authenticated user
- Returns: The deleted workflow object

**3. `updateName` - Rename a workflow**
- Type: `mutation`
- Auth: Protected
- Input: `{ id: string, name: string }` (name must be at least 1 character)
- Action: Updates the workflow name only if it belongs to the authenticated user
- Returns: The updated workflow object

**4. `getOne` - Get a single workflow**
- Type: `query` (reads data)
- Auth: Protected
- Input: `{ id: string }`
- Action: Fetches one workflow if it belongs to the authenticated user
- Returns: Workflow object or null

**5. `getMany` - Get all user's workflows**
- Type: `query`
- Auth: Protected
- Input: None
- Action: Fetches all workflows belonging to the authenticated user
- Returns: Array of workflow objects

**Security Note:** All procedures use `protectedProcedure`, which ensures:
- User must be logged in
- `ctx.auth.user.id` is available (current user's ID)
- Each query filters by `userId` to prevent access to other users' workflows

### App Router Registration
**File:** [src/trpc/routers/_app.ts](src/trpc/routers/_app.ts)

The workflows router is registered here:

```typescript
export const appRouter = createTRPCRouter({
  workflows: workflowsRouter,
});
```

This makes all procedures accessible via `trpc.workflows.*` on the client.

---

## 3. Server-Side Data Prefetching

### Prefetch Function
**File:** [src/features/workflows/server/prefetch.ts](src/features/workflows/server/prefetch.ts)

```typescript
export const prefetchWorkflows = (params: Input) => {
  return prefetch(trpc.workflows.getMany.queryOptions(params));
};
```

**Purpose:** Prefetch workflow data on the server before sending HTML to the client.

**How it works:**
1. Called in the Server Component (the page)
2. Fetches data directly from the database (no HTTP request)
3. Populates React Query cache
4. Data is serialized and sent with the initial HTML (hydration)
5. Client receives pre-loaded data instantly (no loading spinner needed)

**Benefits:**
- Faster perceived performance
- No loading state on first render
- SEO-friendly (data in initial HTML)

### Server Utilities
**File:** [src/trpc/server.tsx](src/trpc/server.tsx)

Two new utilities were added:

**1. `prefetch` function**
```typescript
export function prefetch<T extends ReturnType<TRPCQueryOptions<any>>>(
  queryOptions: T
) {
  const queryClient = getQueryClient();
  if (queryOptions.queryKey[1]?.type === "infinite") {
    void queryClient.prefetchInfiniteQuery(queryOptions as any);
  } else {
    void queryClient.prefetchQuery(queryOptions);
  }
}
```

Handles prefetching both regular and infinite queries.

**2. `HydrateClient` component**
```typescript
export function HydrateClient(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {props.children}
    </HydrationBoundary>
  );
}
```

Transfers server-side React Query cache to the client.

---

## 4. Client-Side React Hooks

### Custom Hooks
**File:** [src/features/workflows/hooks/use-workflows.ts](src/features/workflows/hooks/use-workflows.ts)

**1. `useSuspenseWorkflows()` - Fetch all workflows**

```typescript
export const useSuspenseWorkflows = () => {
  const trpc = useTRPC();
  return useSuspenseQuery(trpc.workflows.getMany.queryOptions());
};
```

- Uses `useSuspenseQuery` for automatic loading states
- Reads from the prefetched cache (no HTTP request on first render)
- Automatically re-fetches when data becomes stale
- Suspends rendering until data is available

**2. `useCreateWorkflow()` - Create a new workflow**

```typescript
export const useCreateWorkflow = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.workflows.create.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Workflow "${data.name}" created`);
        queryClient.invalidateQueries(trpc.workflows.getMany.queryOptions());
      },
      onError: (error) => {
        toast.error(`Error creating workflow: ${error.message}`);
      },
    })
  );
};
```

**What happens when a workflow is created:**
1. User clicks "New Workflow" button
2. Mutation is triggered (HTTP POST to tRPC endpoint)
3. Server creates workflow in database
4. `onSuccess` callback runs:
   - Shows success toast notification
   - Invalidates the `getMany` query cache
   - Triggers automatic re-fetch of workflows
5. UI updates with new workflow

---

## 5. UI Components

### Entity Components (Reusable UI)
**File:** [src/components/entity-components.tsx](src/components/entity-components.tsx)

Generic, reusable components for any entity type (workflows, credentials, etc.):

**1. `EntityHeader` - Page header with action button**
```typescript
<EntityHeader
  title="Workflows"
  description="Create and manage your workflows"
  onNew={handleCreate}
  newButtonLabel="New Workflow"
  disabled={false}
  isCreating={false}
/>
```

**2. `EntityContainer` - Layout wrapper**
```typescript
<EntityContainer
  header={<WorkflowsHeader />}
  search={<></>}
  pagination={<></>}
>
  {children}
</EntityContainer>
```

### Workflow-Specific Components
**File:** [src/features/workflows/components/workflows.tsx](src/features/workflows/components/workflows.tsx)

**1. `WorkflowsContainer` - Outer container**
- Wraps the entire workflows page
- Provides header with "New Workflow" button
- Placeholder for search and pagination (future features)

**2. `WorkflowsHeader` - Header with create button**
- Handles workflow creation
- Shows upgrade modal if user hits subscription limit
- Redirects to new workflow editor on success
- Integrated with `useUpgradeModal` hook

**3. `WorkflowsList` - Displays workflows**
- Currently just shows JSON (placeholder)
- Uses `useSuspenseWorkflows()` to fetch data
- Will be enhanced with cards/table UI

---

## 6. Page Implementation

### Workflows Page
**File:** [src/app/(dashboard)/(rest)/workflows/page.tsx](src/app/(dashboard)/(rest)/workflows/page.tsx)

```typescript
const Page = async () => {
  await requireAuth();  // 1. Ensure user is logged in

  prefetchWorkflows();  // 2. Prefetch data on server

  return (
    <WorkflowsContainer>
      <HydrateClient>  {/* 3. Transfer cache to client */}
        <ErrorBoundary fallback={<p>Error!</p>}>  {/* 4. Error handling */}
          <Suspense fallback={<p>Loading...</p>}>  {/* 5. Loading state */}
            <WorkflowsList />  {/* 6. Actual content */}
          </Suspense>
        </ErrorBoundary>
      </HydrateClient>
    </WorkflowsContainer>
  );
};
```

**Execution flow:**
1. **Server-side** (before HTML is sent):
   - `requireAuth()` checks authentication (redirects if not logged in)
   - `prefetchWorkflows()` fetches data from database
   - Server renders page with data already in cache

2. **Client-side** (in browser):
   - `HydrateClient` receives serialized cache
   - `Suspense` manages loading states
   - `ErrorBoundary` catches errors
   - `WorkflowsList` renders with pre-loaded data

---

## 7. Complete Data Flow

### Creating a Workflow (Step-by-Step)

**User Action → Database Update**

```
1. USER CLICKS "New Workflow" BUTTON
   └─ Component: WorkflowsHeader

2. handleCreate() FUNCTION RUNS
   └─ Calls: createWorkflow.mutate()

3. CLIENT SENDS HTTP REQUEST
   └─ POST /api/trpc/workflows.create

4. tRPC RECEIVES REQUEST
   └─ Route: src/app/api/trpc/[trpc]/route.ts

5. ROUTER EXECUTES PROCEDURE
   └─ Function: workflowsRouter.create (in routers.ts)
   └─ Authenticates user via protectedProcedure

6. DATABASE OPERATION
   └─ prisma.workflow.create({
        data: {
          name: generateSlug(3),  // e.g., "happy-blue-cat"
          userId: ctx.auth.user.id
        }
      })

7. DATABASE RETURNS NEW WORKFLOW
   └─ { id: "...", name: "happy-blue-cat", userId: "...", ... }

8. RESPONSE SENT TO CLIENT
   └─ tRPC serializes and sends data

9. onSuccess CALLBACK RUNS
   ├─ Shows toast: "Workflow 'happy-blue-cat' created"
   ├─ Invalidates cache: queryClient.invalidateQueries()
   └─ Router redirects: router.push(`/workflows/${data.id}`)

10. WORKFLOWS LIST AUTO-REFRESHES
    └─ useSuspenseWorkflows() re-fetches from server
    └─ UI updates with new workflow
```

### Fetching Workflows (Step-by-Step)

**Page Load → Display Data**

```
SERVER-SIDE (Next.js Server Component):

1. PAGE LOADS
   └─ File: src/app/(dashboard)/(rest)/workflows/page.tsx

2. AUTH CHECK
   └─ await requireAuth() - redirects to /login if not authenticated

3. DATA PREFETCH
   └─ prefetchWorkflows() runs
   └─ Calls: trpc.workflows.getMany.queryOptions()

4. SERVER tRPC CALL (NO HTTP)
   └─ caller.workflows.getMany() - direct database query
   └─ Prisma: prisma.workflow.findMany({ where: { userId: "..." } })

5. CACHE POPULATED
   └─ React Query cache on server now has workflows data

6. HTML GENERATED
   └─ Server renders components with data
   └─ Cache serialized into __NEXT_DATA__ script tag

---

CLIENT-SIDE (Browser):

7. HTML RECEIVED
   └─ Browser parses HTML

8. REACT HYDRATION
   └─ HydrateClient extracts cache from __NEXT_DATA__
   └─ React Query cache populated client-side

9. COMPONENT RENDERS
   └─ WorkflowsList calls useSuspenseWorkflows()
   └─ Data already in cache - NO LOADING STATE
   └─ Immediate render with data

10. USER SEES WORKFLOWS
    └─ No spinner, instant display
```

---

## 8. Supporting Features

### Upgrade Modal System

When a user exceeds their subscription limits, the app shows an upgrade prompt.

**Hook:** [src/hooks/use-upgrade-modal.tsx](src/hooks/use-upgrade-modal.tsx)

```typescript
export const useUpgradeModal = () => {
  const [open, setOpen] = useState(false);

  const handleError = (error: unknown) => {
    if (error instanceof TRPCClientError) {
      if (error.data?.code === "FORBIDDEN") {
        setOpen(true);  // Show upgrade modal
        return true;
      }
    }
    return false;
  };

  const modal = <UpgradeModal open={open} onOpenChange={setOpen} />;

  return { handleError, modal };
};
```

**Usage in WorkflowsHeader:**
```typescript
createWorkflow.mutate(undefined, {
  onSuccess: (data) => { ... },
  onError: (error) => {
    handleError(error);  // Shows modal if FORBIDDEN error
  },
});
```

**Modal Component:** [src/components/upgrade-modal.tsx](src/components/upgrade-modal.tsx)

Shows a dialog with "Upgrade Now" button that triggers checkout flow.

### Component Organization Changes

Two components were moved from `components/ui/` to `components/`:

1. **app-sidebar.tsx** - Main navigation sidebar
2. **app-header.tsx** - Page header with sidebar toggle

**Reason:** These are app-specific components, not reusable UI primitives. The `ui/` folder is reserved for shadcn/ui components.

---

## 9. File Organization

The feature follows a **feature-based** folder structure:

```
src/features/workflows/
├── server/
│   ├── routers.ts      # tRPC API procedures
│   └── prefetch.ts     # Server-side data prefetching
├── hooks/
│   └── use-workflows.ts  # Client-side React hooks
└── components/
    └── workflows.tsx    # UI components
```

**Benefits:**
- All workflow-related code in one place
- Easy to find and modify
- Scalable (can add more features like `features/credentials/`)
- Clear separation of server/client code

---

## Technology Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Database** | PostgreSQL + Prisma | Store workflow data |
| **API** | tRPC v11 | Type-safe API calls |
| **Server Rendering** | Next.js 15 Server Components | SSR with data prefetching |
| **State Management** | React Query (TanStack Query) | Cache & synchronization |
| **Client Components** | React 19 | Interactive UI |
| **Forms & Validation** | Zod | Input validation |
| **UI Components** | shadcn/ui | Pre-built components |
| **Styling** | Tailwind CSS v4 | Utility-first CSS |
| **Auth** | Better Auth | User authentication |
| **Notifications** | Sonner | Toast messages |

---

## Key Concepts Explained

### 1. Server Components vs Client Components

**Server Component** (default in Next.js 15):
- Runs only on server
- Can directly access database
- No JavaScript sent to browser
- Cannot use hooks or interactivity

**Client Component** (`"use client"` directive):
- Runs in browser
- Can use React hooks
- Handles user interactions
- Makes HTTP requests to API

### 2. Prefetching vs Direct Fetching

**Prefetching** (Server Component):
```typescript
prefetchWorkflows();  // Runs on server, populates cache
```
- No loading spinner
- Data in initial HTML
- Better SEO

**Direct Fetching** (Client Component):
```typescript
const { data } = useSuspenseWorkflows();  // Uses prefetched cache
```
- Shows loading state if cache empty
- Runs in browser
- Re-validates stale data

### 3. Type Safety Flow

```typescript
// Server defines API
export const workflowsRouter = createTRPCRouter({
  getMany: protectedProcedure.query(() => { ... })
});

// TypeScript infers types automatically
export type AppRouter = typeof appRouter;

// Client gets full type safety
const { data } = useSuspenseWorkflows();
//     ^-- TypeScript knows exact shape of data
```

No manual type definitions needed!

---

## Dependencies Added

**File:** [package.json](package.json)

1. **`random-word-slugs`** - Generate random workflow names (e.g., "happy-blue-cat")
2. **`react-error-boundary`** - Error handling in React components

---

## Summary

This workflows feature demonstrates a **modern, production-ready** implementation of CRUD operations in a Next.js app:

**Key Achievements:**
✅ Type-safe API with tRPC
✅ Server-side rendering with data prefetching
✅ Optimistic client-side caching
✅ Row-level security (users can only access their own workflows)
✅ Error handling and loading states
✅ Subscription limit enforcement with upgrade modal
✅ Toast notifications for user feedback
✅ Clean, feature-based code organization

**Data Flow Summary:**
1. User loads page → Server prefetches data
2. HTML sent with data already in cache
3. Client hydrates and renders instantly
4. User creates workflow → Mutation sent to server
5. Server validates, saves to database, returns result
6. Client cache updates, UI re-renders automatically

This pattern can be reused for other entities like credentials, executions, etc.
