import { ChatGroq } from "@langchain/groq";
import { SystemMessage } from "@langchain/core/messages";

export const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
export const DEFAULT_GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

export class AIConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "AIConfigError";
    this.statusCode = 503;
  }
}

export class AIExecutionError extends Error {
  constructor(message, statusCode = 502) {
    super(message);
    this.name = "AIExecutionError";
    this.statusCode = statusCode;
  }
}

function getGroqApiKey() {
  const key = process.env.GROQ_API_KEY?.trim();
  if (!key) {
    throw new AIConfigError(
      "GROQ_API_KEY is not configured in backend/.env. Add a valid Groq API key to enable LangGraph AI agents."
    );
  }
  return key;
}

export function getReasoningModel({
  model = process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL,
  temperature = 0.2,
  maxTokens = 4096,
  timeout = 45000,
} = {}) {
  const apiKey = getGroqApiKey();
  return new ChatGroq({
    apiKey,
    model,
    temperature,
    maxTokens,
    timeout,
  });
}

export function getVisionModel({
  model = process.env.GROQ_VISION_MODEL || DEFAULT_GROQ_VISION_MODEL,
  temperature = 0.1,
  maxTokens = 1536,
  timeout = 35000,
} = {}) {
  const apiKey = getGroqApiKey();
  return new ChatGroq({
    apiKey,
    model,
    temperature,
    maxTokens,
    timeout,
  });
}

function extractJsonObject(text) {
  const raw = String(text || "").trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw;

  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("Model response did not contain a valid JSON object");
  }
  return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
}

function mapProviderError(err, label) {
  if (err instanceof AIConfigError || err instanceof AIExecutionError) {
    return err;
  }
  const status = err?.status ?? err?.statusCode ?? err?.response?.status;
  if (status === 401 || status === 403) {
    return new AIConfigError(`Groq authentication failed during ${label}. Check GROQ_API_KEY in backend/.env.`);
  }
  if (status === 429) {
    return new AIExecutionError(`Groq rate limit reached during ${label}. Please retry shortly.`, 429);
  }
  return new AIExecutionError(`AI execution failed during ${label}: ${err?.message || "Unknown error"}`, 502);
}

/**
 * Invoke an LLM with strict Zod schema validation.
 * Uses native structured output first and falls back once to strict JSON extraction
 * if the provider rejects tool-calling schema formatting.
 */
export async function invokeStructured(
  schema,
  messages,
  {
    name = "structured_output",
    temperature = 0.2,
    maxTokens = 4096,
    llm = null,
    model = undefined,
  } = {}
) {
  const chatModel = llm || getReasoningModel({ model, temperature, maxTokens });

  try {
    if (typeof chatModel.withStructuredOutput === "function") {
      try {
        const structured = chatModel.withStructuredOutput(schema, { name });
        const result = await structured.invoke(messages);
        return schema.parse(result);
      } catch (structuredErr) {
        const status = structuredErr?.status ?? structuredErr?.statusCode;
        // Propagate auth/rate-limit errors immediately without retrying
        if (status === 401 || status === 403 || status === 429) {
          throw structuredErr;
        }
        // Fallback: ask model directly for JSON matching the schema
        const jsonInstruction = new SystemMessage(
          `Return ONLY a valid JSON object matching schema "${name}". Do not include markdown fences or explanatory prose.`
        );
        const fallbackResponse = await chatModel.invoke([jsonInstruction, ...messages], {
          response_format: { type: "json_object" },
        });
        const parsed = extractJsonObject(fallbackResponse?.content);
        return schema.parse(parsed);
      }
    }

    const rawResponse = await chatModel.invoke(messages);
    if (rawResponse && typeof rawResponse === "object" && !("content" in rawResponse)) {
      return schema.parse(rawResponse);
    }
    const parsed = extractJsonObject(rawResponse?.content);
    return schema.parse(parsed);
  } catch (err) {
    throw mapProviderError(err, name);
  }
}
