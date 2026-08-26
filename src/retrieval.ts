import { RULES } from './rules.js';

import {
    createEmbedding,
    cosineSimilarity
} from './embeddings.js';

type IndexedRule = {
    id: string;
    content: string;
    embedding: number[];
};

export type RetrievalResult = {
    id: string;
    content: string;
    score: number;
};

let _indexedRules: IndexedRule[] = [];

export async function indexRules(): Promise<void> {
    _indexedRules = await Promise.all(
        RULES.map(async (rule) => ({
            ...rule,
            embedding: await createEmbedding(
                `search_document: ${rule.content}`
            )
        }))
    );
}

export async function findRelevantRules(
    question: string,
    limit = 2
): Promise<RetrievalResult[]> {
    const _questionEmbedding = await createEmbedding(
        `search_query: ${question}`
    );

    const _rankedRules = _indexedRules
        .map((rule) => ({
            rule,
            score: cosineSimilarity(
                _questionEmbedding,
                rule.embedding
            )
        }))
        .sort((a, b) => b.score - a.score);

    console.log('\nSemantic retrieval scores:');

    for (const _result of _rankedRules) {
        console.log(
            `${_result.rule.id}: ${_result.score.toFixed(4)}`
        );
    }

    const _minimumSimilarity = 0.65;

    return _rankedRules
        .filter(
            (result) =>
                result.score >= _minimumSimilarity
        )
        .slice(0, limit)
        .map((result) => ({
            id: result.rule.id,
            content: result.rule.content,
            score: result.score
        }));
}
