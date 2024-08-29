import { Annotation, StateGraph, MemorySaver } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import fs from "fs";
import * as dotenv from "dotenv";

dotenv.config();

// Define the graph state
const GraphState = Annotation.Root({
  text: Annotation(""), // Text for analysis
  wordData: Annotation([]), // State of word data
});

// Function to analyze text through OpenAI API
async function analyzeText(text) {
  const openai = new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.AI_MODEL_ID,
    temperature: 0,
  });

  const prompt = `Analyze the text: "${text}". For each word, perform the following:
  1. Convert the word to its root form (lemma).
  2. Identify the word's type (e.g., noun, verb, adjective).
  3. Classify the word into a relevant group (e.g., nature, action).

  Return the result as a valid JSON array where each object has:
  - "word": the root form,
  - "type": the word's type,
  - "group": the word's group.

  Ensure the output is a valid JSON string without any \`\`\`json\`\`\` tags.`;

  console.log("Requesting analysis from OpenAI API...");
  const response = await openai.invoke([{ role: "user", content: prompt }]);

  return JSON.parse(response.content);
}

// Define the state graph and processing workflow
const workflow = new StateGraph(GraphState)
  .addNode("TextInput", async () => {
    const text = fs.readFileSync("subtitles.txt", "utf8");

    return { text };
  })
  .addNode("AnalyzeText", async (state) => {
    const wordData = await analyzeText(state.text);

    return { wordData };
  })
  .addEdge("__start__", "TextInput")
  .addEdge("TextInput", "AnalyzeText");

// Initialize memory for saving state between graph runs
const checkpointer = new MemorySaver();

// Compile and run the graph
const app = workflow.compile({ checkpointer });

(async () => {
  try {
    const finalState = await app.invoke(
      {},
      { configurable: { thread_id: "42" } }
    );

    console.log(JSON.stringify(finalState.wordData, null, 2));
  } catch (error) {
    console.error("Error:", error);
  }
})();
