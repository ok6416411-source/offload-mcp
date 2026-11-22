import { test } from "node:test";
import assert from "node:assert/strict";
import { complete } from "../src/router.js";
import { activeProviders } from "../src/providers.js";

const ok = (text) => ({ ok: true, status: 200, headers: new Headers(), json: async () => ({ choices: [{ message: { content: text } }] }) });
const limited = () => ({ ok: false, status: 429, headers: new Headers({ "retry-after": "30" }), text: async () => "" });

test("only providers with keys are active, respecting OFFLOAD_ORDER", () => {
  const list = activeProviders({ GROQ_API_KEY: "a", GEMINI_API_KEY: "b", OFFLOAD_ORDER: "gemini,groq" });
  assert.deepEqual(list.map((p) => p.id), ["gemini", "groq"]);
});

test("model override via env", () => {
  const [p] = activeProviders({ GROQ_API_KEY: "a", OFFLOAD_GROQ_MODEL: "x-model" });
  assert.equal(p.model, "x-model");
});

test("falls back to the next provider on 429", async () => {
  const calls = [];
  const fetch = async (url) => { calls.push(url); return url.includes("groq") ? limited() : ok("hi"); };
  const r = await complete({ prompt: "x" }, { fetch, env: { GROQ_API_KEY: "a", MISTRAL_API_KEY: "b" } });
  assert.equal(r.provider, "mistral");
  assert.equal(r.text, "hi");
  assert.equal(calls.length, 2);
});

test("clear error without keys", async () => {
  await assert.rejects(complete({ prompt: "x" }, { env: {} }), /No provider configured/);
});
