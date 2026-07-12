import { z } from 'zod';
import { getEnv } from '../config/env';
import {
  CRM_EXTRACTION_SYSTEM_PROMPT,
  FEW_SHOT_EXAMPLES,
} from '../prompts/crmExtraction.prompt';
import { RawLlmRow } from '../services/crmMapper.service';

export interface AiCompletionResult {
  rows: RawLlmRow[];
}

export interface AiProvider {
  name: string;
  complete(systemPrompt: string, userPrompt: string): Promise<{ content: string }>;
}

const confidenceSchema = z.enum(['high', 'medium', 'low']);

/** LLMs sometimes return _confidence as a bare string instead of a per-field object. */
export function normalizeConfidenceField(
  value: unknown
): Partial<Record<string, z.infer<typeof confidenceSchema>>> | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) return {};

  const normalized: Partial<Record<string, z.infer<typeof confidenceSchema>>> = {};
  for (const [field, confidence] of Object.entries(value as Record<string, unknown>)) {
    const parsed = confidenceSchema.safeParse(confidence);
    if (parsed.success) normalized[field] = parsed.data;
  }
  return normalized;
}

const rowSchema = z.object({
  created_at: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  country_code: z.string().nullable().optional(),
  mobile_without_country_code: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  lead_owner: z.string().nullable().optional(),
  crm_status: z.string().nullable().optional(),
  crm_note: z.string().nullable().optional(),
  data_source: z.string().nullable().optional(),
  possession_time: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  _confidence: z.preprocess(normalizeConfidenceField, z.record(confidenceSchema).optional()),
});

const extractionResponseSchema = z.array(rowSchema);

function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const arrayStart = trimmed.indexOf('[');
  const objectStart = trimmed.indexOf('{');
  if (arrayStart >= 0 && (objectStart < 0 || arrayStart < objectStart)) {
    const end = trimmed.lastIndexOf(']');
    if (end > arrayStart) return trimmed.slice(arrayStart, end + 1);
  }
  if (objectStart >= 0) {
    const end = trimmed.lastIndexOf('}');
    if (end > objectStart) return trimmed.slice(objectStart, end + 1);
  }
  return trimmed;
}

function parseExtractionResponse(content: string): RawLlmRow[] {
  const jsonStr = extractJson(content);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error('LLM returned invalid JSON');
  }

  const records = Array.isArray(parsed)
    ? parsed
    : (parsed as { records?: unknown }).records ?? (parsed as { data?: unknown }).data;

  return extractionResponseSchema.parse(records) as RawLlmRow[];
}

function hasDuplicateContactKeys(rows: RawLlmRow[]): boolean {
  const seen = new Set<string>();
  for (const row of rows) {
    const email = row.email?.trim().toLowerCase();
    const phone = row.mobile_without_country_code?.replace(/\D/g, '');
    const key = email || phone || '';
    if (!key) continue;
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

async function callOpenAi(systemPrompt: string, userPrompt: string): Promise<{ content: string }> {
  const env = getEnv();
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      temperature: 0,
      max_tokens: 16384,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${err}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  return {
    content: data.choices[0]?.message?.content ?? '[]',
  };
}

async function callAnthropic(systemPrompt: string, userPrompt: string): Promise<{ content: string }> {
  const env = getEnv();
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.ANTHROPIC_MODEL,
      max_tokens: 8192,
      temperature: 0,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${err}`);
  }

  const data = (await response.json()) as {
    content: Array<{ text: string }>;
  };

  return {
    content: data.content[0]?.text ?? '[]',
  };
}

async function callGemini(systemPrompt: string, userPrompt: string): Promise<{ content: string }> {
  const env = getEnv();
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${err}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  return {
    content: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]',
  };
}

function getProvider(name: 'openai' | 'anthropic' | 'gemini'): AiProvider {
  const providers: Record<string, AiProvider> = {
    openai: { name: 'openai', complete: callOpenAi },
    anthropic: { name: 'anthropic', complete: callAnthropic },
    gemini: { name: 'gemini', complete: callGemini },
  };
  return providers[name];
}

async function completeWithFallback(
  systemPrompt: string,
  userPrompt: string
): Promise<{ content: string; provider: string }> {
  const env = getEnv();
  const primary = getProvider(env.AI_PROVIDER);
  const fallback = env.AI_FALLBACK_PROVIDER ? getProvider(env.AI_FALLBACK_PROVIDER) : null;

  try {
    const result = await primary.complete(systemPrompt, userPrompt);
    return { ...result, provider: primary.name };
  } catch (primaryError) {
    if (!fallback || fallback.name === primary.name) throw primaryError;
    const result = await fallback.complete(systemPrompt, userPrompt);
    return { ...result, provider: fallback.name };
  }
}

function buildExtractionUserPrompt(headers: string[], rows: Record<string, string>[]): string {
  const numberedRows = rows.map((row, i) => ({ _row: i + 1, ...row }));
  return `${FEW_SHOT_EXAMPLES}

Headers: ${JSON.stringify(headers)}
Rows (${rows.length}, in order):
${JSON.stringify(numberedRows)}

CRITICAL:
- Return EXACTLY ${rows.length} records in the SAME ORDER as the input rows.
- One output record per input row — never skip, never duplicate.
Return JSON: { "records": [ ...exactly ${rows.length} objects... ] }`;
}

function buildSingleRowPrompt(headers: string[], row: Record<string, string>): string {
  return `${FEW_SHOT_EXAMPLES}

Headers: ${JSON.stringify(headers)}
Single row:
${JSON.stringify(row)}

Return JSON: { "records": [ one mapped CRM object for this row only ] }`;
}

function computeLlmChunkSize(headers: string[], rowCount: number): number {
  if (headers.length > 25) return 3;
  if (headers.length > 15) return 5;
  if (headers.length > 10) return 8;
  return Math.min(rowCount, 15);
}

async function extractSingleRow(
  headers: string[],
  row: Record<string, string>
): Promise<RawLlmRow> {
  const { content } = await completeWithFallback(
    CRM_EXTRACTION_SYSTEM_PROMPT,
    buildSingleRowPrompt(headers, row)
  );
  const records = parseExtractionResponse(content);
  if (records.length !== 1) {
    throw new Error(`LLM single-row extraction returned ${records.length} records, expected 1`);
  }
  return records[0]!;
}

async function extractRowsIndividually(
  headers: string[],
  rows: Record<string, string>[]
): Promise<RawLlmRow[]> {
  const results: RawLlmRow[] = [];
  for (const row of rows) {
    results.push(await extractSingleRow(headers, row));
  }
  return results;
}

async function extractCrmRecordsChunk(
  headers: string[],
  rows: Record<string, string>[]
): Promise<AiCompletionResult> {
  if (rows.length === 1) {
    return { rows: [await extractSingleRow(headers, rows[0]!)] };
  }

  const { content } = await completeWithFallback(
    CRM_EXTRACTION_SYSTEM_PROMPT,
    buildExtractionUserPrompt(headers, rows)
  );

  let validated: RawLlmRow[];
  try {
    validated = parseExtractionResponse(content);
  } catch {
    return { rows: await extractRowsIndividually(headers, rows) };
  }

  const countMismatch = validated.length !== rows.length;
  const duplicateContacts = hasDuplicateContactKeys(validated);

  if (countMismatch || duplicateContacts) {
    return { rows: await extractRowsIndividually(headers, rows) };
  }

  return { rows: validated };
}

export async function extractCrmRecords(
  headers: string[],
  rows: Record<string, string>[]
): Promise<AiCompletionResult> {
  const chunkSize = computeLlmChunkSize(headers, rows.length);
  const allRows: RawLlmRow[] = [];

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const result = await extractCrmRecordsChunk(headers, chunk);
    if (result.rows.length !== chunk.length) {
      throw new Error(`LLM returned ${result.rows.length} records, expected ${chunk.length}`);
    }
    allRows.push(...result.rows);
  }

  if (allRows.length !== rows.length) {
    throw new Error(`LLM returned ${allRows.length} records, expected ${rows.length}`);
  }

  return { rows: allRows };
}

let mockExtractor: ((headers: string[], rows: Record<string, string>[]) => Promise<AiCompletionResult>) | null = null;

export function setMockExtractor(
  fn: ((headers: string[], rows: Record<string, string>[]) => Promise<AiCompletionResult>) | null
): void {
  mockExtractor = fn;
}

export async function extractCrmRecordsWithMock(
  headers: string[],
  rows: Record<string, string>[]
): Promise<AiCompletionResult> {
  if (mockExtractor) return mockExtractor(headers, rows);
  return extractCrmRecords(headers, rows);
}
