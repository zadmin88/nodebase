import { Node, NodeProps, useReactFlow } from "@xyflow/react";
import { GlobeIcon } from "lucide-react";
import { memo, useState } from "react";
import { BaseExecutionNode } from "../base-execution-node";
import { FormType, HttpRequestDialog } from "./dialog";

type HttpRequestNodeData = {
  endpoint?: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: string;
  [key: string]: unknown;
};

type HttpRequestNodeType = Node<HttpRequestNodeData>;

export const HttpRequestNode = memo((props: NodeProps<HttpRequestNodeType>) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const nodeData = props.data;
  const { setNodes } = useReactFlow();

  const handleOpenSettings = () => setDialogOpen(true);

  const handleSubmit = (values: FormType) => {
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === props.id) {
          return {
            ...node,
            data: {
              ...node.data,
              endpoint: values.endpoint,
              method: values.method,
              body: values.body,
            },
          };
        }
        return node;
      })
    );
  };

  const description = nodeData.endpoint
    ? `${nodeData.method || "GET"}: ${nodeData.endpoint}`
    : "Not configured";

  return (
    <>
      <HttpRequestDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultEndpoint={nodeData.endpoint} // TODO: Check if it can be improved by [context missing]
        defaultMethod={nodeData.method}
        defaultBody={nodeData.body}
        onSubmit={handleSubmit}
      />
      <BaseExecutionNode
        {...props}
        id={props.id}
        icon={GlobeIcon}
        // Note: The 'name' property is missing, which causes the TypeScript error in the screenshot.
        // It should be added here, likely as: name="HTTP Request"
        description={description}
        name="HTTP Request"
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
      >
        {/* Node content goes here */}
      </BaseExecutionNode>
    </>
  );
});

HttpRequestNode.displayName = "HttpRequestNode";
