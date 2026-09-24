import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod/v4';

/**
 * Thin wrapper around Claude structured outputs. Returns null on any failure
 * (not configured, timeout, API error, refusal, schema mismatch) so callers
 * always fall back to the deterministic rule engine.
 */
@Injectable()
export class LlmProvider {
  private readonly logger = new Logger(LlmProvider.name);
  private readonly client: Anthropic | null;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('ANTHROPIC_API_KEY');
    this.model = config.get<string>('AI_MODEL') || 'claude-opus-5';
    this.timeoutMs = Number(config.get('AI_TIMEOUT_MS') ?? 8000);
    this.client = apiKey ? new Anthropic({ apiKey, maxRetries: 1, timeout: this.timeoutMs }) : null;
  }

  get enabled() {
    return this.client !== null;
  }

  async structured<T extends z.ZodType>(system: string, user: string, schema: T): Promise<z.infer<T> | null> {
    if (!this.client) return null;
    try {
      const response = await this.client.messages.parse({
        model: this.model,
        max_tokens: 1024,
        system,
        messages: [{ role: 'user', content: user }],
        output_config: { format: zodOutputFormat(schema) },
      });
      if (response.stop_reason !== 'end_turn' || response.parsed_output == null) {
        this.logger.warn(`LLM returned no usable output (stop_reason=${response.stop_reason})`);
        return null;
      }
      // Defence in depth: re-validate even though the SDK already parsed against the schema.
      const checked = schema.safeParse(response.parsed_output);
      return checked.success ? checked.data : null;
    } catch (e) {
      if (e instanceof Anthropic.APIError) this.logger.warn(`LLM API error ${e.status ?? ''}: ${e.name}`);
      else this.logger.warn(`LLM call failed: ${(e as Error).name}`);
      return null;
    }
  }
}
