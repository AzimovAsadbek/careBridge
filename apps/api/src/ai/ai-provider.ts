import { z } from 'zod/v4';

/** Why an AI call produced no usable output. Every failure leads to the rule-engine fallback. */
export type AiFailureReason =
  | 'not_configured'
  | 'timeout'
  | 'quota'
  | 'unavailable'
  | 'blocked'
  | 'malformed'
  | 'error';

export type AiResult<T> =
  | { ok: true; data: T; provider: string; model: string; latencyMs: number }
  | { ok: false; reason: AiFailureReason; provider: string; model: string; retryAfterMs?: number };

export interface StructuredRequest<T extends z.ZodType> {
  /** Trusted, developer-authored instructions. */
  system: string;
  /** Untrusted data (patient records, feedback) wrapped by the caller. */
  prompt: string;
  /** Output contract: sent to the model as JSON Schema and re-validated on return. */
  schema: T;
}

/**
 * Provider boundary for all AI calls. Implementations must never throw, never log
 * prompts, outputs or credentials, and must validate output against `schema`.
 */
export abstract class AiProvider {
  abstract readonly name: string;
  abstract readonly model: string;
  /** Models tried after `model` on quota / capacity problems (may be empty). */
  readonly fallbackModels: string[] = [];
  abstract get enabled(): boolean;
  abstract generate<T extends z.ZodType>(request: StructuredRequest<T>): Promise<AiResult<z.infer<T>>>;
}

/** Transient failures worth retrying later; the rest fall back to rules immediately. */
export const RETRYABLE: ReadonlySet<AiFailureReason> = new Set(['quota', 'unavailable', 'timeout']);

/**
 * Escape untrusted text for embedding inside an XML-like delimiter so it can never
 * close the tag and pose as instructions.
 */
export function asUntrustedData(tag: string, value: unknown): string {
  const json = JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
  return `<${tag}>${json}</${tag}>`;
}
