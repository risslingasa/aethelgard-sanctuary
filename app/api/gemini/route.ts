import { NextRequest, NextResponse } from 'next/server';
import {
  ALLOWED_GEMINI_MODELS,
  DEFAULT_GEMINI_MODEL,
  MissingGeminiApiKeyError,
  getGeminiClient,
} from '@/lib/gemini';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_PROMPT_LENGTH = 4000;
const MAX_SYSTEM_INSTRUCTION_LENGTH = 1000;

interface GeminiRequestBody {
  prompt?: unknown;
  systemInstruction?: unknown;
  model?: unknown;
}

function getUpstreamStatusCode(err: unknown): number | undefined {
  if (typeof err === 'object' && err !== null) {
    const rec = err as Record<string, unknown>;
    if (typeof rec.status === 'number') return rec.status;
    if (typeof rec.code === 'number') return rec.code;
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  let body: GeminiRequestBody;
  try {
    body = (await req.json()) as GeminiRequestBody;
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON request body.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  if (typeof body?.prompt !== 'string') {
    return NextResponse.json(
      { error: 'A text prompt is required.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const prompt = body.prompt.trim();
  if (!prompt || prompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json(
      { error: `Prompt must be between 1 and ${MAX_PROMPT_LENGTH} characters.` },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  let systemInstruction: string | undefined;
  if (body.systemInstruction !== undefined) {
    if (typeof body.systemInstruction !== 'string') {
      return NextResponse.json(
        { error: 'systemInstruction must be a string.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    const trimmed = body.systemInstruction.trim();
    if (trimmed.length > MAX_SYSTEM_INSTRUCTION_LENGTH) {
      return NextResponse.json(
        {
          error: `systemInstruction must be at most ${MAX_SYSTEM_INSTRUCTION_LENGTH} characters.`,
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    if (trimmed.length > 0) {
      systemInstruction = trimmed;
    }
  }

  let model: string = DEFAULT_GEMINI_MODEL;
  if (body.model !== undefined) {
    if (typeof body.model !== 'string' || !ALLOWED_GEMINI_MODELS.has(body.model)) {
      return NextResponse.json(
        { error: 'Requested model is not allowed on this endpoint.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    model = body.model;
  }

  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: systemInstruction ? { systemInstruction } : undefined,
    });

    return NextResponse.json(
      { text: response.text ?? '' },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    if (err instanceof MissingGeminiApiKeyError) {
      return NextResponse.json(
        { error: err.message },
        { status: 503, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const status = getUpstreamStatusCode(err);
    if (status === 400 || status === 401 || status === 403) {
      return NextResponse.json(
        {
          error:
            'Unable to authenticate with the Gemini API. Please check your GEMINI_API_KEY in Settings > Secrets.',
        },
        { status: 502, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (status === 429) {
      return NextResponse.json(
        {
          error:
            'Gemini API rate limit or quota reached. Please wait a moment or check your key tier in Settings > Secrets.',
        },
        { status: 429, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return NextResponse.json(
      { error: 'Unable to complete the Gemini API request right now.' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
