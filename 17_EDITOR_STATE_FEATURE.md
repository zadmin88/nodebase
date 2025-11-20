# Editor State & Node Configuration Feature - Implementation Guide

## Overview

This document explains the **Editor State Management & Node Configuration** feature added to the application. This enhancement builds upon the node selector feature by introducing:

- **Global editor state management** using Jotai atoms
- **Node configuration dialogs** for HTTP Request and Manual Trigger nodes
- **Visual node status indicators** (loading, success, error states)
- **Workflow save functionality** that persists nodes and edges to the database
- **Node deletion** with automatic edge cleanup
- **Enhanced editor UX** with snap-to-grid, pan controls, and improved selection

---

## Table of Contents

1. [Dependencies Added](#1-dependencies-added)
2. [Global State Management](#2-global-state-management)
3. [Node Status Indicators](#3-node-status-indicators)
4. [Node Configuration Dialogs](#4-node-configuration-dialogs)
5. [Workflow Save Functionality](#5-workflow-save-functionality)
6. [Node Deletion](#6-node-deletion)
7. [Editor UX Enhancements](#7-editor-ux-enhancements)
8. [Base Node Updates](#8-base-node-updates)
9. [Complete User Flows](#9-complete-user-flows)
10. [Architecture Patterns](#10-architecture-patterns)
11. [File Organization](#11-file-organization)

---

## 1. Dependencies Added

**Package:** `jotai` v2.15.1

**What is Jotai?**
A primitive and flexible state management library for React. It provides atomic state management with minimal boilerplate and excellent TypeScript support.

**Why Jotai?**
- **Minimalist API**: Simple `atom()` and `useAtom()` hooks
- **Performance**: Automatic dependency tracking and optimal re-renders
- **TypeScript-first**: Full type inference out of the box
- **React-friendly**: Hooks-based API, works seamlessly with React 18+
- **Granular updates**: Only components that use specific atoms re-render
- **No provider hell**: Single `Provider` component at the root

**Usage in this project:**
```typescript
import { atom } from "jotai";
import { useAtom, useAtomValue, useSetAtom } from "jotai";

// Define atom
export const editorAtom = atom<ReactFlowInstance | null>(null);

// Read and write
const [editor, setEditor] = useAtom(editorAtom);

// Read only
const editor = useAtomValue(editorAtom);

// Write only
const setEditor = useSetAtom(editorAtom);
```

---

## 2. Global State Management

### Editor Atom

**File:** [src/features/editor/store/atoms.ts](src/features/editor/store/atoms.ts)

```typescript
import type { ReactFlowInstance } from "@xyflow/react";
import { atom } from "jotai";

export const editorAtom = atom<ReactFlowInstance | null>(null);
```

**Purpose:** Store the React Flow instance globally so it can be accessed from any component in the editor context.

**ReactFlowInstance provides:**
- `getNodes()`: Get current nodes in the canvas
- `getEdges()`: Get current edges (connections)
- `setNodes()`: Update nodes
- `setEdges()`: Update edges
- `getViewport()`: Get current zoom/pan state
- `fitView()`: Auto-fit canvas to show all nodes
- `screenToFlowPosition()`: Convert screen coordinates to canvas coordinates

### Provider Setup

**File:** [src/app/layout.tsx](src/app/layout.tsx)

**Changes:**
```typescript
import { Provider } from "jotai";

export default function RootLayout({ children }) {
  return (
    <TRPCReactProvider>
      <NuqsAdapter>
        <Provider>{children}</Provider>  {/* Added Jotai Provider */}
        <Toaster />
      </NuqsAdapter>
    </TRPCReactProvider>
  );
}
```

**Why at root level?**
- All pages can access editor state if needed
- Single source of truth for the React Flow instance
- Enables cross-component communication without prop drilling

### Setting the Editor Instance

**File:** [src/features/editor/components/editor.tsx](src/features/editor/components/editor.tsx)

**Changes:**
```typescript
import { useSetAtom } from "jotai";
import { editorAtom } from "../store/atoms";

export const Editor = ({ workflowId }: { workflowId: string }) => {
  const setEditor = useSetAtom(editorAtom);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onInit={setEditor}  // Store instance when React Flow initializes
      // ... other props
    />
  );
};
```

**Flow:**
1. React Flow initializes
2. `onInit` callback fires with the instance
3. Instance stored in global atom via `setEditor`
4. Other components can now access the instance

---

## 3. Node Status Indicators

### Status Indicator Component

**File:** [src/components/react-flow/node-status-indicator.tsx](src/components/react-flow/node-status-indicator.tsx)

**Status Types:**
```typescript
export type NodeStatus = "loading" | "success" | "error" | "initial";
```

**Variant Types:**
```typescript
export type NodeStatusVariant = "overlay" | "border";
```

### Visual Implementations

#### 1. Border Variant (Default)

**Loading State:**
- **Rotating gradient border**: Conic gradient animation
- **Color**: Blue (rgba(42,67,233,0.5) to transparent)
- **Animation**: 2s continuous rotation
- **Visual effect**: Spinning border around node

```typescript
<BorderLoadingIndicator>
  {children}
</BorderLoadingIndicator>
```

**Success State:**
- **Green border**: `border-green-700/50`
- **Width**: 3px (`border-3`)
- **Static**: No animation

**Error State:**
- **Red border**: `border-red-700/50`
- **Width**: 3px (`border-3`)
- **Static**: No animation

#### 2. Overlay Variant

**Loading State:**
- **Backdrop**: Semi-transparent background with backdrop blur
- **Ping animation**: Expanding blue circle (600ms pulse)
- **Spinner**: Rotating LoaderCircle icon in center
- **Z-index**: 50 (overlays node content)

```typescript
<SpinnerLoadingIndicator>
  {children}
</SpinnerLoadingIndicator>
```

**Visual structure:**
```
┌──────────────────────────────┐
│ Blue border                  │
│  ┌────────────────────────┐  │
│  │ Blurred backdrop       │  │
│  │   ◉ ← Ping animation   │  │
│  │   ⟳ ← Spinner icon     │  │
│  │                        │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

### StatusBorder Helper Component

```typescript
const StatusBorder = ({ children, className }) => {
  return (
    <>
      <div className={cn(
        "absolute -top-[2px] -left-[2px] h-[calc(100%+4px)] w-[calc(100%+4px)] rounded-md border-3",
        className
      )} />
      {children}
    </>
  );
};
```

**Purpose:** Reusable border overlay component for success/error states.

**Positioning:**
- **Absolute positioning**: `-top-[2px] -left-[2px]`
- **Overflow size**: `h-[calc(100%+4px)] w-[calc(100%+4px)]`
- **Effect**: Border sits outside the node boundaries (2px on all sides)

### NodeStatusIndicator Main Component

```typescript
export const NodeStatusIndicator = ({
  status,
  variant = "border",
  children,
  className,
}: NodeStatusIndicatorProps) => {
  switch (status) {
    case "loading":
      switch (variant) {
        case "overlay":
          return <SpinnerLoadingIndicator>{children}</SpinnerLoadingIndicator>;
        case "border":
          return (
            <BorderLoadingIndicator className={className}>
              {children}
            </BorderLoadingIndicator>
          );
      }
    case "success":
      return (
        <StatusBorder className={cn("border-green-700/50", className)}>
          {children}
        </StatusBorder>
      );
    case "error":
      return (
        <StatusBorder className={cn("border-red-700/50", className)}>
          {children}
        </StatusBorder>
      );
    default:
      return <>{children}</>;
  }
};
```

**Pattern:** Nested switch statements for status → variant selection.

---

## 4. Node Configuration Dialogs

### HTTP Request Dialog

**File:** [src/features/executions/components/http-request/dialog.tsx](src/features/executions/components/http-request/dialog.tsx)

**Form Schema:**
```typescript
const formSchema = z.object({
  endpoint: z.url({ message: "Please enter a valid URL" }),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  body: z.string().optional(),
});

export type FormType = z.infer<typeof formSchema>;
```

**Validation:**
- **endpoint**: Must be valid URL format
- **method**: One of 5 HTTP methods
- **body**: Optional string (only shown for POST/PUT/PATCH)

**Key Features:**

1. **Conditional Body Field:**
```typescript
const watchMethod = form.watch("method");
const showBodyField = ["POST", "PUT", "PATCH"].includes(watchMethod);
```
- Body field only appears for methods that support request bodies
- Real-time reactivity using `form.watch()`

2. **Form Reset on Open:**
```typescript
useEffect(() => {
  if (open) {
    form.reset({
      endpoint: defaultEndpoint,
      method: defaultMethod,
      body: defaultBody,
    });
  }
}, [open, defaultEndpoint, defaultMethod, defaultBody, form]);
```
- Resets form values when dialog opens
- Ensures form reflects current node data

3. **Template Variable Support:**
- **Endpoint**: `https://api.example.com/users/{{httpResponse.data.id}}`
- **Body**: `{"userId": "{{httpResponse.data.id}}"}`
- **JSON stringification**: `{{json variable}}` for objects

**UI Components:**
- **Method Select**: Dropdown with 5 HTTP methods
- **Endpoint Input**: URL input with placeholder showing variable syntax
- **Body Textarea**: Monospace font, 120px min height, JSON formatting
- **Save Button**: Submits form and closes dialog

**Usage Pattern:**
```typescript
<HttpRequestDialog
  open={dialogOpen}
  onOpenChange={setDialogOpen}
  defaultEndpoint={nodeData.endpoint}
  defaultMethod={nodeData.method}
  defaultBody={nodeData.body}
  onSubmit={(values) => {
    // Update node data in React Flow
  }}
/>
```

### Manual Trigger Dialog

**File:** [src/features/triggers/components/manual-trigger/dialog.tsx](src/features/triggers/components/manual-trigger/dialog.tsx)

**Simplified dialog** (no configuration needed):
```typescript
export const ManualTriggerDialog = ({ open, onOpenChange }: Props) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manual Trigger</DialogTitle>
          <DialogDescription>
            This trigger can be activated manually to start the workflow.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            Used to manually execute a workflow, no configuration available
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
```

**Purpose:** Informational dialog only (no form fields).

**Why?** Manual triggers have no configurable properties—they simply start the workflow when clicked.

---

## 5. Workflow Save Functionality

### Backend: tRPC Mutation

**File:** [src/features/workflows/server/routers.ts](src/features/workflows/server/routers.ts)

**New Procedure:**
```typescript
update: protectedProcedure
  .input(
    z.object({
      id: z.string(),
      nodes: z.array(
        z.object({
          id: z.string(),
          type: z.string().nullish(),
          position: z.object({ x: z.number(), y: z.number() }),
          data: z.record(z.string(), z.any()).optional(),
        })
      ),
      edges: z.array(
        z.object({
          source: z.string(),
          target: z.string(),
          sourceHandle: z.string().nullish(),
          targetHandle: z.string().nullish(),
        })
      ),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const { id, nodes, edges } = input;

    const workflow = await prisma.workflow.findUniqueOrThrow({
      where: { id, userId: ctx.auth.user.id },
    });

    // Transaction to ensure consistency
    return await prisma.$transaction(async (tx) => {
      // Delete existing nodes and connections (cascade deletes connections)
      await tx.node.deleteMany({
        where: { workflowId: id },
      });

      // Create nodes
      await tx.node.createMany({
        data: nodes.map((node) => ({
          id: node.id,
          workflowId: id,
          name: node.type || "unknown",
          type: node.type as NodeType,
          position: node.position,
          data: node.data || {},
        })),
      });

      // Create connections
      await tx.connection.createMany({
        data: edges.map((edge) => ({
          workflowId: id,
          fromNodeId: edge.source,
          toNodeId: edge.target,
          fromOutput: edge.sourceHandle || "main",
          toInput: edge.targetHandle || "main",
        })),
      });

      // Update workflow's updatedAt timestamp
      await tx.workflow.update({
        where: { id },
        data: { updatedAt: new Date() },
      });

      return workflow;
    });
  })
```

**Key Design Decisions:**

1. **Protected Procedure**: Only authenticated users can save workflows
2. **User Authorization**: Verifies workflow belongs to current user via `userId: ctx.auth.user.id`
3. **Delete-and-Recreate Strategy**: Simpler than detecting diffs
4. **Transaction**: Ensures atomic operation (all succeed or all fail)
5. **Cascade Deletes**: Database handles orphaned connections automatically
6. **Timestamp Update**: `updatedAt` reflects last save time

**Input Validation:**
- **nodes array**: Contains React Flow node structure (id, type, position, data)
- **edges array**: Contains connections (source, target, handles)
- **nullish types**: React Flow uses `null` for optional fields

**Why delete-and-recreate?**
- **Simplicity**: No complex diff logic needed
- **Consistency**: Guaranteed state match between frontend and backend
- **Performance**: Fast enough for typical workflow sizes (<100 nodes)
- **No orphans**: All deleted nodes have connections removed automatically

### Frontend: React Hook

**File:** [src/features/workflows/hooks/use-workflows.ts](src/features/workflows/hooks/use-workflows.ts)

**New Hook:**
```typescript
export const useUpdateWorkflow = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.workflows.update.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Workflow "${data.name}" saved`);
        queryClient.invalidateQueries(trpc.workflows.getMany.queryOptions({}));
        queryClient.invalidateQueries(
          trpc.workflows.getOne.queryOptions({ id: data.id })
        );
      },
      onError: (error) => {
        toast.error(`Failed to save workflow: ${error.message}`);
      },
    })
  );
};
```

**Features:**
- **Success toast**: Shows workflow name confirmation
- **Cache invalidation**: Refreshes workflow lists and detail views
- **Error handling**: Displays user-friendly error messages
- **Type-safe**: TypeScript infers mutation input/output types

### Save Button Implementation

**File:** [src/features/editor/components/editor-header.tsx](src/features/editor/components/editor-header.tsx)

**Changes:**
```typescript
export const EditorSaveButton = ({ workflowId }: { workflowId: string }) => {
  const editor = useAtomValue(editorAtom);  // Get editor instance from global state
  const saveWorkflow = useUpdateWorkflow();

  const handleSave = () => {
    if (!editor) {
      return;  // Editor not initialized yet
    }

    const nodes = editor.getNodes();  // Get current canvas nodes
    const edges = editor.getEdges();  // Get current canvas edges

    saveWorkflow.mutate({
      id: workflowId,
      nodes,
      edges,
    });
  };

  return (
    <div className="ml-auto">
      <Button
        size="sm"
        onClick={handleSave}
        disabled={saveWorkflow.isPending}  // Disable during save
      >
        <SaveIcon className="size-4" />
        Save
      </Button>
    </div>
  );
};
```

**Flow:**
1. User clicks "Save" button
2. Get current editor instance from Jotai atom
3. Extract nodes and edges from React Flow
4. Call tRPC mutation with workflow ID + nodes + edges
5. Backend saves to database in transaction
6. Success: Toast notification + cache invalidation
7. Error: Toast with error message

**Why access editor from global state?**
- Save button is in header component (separate from canvas)
- No prop drilling needed through multiple components
- Clean separation of concerns

---

## 6. Node Deletion

### Base Execution Node Deletion

**File:** [src/features/executions/components/base-execution-node.tsx](src/features/executions/components/base-execution-node.tsx)

**Implementation:**
```typescript
export const BaseExecutionNode = memo(({ id, ...props }: BaseExecutionNodeProps) => {
  const { setNodes, setEdges } = useReactFlow();

  const handleDelete = () => {
    // Remove the node
    setNodes((currentNodes) => {
      const updatedNodes = currentNodes.filter((node) => node.id !== id);
      return updatedNodes;
    });

    // Remove all connected edges
    setEdges((currentEdges) => {
      const updatedEdges = currentEdges.filter(
        (edge) => edge.source !== id && edge.target !== id
      );
      return updatedEdges;
    });
  };

  return (
    <WorkflowNode
      name={name}
      description={description}
      onDelete={handleDelete}
      onSettings={onSettings}
    >
      {/* Node content */}
    </WorkflowNode>
  );
});
```

**Key Points:**

1. **useReactFlow hook**: Provides access to `setNodes` and `setEdges`
2. **Filter pattern**: Returns new array without the deleted node
3. **Edge cleanup**: Removes edges where node is either source or target
4. **Automatic**: WorkflowNode toolbar shows delete button that calls `onDelete`

### Base Trigger Node Deletion

**File:** [src/features/triggers/components/base-trigger-node.tsx](src/features/triggers/components/base-trigger-node.tsx)

**Identical implementation** as execution nodes:
```typescript
const handleDelete = () => {
  setNodes((currentNodes) => {
    const updatedNodes = currentNodes.filter((node) => node.id !== id);
    return updatedNodes;
  });

  setEdges((currentEdges) => {
    const updatedEdges = currentEdges.filter(
      (edge) => edge.source !== id && edge.target !== id
    );
    return updatedEdges;
  });
};
```

**Pattern consistency:** Both trigger and execution nodes use same deletion logic.

**Why separate implementations?**
- Each base component is independent
- Could add category-specific deletion logic later (e.g., warnings for triggers)
- Follows component composition pattern established in previous feature

---

## 7. Editor UX Enhancements

**File:** [src/features/editor/components/editor.tsx](src/features/editor/components/editor.tsx)

**New ReactFlow Props:**
```typescript
<ReactFlow
  nodes={nodes}
  edges={edges}
  onNodesChange={onNodesChange}
  onEdgesChange={onEdgesChange}
  onConnect={onConnect}
  nodeTypes={nodeComponents}
  onInit={setEditor}
  fitView
  snapGrid={[10, 10]}        // NEW: Grid size
  snapToGrid={true}           // NEW: Enable snapping
  panOnScroll                 // NEW: Pan with mouse wheel
  panOnDrag={false}           // NEW: Disable pan with mouse drag
  selectionOnDrag             // NEW: Enable box selection
/>
```

### Feature Breakdown

#### 1. Snap to Grid

```typescript
snapGrid={[10, 10]}
snapToGrid={true}
```

**Purpose:** Nodes snap to 10px grid when dragging

**Benefits:**
- **Alignment**: Nodes naturally align with each other
- **Professional look**: Clean, organized canvas
- **Easier connections**: Handle positions are predictable

**Visual:**
```
Without snap-to-grid:     With snap-to-grid:
┌──────┐                  ┌──────┐
│ Node │                  │ Node │
└──────┘                  └──────┘
  ┌──────┐                  ┌──────┐
  │ Node │                  │ Node │
  └──────┘                  └──────┘
    ┌──────┐                  ┌──────┐
    │ Node │                  │ Node │
    └──────┘                  └──────┘
```

#### 2. Pan Controls

```typescript
panOnScroll          // Pan canvas with mouse wheel/trackpad
panOnDrag={false}    // Disable pan with left-click drag
```

**Rationale:**
- **Selection priority**: Left-click drag now creates selection box
- **Modern UX**: Scroll to pan is intuitive (matches Figma, Miro)
- **Power user**: Space + drag still works for panning

**Interaction model:**
- **Scroll**: Pan canvas up/down/left/right
- **Left-click + drag on node**: Move node
- **Left-click + drag on canvas**: Select multiple nodes
- **Middle-click + drag**: Pan canvas (browser default)
- **Space + drag**: Pan canvas (React Flow default)

#### 3. Selection on Drag

```typescript
selectionOnDrag
```

**Purpose:** Enable box selection by dragging on canvas

**Use case:** Select multiple nodes to:
- Delete group
- Move group
- Bulk edit
- Create compound nodes (future feature)

**Visual:**
```
User drags on empty canvas:
  ┌─ ─ ─ ─ ─ ─ ─ ─ ┐
  │ Selection box  │
  │  ┌──────┐      │
  │  │ Node │ ←────┤ Nodes inside box get selected
  │  └──────┘      │
  └─ ─ ─ ─ ─ ─ ─ ─ ┘
```

---

## 8. Base Node Updates

### Visual Status Indicators

**File:** [src/components/react-flow/base-node.tsx](src/components/react-flow/base-node.tsx)

**New Interface:**
```typescript
interface BaseNodeProps extends HTMLAttributes<HTMLDivElement> {
  status?: NodeStatus;
}
```

**Status Icons in Bottom-Right Corner:**
```typescript
export function BaseNode({ className, status, ...props }: BaseNodeProps) {
  return (
    <div className={cn("bg-card relative rounded-sm border", className)} {...props}>
      {props.children}

      {status === "error" && (
        <XCircleIcon className="absolute right-0.5 bottom-0.5 size-2 text-red-700 stroke-3" />
      )}

      {status === "success" && (
        <CheckCircleIcon className="absolute right-0.5 bottom-0.5 size-2 text-green-700 stroke-3" />
      )}

      {status === "loading" && (
        <Loader2Icon className="absolute -right-0.5 -bottom-0.5 size-2 text-blue-700 stroke-3 animate-spin" />
      )}
    </div>
  );
}
```

**Design:**
- **Small icons**: 2px size (8px actual due to `size-2` = 0.5rem)
- **Corner placement**: Bottom-right (doesn't interfere with handles)
- **High contrast**: Stroke width 3 for visibility
- **Color coding**:
  - Red: Error
  - Green: Success
  - Blue: Loading (with spin animation)

**Layering:**
```
┌────────────────────────┐
│ BaseNode               │
│                        │
│  [Node Content]        │
│                        │
│                    [✓] │ ← Status icon
└────────────────────────┘
```

### Style Updates

**Changes:**
```typescript
// Old
"hover:ring-1"
"[.react-flow\\_\\_node.selected_&]:border-muted-foreground"

// New
"hover:bg-accent"
"border-muted-foreground"
```

**Rationale:**
- **Simpler hover**: Background color change instead of ring
- **Always visible border**: No special selected state (status indicators provide feedback)
- **Cleaner look**: Reduced visual noise

---

## 9. Complete User Flows

### Flow 1: Configuring HTTP Request Node

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USER ADDS HTTP REQUEST NODE TO CANVAS                    │
│    └─ Node shows "Not configured" description               │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. USER DOUBLE-CLICKS NODE OR CLICKS SETTINGS BUTTON        │
│    └─ onDoubleClick handler fires                           │
│    └─ setDialogOpen(true) called                            │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. HTTP REQUEST DIALOG OPENS                                │
│    └─ Form fields shown: Method, Endpoint, Body             │
│    └─ Prefilled with node's current data (if any)           │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. USER FILLS FORM                                          │
│    └─ Selects "POST" method                                 │
│    └─ Body field appears (conditional)                      │
│    └─ Enters: https://api.example.com/users                 │
│    └─ Enters body: {"name": "{{user.name}}"}                │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. VALIDATION (ZOD)                                          │
│    └─ Endpoint must be valid URL                            │
│    └─ Method must be valid enum value                       │
│    └─ If invalid: Show error messages                       │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. USER CLICKS "SAVE"                                        │
│    └─ handleSubmit called with validated values             │
│    └─ setNodes() updates node data in React Flow            │
│    └─ Dialog closes                                          │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. NODE UPDATES DISPLAY                                      │
│    └─ Description changes to "POST: https://api..."         │
│    └─ Node re-renders with new data                         │
└─────────────────────────────────────────────────────────────┘
```

### Flow 2: Saving Workflow to Database

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USER EDITS WORKFLOW                                       │
│    └─ Adds nodes, moves them, creates connections           │
│    └─ Configures node settings                              │
│    └─ All changes local to React Flow state                 │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. USER CLICKS "SAVE" BUTTON IN HEADER                      │
│    └─ handleSave() called                                   │
│    └─ Gets editor instance from Jotai atom                  │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. EXTRACT CURRENT STATE                                     │
│    └─ editor.getNodes() → current node array                │
│    └─ editor.getEdges() → current edge array                │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. CALL TRPC MUTATION                                        │
│    └─ saveWorkflow.mutate({ id, nodes, edges })             │
│    └─ Button disabled during save (isPending)               │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. BACKEND: AUTHORIZATION CHECK                              │
│    └─ findUniqueOrThrow with userId filter                  │
│    └─ Throws if workflow doesn't exist or wrong user        │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. BACKEND: DATABASE TRANSACTION STARTS                      │
│    └─ Delete all existing nodes for workflow                │
│    └─ (Connections cascade delete automatically)            │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. BACKEND: CREATE NEW NODES                                 │
│    └─ createMany with nodes from frontend                   │
│    └─ Maps React Flow structure to Prisma schema            │
│    └─ Stores: id, type, position, data                      │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 8. BACKEND: CREATE NEW CONNECTIONS                           │
│    └─ createMany with edges from frontend                   │
│    └─ Maps source/target to fromNodeId/toNodeId             │
│    └─ Stores: sourceHandle, targetHandle                    │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 9. BACKEND: UPDATE TIMESTAMP                                 │
│    └─ workflow.update({ updatedAt: new Date() })            │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 10. BACKEND: COMMIT TRANSACTION                              │
│    └─ All operations succeed → commit                       │
│    └─ Any operation fails → rollback entire transaction     │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 11. FRONTEND: SUCCESS HANDLING                               │
│    └─ toast.success("Workflow saved")                       │
│    └─ queryClient.invalidateQueries (refresh cache)         │
│    └─ Button re-enabled                                     │
└─────────────────────────────────────────────────────────────┘
```

### Flow 3: Deleting a Node

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USER HOVERS OVER NODE                                     │
│    └─ WorkflowNode toolbar appears (delete + settings)      │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. USER CLICKS DELETE BUTTON (TRASH ICON)                   │
│    └─ onDelete callback fires                               │
│    └─ handleDelete() in base node component                 │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. UPDATE NODES STATE                                        │
│    └─ setNodes(currentNodes.filter(n => n.id !== id))       │
│    └─ Returns new array without deleted node                │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. UPDATE EDGES STATE                                        │
│    └─ setEdges(currentEdges.filter(e =>                     │
│         e.source !== id && e.target !== id))                │
│    └─ Removes all connections to/from deleted node          │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. REACT FLOW RE-RENDERS                                     │
│    └─ Node disappears from canvas                           │
│    └─ Connected edges disappear                             │
│    └─ Remaining nodes unaffected                            │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. USER SAVES WORKFLOW (OPTIONAL)                           │
│    └─ Click save button to persist deletion to database     │
│    └─ If not saved: Deletion only in local state            │
│    └─ Refresh page → deleted node reappears                 │
└─────────────────────────────────────────────────────────────┘
```

### Flow 4: Node Status Lifecycle (Example)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. NODE INITIAL STATE                                        │
│    └─ status="initial"                                      │
│    └─ No border or overlay                                  │
│    └─ No icon in corner                                     │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. USER TRIGGERS WORKFLOW EXECUTION                          │
│    └─ Backend starts processing                             │
│    └─ Node status updates to "loading"                      │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. LOADING STATE VISUAL                                      │
│    └─ Rotating blue gradient border appears                 │
│    └─ Spinning Loader2 icon in bottom-right corner          │
│    └─ Node content still visible                            │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. EXECUTION COMPLETES SUCCESSFULLY                          │
│    └─ Backend returns success                               │
│    └─ Node status updates to "success"                      │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. SUCCESS STATE VISUAL                                      │
│    └─ Green static border appears                           │
│    └─ Green checkmark icon in bottom-right corner           │
│    └─ Loading animation stops                               │
└─────────────────────────────────────────────────────────────┘

                    OR (if error)

┌─────────────────────────────────────────────────────────────┐
│ 4. EXECUTION FAILS                                           │
│    └─ Backend returns error                                 │
│    └─ Node status updates to "error"                        │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. ERROR STATE VISUAL                                        │
│    └─ Red static border appears                             │
│    └─ Red X icon in bottom-right corner                     │
│    └─ Loading animation stops                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 10. Architecture Patterns

### 1. Global State with Jotai

**Pattern:** Atomic state management for editor instance

```typescript
// Define atom
export const editorAtom = atom<ReactFlowInstance | null>(null);

// Provider at root
<Provider>{children}</Provider>

// Write once (when initialized)
const setEditor = useSetAtom(editorAtom);
<ReactFlow onInit={setEditor} />

// Read many times (from any component)
const editor = useAtomValue(editorAtom);
editor?.getNodes();
```

**Benefits:**
- **No prop drilling**: Any component can access editor
- **Type-safe**: TypeScript knows exact type
- **Performance**: Only components using atom re-render
- **Simple API**: Familiar hooks pattern

**When to use:**
- Singleton instances (like React Flow)
- Cross-cutting concerns (theme, auth, etc.)
- Data needed by distant components

**When NOT to use:**
- Local component state
- Parent-child communication (use props)
- Derived state (use useMemo)

### 2. Controlled Dialog Pattern

**Pattern:** Parent controls dialog open/closed state

```typescript
// Parent component
const [dialogOpen, setDialogOpen] = useState(false);

<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
  <DialogContent>
    <Form onSubmit={(values) => {
      updateNodeData(values);
      setDialogOpen(false);  // Close after save
    }} />
  </DialogContent>
</Dialog>

// Trigger from parent
<Button onClick={() => setDialogOpen(true)}>Settings</Button>
```

**Benefits:**
- **Predictable**: Parent knows when dialog is open
- **Coordinated**: Can close dialog after async operations
- **Testable**: Easy to simulate open/close
- **Flexible**: Parent can prevent closing if needed

### 3. Form Schema First

**Pattern:** Define Zod schema, infer TypeScript types

```typescript
// 1. Define schema
const formSchema = z.object({
  endpoint: z.url(),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  body: z.string().optional(),
});

// 2. Infer types
export type FormType = z.infer<typeof formSchema>;

// 3. Use in form
const form = useForm<FormType>({
  resolver: zodResolver(formSchema),
});

// 4. Use in props
interface Props {
  onSubmit: (values: FormType) => void;
}
```

**Benefits:**
- **Single source of truth**: Schema defines validation + types
- **Runtime safety**: Zod validates at runtime
- **Compile-time safety**: TypeScript checks at compile time
- **Self-documenting**: Schema shows required fields

### 4. Conditional Form Fields

**Pattern:** Show/hide fields based on form values

```typescript
// Watch field value
const watchMethod = form.watch("method");

// Conditional logic
const showBodyField = ["POST", "PUT", "PATCH"].includes(watchMethod);

// Conditional render
{showBodyField && (
  <FormField name="body" />
)}
```

**Benefits:**
- **Dynamic UX**: Form adapts to user input
- **Clean UI**: Only show relevant fields
- **Validation**: Optional fields only required when shown

### 5. Delete-and-Recreate Strategy

**Pattern:** Replace entire state instead of patching

```typescript
// Instead of:
await prisma.node.update({ where: { id }, data: { position } });
await prisma.node.update({ where: { id2 }, data: { position2 } });
// ... (complex diff logic)

// Do this:
await prisma.node.deleteMany({ where: { workflowId } });
await prisma.node.createMany({ data: nodes });
```

**Trade-offs:**

**Pros:**
- Simple implementation
- No diff logic needed
- Guaranteed consistency
- Works with transactions

**Cons:**
- Loses node-level history
- Generates new IDs (if not preserved)
- Potentially slower for huge workflows

**When to use:**
- Small-to-medium data sizes
- Infrequent updates
- When consistency > performance

**When NOT to use:**
- Real-time collaboration
- Large datasets (>1000 items)
- Fine-grained history tracking needed

### 6. Transaction Pattern

**Pattern:** Group multiple DB operations atomically

```typescript
return await prisma.$transaction(async (tx) => {
  await tx.node.deleteMany({ where: { workflowId } });
  await tx.node.createMany({ data: nodes });
  await tx.connection.createMany({ data: edges });
  await tx.workflow.update({ where: { id }, data: { updatedAt } });
});
```

**Guarantees:**
- **Atomicity**: All succeed or all fail
- **Consistency**: No partial updates
- **Isolation**: Other requests see old or new state, never in-between

**When to use:**
- Multiple related writes
- Critical data integrity
- Operations that depend on each other

### 7. Status as Prop

**Pattern:** Pass status down through component layers

```typescript
// Node component
const HttpRequestNode = (props) => {
  const status = deriveStatusFromExecutionState();

  return (
    <BaseExecutionNode status={status} {...props}>
      {/* content */}
    </BaseExecutionNode>
  );
};

// Base component
const BaseExecutionNode = ({ status, children }) => {
  return (
    <NodeStatusIndicator status={status} variant="border">
      <BaseNode status={status}>
        {children}
      </BaseNode>
    </NodeStatusIndicator>
  );
};

// Primitive
const NodeStatusIndicator = ({ status, children }) => {
  switch (status) {
    case "loading": return <BorderLoadingIndicator>{children}</BorderLoadingIndicator>;
    case "success": return <StatusBorder color="green">{children}</StatusBorder>;
    // ...
  }
};
```

**Benefits:**
- **Separation of concerns**: Each layer handles its aspect
- **Composable**: Mix and match indicators
- **Type-safe**: Status enum enforced

---

## 11. File Organization

### New Files

```
src/
├── components/
│   └── react-flow/
│       └── node-status-indicator.tsx       # Status indicator component
│
├── features/
│   ├── editor/
│   │   └── store/
│   │       └── atoms.ts                    # Jotai atoms (editor instance)
│   │
│   ├── executions/
│   │   └── components/
│   │       └── http-request/
│   │           └── dialog.tsx              # HTTP request config dialog
│   │
│   └── triggers/
│       └── components/
│           └── manual-trigger/
│               └── dialog.tsx              # Manual trigger info dialog
```

### Modified Files

```
src/
├── app/
│   └── layout.tsx                          # Added Jotai Provider
│
├── components/
│   └── react-flow/
│       └── base-node.tsx                   # Added status prop + corner icons
│
├── features/
│   ├── editor/
│   │   └── components/
│   │       ├── editor.tsx                  # Added Jotai, snap-to-grid, pan controls
│   │       └── editor-header.tsx           # Implemented save functionality
│   │
│   ├── executions/
│   │   └── components/
│   │       ├── base-execution-node.tsx     # Added status, delete, dialog
│   │       └── http-request/
│   │           └── node.tsx                # Integrated dialog + data handling
│   │
│   ├── triggers/
│   │   └── components/
│   │       ├── base-trigger-node.tsx       # Added status, delete, dialog
│   │       └── manual-trigger/
│   │           └── node.tsx                # Integrated dialog + status
│   │
│   └── workflows/
│       ├── hooks/
│       │   └── use-workflows.ts            # Added useUpdateWorkflow hook
│       └── server/
│           └── routers.ts                  # Added update mutation

package.json                                 # Added jotai dependency
```

### Feature Domains

```
features/
├── editor/
│   ├── components/      # Editor canvas + header
│   └── store/           # Global editor state (NEW)
│
├── executions/
│   └── components/
│       ├── base-execution-node.tsx
│       └── http-request/
│           ├── node.tsx
│           └── dialog.tsx  (NEW)
│
├── triggers/
│   └── components/
│       ├── base-trigger-node.tsx
│       └── manual-trigger/
│           ├── node.tsx
│           └── dialog.tsx  (NEW)
│
└── workflows/
    ├── hooks/           # Client-side workflow operations
    └── server/          # Backend workflow operations
```

---

## Summary

**What was added:**

✅ Global editor state management with Jotai
✅ Visual node status indicators (loading, success, error)
✅ Configuration dialogs for HTTP Request and Manual Trigger nodes
✅ Complete workflow save functionality (frontend + backend)
✅ Node deletion with automatic edge cleanup
✅ Enhanced editor UX (snap-to-grid, pan controls, selection)
✅ Form validation with Zod schemas
✅ Database transactions for atomic saves
✅ Cache invalidation for optimistic updates

**Key Benefits:**

- **Persistent state**: Workflows save to database with one click
- **User feedback**: Visual indicators show node execution status
- **Configurability**: Nodes can be configured via intuitive dialogs
- **Data integrity**: Transactions ensure consistent database state
- **Better UX**: Grid snapping, pan controls, and selection improve editing
- **Type safety**: Zod + TypeScript enforce correct data shapes
- **Performance**: Jotai ensures minimal re-renders

**Technical Achievements:**

- **Atomic operations**: Transaction pattern prevents partial saves
- **Separation of concerns**: Dialog state, form validation, and data persistence cleanly separated
- **Reusable components**: Status indicators work with any node type
- **Scalable architecture**: Easy to add new node types with configs
- **Authorization**: Server validates user owns workflow before saving

**Next Steps:**

1. **Workflow execution engine**: Actually run the workflows (trigger → execution flow)
2. **Real-time status updates**: WebSocket/SSE to show live execution status
3. **More node types**: Database queries, transformations, conditionals, loops
4. **Node validation**: Pre-execution checks (required fields, valid connections)
5. **Version history**: Track workflow changes over time
6. **Undo/redo**: Local history for editor operations
7. **Keyboard shortcuts**: Save (Ctrl+S), delete (Del), select all (Ctrl+A)
8. **Auto-save**: Periodic saves in background
9. **Collaborative editing**: Operational transforms or CRDT for real-time collab
10. **Node templates**: Pre-configured node blueprints

**Architecture Evolution:**

```
Previous Feature:         This Feature:
─────────────────         ─────────────
Static canvas      →      Persistent editor state
Visual nodes only  →      Configurable + executable nodes
Client-only state  →      Synced with database
Manual connections →      Saved connections
No feedback        →      Visual status indicators
```

**This feature transforms the editor from a visual prototype into a functional workflow builder with persistence, configuration, and execution capabilities.**
