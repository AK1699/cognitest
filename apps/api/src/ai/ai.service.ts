import { Injectable, Logger } from '@nestjs/common';

export interface PlanMetadata {
  objective: string;
  scope: string[];
  strategy: string;
}

interface PlanMetadataInput {
  name: string;
  description: string | null;
  requirements: { title: string; description: string | null }[];
}

/**
 * Optional LLM access, used only as a fallback when deterministic rules can't
 * derive good plan metadata. Disabled unless ANTHROPIC_API_KEY is set, and
 * implemented with plain fetch (no SDK dependency). When it runs it sends
 * requirement text to Anthropic's API — hence it is strictly opt-in.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  get enabled(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }

  async suggestPlanMetadata(input: PlanMetadataInput): Promise<PlanMetadata | null> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;
    const model = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001';

    const requirements = input.requirements
      .map((r, i) => `${i + 1}. ${r.title}${r.description ? ` — ${r.description}` : ''}`)
      .join('\n');
    const prompt = [
      'You are a senior QA lead. From the test design below, produce a concise test plan.',
      'Respond with ONLY a JSON object of the shape:',
      '{"objective": string, "scope": string[], "strategy": string}',
      '- objective: one or two sentences on what this plan validates.',
      '- scope: 3–8 short in-scope areas.',
      '- strategy: a "+"-joined list of the test types that apply (e.g. "Functional + Negative + Security").',
      '',
      `Design name: ${input.name}`,
      input.description ? `Design description: ${input.description}` : '',
      '',
      'Requirements:',
      requirements || '(none)',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) {
        this.logger.warn(`Anthropic request failed: ${res.status}`);
        return null;
      }
      const payload = (await res.json()) as { content?: { text?: string }[] };
      const text = payload.content?.[0]?.text ?? '';
      const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
      const parsed = JSON.parse(json) as Partial<PlanMetadata>;
      if (typeof parsed.objective !== 'string' || typeof parsed.strategy !== 'string') return null;
      return {
        objective: parsed.objective,
        scope: Array.isArray(parsed.scope) ? parsed.scope.map(String) : [],
        strategy: parsed.strategy,
      };
    } catch (cause) {
      this.logger.warn(`AI plan metadata fallback failed: ${String(cause)}`);
      return null;
    }
  }
}
