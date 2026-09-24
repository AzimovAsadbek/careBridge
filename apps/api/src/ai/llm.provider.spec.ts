import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { LlmProvider } from './llm.provider';
import { FeedbackAnalysisSchema } from './ai.schemas';

const valid = { sentiment: 'NEGATIVE', category: 'service_quality', topics: ['waiting_time'], priority: 'MEDIUM', summary: 'x' };

function providerWith(parse: jest.Mock) {
  const p = new LlmProvider(new ConfigService({ ANTHROPIC_API_KEY: 'test-key' }));
  (p as unknown as { client: unknown }).client = { messages: { parse } };
  return p;
}

describe('LlmProvider', () => {
  it('is disabled without an API key', async () => {
    const p = new LlmProvider(new ConfigService({}));
    expect(p.enabled).toBe(false);
    expect(await p.structured('s', 'u', FeedbackAnalysisSchema)).toBeNull();
  });

  it('returns validated output on success', async () => {
    const p = providerWith(jest.fn().mockResolvedValue({ stop_reason: 'end_turn', parsed_output: valid }));
    expect(await p.structured('s', 'u', FeedbackAnalysisSchema)).toEqual(valid);
  });

  it('rejects malformed model output', async () => {
    const p = providerWith(
      jest.fn().mockResolvedValue({ stop_reason: 'end_turn', parsed_output: { ...valid, priority: 'CRITICAL' } }),
    );
    expect(await p.structured('s', 'u', FeedbackAnalysisSchema)).toBeNull();
  });

  it('returns null on refusal / truncation', async () => {
    const p = providerWith(jest.fn().mockResolvedValue({ stop_reason: 'refusal', parsed_output: null }));
    expect(await p.structured('s', 'u', FeedbackAnalysisSchema)).toBeNull();
  });

  it('returns null on timeout', async () => {
    const p = providerWith(jest.fn().mockRejectedValue(new Anthropic.APIConnectionTimeoutError()));
    expect(await p.structured('s', 'u', FeedbackAnalysisSchema)).toBeNull();
  });

  it('returns null when the service is unavailable', async () => {
    const p = providerWith(jest.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    expect(await p.structured('s', 'u', FeedbackAnalysisSchema)).toBeNull();
  });
});
