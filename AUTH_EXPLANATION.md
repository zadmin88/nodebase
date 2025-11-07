# Better Auth + tRPC Implementation Guide

This guide explains the authentication system and how it integrates with tRPC in your application.

## What is Better Auth?

**Better Auth** is a modern, type-safe authentication library for TypeScript applications. It provides:
- 🔐 Built-in support for email/password, OAuth providers
- 📦 Database adapters (Prisma, Drizzle, etc.)
- 🎯 Full TypeScript support
- 🔄 Session management
- 🚀 Server-first approach with React hooks

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                          AUTHENTICATION FLOW                            │
└────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  1. CLIENT SIDE (Browser)                                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Login/Signup Form                                           │  │
│  │  (src/features/auth/components/)                             │  │
│  │                                                               │  │
│  │  • React Hook Form + Zod validation                          │  │
│  │  • Uses authClient from better-auth/react                    │  │
│  │                                                               │  │
│  │  await authClient.signUp.email({                             │  │
│  │    email, password, name                                     │  │
│  │  })                                                           │  │
│  │                                                               │  │
│  │  await authClient.signIn.email({                             │  │
│  │    email, password                                            │  │
│  │  })                                                           │  │
│  └──────────────────────────┬───────────────────────────────────┘  │
│                              │                                       │
└──────────────────────────────┼───────────────────────────────────────┘
                               │
                               │ HTTP POST /api/auth/sign-up
                               │ HTTP POST /api/auth/sign-in
                               │
┌──────────────────────────────▼───────────────────────────────────────┐
│  2. AUTH API ROUTE                                                    │
│     (src/app/api/auth/[...all]/route.ts)                             │
├─────────────────────────────────────────────────────────────────────┬┤
│                                                                       ││
│  ┌────────────────────────────────────────────────────────────┐    ││
│  │ import { toNextJsHandler } from "better-auth/next-js";     │    ││
│  │ export const { POST, GET } = toNextJsHandler(auth);        │    ││
│  │                                                             │    ││
│  │ • Catches all /api/auth/* routes                           │    ││
│  │ • Routes to appropriate Better Auth handler                │    ││
│  └────────────────────────────┬───────────────────────────────┘    ││
│                                │                                     ││
│                                ▼                                     ││
│  ┌────────────────────────────────────────────────────────────┐    ││
│  │  Better Auth Core (src/lib/auth.ts)                        │    ││
│  │                                                             │    ││
│  │  export const auth = betterAuth({                          │    ││
│  │    database: prismaAdapter(prisma, {                       │    ││
│  │      provider: "postgresql"                                │    ││
│  │    }),                                                      │    ││
│  │    emailAndPassword: {                                     │    ││
│  │      enabled: true,                                        │    ││
│  │      autoSignIn: true  ← Auto login after signup          │    ││
│  │    }                                                        │    ││
│  │  })                                                         │    ││
│  │                                                             │    ││
│  │  • Creates/validates sessions                              │    ││
│  │  • Hashes passwords                                        │    ││
│  │  • Manages tokens                                          │    ││
│  └────────────────────────────┬───────────────────────────────┘    ││
│                                │                                     ││
│                                ▼                                     ││
│  ┌────────────────────────────────────────────────────────────┐    ││
│  │  Database via Prisma (src/lib/db.ts)                       │    ││
│  │                                                             │    ││
│  │  Tables:                                                    │    ││
│  │  • user         - User accounts                            │    ││
│  │  • session      - Active sessions with tokens              │    ││
│  │  • account      - OAuth accounts & passwords               │    ││
│  │  • verification - Email verification codes                 │    ││
│  └────────────────────────────┬───────────────────────────────┘    ││
└────────────────────────────────┼──────────────────────────────────────┘
                                 │
                                 │ Creates session, returns cookie
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  3. BACK TO CLIENT                                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  • Session cookie set automatically                                  │
│  • onSuccess callback fires                                          │
│  • Router redirects to "/"                                           │
│  • User is now authenticated!                                        │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

## Database Schema (Prisma)

Your authentication uses 4 tables managed by Better Auth:

```prisma
model User {
  id            String    @id
  name          String
  email         String    @unique
  emailVerified Boolean   @default(false)
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  sessions      Session[]
  accounts      Account[]

  @@map("user")
}

model Session {
  id        String   @id
  expiresAt DateTime
  token     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  ipAddress String?
  userAgent String?
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("session")
}

model Account {
  id                    String    @id
  accountId             String
  providerId            String
  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  password              String?   ← Hashed password stored here
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@map("account")
}

model Verification {
  id         String   @id
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@map("verification")
}
```

## File Structure

```
src/
├── lib/
│   ├── auth.ts           ← Server-side Better Auth config
│   ├── auth-client.ts    ← Client-side auth client
│   ├── auth-utils.ts     ← Helper functions (requireAuth, requireUnauth)
│   └── db.ts             ← Prisma client singleton
│
├── features/auth/components/
│   ├── login-form.tsx    ← Login form component
│   └── register-form.tsx ← Signup form component
│
├── app/
│   ├── api/auth/[...all]/
│   │   └── route.ts      ← Catch-all auth API route
│   │
│   ├── (auth)/           ← Route group (doesn't affect URL)
│   │   ├── login/
│   │   │   └── page.tsx  ← /login page
│   │   └── signup/
│   │       └── page.tsx  ← /signup page
│   │
│   └── page.tsx          ← Protected home page
│
└── trpc/
    ├── init.ts           ← tRPC context includes auth session
    └── routers/_app.ts   ← tRPC procedures can access user session
```

## Key Components Explained

### 1. Server Auth Config ([src/lib/auth.ts](src/lib/auth.ts))

```typescript
export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql"
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true  // Auto-login after successful signup
  }
});
```

**What it does:**
- Creates the Better Auth instance
- Connects to database via Prisma
- Enables email/password authentication
- Configures auto sign-in after registration

### 2. Client Auth Client ([src/lib/auth-client.ts](src/lib/auth-client.ts))

```typescript
import { createAuthClient } from "better-auth/react";
export const authClient = createAuthClient();
```

**What it does:**
- Creates a client-side auth client
- Provides React hooks and methods for authentication
- Automatically handles cookies and sessions

**Available methods:**
```typescript
authClient.signUp.email({ email, password, name })
authClient.signIn.email({ email, password })
authClient.signOut()
authClient.useSession() // React hook
```

### 3. Auth Utilities ([src/lib/auth-utils.ts](src/lib/auth-utils.ts))

```typescript
// Server action to require authentication
export const requireAuth = async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  return session;
};

// Server action to require NO authentication (for login/signup pages)
export const requireUnauth = async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/");
};
```

**What they do:**
- `requireAuth()`: Protects pages - redirects to login if not authenticated
- `requireUnauth()`: Prevents authenticated users from accessing login/signup

### 4. Auth Forms ([src/features/auth/components/](src/features/auth/components/))

**Login Form:**
```typescript
const onSubmit = async (values) => {
  await authClient.signIn.email(
    { email, password, callbackURL: "/" },
    {
      onSuccess: () => router.push("/"),
      onError: (ctx) => toast.error(ctx.error.message)
    }
  );
};
```

**Signup Form:**
```typescript
const onSubmit = async (values) => {
  await authClient.signUp.email(
    { email, password, name, callbackURL: "/" },
    {
      onSuccess: () => router.push("/"),
      onError: (ctx) => toast.error(ctx.error.message)
    }
  );
};
```

**Features:**
- ✅ Zod schema validation
- ✅ React Hook Form for form state
- ✅ Toast notifications for errors
- ✅ Automatic redirect on success
- ✅ Loading states during submission

## Integration with tRPC

### How Authentication Works with tRPC

#### **Option 1: Server Components (Your Current Implementation)**

```typescript
// src/app/page.tsx
import { requireAuth } from "@/lib/auth-utils";
import { caller } from "@/trpc/server";

const Page = async () => {
  // Protect the route
  await requireAuth();

  // Call tRPC procedure directly (no HTTP!)
  const data = await caller.getUsers();

  return <div>{JSON.stringify(data)}</div>;
};
```

**How it works:**
1. `requireAuth()` checks session, redirects if not authenticated
2. If authenticated, `caller` makes direct tRPC calls
3. No HTTP overhead - runs on server only

#### **Option 2: Add Session to tRPC Context**

You can make the user session available in all tRPC procedures:

```typescript
// src/trpc/init.ts
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export const createTRPCContext = cache(async () => {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  return {
    session,
    userId: session?.user?.id,
    db: prisma
  };
});
```

Now every procedure has access to the session:

```typescript
// src/trpc/routers/_app.ts
export const appRouter = createTRPCRouter({
  getUsers: baseProcedure.query(({ ctx }) => {
    // ctx.session is available here!
    // ctx.userId is available here!
    return prisma.user.findMany();
  }),

  getCurrentUser: baseProcedure.query(({ ctx }) => {
    if (!ctx.userId) throw new Error("Not authenticated");
    return prisma.user.findUnique({
      where: { id: ctx.userId }
    });
  })
});
```

#### **Option 3: Protected Procedures with Middleware**

Create a protected procedure that requires authentication:

```typescript
// src/trpc/init.ts
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      session: ctx.session,
      user: ctx.session.user
    }
  });
});

export const protectedProcedure = t.procedure.use(isAuthed);
```

Use it in your router:

```typescript
// src/trpc/routers/_app.ts
export const appRouter = createTRPCRouter({
  // Public procedure - anyone can call
  getPublicData: baseProcedure.query(() => {
    return { message: "Hello World" };
  }),

  // Protected procedure - requires auth
  getPrivateData: protectedProcedure.query(({ ctx }) => {
    // ctx.user is guaranteed to exist here!
    return {
      message: `Hello ${ctx.user.name}!`,
      userId: ctx.user.id
    };
  })
});
```

## Complete Authentication Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    USER SIGNUP/LOGIN JOURNEY                         │
└─────────────────────────────────────────────────────────────────────┘

  👤 User visits /signup or /login
                 ↓
  ┌──────────────────────────────────────────────┐
  │ requireUnauth() checks session               │
  │ • If logged in → redirect to /               │
  │ • If not logged in → show form               │
  └──────────────────┬───────────────────────────┘
                     ↓
  ┌──────────────────────────────────────────────┐
  │ User fills form and submits                  │
  │ • Client-side Zod validation                 │
  │ • React Hook Form handles state              │
  └──────────────────┬───────────────────────────┘
                     ↓
  ┌──────────────────────────────────────────────┐
  │ authClient.signUp.email() or                 │
  │ authClient.signIn.email()                    │
  │                                               │
  │ HTTP POST /api/auth/sign-up or sign-in       │
  └──────────────────┬───────────────────────────┘
                     ↓
  ┌──────────────────────────────────────────────┐
  │ Better Auth processes request                │
  │ • Validates credentials                       │
  │ • Hashes password (signup)                    │
  │ • Checks password (login)                     │
  │ • Creates session in database                 │
  │ • Generates session token                     │
  └──────────────────┬───────────────────────────┘
                     ↓
  ┌──────────────────────────────────────────────┐
  │ Response sent back to client                 │
  │ • Sets HttpOnly session cookie               │
  │ • Returns user data                           │
  └──────────────────┬───────────────────────────┘
                     ↓
  ┌──────────────────────────────────────────────┐
  │ onSuccess callback fires                     │
  │ • router.push("/") → redirect to home        │
  └──────────────────┬───────────────────────────┘
                     ↓
  ┌──────────────────────────────────────────────┐
  │ User visits / (home page)                    │
  │ • requireAuth() checks session               │
  │ • Session exists → render page               │
  │ • Can now call protected tRPC procedures     │
  └──────────────────────────────────────────────┘

  ✅ User is authenticated!
```

## Route Protection Patterns

### Pattern 1: Server Component Protection (Recommended)

```typescript
// Protected page
const Page = async () => {
  await requireAuth(); // Redirects to /login if not authenticated

  return <ProtectedContent />;
};
```

### Pattern 2: Client Component Protection

```typescript
"use client";

const Page = () => {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) return <Loading />;
  if (!session) redirect("/login");

  return <ProtectedContent session={session} />;
};
```

### Pattern 3: Middleware (Coming Soon)

You can add middleware to protect multiple routes:

```typescript
// middleware.ts
import { auth } from "@/lib/auth";

export default auth.middleware({
  matcher: ["/dashboard/:path*", "/settings/:path*"]
});
```

## Common Patterns

### 1. Get Current User

**Server Component:**
```typescript
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const session = await auth.api.getSession({ headers: await headers() });
const user = session?.user;
```

**Client Component:**
```typescript
"use client";
import { authClient } from "@/lib/auth-client";

const { data: session } = authClient.useSession();
const user = session?.user;
```

### 2. Sign Out

```typescript
"use client";
import { authClient } from "@/lib/auth-client";

const handleLogout = async () => {
  await authClient.signOut();
  router.push("/login");
};
```

### 3. Conditional Rendering Based on Auth

```typescript
"use client";

const { data: session } = authClient.useSession();

return (
  <>
    {session ? (
      <Button onClick={() => authClient.signOut()}>Logout</Button>
    ) : (
      <Link href="/login">Login</Link>
    )}
  </>
);
```

## Benefits of This Setup

✅ **Type Safety** - Full TypeScript support across auth flow
✅ **Security** - HttpOnly cookies, hashed passwords, secure sessions
✅ **DX** - Simple API, minimal boilerplate
✅ **Flexibility** - Works with Server and Client Components
✅ **Integration** - Seamlessly integrates with tRPC context
✅ **Database** - Uses your existing Prisma setup
✅ **Session Management** - Automatic session handling
✅ **Validation** - Built-in with Zod schemas

## Next Steps

1. **Add OAuth Providers** (GitHub, Google, etc.)
2. **Email Verification** - Verify user emails before access
3. **Password Reset** - Forgot password flow
4. **Session Management** - View and revoke active sessions
5. **2FA** - Two-factor authentication
6. **Role-Based Access Control** - User roles and permissions

## Environment Variables

Required in your `.env`:

```env
# Database
DATABASE_URL="postgresql://..."

# Better Auth
BETTER_AUTH_SECRET="your-secret-key-here"
BETTER_AUTH_URL="http://localhost:3000"
```

- `BETTER_AUTH_SECRET`: Secret key for session encryption (generate with `openssl rand -base64 32`)
- `BETTER_AUTH_URL`: Base URL of your application (important for OAuth callbacks)

## Summary

Your authentication system:

1. **Better Auth** handles all auth logic (signup, login, sessions)
2. **Prisma** stores users, sessions, accounts in PostgreSQL
3. **Client forms** use `authClient` to call auth API
4. **Server utilities** (`requireAuth`, `requireUnauth`) protect routes
5. **tRPC integration** allows procedures to access session via context
6. **Type safety** throughout - from forms to database to API

The beauty of this setup: **auth "just works"** across your entire app, whether you're using Server Components, Client Components, or tRPC procedures!
