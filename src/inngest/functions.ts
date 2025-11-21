import prisma from "@/lib/db";
import { NonRetriableError } from "inngest";
import { inngest } from "./client";
import { topologicalSort } from "./utils";
import { getExecutor } from "@/features/executions/lib/executor-registry";
import { NodeType } from "@/generated/prisma/enums";

export const executeWorkflow = inngest.createFunction(
  { id: "execute-workflow" },
  { event: "workflow/execute.workflow" },
  async ({ event, step }) => {
    const workflowId = event.data.workflowId;

    if (!workflowId) {
      throw new NonRetriableError("Workflow ID is missing");
    }

    const sortedNodes = await step.run("prepare-workflow", async () => {
      const workflow = await prisma.workflow.findUniqueOrThrow({
        where: { id: workflowId },
        include: { nodes: true, connections: true },
      });
      // The rest of the workflow preparation logic would follow here.
      return topologicalSort(workflow.nodes, workflow.connections);
    });

    // Initialize context with any initial data from the trigger
    let context = event.data.initialData || {};

    // Execute each node
    for (const node of sortedNodes) {
      const executor = getExecutor(node.type as NodeType);
      // Execution logic would follow here, using the executor and updating the context
    }

    return { workflowId, context };
  }
);

// const google = createGoogleGenerativeAI();
// const openai = createOpenAI();
// const anthropic = createAnthropic();

// export const execute = inngest.createFunction(
//   { id: "execute-ai" },
//   { event: "execute/ai" },
//   async ({ event, step }) => {
//     const { steps: geminiSteps } = await step.ai.wrap(
//       "gemini-generate-text",
//       generateText,
//       {
//         model: google("gemini-2.5-flash"),
//         prompt: "what is 50 + 50",
//         system: "You are a helpful assistant that only answers with numbers.",
//       }
//     );

//     const { steps: OpenAISteps } = await step.ai.wrap(
//       "openAI-generate-text",
//       generateText,
//       {
//         model: openai("gpt-4.1-mini"),
//         prompt: "what is 50 + 50",
//         system: "You are a helpful assistant that only answers with numbers.",
//       }
//     );

//     const { steps: anthropicSteps } = await step.ai.wrap(
//       "anthropic-generate-text",
//       generateText,
//       {
//         model: anthropic("claude-sonnet-4-5"),
//         prompt: "what is 50 + 50",
//         system: "You are a helpful assistant that only answers with numbers.",
//       }
//     );
//     return {
//       geminiSteps,
//       OpenAISteps,
//       anthropicSteps,
//     };
//   }
// );
