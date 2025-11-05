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
├── app/              # Next.js App Router pages and layouts
│   ├── layout.tsx    # Root layout with Geist fonts
│   ├── globals.css   # Tailwind CSS v4 imports and theme variables
│   └── page.tsx      # Home page
├── components/
│   └── ui/           # shadcn/ui components (50+ pre-built components)
├── hooks/            # Custom React hooks (e.g., use-mobile)
├── lib/
│   └── utils.ts      # Utility functions (cn helper for className merging)
└── generated/
    └── prisma/       # Generated Prisma Client (custom output location)

prisma/
├── schema.prisma     # Database schema definition
└── migrations/       # Database migrations
```

### Key Technologies

- **Next.js 15**: Uses App Router, React Server Components by default
- **TypeScript**: Strict mode enabled, paths aliased with `@/*` for imports
- **Tailwind CSS v4**: Configured with custom theme inline in globals.css, uses new `@import` syntax
- **Prisma**: PostgreSQL database with custom client output to `src/generated/prisma`
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

**Current Schema:** Basic User/Post relationship
- User: id, email (unique), name, posts relation
- Post: id, title, content, published, authorId, author relation

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
   - Required: `DATABASE_URL` for PostgreSQL connection
   - Add new variables to `.env` (not committed) and document them

### Important Notes

- This project uses Turbopack (Next.js's Rust-based bundler) for both dev and build
- React Server Components are the default; mark client components with `"use client"`
- Prisma Client location is customized - always import from `@/generated/prisma`
- Tailwind CSS v4 has different configuration syntax than v3 (no traditional config file)
- The component library is extensive with 50+ pre-built shadcn/ui components available
