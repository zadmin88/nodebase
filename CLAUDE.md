# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 15 application using the App Router, built with TypeScript, Tailwind CSS v4, and Prisma ORM. The project is bootstrapped with shadcn/ui components (New York style) and includes a comprehensive UI component library based on Radix UI primitives.

## Development Commands

**Start development server:**
```bash
npm run dev
```
- Uses Turbopack for faster builds
- Runs on http://localhost:3000

**Build for production:**
```bash
npm run build
```
- Uses Turbopack for optimized production builds

**Start production server:**
```bash
npm start
```

**Lint code:**
```bash
npm run lint
```

**Run Prisma commands:**
```bash
# Generate Prisma Client
npx prisma generate

# Create and apply migrations
npx prisma migrate dev --name <migration_name>

# Push schema changes without migrations (dev only)
npx prisma db push

# Open Prisma Studio to view/edit database
npx prisma studio

# Reset database (warning: destructive)
npx prisma migrate reset
```

## Architecture

### Project Structure

```
src/
├── app/
│   ├── (auth)/           # Route group for auth pages (doesn't affect URL)
│   │   ├── login/        # /login page
│   │   └── signup/       # /signup page
│   ├── api/
│   │   ├── auth/[...all]/ # Better Auth API routes (catch-all)
│   │   └── trpc/[trpc]/   # tRPC API endpoint
│   ├── layout.tsx        # Root layout with TRPCReactProvider
│   ├── globals.css       # Tailwind CSS v4 theme
│   └── page.tsx          # Protected home page (uses requireAuth)
│
├── features/
│   └── auth/
│       └── components/   # Login & Register forms
│
├── trpc/
│   ├── init.ts           # tRPC initialization & context
│   ├── routers/
│   │   └── _app.ts       # API procedures (e.g., getUsers)
│   ├── client.tsx        # Client-side tRPC + React Query setup
│   ├── server.tsx        # Server-side tRPC (direct calls)
│   └── query-client.ts   # React Query configuration
│
├── lib/
│   ├── auth.ts           # Better Auth server config
│   ├── auth-client.ts    # Better Auth client
│   ├── auth-utils.ts     # requireAuth, requireUnauth helpers
│   ├── db.ts             # Prisma client singleton
│   └── utils.ts          # cn() helper
│
├── components/ui/        # 50+ shadcn/ui components
├── hooks/                # Custom React hooks
└── generated/prisma/     # Generated Prisma Client

prisma/
├── schema.prisma         # Database schema (Better Auth tables)
└── migrations/           # Database migrations
```

### Key Technologies

- **Next.js 15**: Uses App Router, React Server Components by default
- **TypeScript**: Strict mode enabled, paths aliased with `@/*` for imports
- **Tailwind CSS v4**: Configured with custom theme inline in globals.css, uses new `@import` syntax
- **Prisma**: PostgreSQL database with custom client output to `src/generated/prisma`
- **tRPC**: End-to-end typesafe API layer with React Query integration
- **Better Auth**: Type-safe authentication with email/password and session management
- **shadcn/ui**: Component library with Radix UI primitives, uses "New York" style variant
- **Form handling**: react-hook-form with zod validation (@hookform/resolvers)
- **Icons**: lucide-react
- **Theming**: next-themes for dark mode support

### Database Configuration

**Prisma Client Output Location:**
The Prisma Client is generated to a custom location: `src/generated/prisma` (not the default `node_modules/.prisma/client`). This is configured in [prisma/schema.prisma:9](prisma/schema.prisma#L9).

**Import Prisma Client like this:**
```typescript
import { PrismaClient } from '@/generated/prisma'
```

**Database Provider:** PostgreSQL (requires `DATABASE_URL` in .env)

**Current Schema:** Better Auth authentication tables
- **user**: User accounts (id, name, email, emailVerified, image, createdAt, updatedAt)
- **session**: Active sessions with tokens and expiry
- **account**: OAuth accounts and hashed passwords
- **verification**: Email verification codes

All tables use lowercase naming via `@@map()` directive.

### Component System

**shadcn/ui Configuration:**
- Style: "new-york" variant
- RSC: true (React Server Components enabled)
- Base color: neutral
- CSS variables: enabled
- Icon library: lucide-react

**Path Aliases:**
- `@/components` → src/components
- `@/ui` → src/components/ui
- `@/lib` → src/lib
- `@/hooks` → src/hooks
- `@/utils` → src/lib/utils

**Adding shadcn/ui components:**
```bash
npx shadcn@latest add <component-name>
```
Components are installed to `src/components/ui/` with the configuration from [components.json](components.json).

### Styling

**Tailwind CSS v4:**
- Uses new `@import "tailwindcss"` syntax in globals.css
- Theme variables defined with `@theme inline` directive
- Custom dark mode variant: `@custom-variant dark (&:is(.dark *))`
- Animation support via `tw-animate-css` package
- No separate tailwind.config.js file (uses v4 inline configuration)

**CSS Variable System:**
Theme colors are defined as CSS variables in globals.css and mapped through Tailwind's theme system.

**Utility Function:**
Use the `cn()` helper from `@/lib/utils` to merge Tailwind classes with conditional logic:
```typescript
import { cn } from "@/lib/utils"

className={cn("base-classes", condition && "conditional-classes")}
```

### Font Configuration

**Fonts:**
- Primary: Geist Sans (variable font)
- Monospace: Geist Mono (variable font)

Both are loaded via `next/font/google` and applied as CSS variables in the root layout.

### tRPC Configuration

**What is tRPC?**
End-to-end typesafe API layer. You define procedures on the server, and TypeScript automatically infers types on the client—no code generation needed!

**Key Files:**
- `src/trpc/init.ts` - tRPC initialization and context creation
- `src/trpc/routers/_app.ts` - Define your API procedures here
- `src/trpc/client.tsx` - Client-side setup (React Query + tRPC)
- `src/trpc/server.tsx` - Server-side setup for Server Components
- `src/app/api/trpc/[trpc]/route.ts` - HTTP endpoint for client requests

**Usage Patterns:**

1. **Client Components** (HTTP request):
```typescript
"use client"
import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";

const trpc = useTRPC();
const { data } = useSuspenseQuery(trpc.getUsers.queryOptions());
// data is automatically typed!
```

2. **Server Components** (direct call, no HTTP):
```typescript
import { caller } from "@/trpc/server";

const data = await caller.getUsers(); // Direct DB access
```

**Adding New Procedures:**
```typescript
// src/trpc/routers/_app.ts
export const appRouter = createTRPCRouter({
  getUsers: baseProcedure.query(() => {
    return prisma.user.findMany();
  }),

  // Add new procedure:
  createUser: baseProcedure
    .input(z.object({ name: z.string(), email: z.string().email() }))
    .mutation(async ({ input }) => {
      return prisma.user.create({ data: input });
    })
});
```

**Important:**
- Procedures defined in `_app.ts` are automatically type-safe on the client
- Use `.query()` for reading data (GET-like)
- Use `.mutation()` for changing data (POST/PUT/DELETE-like)
- Use `.input()` with Zod schemas for validation
- Context is available via `({ ctx })` parameter
- See [TRPC_EXPLANATION.md](TRPC_EXPLANATION.md) and [TRPC_SIMPLE_FLOW.md](TRPC_SIMPLE_FLOW.md) for detailed guides

### Authentication System

**Library:** Better Auth - Type-safe authentication with Prisma integration

**Key Files:**
- `src/lib/auth.ts` - Server-side Better Auth configuration
- `src/lib/auth-client.ts` - Client-side auth client
- `src/lib/auth-utils.ts` - Helper functions (`requireAuth`, `requireUnauth`)
- `src/app/api/auth/[...all]/route.ts` - Catch-all auth API routes
- `src/features/auth/components/` - Login and Register forms

**Authentication Flow:**
1. User submits form (login or signup)
2. `authClient.signIn.email()` or `authClient.signUp.email()` calls API
3. Better Auth validates credentials, creates session
4. HttpOnly session cookie set automatically
5. User redirected to protected route

**Protecting Routes:**

**Server Component** (recommended):
```typescript
import { requireAuth } from "@/lib/auth-utils";

const Page = async () => {
  await requireAuth(); // Redirects to /login if not authenticated
  return <ProtectedContent />;
};
```

**Client Component:**
```typescript
"use client";
import { authClient } from "@/lib/auth-client";

const { data: session, isPending } = authClient.useSession();
if (!session) redirect("/login");
```

**Auth Helper Functions:**
- `requireAuth()` - Server action to protect pages (redirects to /login)
- `requireUnauth()` - Prevents authenticated users from accessing login/signup (redirects to /)

**Getting Current User:**
```typescript
// Server
import { auth } from "@/lib/auth";
const session = await auth.api.getSession({ headers: await headers() });
const user = session?.user;

// Client
const { data: session } = authClient.useSession();
const user = session?.user;
```

**Database Tables:**
Better Auth manages 4 tables:
- `user` - User accounts
- `session` - Active sessions with tokens
- `account` - OAuth accounts and hashed passwords
- `verification` - Email verification codes

**Environment Variables Required:**
```env
BETTER_AUTH_SECRET="your-secret-key"  # Generate with: openssl rand -base64 32
BETTER_AUTH_URL="http://localhost:3000"
```

**See [AUTH_EXPLANATION.md](AUTH_EXPLANATION.md) for complete authentication guide including:**
- How to integrate auth with tRPC context
- Protected tRPC procedures
- OAuth provider setup
- Password reset flow
- Session management

## Development Guidelines

### When Adding New Features

1. **Database Changes:**
   - Update `prisma/schema.prisma`
   - Run `npx prisma migrate dev --name <migration_name>`
   - Remember the Prisma Client is in `@/generated/prisma`, not `@prisma/client`

2. **UI Components:**
   - Check if shadcn/ui has the component first: `npx shadcn@latest add <component>`
   - Use path aliases for imports
   - Use the `cn()` utility for conditional className merging

3. **Forms:**
   - Use react-hook-form with zod schema validation
   - Leverage @hookform/resolvers for integration

4. **Environment Variables:**
   - Required in `.env`:
     - `DATABASE_URL` - PostgreSQL connection string
     - `BETTER_AUTH_SECRET` - Secret key for session encryption
     - `BETTER_AUTH_URL` - Base URL of your application
   - Add new variables to `.env` (not committed) and document them

5. **Authentication:**
   - Use `requireAuth()` in Server Components to protect routes
   - Use `requireUnauth()` for login/signup pages
   - Access user session via `auth.api.getSession()` (server) or `authClient.useSession()` (client)

6. **tRPC Procedures:**
   - Add new procedures in `src/trpc/routers/_app.ts`
   - Use `.query()` for reads, `.mutation()` for writes
   - Always use `.input()` with Zod schemas for type-safe validation
   - Use `caller` in Server Components, `useTRPC()` hook in Client Components

### Important Notes

- This project uses Turbopack (Next.js's Rust-based bundler) for both dev and build
- React Server Components are the default; mark client components with `"use client"`
- Prisma Client location is customized - always import from `@/generated/prisma`
- Tailwind CSS v4 has different configuration syntax than v3 (no traditional config file)
- The component library is extensive with 50+ pre-built shadcn/ui components available
