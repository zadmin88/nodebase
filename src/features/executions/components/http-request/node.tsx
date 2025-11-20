import type { Node, NodeProps, useReactFlow } from "@xyflow/react";
import { GlobeIcon } from "lucide-react";
import { memo, useState } from "react";
import { BaseExecutionNode } from "../base-execution-node";

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
      // Note: The 'name' property is missing, which causes the TypeScript error in the screenshot.
      // It should be added here, likely as: name="HTTP Request"
      description={description}
      name="HTTP Request"
      onSettings={() => {}}
      onDoubleClick={() => {}}
    >
      {/* Node content goes here */}
    </BaseExecutionNode>
  );
});

HttpRequestNode.displayName = "HttpRequestNode";
