import OpenAI from 'openai';

// Single shared client for the whole app -- every OpenAI call site imports
// this instead of constructing its own client. Key comes from the
// environment only; there is no per-organization override.
export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Cheap/fast model with a hard token cap -- every call in this app uses
// these same defaults to keep cost predictable.
export const OPENAI_MODEL = 'gpt-3.5-turbo';
export const OPENAI_MAX_TOKENS = 300;
export const OPENAI_TEMPERATURE = 0.5;
