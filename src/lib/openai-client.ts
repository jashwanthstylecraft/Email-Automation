import OpenAI from 'openai';

// Single shared client for the whole app -- every OpenAI call site imports
// this instead of constructing its own client. Key comes from the
// environment only; there is no per-organization override.
//
// The SDK's constructor throws immediately if no key is present at all
// (not just when a call is made), which crashes Next.js's build-time page
// data collection for any route that imports this module -- OPENAI_API_KEY
// is meant to be optional (every call site already checks
// process.env.OPENAI_API_KEY before calling out), so a placeholder keeps
// construction safe; it's never actually sent anywhere when the real key
// is absent, since those guarded call sites never fire in that case.
export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'sk-not-configured' });

// Cheap/fast model with a hard token cap -- every call in this app uses
// these same defaults to keep cost predictable.
export const OPENAI_MODEL = 'gpt-3.5-turbo';
export const OPENAI_MAX_TOKENS = 300;
export const OPENAI_TEMPERATURE = 0.5;
