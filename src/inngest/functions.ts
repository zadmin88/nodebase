import { inngest } from "./client";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";

const google = createGoogleGenerativeAI();
const openai = createOpenAI();
const anthropic = createAnthropic();

export const execute = inngest.createFunction(
  { id: "execute-ai" },
  { event: "execute/ai" },
  async ({ event, step }) => {
    const { steps: geminiSteps } = await step.ai.wrap(
      "gemini-generate-text",
      generateText,
      {
        model: google("gemini-2.5-flash"),
        prompt: "what is 50 + 50",
        system: "You are a helpful assistant that only answers with numbers.",
      }
    );

    const { steps: OpenAISteps } = await step.ai.wrap(
      "openAI-generate-text",
      generateText,
      {
        model: openai("gpt-4.1-mini"),
        prompt: "what is 50 + 50",
        system: "You are a helpful assistant that only answers with numbers.",
      }
    );

    const { steps: anthropicSteps } = await step.ai.wrap(
      "anthropic-generate-text",
      generateText,
      {
        model: anthropic("claude-sonnet-4-5"),
        prompt: "what is 50 + 50",
        system: "You are a helpful assistant that only answers with numbers.",
      }
    );
    return {
      geminiSteps,
      OpenAISteps,
      anthropicSteps,
    };
  }
);
