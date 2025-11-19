# Editor Setup Feature - Implementation Guide

## Overview

This document explains the **Visual Workflow Editor** feature added to the application. This enhancement transforms workflows from simple data structures into an interactive, visual node-based editor powered by React Flow. Users can now:

- **Visual workflow building** with drag-and-drop nodes
- **Node connections** with interactive edges
- **Persistent state** stored in PostgreSQL database
- **Type-safe data modeling** with Prisma ORM
- **Real-time updates** with React Flow integration
- **Extensible node system** supporting multiple node types

---

## Table of Contents

1. [Dependencies Added](#1-dependencies-added)
2. [Database Schema](#2-database-schema)
3. [Node Component System](#3-node-component-system)
4. [React Flow Integration](#4-react-flow-integration)
5. [Server-Side Implementation](#5-server-side-implementation)
6. [Complete Data Flow](#6-complete-data-flow)
7. [File Organization](#7-file-organization)
8. [Key Concepts](#8-key-concepts)

---

## 1. Dependencies Added

**Package:** `@xyflow/react` v12.9.3

**What is React Flow (xyflow)?**
A highly customizable React library for building node-based editors, diagrams, and interactive graphs. It provides:
- Drag-and-drop node positioning
- Customizable node and edge components
- Built-in controls (zoom, pan, minimap)
- Connection validation
- Performance optimizations for large graphs

**Why React Flow?**
- **Production-ready**: Battle-tested in enterprise applications
- **Customizable**: Full control over node/edge appearance and behavior
- **Type-safe**: Full TypeScript support
- **Performant**: Handles hundreds of nodes efficiently
- **Well-documented**: Extensive documentation and examples

---

## 2. Database Schema

### New Models Added

**File:** [prisma/schema.prisma](prisma/schema.prisma)

#### NodeType Enum

```prisma
enum NodeType {
  INITIAL
}
```

**Purpose:** Defines available node types in the workflow system. Currently supports `INITIAL` node type, which serves as the entry point for workflows.

**Extensibility:** Additional node types can be added here (e.g., `WEBHOOK`, `HTTP_REQUEST`, `TRANSFORM`, etc.).

#### Node Model

```prisma
model Node {
  id String @id @default(cuid())
  workflowId String
  workflow Workflow @relation(fields: [workflowId], references: [id], onDelete: Cascade)

  name String
  type NodeType
  position Json
  data Json @default("{}")

  outputConnections Connection[] @relation("FromNode")
  inputConnections Connection[] @relation("ToNode")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**Fields:**
- `id`: Unique identifier (CUID)
- `workflowId`: Foreign key to parent workflow
- `name`: Display name for the node
- `type`: Node type from `NodeType` enum
- `position`: JSON object storing `{ x: number, y: number }` coordinates
- `data`: JSON object for node-specific configuration (flexible schema)
- `outputConnections`: Connections where this node is the source
- `inputConnections`: Connections where this node is the target

**Why JSON fields?**
- **Position**: React Flow expects `{ x, y }` object; storing as JSON avoids separate columns
- **Data**: Each node type may have different configuration needs; JSON provides flexibility

#### Connection Model

```prisma
model Connection {
  id String @id @default(cuid())
  workflowId String
  workflow Workflow @relation(fields: [workflowId], references: [id], onDelete: Cascade)

  fromNodeId String
  fromNode Node @relation("FromNode", fields: [fromNodeId], references: [id], onDelete: Cascade)
  toNodeId String
  toNode Node @relation("ToNode", fields: [toNodeId], references: [id], onDelete: Cascade)

  fromOutput String @default("main")
  toInput String @default("main")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([fromNodeId, toNodeId, fromOutput, toInput])
}
```

**Fields:**
- `id`: Unique identifier
- `workflowId`: Foreign key to parent workflow
- `fromNodeId`: Source node ID
- `toNodeId`: Target node ID
- `fromOutput`: Output handle name (default: "main")
- `toInput`: Input handle name (default: "main")

**Key Features:**
- **Unique constraint**: Prevents duplicate connections between the same handles
- **Cascade delete**: Removing a node automatically deletes its connections
- **Multiple handles**: Supports nodes with multiple input/output points

#### Updated Workflow Model

```prisma
model Workflow {
  id        String   @id @default(cuid())
  name      String
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  nodes      Node[]              // NEW
  connections Connection[]       // NEW
  createdAt DateTime @default(now())
  updatedAt DateTime @default(now()) @updatedAt

  @@map("workflow")
}
```

**Changes:**
- Added `nodes` relation (one-to-many)
- Added `connections` relation (one-to-many)

---

## 3. Node Component System

### Component Architecture

The node system follows a layered architecture:

```
WorkflowNode (wrapper with toolbar)
    └── InitialNode (specific node type)
        └── PlaceholderNode (styled container)
            └── BaseNode (primitive)
```

### Base Node Components

**File:** [src/components/react-flow/base-node.tsx](src/components/react-flow/base-node.tsx)

Provides primitive building blocks for all node types:

#### 1. BaseNode Component

```typescript
export function BaseNode({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "bg-card text-card-foreground relative rounded-md border",
        "hover:ring-1",
        "[.react-flow__node.selected_&]:border-muted-foreground",
        "[.react-flow__node.selected_&]:shadow-lg",
        className,
      )}
      tabIndex={0}
      {...props}
    />
  );
}
```

**Features:**
- Card-style appearance with border
- Hover ring effect
- Selected state styling using React Flow's class
- Keyboard accessible (tabIndex)

**Styling trick:** React Flow wraps nodes in a `div.react-flow__node` element and adds `.selected` class when selected. The `[.react-flow__node.selected_&]` selector targets the BaseNode when its wrapper has `.selected`.

#### 2. BaseNodeHeader Component

```typescript
export function BaseNodeHeader({ className, ...props }: ComponentProps<"header">) {
  return (
    <header
      className={cn(
        "mx-0 my-0 -mb-1 flex flex-row items-center justify-between gap-2 px-3 py-2",
        className,
      )}
      {...props}
    />
  );
}
```

**Purpose:** Consistent header layout for node titles and controls.

#### 3. BaseNodeHeaderTitle Component

```typescript
export function BaseNodeHeaderTitle({ className, ...props }: ComponentProps<"h3">) {
  return (
    <h3
      data-slot="base-node-title"
      className={cn("user-select-none flex-1 font-semibold", className)}
      {...props}
    />
  );
}
```

**Features:**
- Non-selectable text (prevents accidental text selection during drag)
- Flex-1 to fill available space
- Data attribute for testing/debugging

#### 4. BaseNodeContent & BaseNodeFooter

```typescript
export function BaseNodeContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="base-node-content"
      className={cn("flex flex-col gap-y-2 p-3", className)}
      {...props}
    />
  );
}

export function BaseNodeFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="base-node-footer"
      className={cn(
        "flex flex-col items-center gap-y-2 border-t px-3 pt-2 pb-3",
        className,
      )}
      {...props}
    />
  );
}
```

**Purpose:** Standardized sections for node body and footer content.

### PlaceholderNode Component

**File:** [src/components/react-flow/placeholder-node.tsx](src/components/react-flow/placeholder-node.tsx)

```typescript
export function PlaceholderNode({ children, onClick }: PlaceholderNodeProps) {
  return (
    <BaseNode
      className="bg-card w-auto h-auto border-dashed border-gray-400 p-4 text-center text-gray-400 shadow-none cursor-pointer hover:border-gray-500 hover:bg-gray-50"
      onClick={onClick}
    >
      {children}
      <Handle
        type="target"
        style={{ visibility: "hidden" }}
        position={Position.Top}
        isConnectable={false}
      />
      <Handle
        type="source"
        style={{ visibility: "hidden" }}
        position={Position.Bottom}
        isConnectable={false}
      />
    </BaseNode>
  );
}
```

**Features:**
- Dashed border style (visual cue for "empty" or "add" state)
- Hidden handles (maintains React Flow structure without visual clutter)
- Clickable area for interaction
- Hover effects

**Use case:** Initial nodes, "add node" placeholders, or empty states.

### WorkflowNode Wrapper

**File:** [src/components/workflow-node.tsx](src/components/workflow-node.tsx)

```typescript
export function WorkflowNode({
  children,
  showToolbar = true,
  onDelete,
  onSettings,
  name,
  description,
}: WorkflowNodeProps) {
  return (
    <>
      {showToolbar && (
        <NodeToolbar>
          <Button size="sm" variant="ghost" onClick={onSettings}>
            <SettingsIcon className="size-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete}>
            <TrashIcon className="size-4" />
          </Button>
        </NodeToolbar>
      )}
      {children}
      {name && (
        <NodeToolbar
          position={Position.Bottom}
          isVisible
          className="max-w-[200px] text-center"
        >
          <p className="font-medium">{name}</p>
          {description && (
            <p className="text-muted-foreground truncate text-sm">
              {description}
            </p>
          )}
        </NodeToolbar>
      )}
    </>
  );
}
```

**Features:**
- **Top toolbar**: Settings and delete buttons (optional)
- **Bottom toolbar**: Node name and description (optional)
- **NodeToolbar**: React Flow component that appears on hover/selection
- **Conditional rendering**: Toolbars only show when needed

### InitialNode Implementation

**File:** [src/components/initial-node.tsx](src/components/initial-node.tsx)

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

**Key points:**
- `memo()`: Performance optimization (only re-renders when props change)
- `showToolbar={false}`: Initial node shouldn't be deleted/configured
- `PlusIcon`: Visual indicator for "start here"
- `onClick={() => {}}`: Placeholder for future interaction

### Node Component Registry

**File:** [src/config/node-components.ts](src/config/node-components.ts)

```typescript
import { InitialNode } from "@/components/initial-node";
import { NodeType } from "@/generated/prisma/enums";
import type { NodeTypes } from "@xyflow/react";

export const nodeComponents = {
  [NodeType.INITIAL]: InitialNode,
} as const satisfies NodeTypes;

export type RegisteredNodeType = keyof typeof nodeComponents;
```

**Purpose:** Central registry mapping `NodeType` enum values to React components.

**Type safety:**
- `satisfies NodeTypes`: Ensures object matches React Flow's expected type
- `as const`: Creates readonly object (prevents accidental modification)
- `RegisteredNodeType`: Type helper for registered node types

**Usage:**
```typescript
// In React Flow
<ReactFlow nodeTypes={nodeComponents} />

// React Flow automatically renders the correct component based on node.type
```

---

## 4. React Flow Integration

### Editor Component

**File:** [src/features/editor/components/editor.tsx](src/features/editor/components/editor.tsx)

```typescript
export const Editor = ({ workflowId }: { workflowId: string }) => {
  const { data: workflow } = useSuspenseWorkflow(workflowId);

  const [nodes, setNodes] = useState<Node[]>(workflow.nodes);
  const [edges, setEdges] = useState<Edge[]>(workflow.edges);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setNodes((nodesSnapshot) => applyNodeChanges(changes, nodesSnapshot)),
    []
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) =>
      setEdges((edgesSnapshot) => applyEdgeChanges(changes, edgesSnapshot)),
    []
  );

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((edgesSnapshot) => addEdge(params, edgesSnapshot)),
    []
  );

  return (
    <div className="size-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeComponents}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />

        <Panel position="top-right" className="m-2">
          <AddNodeButton />
        </Panel>
      </ReactFlow>
    </div>
  );
};
```

#### Key React Flow Concepts

**1. Nodes and Edges State**

```typescript
const [nodes, setNodes] = useState<Node[]>(workflow.nodes);
const [edges, setEdges] = useState<Edge[]>(workflow.edges);
```

React Flow is a **controlled component**. You manage nodes/edges state and pass them as props.

**2. Change Handlers**

```typescript
const onNodesChange = useCallback(
  (changes: NodeChange[]) =>
    setNodes((nodesSnapshot) => applyNodeChanges(changes, nodesSnapshot)),
  []
);
```

**How it works:**
- User drags a node → React Flow generates `NodeChange` events
- `onNodesChange` handler receives array of changes
- `applyNodeChanges()` applies changes to current state
- State update triggers re-render

**Types of NodeChange events:**
- `position`: Node was moved
- `dimensions`: Node was resized
- `select`: Node was selected/deselected
- `remove`: Node was deleted

**Why useCallback?**
- Prevents unnecessary re-renders
- React Flow is performance-sensitive

**3. Connection Handler**

```typescript
const onConnect = useCallback(
  (params: Connection) =>
    setEdges((edgesSnapshot) => addEdge(params, edgesSnapshot)),
  []
);
```

**Flow:**
1. User drags from one node's handle to another
2. React Flow validates connection
3. `onConnect` fires with connection parameters
4. `addEdge()` adds new edge to state

**4. Built-in Components**

```typescript
<Background />    // Grid/dot background
<Controls />      // Zoom/pan controls
<MiniMap />       // Mini overview map
<Panel />         // Overlay panel for custom UI
```

**5. Props**

- `nodeTypes={nodeComponents}`: Maps node types to React components
- `fitView`: Automatically centers and scales the view to show all nodes

### AddNodeButton Component

**File:** [src/features/editor/components/add-node-button.tsx](src/features/editor/components/add-node-button.tsx)

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

**Current state:** Placeholder button in top-right panel.

**Future implementation:** Will open dialog to select node type and add to workflow.

---

## 5. Server-Side Implementation

### Updated tRPC Router

**File:** [src/features/workflows/server/routers.ts](src/features/workflows/server/routers.ts)

#### Updated: create Procedure

**Before:**
```typescript
create: protectedProcedure.mutation(({ ctx }) => {
  return prisma.workflow.create({
    data: {
      name: generateSlug(3),
      userId: ctx.auth.user.id,
    },
  });
});
```

**After:**
```typescript
create: protectedProcedure.mutation(({ ctx }) => {
  return prisma.workflow.create({
    data: {
      name: generateSlug(3),
      userId: ctx.auth.user.id,
      nodes: {
        create: {
          position: { x: 0, y: 0 },
          type: NodeType.INITIAL,
          name: NodeType.INITIAL,
        },
      },
    },
  });
});
```

**Changes:**
- **Nested create**: Uses Prisma's nested write to create workflow + initial node in single transaction
- **Initial node**: Every workflow starts with one `INITIAL` node at origin (0, 0)

**Why initial node?**
- Provides visual starting point for users
- Prevents empty canvas confusion
- Can be used as workflow entry point in execution

#### New: getOne Procedure

```typescript
getOne: protectedProcedure
  .input(z.object({ id: z.string() }))
  .query(async ({ ctx, input }) => {
    const workflow = await prisma.workflow.findUniqueOrThrow({
      where: { id: input.id, userId: ctx.auth.user.id },
      include: { nodes: true, connections: true },
    });

    // Transform server nodes to react-flow compatible nodes
    const nodes: Node[] = workflow.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position as { x: number; y: number },
      data: (node.data as Record<string, unknown>) || {},
    }));

    // Transform server connections to react-flow compatible edges
    const edges: Edge[] = workflow.connections.map((connection) => ({
      id: connection.id,
      source: connection.fromNodeId,
      target: connection.toNodeId,
      sourceHandle: connection.fromOutput,
      targetHandle: connection.toInput,
    }));

    return {
      id: workflow.id,
      name: workflow.name,
      nodes,
      edges,
    };
  });
```

**Key features:**

**1. Data fetching:**
```typescript
include: { nodes: true, connections: true }
```
Eager loads related nodes and connections in single query.

**2. Database → React Flow transformation:**

**Database format:**
```typescript
{
  nodes: [
    { id: "n1", position: { x: 0, y: 0 }, type: "INITIAL", data: {...} }
  ],
  connections: [
    { id: "c1", fromNodeId: "n1", toNodeId: "n2", fromOutput: "main", toInput: "main" }
  ]
}
```

**React Flow format:**
```typescript
{
  nodes: [
    { id: "n1", position: { x: 0, y: 0 }, type: "INITIAL", data: {...} }
  ],
  edges: [
    { id: "c1", source: "n1", target: "n2", sourceHandle: "main", targetHandle: "main" }
  ]
}
```

**Mapping:**
- `fromNodeId` → `source`
- `toNodeId` → `target`
- `fromOutput` → `sourceHandle`
- `toInput` → `targetHandle`

**Why transform?**
- React Flow uses different naming conventions
- Transformation happens on server (reduces client-side work)
- Type-safe via tRPC (client automatically knows return type)

**3. Security:**
```typescript
where: { id: input.id, userId: ctx.auth.user.id }
```
Ensures users can only access their own workflows.

---

## 6. Complete Data Flow

### Workflow Creation Flow

```
1. USER CLICKS "Create Workflow"
   └─ Calls: trpc.workflows.create.mutate()

2. tRPC MUTATION EXECUTES
   └─ Server: src/features/workflows/server/routers.ts

3. PRISMA TRANSACTION
   └─ BEGIN
       INSERT INTO workflow (name, userId) VALUES (...)
       INSERT INTO Node (workflowId, type, position, name) VALUES (...)
       COMMIT

4. SERVER RESPONSE
   └─ Returns: { id: "abc123", name: "random-slug", ... }

5. CLIENT RECEIVES RESPONSE
   └─ React Query invalidates workflow list
   └─ User redirected to /workflows/abc123

6. EDITOR PAGE LOADS
   └─ Calls: trpc.workflows.getOne({ id: "abc123" })
```

### Editor Loading Flow

```
1. EDITOR COMPONENT MOUNTS
   └─ Component: src/features/editor/components/editor.tsx

2. useSuspenseWorkflow HOOK EXECUTES
   └─ Calls: trpc.workflows.getOne({ id: workflowId })

3. SERVER QUERY EXECUTES
   ├─ SELECT * FROM workflow WHERE id = ? AND userId = ?
   ├─ SELECT * FROM Node WHERE workflowId = ?
   └─ SELECT * FROM Connection WHERE workflowId = ?

4. DATA TRANSFORMATION
   ├─ Database nodes → React Flow nodes format
   └─ Database connections → React Flow edges format

5. CLIENT RECEIVES DATA
   └─ { id, name, nodes: Node[], edges: Edge[] }

6. REACT STATE INITIALIZATION
   ├─ useState(workflow.nodes)
   └─ useState(workflow.edges)

7. REACT FLOW RENDERS
   ├─ For each node: renders component from nodeComponents registry
   ├─ Draws edges between nodes
   └─ Enables interaction (drag, connect, select)
```

### Node Drag Flow (Client-Side Only)

```
1. USER DRAGS NODE
   └─ React Flow internal event handling

2. onNodesChange CALLBACK FIRES
   └─ Receives: [{ type: 'position', id: 'n1', position: { x: 100, y: 200 } }]

3. applyNodeChanges UPDATES STATE
   └─ Old state: [{ id: 'n1', position: { x: 0, y: 0 } }]
   └─ New state: [{ id: 'n1', position: { x: 100, y: 200 } }]

4. REACT RE-RENDERS
   └─ Node component re-renders at new position

5. (FUTURE) DEBOUNCED SAVE TO SERVER
   └─ After user stops dragging, persist to database
```

### Connection Creation Flow (Client-Side Only)

```
1. USER DRAGS FROM NODE HANDLE
   └─ React Flow shows connection preview

2. USER RELEASES ON TARGET HANDLE
   └─ React Flow validates connection

3. onConnect CALLBACK FIRES
   └─ Receives: { source: 'n1', target: 'n2', sourceHandle: 'out', targetHandle: 'in' }

4. addEdge UPDATES STATE
   └─ New edge added to edges array

5. REACT RE-RENDERS
   └─ New edge drawn on canvas

6. (FUTURE) SAVE TO SERVER
   └─ POST to API to persist connection
```

---

## 7. File Organization

### New Files Added

```
src/
├── components/
│   ├── initial-node.tsx              # INITIAL node type component
│   ├── workflow-node.tsx             # Wrapper with toolbars
│   └── react-flow/
│       ├── base-node.tsx             # Primitive node components
│       └── placeholder-node.tsx      # Placeholder/empty state node
│
├── config/
│   └── node-components.ts            # Node type → component registry
│
└── features/editor/
    └── components/
        └── add-node-button.tsx       # Button to add new nodes

prisma/
├── schema.prisma                     # Updated with Node, Connection models
└── migrations/
    └── 20251119015006_react_flow_tables/
        └── migration.sql             # Database migration
```

### Modified Files

```
src/
└── features/workflows/
    └── server/
        └── routers.ts                # Added getOne, updated create

package.json                          # Added @xyflow/react dependency
```

---

## 8. Key Concepts

### Why React Flow?

**Problem:** Building a node-based editor from scratch is complex:
- Drag-and-drop with constraints
- Connection validation
- Zoom/pan with performance
- Accessibility
- Edge routing

**Solution:** React Flow provides all this out of the box.

### Node Type System

**Type-safe flow:**
1. **Database:** Prisma enum defines available types
2. **Registry:** TypeScript maps enum to React components
3. **Runtime:** React Flow renders correct component based on `node.type`

**Adding new node type:**
```typescript
// 1. Add to Prisma schema
enum NodeType {
  INITIAL
  WEBHOOK  // NEW
}

// 2. Create component
export const WebhookNode = memo((props: NodeProps) => {
  return <BaseNode>...</BaseNode>
});

// 3. Register component
export const nodeComponents = {
  [NodeType.INITIAL]: InitialNode,
  [NodeType.WEBHOOK]: WebhookNode,  // NEW
};
```

TypeScript will enforce that all enum values have corresponding components!

### Data Transformation Strategy

**Why transform server data?**
- React Flow expects specific property names (`source` not `fromNodeId`)
- Transformation on server reduces client bundle size
- Single source of truth (database schema)
- Type-safe via tRPC

**Alternative approach (not used):**
Store React Flow format directly in database. **Downside:** Tightly couples database to UI library.

### JSON Fields for Flexibility

**Position field:**
```typescript
position: { x: number; y: number }
```
Stored as JSON because:
- React Flow requires this exact shape
- Avoids separate `positionX`, `positionY` columns
- Easy to extend (e.g., add `z` for 3D)

**Data field:**
```typescript
data: Record<string, unknown>
```
Stored as JSON because:
- Each node type has different configuration
- Schema-less flexibility
- Can use Zod for validation per node type

### Controlled vs Uncontrolled Components

React Flow uses **controlled component pattern**:
- You manage `nodes` and `edges` state
- React Flow renders based on your state
- Events flow back to your handlers
- You decide when to update state

**Benefits:**
- Full control over state management
- Can intercept/validate changes
- Integrate with Redux, Zustand, etc.
- Easier to implement undo/redo

### Performance Optimizations

**1. memo() for node components:**
```typescript
export const InitialNode = memo((props: NodeProps) => { ... });
```
Prevents re-renders when props haven't changed.

**2. useCallback() for handlers:**
```typescript
const onNodesChange = useCallback((changes) => { ... }, []);
```
Stable function references prevent unnecessary re-renders.

**3. React Flow internals:**
- Virtualization for large graphs
- Efficient diffing algorithm
- GPU-accelerated rendering

### Future Enhancements

**State persistence:**
Currently, node positions are only stored in React state. Next steps:
1. Debounce position changes
2. Batch updates
3. POST to tRPC mutation
4. Update database

**Implementation sketch:**
```typescript
const [debouncedNodes] = useDebounce(nodes, 1000);

useEffect(() => {
  if (debouncedNodes) {
    updateWorkflow.mutate({
      id: workflowId,
      nodes: debouncedNodes.map(n => ({
        id: n.id,
        position: n.position,
      })),
    });
  }
}, [debouncedNodes]);
```

**Node library:**
- Build a palette of node types (HTTP, Database, Transform, etc.)
- Drag from palette to canvas
- Configure node settings in side panel

**Execution engine:**
- Interpret node graph
- Execute nodes in topological order
- Handle async operations
- Error handling and retries

---

## Technology Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **UI Framework** | React Flow (@xyflow/react) | Visual node editor |
| **State Management** | React useState + useCallback | Local editor state |
| **Database** | PostgreSQL + Prisma | Persistent storage |
| **Type Safety** | TypeScript + tRPC | End-to-end type inference |
| **Styling** | Tailwind CSS v4 | Component styling |
| **Node Registry** | TypeScript const object | Type-safe component mapping |

---

## Code Quality Patterns

### 1. Type Safety

**Prisma enum → TypeScript:**
```typescript
import { NodeType } from "@/generated/prisma/enums";
```
Database types automatically available in TypeScript!

**satisfies operator:**
```typescript
export const nodeComponents = {
  [NodeType.INITIAL]: InitialNode,
} as const satisfies NodeTypes;
```
Ensures registry matches React Flow's expected type while preserving literal types.

### 2. Component Composition

**Layered architecture:**
- `BaseNode`: Primitive styling
- `PlaceholderNode`: Specific variant
- `WorkflowNode`: Behavior wrapper
- `InitialNode`: Concrete implementation

**Benefits:**
- Reusability across node types
- Separation of concerns
- Easy to customize

### 3. Data Slots

```typescript
<div data-slot="base-node-content" />
```
Data attributes for:
- Testing (e.g., `screen.getByRole('[data-slot="base-node-content"]')`)
- Debugging (inspect React tree)
- CSS overrides (advanced styling)

---

## Summary

**What was added:**
✅ React Flow integration for visual workflow editing
✅ Database schema for nodes and connections
✅ Type-safe node component system
✅ Base node primitives for consistent styling
✅ Initial node type with placeholder design
✅ tRPC procedures for fetching workflow graphs
✅ Automatic initial node creation on workflow creation
✅ Editor component with controls, minimap, and background

**Key Benefits:**
- **Better UX**: Visual, drag-and-drop interface instead of text-based configuration
- **Type Safety**: Prisma enums → TypeScript → React Flow (fully type-safe)
- **Extensible**: Easy to add new node types via registry system
- **Production-Ready**: Built on battle-tested React Flow library
- **Performance**: Optimized with memo(), useCallback(), and React Flow's internals

**Next Steps:**
1. Implement node persistence (save position/connection changes)
2. Build node library with multiple types (HTTP, Webhook, Transform, etc.)
3. Add node configuration panel
4. Implement workflow execution engine
5. Add validation and error handling

**This pattern establishes the foundation for a complete visual workflow automation system.**
