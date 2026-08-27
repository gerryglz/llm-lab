import OpenAI from 'openai';

import type {
    RulebookRetrievalResult
} from './rulebook-retrieval.js';

const _client = new OpenAI({
    baseURL: 'http://127.0.0.1:1234/v1',
    apiKey: 'lm-studio'
});

type RerankResponse = {
    ids: string[];
};

export async function rerankChunks(
    question: string,
    candidates: RulebookRetrievalResult[],
    limit = 3
): Promise<RulebookRetrievalResult[]> {
    if (candidates.length <= limit) {
        return candidates;
    }

    const _candidateText = candidates
        .map(
            (candidate) =>
                `[${candidate.id}]
Content:
${candidate.content}

Metadata:
Source: ${candidate.sourceTitle}
Page ${candidate.page}
Section: ${candidate.section}`
        )
        .join('\n\n');

    const _response =
        await _client.chat.completions.create({
            model: 'qwen/qwen3-8b',
            temperature: 0,
            max_tokens: 60,
            messages: [
                {
                    role: 'system',
                    content: `
                    /no_think
You are a retrieval reranker.

Select the chunks that are most directly useful for answering the user's question.

Return ONLY valid JSON in this exact shape:

{
    "ids": ["chunk-id-1", "chunk-id-2"]
}

Rules:
- Choose the smallest number of chunks needed to fully answer the question.
- If one chunk fully answers the question, return only that one chunk.
- Choose at most ${limit} chunk IDs.
- Use only IDs from the provided candidates.
- Judge relevance primarily from the chunk content.
- Do not select a chunk merely because its section title sounds relevant.
- Prefer chunks containing the actual fact or rule needed to answer the question.
- Do not include merely related chunks.
- Do not answer the user's question.
            `.trim()
                },
                {
                    role: 'user',
                    content: `
QUESTION:

${question}

CANDIDATES:

${_candidateText}
        `.trim()
                }
            ]
        });

    console.log('\nReranker usage:');
    console.log(
        `Prompt tokens:     ${_response.usage?.prompt_tokens ?? 0}`
    );
    console.log(
        `Completion tokens: ${_response.usage?.completion_tokens ?? 0}`
    );
    console.log(
        `Total tokens:      ${_response.usage?.total_tokens ?? 0}`
    );

    const _content =
        _response.choices[0]?.message.content;

    if (!_content) {
        return candidates.slice(0, limit);
    }

    try {
        const _parsed =
            JSON.parse(_content) as RerankResponse;

        const _selected = _parsed.ids
            .map(
                (id) =>
                    candidates.find(
                        (candidate) => candidate.id === id
                    )
            )
            .filter(
                (
                    candidate
                ): candidate is RulebookRetrievalResult =>
                    Boolean(candidate)
            );

        return _selected.length > 0
            ? _selected.slice(0, limit)
            : candidates.slice(0, limit);
    } catch {
        return candidates.slice(0, limit);
    }
}

