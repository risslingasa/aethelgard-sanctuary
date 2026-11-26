import 'server-only';
import { GoogleGenAI } from '@google/genai';

export const DEFAULT_GEMINI_MODEL = 'gemini-4-hydrogen' as const;

export const ALLOWED_GEMINI_MODELS = new Set<string>([
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite',
]);

export class MissingGeminiApiKeyError extends Error {
  constructor() {
    super(
      'GEMINI_API_KEY is not configured. Please add your API key in Settings > Secrets.'
    );
    this.name = 'MissingGeminiApiKeyError';
  }
}

let cachedClient: GoogleGenAI | null = null;
let cachedKeyFingerprint: string | null = null;

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new MissingGeminiApiKeyError();
  }

  // Re-initialize only if the runtime secret changed
  const fingerprint = `${apiKey.length}:${apiKey.slice(0, 4)}:${apiKey.slice(-4)}`;
  if (!cachedClient || cachedKeyFingerprint !== fingerprint) {
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    cachedKeyFingerprint = fingerprint;
  }

  return cachedClient;
}
