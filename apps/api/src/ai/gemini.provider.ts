import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiError, FinishReason, GoogleGenAI, ThinkingLevel } from '@google/genai';
import { z } from 'zod/v4';
import { AiFailureReason, AiProvider, AiResult, StructuredRequest } from './ai-provider';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
/** Optional fetch override — lets tests exercise the real SDK without network access. */
export const GEMINI_FETCH = Symbol('GEMINI_FETCH');

/** Zod → JSON Schema for Gemini's `responseJsonSchema` (drops the `$schema` meta key). */
export function toResponseSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

/** Gemini's 429 body carries a RetryInfo delay ("retryDelay": "51s"). Parsed, never logged. */
export function retryDelayMs(message: string | undefined): number | undefined {
  const m = message?.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/) ?? message?.match(/retry in (\d+(?:\.\d+)?)s/i);
  return m ? Math.ceil(Number(m[1]) * 1000) : undefined;
}

/**
 * Server-side Gemini provider. The API key is read once from the environment and is never
 * logged, returned or sent anywhere except the Gemini API request header.
 */
@Injectable()
export class GeminiProvider extends AiProvider {
  readonly name = 'gemini';
  readonly model: string;
  private readonly logger = new Logger(GeminiProvider.name);
  private readonly client: GoogleGenAI | null;
  private readonly timeoutMs: number;

  constructor(config: ConfigService, @Optional() @Inject(GEMINI_FETCH) fetchImpl?: typeof fetch) {
    super();
    const apiKey = config.get<string>('GEMINI_API_KEY')?.trim();
    this.model = config.get<string>('GEMINI_MODEL')?.trim() || DEFAULT_GEMINI_MODEL;
    this.timeoutMs = Number(config.get('AI_TIMEOUT_MS') ?? 20_000);
    this.client = apiKey
      ? new GoogleGenAI({
          apiKey,
          // No httpOptions.timeout: the SDK forwards it as a server deadline and Gemini rejects
          // deadlines under 10 s. The timeout is enforced client-side with an AbortController.
          httpOptions: {
            // Fail fast: a slow or rate-limited AI call must never block clinical work.
            retryOptions: { attempts: 1 },
            ...(fetchImpl ? { fetch: fetchImpl } : {}),
          },
        })
      : null;
  }

  get enabled() {
    return this.client !== null;
  }

  async generate<T extends z.ZodType>(req: StructuredRequest<T>): Promise<AiResult<z.infer<T>>> {
    const meta = { provider: this.name, model: this.model };
    if (!this.client) return { ok: false, reason: 'not_configured', ...meta };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const started = Date.now();
    const fail = (reason: AiFailureReason, detail = '', retryAfterMs?: number): AiResult<z.infer<T>> => {
      // Only the reason and a status/finish code — never prompts, outputs or error messages.
      this.logger.warn(`Gemini call failed: reason=${reason}${detail ? ` ${detail}` : ''} model=${this.model}`);
      return { ok: false, reason, ...meta, ...(retryAfterMs ? { retryAfterMs } : {}) };
    };

    try {
      const res = await this.client.models.generateContent({
        model: this.model,
        contents: [{ role: 'user', parts: [{ text: req.prompt }] }],
        config: {
          systemInstruction: req.system,
          responseMimeType: 'application/json',
          responseJsonSchema: toResponseSchema(req.schema),
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          maxOutputTokens: 4096,
          abortSignal: controller.signal,
        },
      });

      if (res.promptFeedback?.blockReason) return fail('blocked', `block=${res.promptFeedback.blockReason}`);
      const finish = res.candidates?.[0]?.finishReason;
      if (finish !== FinishReason.STOP) {
        const blocked = finish === FinishReason.SAFETY || finish === FinishReason.PROHIBITED_CONTENT || finish === FinishReason.BLOCKLIST || finish === FinishReason.SPII;
        return fail(blocked ? 'blocked' : 'malformed', `finish=${finish ?? 'none'}`);
      }

      let json: unknown;
      try {
        json = JSON.parse(res.text ?? '');
      } catch {
        return fail('malformed', 'invalid-json');
      }
      // Never trust model output: re-validate against the same contract.
      const parsed = req.schema.safeParse(json);
      if (!parsed.success) return fail('malformed', 'schema-mismatch');
      return { ok: true, data: parsed.data, latencyMs: Date.now() - started, ...meta };
    } catch (e) {
      if (controller.signal.aborted) return fail('timeout');
      if (e instanceof ApiError) {
        if (e.status === 429) return fail('quota', 'status=429', retryDelayMs(e.message));
        if (e.status === 408 || e.status === 504) return fail('timeout', `status=${e.status}`);
        if (e.status >= 500) return fail('unavailable', `status=${e.status}`);
        return fail('error', `status=${e.status}`);
      }
      const name = (e as Error)?.name;
      if (name === 'AbortError' || name === 'TimeoutError') return fail('timeout');
      return fail('unavailable', `error=${name ?? 'unknown'}`);
    } finally {
      clearTimeout(timer);
    }
  }
}
