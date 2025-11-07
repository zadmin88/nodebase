# tRPC Simple Flow Diagram

## The Magic in 3 Steps 🪄

```
┌─────────────────────────────────────────────────────────────────┐
│                    YOU WRITE THIS ON SERVER                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  // src/trpc/routers/_app.ts                                     │
│                                                                   │
│  export const appRouter = createTRPCRouter({                     │
│    getUsers: baseProcedure.query(() => {                         │
│      return prisma.user.findMany();  // Returns User[]          │
│    }),                                                            │
│  });                                                              │
│                                                                   │
│  export type AppRouter = typeof appRouter;                       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ TypeScript types flow automatically
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   YOU USE THIS ON CLIENT                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  // src/app/client.tsx                                           │
│                                                                   │
│  const trpc = useTRPC();                                         │
│  const { data } = useSuspenseQuery(                              │
│    trpc.getUsers.queryOptions()  // TypeScript knows it's User[]│
│  );                                                               │
│                                                                   │
│  // data is typed as User[] automatically! ✨                    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## How Data Actually Flows

```
┌──────────────┐
│   Browser    │  User opens page
│              │
│  1. React    │  ──┐
│     renders  │    │
└──────────────┘    │
                    │
                    ▼
┌──────────────────────────────────────────────────────┐
│  2. Client Component calls:                          │
│                                                       │
│     useSuspenseQuery(trpc.getUsers.queryOptions())   │
│                                                       │
│     • Check cache first (React Query)                │
│     • If not in cache, make HTTP request             │
└─────────────────────────┬────────────────────────────┘
                          │
                          │ HTTP POST /api/trpc
                          │ Body: { method: "getUsers" }
                          │
                          ▼
┌──────────────────────────────────────────────────────┐
│  3. Next.js API Route                                │
│     /api/trpc/[trpc]/route.ts                        │
│                                                       │
│     • Receives request                               │
│     • Creates context: { userId: "user_123" }       │
│     • Routes to appRouter.getUsers                   │
└─────────────────────────┬────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────┐
│  4. Procedure executes                               │
│     appRouter.getUsers.query()                       │
│                                                       │
│     • Runs: prisma.user.findMany()                  │
│     • Gets data from PostgreSQL                      │
│     • Returns: User[]                                │
└─────────────────────────┬────────────────────────────┘
                          │
                          │ JSON response
                          │ { result: [{ id: 1, ... }] }
                          │
                          ▼
┌──────────────────────────────────────────────────────┐
│  5. Back to Client                                   │
│                                                       │
│     • React Query caches the result                  │
│     • Component re-renders with data                 │
│     • TypeScript ensures type safety!                │
└──────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────┐
│   Browser    │  User sees data!
│              │
│  <div>       │
│    User[]    │
│  </div>      │
└──────────────┘
```

## File Organization

```
src/
├── trpc/
│   ├── init.ts              ← tRPC initialization & context
│   ├── routers/
│   │   └── _app.ts          ← ⭐ YOUR API PROCEDURES GO HERE
│   ├── client.tsx           ← Client-side setup (React Query + tRPC)
│   ├── server.tsx           ← Server-side setup (for RSC)
│   └── query-client.ts      ← React Query configuration
│
├── app/
│   ├── api/trpc/[trpc]/
│   │   └── route.ts         ← HTTP endpoint handler
│   ├── layout.tsx           ← Wraps with TRPCReactProvider
│   ├── page.tsx             ← Server Component (prefetch)
│   └── client.tsx           ← Client Component (use data)
│
└── lib/
    └── db.ts                ← Prisma client singleton
```

## The "Aha!" Moments

### 🎯 Moment 1: No Separate API Layer

**Traditional REST:**
```typescript
// Backend: Create REST endpoint
app.get('/api/users', async (req, res) => {
  const users = await db.users.findMany();
  res.json(users);
});

// Frontend: Fetch and type manually
type User = { id: number; name: string }; // ← Manual typing!
const response = await fetch('/api/users');
const users: User[] = await response.json(); // ← Hope it's correct!
```

**With tRPC:**
```typescript
// Backend: Just a function
getUsers: baseProcedure.query(() => prisma.user.findMany())

// Frontend: Call it like a local function
const { data } = useSuspenseQuery(trpc.getUsers.queryOptions());
// ← data is automatically typed as User[]! No manual typing! ✨
```

### 🎯 Moment 2: Types Flow Automatically

```typescript
// You change this on the server...
export const appRouter = createTRPCRouter({
  getUsers: baseProcedure.query(() => {
    return prisma.user.findMany({
      select: { id: true, email: true, name: true }
    });
  }),
});

// ...and TypeScript IMMEDIATELY knows on the client!
const { data } = useSuspenseQuery(trpc.getUsers.queryOptions());
//     ^^^^
//     TypeScript knows this is: { id: number, email: string, name: string | null }[]
```

If you change the return type on server, **you get compile errors** on the client immediately!

### 🎯 Moment 3: Two Execution Modes

**Client Component** (HTTP request):
```typescript
"use client"
const trpc = useTRPC(); // ← Uses HTTP
const { data } = useSuspenseQuery(trpc.getUsers.queryOptions());
```

**Server Component** (direct call):
```typescript
import { trpc } from "@/trpc/server"; // ← No HTTP!
const data = await trpc.getUsers.fetch(); // ← Direct DB access
```

Same procedure, different execution! Server Component is faster (no HTTP overhead).

## What Makes This Work?

### 1. TypeScript's Type Inference

```typescript
// Server defines this:
const appRouter = {
  getUsers: procedure.query(() => User[])
}

// TypeScript extracts the shape:
type AppRouter = typeof appRouter
// = { getUsers: { query: () => User[] } }

// Client receives just the TYPE (not the code):
createTRPCClient<AppRouter>({ ... })

// Now client knows structure!
```

### 2. React Query Integration

tRPC uses React Query under the hood for:
- ✅ Caching (don't refetch data unnecessarily)
- ✅ Background updates (keep data fresh)
- ✅ Request deduplication (multiple calls = one request)
- ✅ Loading/error states
- ✅ Suspense support

### 3. Batching

```typescript
// You write:
trpc.getUsers.query();
trpc.getPosts.query();
trpc.getComments.query();

// tRPC sends ONE HTTP request:
POST /api/trpc
{
  "0": { "method": "getUsers" },
  "1": { "method": "getPosts" },
  "2": { "method": "getComments" }
}
```

## Your Current Setup

### What You Have Now

✅ **One Query Procedure**: `getUsers` - fetches all users from database

### What You Can Add

**Mutations** (change data):
```typescript
createUser: baseProcedure
  .input(z.object({ name: z.string(), email: z.string().email() }))
  .mutation(async ({ input }) => {
    return prisma.user.create({ data: input });
  })

// Use on client:
const mutation = useMutation(trpc.createUser.mutationOptions());
mutation.mutate({ name: "Alice", email: "alice@example.com" });
```

**Input Validation**:
```typescript
getUserById: baseProcedure
  .input(z.object({ id: z.number() }))
  .query(({ input }) => {
    return prisma.user.findUnique({ where: { id: input.id } });
  })

// Use on client:
trpc.getUserById.query({ id: 123 }); // ← Typed input!
```

**Use Context**:
```typescript
// In init.ts:
export const createTRPCContext = async () => {
  const session = await getServerSession();
  return { userId: session?.user?.id };
};

// In router:
getCurrentUser: baseProcedure.query(({ ctx }) => {
  return prisma.user.findUnique({ where: { id: ctx.userId } });
})
```

## Common Questions

### Q: Why use tRPC instead of REST?
**A:** Type safety! If you rename a field on the server, TypeScript will show errors on the client immediately. With REST, you find out at runtime.

### Q: Why use tRPC instead of GraphQL?
**A:** Simpler! No schema language to learn, no code generation, just TypeScript.

### Q: Can I use this with mobile apps?
**A:** Yes! Any TypeScript client can use tRPC. There are React Native clients too.

### Q: What about validation?
**A:** Use Zod schemas with `.input()` - they validate AND type the input automatically.

### Q: Is the HTTP overhead a problem?
**A:** Not usually! Request batching helps. Plus you can use Server Components for zero HTTP overhead.

## Summary

**tRPC = Remote Procedure Call with TypeScript**

Instead of:
```
Client → HTTP → REST API → Database
         ↑
    Manual types, hope they match!
```

You get:
```
Client → TypeScript Types → tRPC → Database
         ↑
    Automatic types, guaranteed to match!
```

**The killer feature:** Change anything on the server, and TypeScript immediately tells you what broke on the client. No runtime surprises!
