import { Agent, createTool } from "@voltagent/core";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { ANIMATION_REGISTRY } from "@/lib/animations";

const animationNames = Object.keys(ANIMATION_REGISTRY) as [string, ...string[]];

// Create a description string for the LLM
const animationDescriptions = Object.values(ANIMATION_REGISTRY)
  .map(a => `- ${a.name} (${a.category}): ${a.description} [Tags: ${a.tags.join(", ")}]`)
  .join("\n");

const playAnimationTool = createTool({
  name: "play_animation",
  description: `Play a VRM animation on the avatar. Choose the most appropriate animation based on the emotion and intent of the conversation.
Available animations:
${animationDescriptions}`,
  parameters: z.object({
    animation: z.enum(animationNames).describe("The name of the animation to play"),
    reason: z.string().describe("The reason for choosing this animation based on the context"),
  }),
  execute: async ({ animation, reason }) => {
    console.log(`Agent triggered animation: ${animation} because: ${reason}`);
    return { success: true, animation, reason };
  },
});

const agent = new Agent({
  name: "AnimationDirector",
  model: openai("gpt-4o"),
  instructions: `You are an expert animation director for a 3D avatar. 
Your goal is to analyze the conversation and trigger appropriate animations to make the avatar expressive and alive.
You will receive the recent conversation history.
Analyze the assistant's last message for emotion, intent, and action.
If the assistant is greeting, use a greeting animation.
If the assistant is expressing an emotion, use an emotion animation.
If the assistant is describing an action, use an action animation.
If the assistant is just talking normally, you can use hand gestures to emphasize points.
Do not overuse animations. Only play one if it fits well.
If no specific animation fits, do nothing (do not call the tool).`,
  tools: [playAnimationTool],
});

export async function POST(req: Request) {
  const { messages } = await req.json();
  
  const result = await agent.streamText(messages);

  return result.toUIMessageStreamResponse();
}
