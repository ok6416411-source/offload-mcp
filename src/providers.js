// Free-tier, OpenAI-compatible providers. Each one is enabled only if its API key env var is set.
// Model names change often – override any of them with OFFLOAD_<ID>_MODEL.
export const PROVIDERS = [
  {
    id: "groq",
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    keyEnv: "GROQ_API_KEY",
    model: "llama-3.3-70b-versatile",
    signup: "https://console.groq.com/keys",
    strengths: ["fast"],
  },
  {
    id: "cerebras",
    name: "Cerebras",
    baseUrl: "https://api.cerebras.ai/v1",
    keyEnv: "CEREBRAS_API_KEY",
    model: "llama-3.3-70b",
    signup: "https://cloud.cerebras.ai",
    strengths: ["fast"],
  },
  {
    id: "gemini",
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyEnv: "GEMINI_API_KEY",
    model: "gemini-2.5-flash",
    signup: "https://aistudio.google.com/apikey",
    strengths: ["long-context", "code"],
  },
  {
    id: "mistral",
    name: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    keyEnv: "MISTRAL_API_KEY",
    model: "mistral-small-latest",
    signup: "https://console.mistral.ai/api-keys",
    strengths: ["multilingual"],
  },
  {
    id: "nvidia",
    name: "NVIDIA NIM",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    keyEnv: "NVIDIA_API_KEY",
    model: "meta/llama-3.3-70b-instruct",
    signup: "https://build.nvidia.com",
    strengths: ["many-models"],
  },
  {
    id: "openrouter",
    name: "OpenRouter (free models)",
    baseUrl: "https://openrouter.ai/api/v1",
    keyEnv: "OPENROUTER_API_KEY",
    model: "meta-llama/llama-3.3-70b-instruct:free",
    signup: "https://openrouter.ai/keys",
    strengths: ["variety"],
  },
];

export function activeProviders(env = process.env) {
  const order = (env.OFFLOAD_ORDER || "").split(",").map((s) => s.trim()).filter(Boolean);
  const list = PROVIDERS.filter((p) => env[p.keyEnv]).map((p) => ({
    ...p,
    apiKey: env[p.keyEnv],
    model: env[`OFFLOAD_${p.id.toUpperCase()}_MODEL`] || p.model,
  }));
  if (order.length) list.sort((a, b) => rank(order, a.id) - rank(order, b.id));
  return list;
}

const rank = (order, id) => (order.includes(id) ? order.indexOf(id) : 999);
