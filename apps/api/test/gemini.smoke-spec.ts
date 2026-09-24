/**
 * Opt-in live smoke test against the real Gemini API: `npm run test:smoke -w apps/api`.
 * Reads GEMINI_API_KEY from apps/api/.env; skipped when absent. Never prints the key.
 */
import { existsSync, readFileSync } from 'fs';
import { parseEnv } from 'util';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { GeminiProvider } from '../src/ai/gemini.provider';
import { AiResult, RETRYABLE } from '../src/ai/ai-provider';
import { FeedbackAnalysisSchema, RiskLlmReviewSchema } from '../src/ai/ai.schemas';

const envFile = join(__dirname, '..', '.env');
// Jest sandboxes process.env per file, so parse the file into it explicitly.
if (existsSync(envFile)) Object.assign(process.env, parseEnv(readFileSync(envFile, 'utf8')));
const live = process.env.GEMINI_API_KEY ? it : it.skip;

/** The free tier is 5 req/min with occasional 503 spikes: retry transient failures like the app does. */
async function withRetry<T>(call: () => Promise<AiResult<T>>): Promise<AiResult<T>> {
  let res = await call();
  for (let i = 0; i < 4 && !res.ok && RETRYABLE.has(res.reason); i++) {
    await new Promise((r) => setTimeout(r, Math.min(res.ok ? 0 : (res.retryAfterMs ?? 10_000), 60_000)));
    res = await call();
  }
  return res;
}

describe('Gemini live smoke test', () => {
  const provider = () => new GeminiProvider(new ConfigService(process.env));

  live('classifies Uzbek feedback into the enforced schema', async () => {
    const res = await withRetry(() => provider().generate({
      system: 'Classify anonymous hospital feedback. English summary, no names.',
      prompt: '<feedback>"Palatada juda uzoq kutdik, hamshirani chaqirsak kech keldi."</feedback>',
      schema: FeedbackAnalysisSchema,
    }));
    if (!res.ok) throw new Error(`Gemini call failed: ${res.reason}`);
    expect(FeedbackAnalysisSchema.safeParse(res.data).success).toBe(true);
    expect(res.data.sentiment).toBe('NEGATIVE');
    process.stdout.write(`[smoke] feedback ok model=${res.model} latency=${res.latencyMs}ms category=${res.data.category}\n`);
  });

  live('reviews a risky home-visit record', async () => {
    const res = await withRetry(() => provider().generate({
      system: 'Review a post-discharge home-visit record for risk. Decision support only; no diagnosis.',
      prompt: '<record>{"ageYears":75,"spo2":89,"symptoms":["shortness of breath"]}</record>',
      schema: RiskLlmReviewSchema,
    }));
    if (!res.ok) throw new Error(`Gemini call failed: ${res.reason}`);
    expect(res.data.riskLevel).toBe('HIGH');
    process.stdout.write(`[smoke] risk ok model=${res.model} latency=${res.latencyMs}ms level=${res.data.riskLevel}\n`);
  });
});
