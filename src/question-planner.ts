export type QuestionKind =
    | 'direct'
    | 'timing'
    | 'limit'
    | 'sequence'
    | 'inheritance';

export type EvidenceStrategy =
    | 'direct-passage'
    | 'all-applicable-windows'
    | 'related-constraints'
    | 'linked-rules';

export type QuestionTopic =
    | 'card-selling'
    | 'combat-points'
    | 'general';

export type QuestionPlan = {
    kind: QuestionKind;
    topic: QuestionTopic;
    evidenceStrategy: EvidenceStrategy;
};

export function planQuestion(question: string): QuestionPlan {
    const _topic: QuestionTopic =
        /\b(?:sell|discard)\b[^?.!]*\bcards?\b|\bcards?\b[^?.!]*\b(?:sell|discard)\b/i.test(question)
            ? 'card-selling'
            : /\b(?:CP|combat points?)\b/i.test(question)
                ? 'combat-points'
                : 'general';

    if (
        /^\s*when\b/i.test(question) ||
        /\b(?:what|which)\s+(?:phases?|times?)\b/i.test(question)
    ) {
        return {
            kind: 'timing',
            topic: _topic,
            evidenceStrategy: 'all-applicable-windows'
        };
    }

    if (/\b(?:how many|how much|maximum|max|limit)\b/i.test(question)) {
        return {
            kind: 'limit',
            topic: _topic,
            evidenceStrategy: 'related-constraints'
        };
    }

    if (/\b(?:before|after|next|previous|following)\b/i.test(question)) {
        return {
            kind: 'sequence',
            topic: _topic,
            evidenceStrategy: 'linked-rules'
        };
    }

    if (/\b(?:same|identical|also apply|still apply)\b/i.test(question)) {
        return {
            kind: 'inheritance',
            topic: _topic,
            evidenceStrategy: 'linked-rules'
        };
    }

    return {
        kind: 'direct',
        topic: _topic,
        evidenceStrategy: 'direct-passage'
    };
}

