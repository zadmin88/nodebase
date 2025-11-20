# Node Selector Feature - Implementation Guide

## Overview

This document explains the **Node Selector & Node Type System** feature added to the application. This enhancement builds upon the visual workflow editor by introducing:

- **Interactive node selection** via a slide-out sheet panel
- **Two new node types**: Manual Trigger and HTTP Request
- **Category-based node organization** (Triggers vs Executions)
- **Base node components** for consistent trigger and execution node styling
- **Custom handle components** for visual connection points
- **Node addition workflow** integrated with the editor
- **Validation logic** to prevent duplicate manual triggers

---

## Table of Contents

1. [Dependencies Added](#1-dependencies-added)
2. [Database Schema Updates](#2-database-schema-updates)
3. [Node Selector Component](#3-node-selector-component)
4. [Base Node Components](#4-base-node-components)
5. [New Node Types](#5-new-node-types)
6. [Node Component Registry](#6-node-component-registry)
7. [Editor Integration](#7-editor-integration)
8. [UI Component Updates](#8-ui-component-updates)
9. [Complete User Flow](#9-complete-user-flow)
10. [Architecture Patterns](#10-architecture-patterns)
11. [File Organization](#11-file-organization)

---

## 1. Dependencies Added

**Package:** `@paralleldrive/cuid2` v3.0.4

**What is CUID2?**
A collision-resistant ID generator optimized for horizontal scaling and distributed systems. It creates sortable, URL-safe unique identifiers.

**Why CUID2?**
- **Client-side generation**: IDs can be generated in the browser without server round-trips
- **Collision-resistant**: Cryptographically random (no UUID v4 collisions)
- **Sortable**: Time-ordered by creation
- **URL-safe**: No special characters
- **Performance**: Faster than UUID v4

**Usage:**
```typescript
import { createId } from "@paralleldrive/cuid2";

const newNode = {
  id: createId(), // e.g., "ckl5u0w0x0000qzrmn831i7rn"
  type: NodeType.HTTP_REQUEST,
  // ...
};
```

---

## 2. Database Schema Updates

### NodeType Enum Extension

**File:** [prisma/schema.prisma](prisma/schema.prisma)

**Before:**
```prisma
enum NodeType {
  INITIAL
}
```

**After:**
```prisma
enum NodeType {
  INITIAL
  MANUAL_TRIGGER
  HTTP_REQUEST
}
```

**Changes:**
- Added `MANUAL_TRIGGER`: A trigger node that starts workflows via manual execution
- Added `HTTP_REQUEST`: An execution node that makes HTTP API calls

### Migration

**File:** [prisma/migrations/20251119232152_new_nodes/migration.sql](prisma/migrations/20251119232152_new_nodes/migration.sql)

```sql
ALTER TYPE "NodeType" ADD VALUE 'MANUAL_TRIGGER';
ALTER TYPE "NodeType" ADD VALUE 'HTTP_REQUEST';
```

**Note:** PostgreSQL enum modifications require separate `ALTER TYPE` statements for each value (limitation in PostgreSQL 11 and earlier).

---

## 3. Node Selector Component

### Overview

**File:** [src/components/node-selector.tsx](src/components/node-selector.tsx)

The `NodeSelector` is a slide-out sheet that presents available node types organized by category. It handles:
- Node type presentation with icons and descriptions
- Node creation at screen center with randomization
- Validation (e.g., preventing duplicate manual triggers)
- React Flow integration for adding nodes to canvas

### Node Type Options

```typescript
export type NodeTypeOption = {
  type: NodeType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }> | string;
};
```

**Trigger Nodes:**
```typescript
const triggerNodes: NodeTypeOption[] = [
  {
    type: NodeType.MANUAL_TRIGGER,
    label: "Trigger manually",
    description: "Runs the flow on clicking a button. Good for getting started quickly",
    icon: MousePointerIcon,
  },
];
```

**Execution Nodes:**
```typescript
const executionNodes: NodeTypeOption[] = [
  {
    type: NodeType.HTTP_REQUEST,
    label: "HTTP Request",
    description: "Makes an HTTP request",
    icon: GlobeIcon,
  },
];
```

**Design pattern:** Separate arrays for different node categories allows:
- Visual grouping in the UI
- Easy addition of new categories (e.g., `transformNodes`, `databaseNodes`)
- Category-specific filtering or permissions

### Node Creation Logic

```typescript
const handleNodeSelect = useCallback(
  (selection: NodeTypeOption) => {
    // 1. VALIDATION: Check for duplicate manual triggers
    if (selection.type === NodeType.MANUAL_TRIGGER) {
      const nodes = getNodes();
      const hasManualTrigger = nodes.some(
        (node) => node.type === NodeType.MANUAL_TRIGGER
      );

      if (hasManualTrigger) {
        toast.error("Only one manual trigger is allowed per workflow");
        return;
      }
    }

    // 2. ADD NODE TO CANVAS
    setNodes((nodes) => {
      const hasInitialTrigger = nodes.some(
        (node) => node.type === NodeType.INITIAL
      );

      // Calculate center screen position
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;

      // Convert screen coordinates to React Flow canvas coordinates
      const flowPosition = screenToFlowPosition({
        x: centerX + (Math.random() - 0.5) * 200, // Random offset ±100px
        y: centerY + (Math.random() - 0.5) * 200,
      });

      const newNode = {
        id: createId(),
        data: {},
        position: flowPosition,
        type: selection.type,
      };

      // If initial placeholder exists, replace it; otherwise append
      if (hasInitialTrigger) {
        return [newNode]; // Replace INITIAL node
      }
      return [...nodes, newNode]; // Add to existing nodes
    });

    onOpenChange(false); // Close the selector sheet
  },
  [getNodes, onOpenChange, screenToFlowPosition, setNodes]
);
```

**Key features:**

1. **Validation:** Prevents multiple manual trigger nodes (business rule)
2. **Coordinate transformation:** `screenToFlowPosition()` converts screen pixels to canvas coordinates (accounts for zoom/pan)
3. **Randomization:** Adds slight random offset to prevent nodes from stacking perfectly
4. **Initial node replacement:** If the `INITIAL` placeholder node exists, replace it with the first real node
5. **Toast notifications:** User feedback for validation errors

### UI Structure

```typescript
<Sheet open={open} onOpenChange={onOpenChange}>
  <SheetTrigger asChild>{children}</SheetTrigger>
  <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
    <SheetHeader>
      <SheetTitle>What triggers this workflow?</SheetTitle>
      <SheetDescription>
        A trigger is a step that starts your workflow.
      </SheetDescription>
    </SheetHeader>

    {/* Trigger Nodes Section */}
    <div>
      {triggerNodes.map((nodeType) => (
        <div onClick={() => handleNodeSelect(nodeType)}>
          {/* Node option with icon, label, description */}
        </div>
      ))}
    </div>

    <Separator />

    {/* Execution Nodes Section */}
    <div>
      {executionNodes.map((nodeType) => (
        <div onClick={() => handleNodeSelect(nodeType)}>
          {/* Node option with icon, label, description */}
        </div>
      ))}
    </div>
  </SheetContent>
</Sheet>
```

**Component pattern:** Uses shadcn/ui Sheet component as a controlled component:
- `open` and `onOpenChange` props for state management
- `asChild` prop on `SheetTrigger` to pass props to child (button or node)
- `side="right"` for slide-out from right edge

---

## 4. Base Node Components

### BaseHandle Component

**File:** [src/components/react-flow/base-handle.tsx](src/components/react-flow/base-handle.tsx)

```typescript
export function BaseHandle({
  className,
  children,
  ...props
}: ComponentProps<typeof Handle>) {
  return (
    <Handle
      {...props}
      className={cn(
        "dark:border-secondary dark:bg-secondary h-[11px] w-[11px] rounded-full border border-slate-300 bg-slate-100 transition",
        className,
      )}
    >
      {children}
    </Handle>
  );
}
```

**Purpose:** Consistent styling for all connection handles across node types.

**Features:**
- **Fixed size:** 11px × 11px circular handles
- **Dark mode support:** Conditional styles via Tailwind's `dark:` prefix
- **Transition effects:** Smooth visual feedback on hover/connect
- **Extensible:** Accepts className overrides for custom styling

**Usage:**
```typescript
<BaseHandle
  id="source-1"
  type="source"
  position={Position.Right}
/>
```

**Why a wrapper component?**
- DRY (Don't Repeat Yourself): Styling defined once
- Consistency: All handles look identical
- Easy to update: Change one place to update all handles
- Type-safe: Inherits React Flow's `Handle` types

### BaseTriggerNode Component

**File:** [src/features/triggers/components/base-trigger-node.tsx](src/features/triggers/components/base-trigger-node.tsx)

```typescript
interface BaseTriggerNodeProps extends NodeProps {
  icon: LucideIcon | string;
  name: string;
  description?: string;
  children?: ReactNode;
  onSettings?: () => void;
  onDoubleClick?: () => void;
}

export const BaseTriggerNode = memo(
  ({
    id,
    icon: Icon,
    name,
    description,
    children,
    onSettings,
    onDoubleClick,
  }: BaseTriggerNodeProps) => {
    const handleDelete = useCallback(() => {
      // Delete node logic (TODO: implement with React Flow API)
    }, [id]);

    return (
      <WorkflowNode
        name={name}
        description={description}
        onDelete={handleDelete}
        onSettings={onSettings}
      >
        <BaseNode
          onDoubleClick={onDoubleClick}
          className="rounded-l-2xl relative group"
        >
          <BaseNodeContent>
            {typeof Icon === "string" ? (
              <Image src={Icon} alt={name} width={16} height={16} />
            ) : (
              <Icon className="size-4 text-muted-foreground" />
            )}
            {children}

            {/* Only OUTPUT handle (triggers start workflows) */}
            <BaseHandle
              id="source-1"
              type="source"
              position={Position.Right}
            />
          </BaseNodeContent>
        </BaseNode>
      </WorkflowNode>
    );
  }
);
```

**Key characteristics:**

1. **No input handle:** Trigger nodes are workflow entry points (no predecessors)
2. **Rounded left edge:** Visual distinction via `rounded-l-2xl` class
3. **Icon flexibility:** Accepts Lucide icon component or image URL
4. **Memoization:** Performance optimization prevents unnecessary re-renders

**Visual hierarchy:**
```
WorkflowNode (toolbar wrapper)
  └── BaseNode (styling + events)
      └── BaseNodeContent (layout)
          ├── Icon
          ├── Children (custom content)
          └── BaseHandle (output only)
```

### BaseExecutionNode Component

**File:** [src/features/executions/components/base-execution-node.tsx](src/features/executions/components/base-execution-node.tsx)

```typescript
interface BaseExecutionNodeProps extends NodeProps {
  icon: LucideIcon | string;
  name: string;
  description?: string;
  children?: ReactNode;
  onSettings?: () => void;
  onDoubleClick?: () => void;
}

export const BaseExecutionNode = memo(
  ({
    id,
    icon: Icon,
    name,
    description,
    children,
    onSettings,
    onDoubleClick,
  }: BaseExecutionNodeProps) => {
    const handleDelete = useCallback(() => {
      // Delete node logic
    }, [id]);

    return (
      <WorkflowNode
        name={name}
        description={description}
        onDelete={handleDelete}
        onSettings={onSettings}
      >
        <BaseNode onDoubleClick={onDoubleClick}>
          <BaseNodeContent>
            {typeof Icon === "string" ? (
              <Image src={Icon} alt={name} width={16} height={16} />
            ) : (
              <Icon className="size-4 text-muted-foreground" />
            )}
            {children}

            {/* Both INPUT and OUTPUT handles */}
            <BaseHandle
              id="target-1"
              type="target"
              position={Position.Left}
            />

            <BaseHandle
              id="source-1"
              type="source"
              position={Position.Right}
            />
          </BaseNodeContent>
        </BaseNode>
      </WorkflowNode>
    );
  }
);
```

**Key differences from BaseTriggerNode:**

1. **Both input/output handles:** Execution nodes sit in the middle of workflows
2. **No rounded edges:** Standard rectangular appearance
3. **Same icon/content pattern:** Consistency across node types

**Visual hierarchy:**
```
WorkflowNode (toolbar wrapper)
  └── BaseNode (styling + events)
      └── BaseNodeContent (layout)
          ├── Icon
          ├── Children (custom content)
          ├── BaseHandle (input - left)
          └── BaseHandle (output - right)
```

---

## 5. New Node Types

### Manual Trigger Node

**File:** [src/features/triggers/components/manual-trigger/node.tsx](src/features/triggers/components/manual-trigger/node.tsx)

```typescript
export const ManualTriggerNode = memo((props: NodeProps) => {
  return (
    <BaseTriggerNode
      {...props}
      icon={MousePointerIcon}
      name="When clicking 'Execute workflow'"
      // TODO: Add settings panel
      // TODO: Add node status indicator
    />
  );
});
```

**Functionality:**
- **Purpose:** Allows users to manually start workflow execution
- **Icon:** Mouse pointer (indicates manual interaction)
- **Name:** Descriptive label explaining trigger condition
- **Future enhancements:** Settings panel for execution configuration, status indicators

**Use case:** Ideal for testing workflows, on-demand processing, or user-initiated tasks.

### HTTP Request Node

**File:** [src/features/executions/components/http-request/node.tsx](src/features/executions/components/http-request/node.tsx)

```typescript
type HttpRequestNodeData = {
  endpoint?: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: string;
  [key: string]: unknown;
};

type HttpRequestNodeType = Node<HttpRequestNodeData>;

export const HttpRequestNode = memo((props: NodeProps<HttpRequestNodeType>) => {
  const nodeData = props.data as HttpRequestNodeData;

  const description = nodeData.endpoint
    ? `${nodeData.method || "GET"}: ${nodeData.endpoint}`
    : "Not configured";

  return (
    <BaseExecutionNode
      {...props}
      id={props.id}
      icon={GlobeIcon}
      name="HTTP Request"
      description={description}
      onSettings={() => {}}
      onDoubleClick={() => {}}
    >
      {/* Future: Configuration form, request/response preview */}
    </BaseExecutionNode>
  );
});
```

**Type-safe data structure:**
```typescript
type HttpRequestNodeData = {
  endpoint?: string;        // URL to request
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; // HTTP method
  body?: string;            // Request body (for POST/PUT/PATCH)
  [key: string]: unknown;   // Extensible for headers, auth, etc.
};
```

**Dynamic description:**
- **Configured:** Shows `"GET: https://api.example.com/users"`
- **Not configured:** Shows `"Not configured"`

**Future enhancements:**
- Settings panel for endpoint/method/body configuration
- Headers and authentication configuration
- Response handling and error management
- Request preview and testing

---

## 6. Node Component Registry

**File:** [src/config/node-components.ts](src/config/node-components.ts)

**Before:**
```typescript
export const nodeComponents = {
  [NodeType.INITIAL]: InitialNode,
} as const satisfies NodeTypes;
```

**After:**
```typescript
import { InitialNode } from "@/components/initial-node";
import { HttpRequestNode } from "@/features/executions/components/http-request/node";
import { ManualTriggerNode } from "@/features/triggers/components/manual-trigger/node";
import { NodeType } from "@/generated/prisma/enums";
import type { NodeTypes } from "@xyflow/react";

export const nodeComponents = {
  [NodeType.INITIAL]: InitialNode,
  [NodeType.HTTP_REQUEST]: HttpRequestNode,
  [NodeType.MANUAL_TRIGGER]: ManualTriggerNode,
} as const satisfies NodeTypes;

export type RegisteredNodeType = keyof typeof nodeComponents;
```

**Changes:**
- Added imports for new node components
- Registered `HTTP_REQUEST` → `HttpRequestNode`
- Registered `MANUAL_TRIGGER` → `ManualTriggerNode`

**Type safety guarantees:**
1. **Enum → Component mapping:** Every `NodeType` enum value must have a corresponding component
2. **React Flow compatibility:** `satisfies NodeTypes` ensures object structure matches React Flow's expectations
3. **Compile-time checking:** TypeScript will error if enum values are added without components

---

## 7. Editor Integration

### Updated InitialNode

**File:** [src/components/initial-node.tsx](src/components/initial-node.tsx)

**Before:**
```typescript
export const InitialNode = memo((props: NodeProps) => {
  return (
    <WorkflowNode showToolbar={false}>
      <PlaceholderNode {...props} onClick={() => {}}>
        <div className="cursor-pointer flex items-center justify-center">
          <PlusIcon className="size-4" />
        </div>
      </PlaceholderNode>
    </WorkflowNode>
  );
});
```

**After:**
```typescript
export const InitialNode = memo((props: NodeProps) => {
  const [selectorOpen, setSelectorOpen] = useState(false);
  return (
    <NodeSelector open={selectorOpen} onOpenChange={setSelectorOpen}>
      <WorkflowNode showToolbar={false}>
        <PlaceholderNode {...props} onClick={() => setSelectorOpen(true)}>
          <div className="cursor-pointer flex items-center justify-center">
            <PlusIcon className="size-4" />
          </div>
        </PlaceholderNode>
      </WorkflowNode>
    </NodeSelector>
  );
});
```

**Changes:**
1. **State management:** Added `selectorOpen` state to control sheet visibility
2. **Wrapper component:** Wrapped in `NodeSelector` for node selection UI
3. **Click handler:** Clicking the initial placeholder now opens the node selector
4. **Controlled component:** Sheet visibility is controlled by parent state

**User flow:**
```
1. User creates new workflow
2. Canvas shows INITIAL placeholder node with "+" icon
3. User clicks placeholder
4. Node selector sheet slides in from right
5. User selects node type
6. New node replaces placeholder, sheet closes
```

### Updated AddNodeButton

**File:** [src/features/editor/components/add-node-button.tsx](src/features/editor/components/add-node-button.tsx)

**Before:**
```typescript
export const AddNodeButton = memo(() => {
  return (
    <Button
      onClick={() => {}}
      size="icon"
      variant="outline"
      className="bg-background"
    >
      <PlusIcon />
    </Button>
  );
});
```

**After:**
```typescript
export const AddNodeButton = memo(() => {
  const [selectorOpen, setSelectorOpen] = useState(false);
  return (
    <NodeSelector open={selectorOpen} onOpenChange={setSelectorOpen}>
      <Button
        onClick={() => {}}
        size="icon"
        variant="outline"
        className="bg-background"
      >
        <PlusIcon />
      </Button>
    </NodeSelector>
  );
});
```

**Changes:**
1. **State management:** Added `selectorOpen` state
2. **Wrapper component:** Wrapped button in `NodeSelector`
3. **Implicit trigger:** Button becomes the sheet trigger (via `asChild` on `SheetTrigger`)

**User flow:**
```
1. User clicks "+" button in top-right panel
2. Node selector sheet opens
3. User selects node type
4. New node added to canvas at center
5. Sheet closes
```

**Pattern:** Same `NodeSelector` component used in two contexts:
- Initial placeholder node (first node creation)
- Add node button (additional nodes)

---

## 8. UI Component Updates

### Breadcrumb Component

**File:** [src/components/ui/breadcrumb.tsx](src/components/ui/breadcrumb.tsx)

**Changes:**
- **Formatting:** Converted from inconsistent semicolon usage to consistent semicolons
- **CSS class fix:** Changed `break-words` to `wrap-break-words` (potential Tailwind v4 compatibility fix)

**Before:**
```typescript
className={cn(
  "text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm break-words sm:gap-2.5",
  className
)}
```

**After:**
```typescript
className={cn(
  "text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm wrap-break-words sm:gap-2.5",
  className
)}
```

### DropdownMenu Component

**File:** [src/components/ui/dropdown-menu.tsx](src/components/ui/dropdown-menu.tsx)

**Changes:**
- **Formatting:** Standardized semicolon usage throughout file
- **Code style:** Consistent quotation marks and spacing

**Type of change:** Code style normalization (no functional changes)

---

## 9. Complete User Flow

### Flow 1: Creating First Workflow Node

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USER CREATES WORKFLOW                                    │
│    └─ trpc.workflows.create.mutate()                        │
│    └─ Creates Workflow + INITIAL node in database           │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. EDITOR PAGE LOADS                                         │
│    └─ Fetches workflow with nodes                           │
│    └─ Renders INITIAL placeholder node with "+"             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. USER CLICKS INITIAL NODE                                  │
│    └─ setSelectorOpen(true)                                 │
│    └─ Node selector sheet slides in from right              │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. NODE SELECTOR DISPLAYS OPTIONS                            │
│    ├─ Trigger Nodes Section                                 │
│    │  └─ Manual Trigger (MousePointerIcon)                  │
│    ├─ Separator                                              │
│    └─ Execution Nodes Section                               │
│       └─ HTTP Request (GlobeIcon)                           │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. USER SELECTS "MANUAL TRIGGER"                             │
│    └─ handleNodeSelect() called                             │
│    └─ Validates: No duplicate manual triggers               │
│    └─ Creates new node with createId()                      │
│    └─ Calculates center position with random offset         │
│    └─ Replaces INITIAL node (since hasInitialTrigger=true)  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. REACT FLOW UPDATES                                        │
│    └─ setNodes([newManualTriggerNode])                      │
│    └─ React re-renders canvas                               │
│    └─ ManualTriggerNode component rendered via registry     │
│    └─ Sheet closes (setSelectorOpen(false))                 │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. CANVAS SHOWS MANUAL TRIGGER NODE                          │
│    └─ Rounded left edge                                     │
│    └─ MousePointerIcon displayed                            │
│    └─ Label: "When clicking 'Execute workflow'"             │
│    └─ One output handle (right side)                        │
└─────────────────────────────────────────────────────────────┘
```

### Flow 2: Adding Additional Nodes

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USER CLICKS "+" BUTTON (TOP-RIGHT PANEL)                 │
│    └─ Button wrapped in NodeSelector                        │
│    └─ Sheet opens via controlled state                      │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. USER SELECTS "HTTP REQUEST"                               │
│    └─ handleNodeSelect() called                             │
│    └─ No validation needed (not a manual trigger)           │
│    └─ Creates node with createId()                          │
│    └─ Position: screen center ± 100px random                │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. NODE ADDED TO CANVAS                                      │
│    └─ setNodes([...existingNodes, newHttpRequestNode])      │
│    └─ HttpRequestNode component rendered                    │
│    └─ Shows "Not configured" description                    │
│    └─ Both input (left) and output (right) handles          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. USER CONNECTS NODES                                       │
│    └─ Drags from Manual Trigger output handle               │
│    └─ Drops on HTTP Request input handle                    │
│    └─ React Flow creates edge                               │
│    └─ Workflow: Manual Trigger → HTTP Request               │
└─────────────────────────────────────────────────────────────┘
```

### Flow 3: Validation - Duplicate Manual Trigger

```
┌─────────────────────────────────────────────────────────────┐
│ 1. WORKFLOW ALREADY HAS MANUAL TRIGGER NODE                 │
│    └─ Canvas: [ManualTriggerNode, HttpRequestNode]          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. USER TRIES TO ADD ANOTHER MANUAL TRIGGER                  │
│    └─ Opens node selector                                   │
│    └─ Clicks "Trigger manually" option                      │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. VALIDATION LOGIC RUNS                                     │
│    └─ if (selection.type === NodeType.MANUAL_TRIGGER)       │
│    └─ getNodes().some(n => n.type === MANUAL_TRIGGER)       │
│    └─ Returns true (already exists)                         │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. ERROR DISPLAYED                                           │
│    └─ toast.error("Only one manual trigger is allowed...")  │
│    └─ Function returns early (no node created)              │
│    └─ Sheet remains open                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 10. Architecture Patterns

### Component Composition Pattern

**Layered architecture for code reuse:**

```
┌─────────────────────────────────────────────────────────┐
│ ManualTriggerNode / HttpRequestNode                     │
│ (Concrete implementations)                              │
│ - Provide icon, name, description                       │
│ - Minimal logic, mostly configuration                   │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ BaseTriggerNode / BaseExecutionNode                     │
│ (Category-specific base components)                     │
│ - Handle layouts (rounded edges, handle positions)      │
│ - Common props (icon, name, description, callbacks)     │
│ - Delete/settings logic                                 │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ WorkflowNode                                             │
│ (Toolbar wrapper)                                        │
│ - Settings/delete buttons                               │
│ - Name/description display                              │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ BaseNode / BaseNodeContent                              │
│ (Primitive components)                                   │
│ - Card styling, borders, hover states                   │
│ - Layout containers                                     │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ BaseHandle                                               │
│ (Reusable connection points)                             │
│ - Consistent handle styling                             │
│ - Dark mode support                                     │
└─────────────────────────────────────────────────────────┘
```

**Benefits:**
- **DRY:** Common logic/styling defined once
- **Extensibility:** New node types inherit base functionality
- **Consistency:** All nodes follow same patterns
- **Maintainability:** Changes to base components cascade down

### Controlled Component Pattern

**NodeSelector as a controlled component:**

```typescript
// Parent component manages state
const [selectorOpen, setSelectorOpen] = useState(false);

// Child receives state and callback
<NodeSelector open={selectorOpen} onOpenChange={setSelectorOpen}>
  <Button>Add Node</Button>
</NodeSelector>

// Parent can programmatically control sheet
// setState(true/false) opens/closes sheet
```

**Advantages:**
- **Single source of truth:** Parent owns state
- **Predictable behavior:** Child can't change state unexpectedly
- **Testing:** Easy to test by controlling props
- **Coordination:** Parent can coordinate multiple components

### Type-Safe Node Data Pattern

**Generic node data with TypeScript:**

```typescript
// Define data structure
type HttpRequestNodeData = {
  endpoint?: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: string;
  [key: string]: unknown; // Allow extension
};

// Type the node
type HttpRequestNodeType = Node<HttpRequestNodeData>;

// Component receives typed props
export const HttpRequestNode = memo(
  (props: NodeProps<HttpRequestNodeType>) => {
    // TypeScript knows 'data' structure
    const nodeData = props.data as HttpRequestNodeData;
    const endpoint = nodeData.endpoint; // Type-safe access
  }
);
```

**Benefits:**
- **Autocomplete:** IDE suggests available properties
- **Type safety:** Compile-time errors for typos
- **Documentation:** Data structure is self-documenting
- **Refactoring:** Find all usages of properties

### Registry Pattern

**Central mapping for node types:**

```typescript
// Single registry object
export const nodeComponents = {
  [NodeType.INITIAL]: InitialNode,
  [NodeType.HTTP_REQUEST]: HttpRequestNode,
  [NodeType.MANUAL_TRIGGER]: ManualTriggerNode,
} as const satisfies NodeTypes;

// React Flow uses registry
<ReactFlow nodeTypes={nodeComponents} />

// TypeScript enforces completeness
// Adding new NodeType enum value without component = compile error
```

**Advantages:**
- **Centralized:** One place to register all node types
- **Type-safe:** Compiler ensures all enum values mapped
- **Automatic rendering:** React Flow looks up component by node.type
- **Scalability:** Easy to add new node types

### Validation Pattern

**Client-side validation with user feedback:**

```typescript
const handleNodeSelect = useCallback((selection: NodeTypeOption) => {
  // 1. Check business rules
  if (selection.type === NodeType.MANUAL_TRIGGER) {
    const hasManualTrigger = getNodes().some(
      (node) => node.type === NodeType.MANUAL_TRIGGER
    );

    if (hasManualTrigger) {
      // 2. Provide feedback
      toast.error("Only one manual trigger is allowed per workflow");

      // 3. Exit early
      return;
    }
  }

  // 4. Proceed with valid action
  createNode(selection);
}, []);
```

**Pattern:**
1. **Validate early:** Check constraints before mutations
2. **User feedback:** Toast notifications for errors
3. **Guard clauses:** Early return prevents invalid state
4. **Business rules:** Enforce workflow constraints

---

## 11. File Organization

### New Files Added

```
src/
├── components/
│   ├── node-selector.tsx                          # Node selection sheet UI
│   └── react-flow/
│       └── base-handle.tsx                        # Styled connection handle
│
├── features/
│   ├── executions/
│   │   └── components/
│   │       ├── base-execution-node.tsx            # Base for execution nodes
│   │       └── http-request/
│   │           └── node.tsx                       # HTTP Request node
│   │
│   └── triggers/
│       └── components/
│           ├── base-trigger-node.tsx              # Base for trigger nodes
│           └── manual-trigger/
│               └── node.tsx                       # Manual Trigger node
│
└── prisma/
    └── migrations/
        └── 20251119232152_new_nodes/
            └── migration.sql                      # NodeType enum extension
```

### Modified Files

```
src/
├── components/
│   ├── initial-node.tsx                           # Integrated NodeSelector
│   └── ui/
│       ├── breadcrumb.tsx                         # Code formatting
│       └── dropdown-menu.tsx                      # Code formatting
│
├── config/
│   └── node-components.ts                         # Registered new node types
│
└── features/
    └── editor/
        └── components/
            └── add-node-button.tsx                # Integrated NodeSelector

prisma/
└── schema.prisma                                  # Added MANUAL_TRIGGER, HTTP_REQUEST enums

package.json                                       # Added @paralleldrive/cuid2
package-lock.json                                  # Lockfile updated
```

### Feature-Based Organization

**Directory structure follows feature domains:**

```
features/
├── triggers/        # Nodes that START workflows
│   └── components/
│       ├── base-trigger-node.tsx
│       ├── manual-trigger/
│       ├── webhook-trigger/     (future)
│       └── schedule-trigger/    (future)
│
└── executions/      # Nodes that EXECUTE actions
    └── components/
        ├── base-execution-node.tsx
        ├── http-request/
        ├── database-query/      (future)
        └── transform-data/      (future)
```

**Benefits:**
- **Scalability:** Easy to add new node types in respective categories
- **Discoverability:** Related nodes grouped together
- **Separation of concerns:** Triggers vs executions have different logic
- **Team collaboration:** Multiple devs can work on different features

---

## Summary

**What was added:**
✅ Node selector sheet with categorized node types
✅ Two new node types (Manual Trigger, HTTP Request)
✅ Base components for triggers and executions
✅ Custom handle styling component
✅ Validation for duplicate manual triggers
✅ Client-side ID generation with CUID2
✅ Database enum extension for new node types
✅ Integration with initial node and add button
✅ Type-safe node data structures

**Key Benefits:**
- **Better UX:** Visual node selection with icons and descriptions
- **Extensibility:** Easy to add new node types via registry pattern
- **Type Safety:** Full TypeScript coverage from database to UI
- **Consistency:** Base components ensure uniform styling/behavior
- **Validation:** Client-side constraints prevent invalid workflows
- **Organization:** Feature-based structure scales with growing node library

**Next Steps:**
1. **Node configuration panels:** Double-click or settings button to configure node properties
2. **State persistence:** Save node positions and connections to database
3. **Node execution:** Implement runtime execution engine for workflows
4. **Additional node types:** Webhooks, database queries, transformations, conditionals
5. **Node validation:** Pre-execution validation (e.g., required fields filled)
6. **Delete functionality:** Implement node deletion via toolbar button
7. **Status indicators:** Show node execution status (pending, running, success, error)

**This pattern establishes a scalable foundation for a complete visual workflow automation system with extensible node types and robust validation.**
