import OpenAI from 'openai';

import {
    resolveConversationalQuestion,
    type ConversationTurn
} from './conversation.js';
import { isDiceThroneQuestion } from './domain-classifier.js';
import { resolveEvidencePolicy } from './evidence-policies.js';
import { planQuestion, type QuestionPlan } from './question-planner.js';
import { rewriteQuery } from './query-rewriter.js';
import { findRulebookChunks, type RulebookRetrievalResult } from './rulebook-retrieval.js';
import { rerankChunks } from './reranker.js';

const _client = new OpenAI({
    baseURL: 'http://127.0.0.1:1234/v1',
    apiKey: 'lm-studio'
});

const _model = 'qwen/qwen3-8b';

export const UNSUPPORTED_MESSAGE =
    'That question is not answerable from the Dice Throne rulebook.';

export const INSUFFICIENT_MESSAGE =
    "I don't have enough rulebook evidence to answer that confidently.";

export type AnswerCitation = {
    id: string;
    sourceId: 'core-rulebook' | 'advanced-rules';
    sourceTitle: string;
    page: number;
    section: string;
    role: 'primary-rule' | 'official-clarification';
    excerpt: string;
    relevance: number;
};

export type AnswerEvidence = {
    strength: 'high' | 'medium' | 'partial' | 'none';
    summary: string;
};

export type AnswerResult = {
    status: 'answered' | 'not-specified' | 'unsupported' | 'insufficient';
    answer: string;
    citations: AnswerCitation[];
    evidence: AnswerEvidence;
    retrievalQuery?: string;
    interpretation?: QuestionPlan;
};

type ModelAnswer = {
    supported: boolean;
    answer: string;
    sourceIds: string[];
};

function createExcerpt(content: string, maximumLength = 240): string {
    const _normalized = content.replace(/\s+/g, ' ').trim();

    if (_normalized.length <= maximumLength) return _normalized;

    const _candidate = _normalized.slice(0, maximumLength);
    const _sentenceEnd = Math.max(
        _candidate.lastIndexOf('. '),
        _candidate.lastIndexOf('? '),
        _candidate.lastIndexOf('! ')
    );

    return `${_candidate.slice(0, _sentenceEnd > 100 ? _sentenceEnd + 1 : maximumLength).trim()}…`;
}

function explainEvidence(citations: AnswerCitation[]): AnswerEvidence {
    if (citations.length === 0) {
        return {
            strength: 'none',
            summary: 'No source passage directly supports an answer.'
        };
    }

    const _hasCoreRule = citations.some(
        (citation) => citation.role === 'primary-rule'
    );
    const _hasClarification = citations.some(
        (citation) => citation.role === 'official-clarification'
    );
    const _bestRelevance = Math.max(
        ...citations.map((citation) => citation.relevance)
    );
    const _strength = _bestRelevance >= 0.72 ? 'high' : 'medium';

    if (_hasCoreRule && _hasClarification) {
        return {
            strength: _strength,
            summary: 'The core rule and an official clarification directly support this answer.'
        };
    }

    if (_hasClarification) {
        return {
            strength: _strength,
            summary: 'An official advanced ruling directly addresses this interaction.'
        };
    }

    return {
        strength: _strength,
        summary: 'A primary rulebook passage directly supports this answer.'
    };
}

function parseModelAnswer(content: string): ModelAnswer | null {
    const _json = content
        .replace(/^```json\s*/i, '')
        .replace(/```$/i, '')
        .trim();

    try {
        const _parsed = JSON.parse(_json) as Partial<ModelAnswer>;

        if (
            typeof _parsed.supported !== 'boolean' ||
            typeof _parsed.answer !== 'string' ||
            !Array.isArray(_parsed.sourceIds) ||
            !_parsed.sourceIds.every((id) => typeof id === 'string')
        ) {
            return null;
        }

        return _parsed as ModelAnswer;
    } catch {
        return null;
    }
}

function createFocusedExcerpt(
    content: string,
    focus: RegExp,
    maximumLength = 240
): string {
    const _normalized = content.replace(/\s+/g, ' ').trim();
    const _match = focus.exec(_normalized);
    if (!_match || _match.index === undefined) return createExcerpt(content);

    const _start = Math.max(0, _match.index - 24);
    const _excerpt = _normalized.slice(_start, _start + maximumLength).trim();
    return `${_start > 0 ? '…' : ''}${_excerpt}${_start + maximumLength < _normalized.length ? '…' : ''}`;
}

function toCitation(source: RulebookRetrievalResult): AnswerCitation {
    return {
        id: source.id,
        sourceId: source.sourceId,
        sourceTitle: source.sourceTitle,
        page: source.page,
        section: source.section,
        role: source.sourceId === 'core-rulebook'
            ? 'primary-rule'
            : 'official-clarification',
        excerpt: createExcerpt(source.content),
        relevance: Number(source.score.toFixed(3))
    };
}

export async function answerQuestion(
    question: string,
    history: readonly ConversationTurn[] = []
): Promise<AnswerResult> {
    const _standaloneQuestion = await resolveConversationalQuestion(
        question,
        history
    );
    const _interpretation = planQuestion(_standaloneQuestion);

    if (!(await isDiceThroneQuestion(_standaloneQuestion))) {
        return {
            status: 'unsupported',
            answer: UNSUPPORTED_MESSAGE,
            citations: [],
            evidence: {
                strength: 'none',
                summary: 'The question is outside what the official Dice Throne rules sources can answer.'
            },
            interpretation: _interpretation
        };
    }

    const _retrievalQuery = await rewriteQuery(_standaloneQuestion);
    const _candidates = await findRulebookChunks(
        _standaloneQuestion,
        _retrievalQuery,
        10
    );

    const _policy = await resolveEvidencePolicy(
        _interpretation,
        _standaloneQuestion,
        _candidates
    );

    if (_policy) {
        const _citations = _policy.sources.map(({ source, excerptFocus }) => {
            const _citation = toCitation(source);
            if (excerptFocus) {
                _citation.excerpt = createFocusedExcerpt(
                    source.content,
                    excerptFocus
                );
            }
            return _citation;
        });

        return {
            status: _policy.status,
            answer: _policy.answer,
            citations: _citations,
            evidence: {
                strength: _policy.evidenceStrength,
                summary: _policy.evidenceSummary
            },
            retrievalQuery: _retrievalQuery,
            interpretation: _interpretation
        };
    }

    if (_candidates.length === 0) {
        return {
            status: 'insufficient',
            answer: INSUFFICIENT_MESSAGE,
            citations: [],
            evidence: explainEvidence([]),
            retrievalQuery: _retrievalQuery,
            interpretation: _interpretation
        };
    }

    const _topCandidate = _candidates[0];
    const _directSetupMatch =
        /\b(?:shuffle|starting hand|draw.*(?:start|beginning))\b/i.test(
            _standaloneQuestion
        )
            ? _candidates.find(
                (candidate) =>
                    candidate.sourceId === 'core-rulebook' &&
                    /shuffle your cards/i.test(candidate.content) &&
                    /this is your starting hand/i.test(candidate.content)
            )
            : undefined;
    const _strongStructuredMatch = Boolean(
        _topCandidate &&
        _topCandidate.sourceId === 'core-rulebook' &&
        _topCandidate.score >= 0.68 &&
        _topCandidate.section.toLowerCase() !== `page ${_topCandidate.page}`
    );

    const _evidence = _directSetupMatch
        ? [_directSetupMatch]
        : _strongStructuredMatch && _topCandidate
            ? [_topCandidate]
            : await rerankChunks(_standaloneQuestion, _candidates, 3);

    if (_evidence.length === 0) {
        return {
            status: 'insufficient',
            answer: INSUFFICIENT_MESSAGE,
            citations: [],
            evidence: explainEvidence([]),
            retrievalQuery: _retrievalQuery,
            interpretation: _interpretation
        };
    }

    const _context = _evidence
        .map((source) =>
            `[${source.id}] ${source.sourceTitle}, page ${source.page} — ${source.section}\n${source.content}`
        )
        .join('\n\n');

    const _response = await _client.chat.completions.create({
        model: _model,
        temperature: 0,
        max_tokens: 220,
        messages: [
            {
                role: 'system',
                content: `
/no_think

You answer Dice Throne rules questions using only supplied rulebook excerpts.

Return ONLY valid JSON:
{
  "supported": true,
  "answer": "A concise answer without a citation suffix.",
  "sourceIds": ["exact-source-id"]
}

Rules:
- Set supported to true only when the excerpts directly establish the answer.
- Never use outside knowledge, fill gaps, or infer a missing rule.
- If evidence is insufficient or conflicting, set supported to false, answer to an empty string, and sourceIds to an empty array.
- Cite only source IDs that directly support the answer.
- Use only IDs present in the supplied excerpts.
- Keep the answer concise and practical.
                `.trim()
            },
            {
                role: 'user',
                content: `RULEBOOK EXCERPTS:\n\n${_context}\n\nQUESTION:\n${_standaloneQuestion}`
            }
        ]
    });

    const _modelAnswer = parseModelAnswer(
        _response.choices[0]?.message.content ?? ''
    );

    if (!_modelAnswer?.supported || !_modelAnswer.answer.trim()) {
        return {
            status: 'insufficient',
            answer: INSUFFICIENT_MESSAGE,
            citations: [],
            evidence: explainEvidence([]),
            retrievalQuery: _retrievalQuery,
            interpretation: _interpretation
        };
    }

    const _sourceIds = new Set(_modelAnswer.sourceIds);
    const _citations = _evidence
        .filter((source) => _sourceIds.has(source.id))
        .map(toCitation);

    if (_citations.length === 0) {
        return {
            status: 'insufficient',
            answer: INSUFFICIENT_MESSAGE,
            citations: [],
            evidence: explainEvidence([]),
            retrievalQuery: _retrievalQuery,
            interpretation: _interpretation
        };
    }

    return {
        status: 'answered',
        answer: _modelAnswer.answer.trim(),
        citations: _citations,
        evidence: explainEvidence(_citations),
        retrievalQuery: _retrievalQuery,
        interpretation: _interpretation
    };
}

