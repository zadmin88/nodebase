# tRPC Implementation Explanation

## What is tRPC?

tRPC allows you to build **end-to-end typesafe APIs** without any code generation or runtime bloat. You write TypeScript functions on the server, and call them from the client with full type safety.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BROWSER (CLIENT SIDE)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Client Component (src/app/client.tsx)                       │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │ "use client"                                            │  │  │
│  │  │                                                          │  │  │
│  │  │ const trpc = useTRPC()                                  │  │  │
│  │  │ const { data } = useSuspenseQuery(                      │  │  │
│  │  │   trpc.getUsers.queryOptions()  ← Full TypeScript!     │  │  │
│  │  │ )                                                        │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              ▲                                       │
│                              │                                       │
│                              │ Types & Data                          │
│                              │                                       │
│  ┌──────────────────────────▼───────────────────────────────────┐  │
│  │  TRPCReactProvider (src/trpc/client.tsx)                     │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │ • Creates tRPC Client                                   │  │  │
│  │  │ • Sets up React Query                                   │  │  │
│  │  │ • Configures HTTP batch link                           │  │  │
│  │  │ • URL: /api/trpc                                        │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                       │
└───────────────────────────────┬───────────────────────────────────────┘
                                │
                                │ HTTP Request (batched)
                                │ POST /api/trpc
                                │
┌───────────────────────────────▼───────────────────────────────────────┐
│                        SERVER SIDE (Next.js)                          │
├─────────────────────────────────────────────────────────────────────┬─┤
│                                                                       │ │
│  ┌──────────────────────────────────────────────────────────────┐  │ │
│  │  API Route (src/app/api/trpc/[trpc]/route.ts)               │  │ │
│  │  ┌────────────────────────────────────────────────────────┐  │  │ │
│  │  │ export { handler as GET, handler as POST }             │  │  │ │
│  │  │                                                          │  │  │ │
│  │  │ fetchRequestHandler({                                   │  │  │ │
│  │  │   endpoint: "/api/trpc",                                │  │  │ │
│  │  │   req,                                                   │  │  │ │
│  │  │   router: appRouter,  ────────────┐                     │  │  │ │
│  │  │   createContext       ─────────┐  │                     │  │  │ │
│  │  │ })                             │  │                     │  │  │ │
│  │  └────────────────────────────────┼──┼─────────────────────┘  │  │ │
│  └───────────────────────────────────┼──┼────────────────────────┘  │ │
│                                      │  │                            │ │
│  ┌───────────────────────────────────▼──┼────────────────────────┐  │ │
│  │  Context (src/trpc/init.ts)          │                        │  │ │
│  │  ┌────────────────────────────────┐  │                        │  │ │
│  │  │ createTRPCContext = async () => │  │                        │  │ │
│  │  │   return { userId: "user_123" } │  │                        │  │ │
│  │  │ }                                │  │                        │  │ │
│  │  │                                  │  │                        │  │ │
│  │  │ • Available in all procedures   │  │                        │  │ │
│  │  │ • Can include: auth, db, etc.   │  │                        │  │ │
│  │  └────────────────────────────────┘  │                        │  │ │
│  └───────────────────────────────────────┼────────────────────────┘  │ │
│                                          │                            │ │
│  ┌───────────────────────────────────────▼────────────────────────┐  │ │
│  │  App Router (src/trpc/routers/_app.ts)                         │  │ │
│  │  ┌────────────────────────────────────────────────────────┐   │  │ │
│  │  │ export const appRouter = createTRPCRouter({            │   │  │ │
│  │  │   getUsers: baseProcedure.query(() => {               │   │  │ │
│  │  │     return prisma.user.findMany();  ◄── Database      │   │  │ │
│  │  │   }),                                                   │   │  │ │
│  │  │ })                                                      │   │  │ │
│  │  │                                                          │   │  │ │
│  │  │ export type AppRouter = typeof appRouter;  ◄── Types! │   │  │ │
│  │  └────────────────────────────────────────────────────────┘   │  │ │
│  └──────────────────────────────────────────────────────────────┘  │ │
│                                                                       │ │
│  ┌──────────────────────────────────────────────────────────────┐  │ │
│  │  Server-Side Usage (src/trpc/server.tsx)                    │  │ │
│  │  ┌────────────────────────────────────────────────────────┐  │  │ │
│  │  │ import "server-only"  ◄── Cannot be used in client     │  │  │ │
│  │  │                                                          │  │  │ │
│  │  │ export const trpc = createTRPCOptionsProxy(...)         │  │  │ │
│  │  │                                                          │  │  │ │
│  │  │ • Used in Server Components                             │  │  │ │
│  │  │ • Direct database access                                │  │  │ │
│  │  │ • No HTTP overhead                                      │  │  │ │
│  │  └────────────────────────────────────────────────────────┘  │  │ │
│  └──────────────────────────────────────────────────────────────┘  │ │
│                                                                       │ │
└───────────────────────────────────────────────────────────────────────┘ │
  │                                                                         │
  │  ┌───────────────────────────────────────────────────────────────┐    │
  └─►│  Database (PostgreSQL via Prisma)                             │    │
     │  • prisma.user.findMany()                                      │    │
     └───────────────────────────────────────────────────────────────┘    │
                                                                            │
                                                                            │
```

## Data Flow Explained

### 1️⃣ **Client Component Makes Request** ([src/app/client.tsx:7-8](src/app/client.tsx#L7-L8))

```typescript
const trpc = useTRPC();
const { data: users } = useSuspenseQuery(trpc.getUsers.queryOptions());
```

**What happens:**
- `useTRPC()` hook gets the tRPC client instance
- `trpc.getUsers` is fully typed based on your server router
- TypeScript knows the return type without any manual typing!

### 2️⃣ **Request Goes Through Provider** ([src/trpc/client.tsx:32-59](src/trpc/client.tsx#L32-L59))

```typescript
export function TRPCReactProvider({ children }) {
  const trpcClient = createTRPCClient<AppRouter>({
    links: [httpBatchLink({ url: "/api/trpc" })],
  });

  return (
    <QueryClientProvider>
      <TRPCProvider trpcClient={trpcClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
```

**What happens:**
- Creates a tRPC client that knows about your `AppRouter` type
- Uses `httpBatchLink` to batch multiple requests into one HTTP call
- Wraps everything in React Query for caching and state management

### 3️⃣ **HTTP Request Hits API Route** ([src/app/api/trpc/[trpc]/route.ts:4-10](src/app/api/trpc/[trpc]/route.ts#L4-L10))

```typescript
const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: createTRPCContext,
  });
```

**What happens:**
- Next.js routes `/api/trpc/*` to this handler
- `fetchRequestHandler` processes the tRPC request
- Creates a context for this request
- Routes to the correct procedure in `appRouter`

### 4️⃣ **Context is Created** ([src/trpc/init.ts:3-8](src/trpc/init.ts#L3-L8))

```typescript
export const createTRPCContext = cache(async () => {
  return { userId: "user_123" };
});
```

**What happens:**
- Context is created once per request (cached)
- Can include auth info, database connection, user session, etc.
- Available in all procedures via `ctx` parameter

### 5️⃣ **Procedure Executes** ([src/trpc/routers/_app.ts:4-8](src/trpc/routers/_app.ts#L4-L8))

```typescript
export const appRouter = createTRPCRouter({
  getUsers: baseProcedure.query(() => {
    return prisma.user.findMany();
  }),
});
```

**What happens:**
- `baseProcedure.query()` defines a query procedure (read-only)
- Executes database query via Prisma
- Returns data back through the chain
- TypeScript infers return type automatically!

### 6️⃣ **Response Returns to Client**

- Data flows back through API route → HTTP → tRPC Client → React Query → Component
- React Query caches the result
- Component re-renders with data
- **Full type safety from database to UI!**

## Key Concepts

### 🔹 Procedures

There are three types:

```typescript
// Query - for fetching data (GET-like)
baseProcedure.query(() => { ... })

// Mutation - for changing data (POST/PUT/DELETE-like)
baseProcedure.mutation(() => { ... })

// Subscription - for real-time updates (WebSockets)
baseProcedure.subscription(() => { ... })
```

### 🔹 Two Ways to Use tRPC in Next.js

#### **Client Components** (your example)
```typescript
"use client"
const trpc = useTRPC();
const { data } = useSuspenseQuery(trpc.getUsers.queryOptions());
```
- Uses HTTP requests
- Goes through `/api/trpc` endpoint
- Has React Query caching
- Can be used in interactive components

#### **Server Components** ([src/app/page.tsx:1-22](src/app/page.tsx#L1-L22))
```typescript
import { trpc } from "@/trpc/server";

const Page = async () => {
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(trpc.getUsers.queryOptions());
  // ...
}
```
- Direct function calls (no HTTP!)
- Runs on server only
- Faster (no network overhead)
- Can prefetch data for hydration

### 🔹 Type Safety Flow

```
┌─────────────────────────────────────────────────────┐
│ 1. You define the router on server                  │
│    appRouter = { getUsers: procedure.query(...) }   │
└────────────────────┬────────────────────────────────┘
                     │
                     │ export type AppRouter
                     │
┌────────────────────▼────────────────────────────────┐
│ 2. Client imports the TYPE (not implementation!)    │
│    createTRPCClient<AppRouter>                      │
└────────────────────┬────────────────────────────────┘
                     │
                     │ TypeScript magic ✨
                     │
┌────────────────────▼────────────────────────────────┐
│ 3. Client knows all procedures and their types      │
│    trpc.getUsers.queryOptions() → User[]            │
└─────────────────────────────────────────────────────┘
```

**No code generation needed!** TypeScript's type system handles everything.

## Your Implementation Step-by-Step

### Setup Files

1. **[src/trpc/init.ts](src/trpc/init.ts)** - Initialize tRPC
   - Creates the base configuration
   - Defines context creator
   - Exports router/procedure builders

2. **[src/trpc/query-client.ts](src/trpc/query-client.ts)** - React Query config
   - Configures caching behavior (30s stale time)
   - Handles hydration/dehydration

3. **[src/trpc/routers/_app.ts](src/trpc/routers/_app.ts)** - Your API
   - Defines all your procedures
   - Exports the router type

4. **[src/trpc/client.tsx](src/trpc/client.tsx)** - Client setup
   - Creates TRPCReactProvider
   - Configures HTTP transport
   - Exports useTRPC hook

5. **[src/trpc/server.tsx](src/trpc/server.tsx)** - Server setup
   - For Server Components
   - Direct access (no HTTP)

6. **[src/app/api/trpc/[trpc]/route.ts](src/app/api/trpc/[trpc]/route.ts)** - HTTP endpoint
   - Handles HTTP requests from client
   - Routes to correct procedure

### Usage Files

7. **[src/app/layout.tsx:30](src/app/layout.tsx#L30)** - Wrap app
   ```typescript
   <TRPCReactProvider>{children}</TRPCReactProvider>
   ```

8. **[src/app/page.tsx](src/app/page.tsx)** - Server Component
   - Prefetches data on server
   - Hydrates to client

9. **[src/app/client.tsx](src/app/client.tsx)** - Client Component
   - Uses prefetched data
   - Shows in UI

## Benefits You Get

✅ **Type Safety** - Catch errors at compile time, not runtime
✅ **Autocomplete** - Your IDE knows all available procedures
✅ **Refactor Safe** - Rename on server, updates everywhere
✅ **No API Docs Needed** - Types are self-documenting
✅ **Performance** - Request batching, caching, prefetching
✅ **DX** - No REST endpoints, no GraphQL schema, just TypeScript!

## Next Steps to Learn

1. **Add a mutation** (create/update/delete data)
2. **Add input validation** with Zod schemas
3. **Use context** for authentication
4. **Add middleware** for logging, auth checks
5. **Create nested routers** to organize procedures

Would you like me to show you how to add any of these features?
