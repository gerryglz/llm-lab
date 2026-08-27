import {
    findRulebookChunks,
    type RulebookRetrievalResult
} from './rulebook-retrieval.js';
import type { QuestionPlan } from './question-planner.js';

type PolicySource = {
    source: RulebookRetrievalResult;
};

export type PolicyResolution = {
    status: 'answered' | 'not-specified';
    answer: string;
    evidenceStrength: 'high' | 'partial';
    evidenceSummary: string;
    sources: PolicySource[];
};

function findDiscardRule(
    candidates: readonly RulebookRetrievalResult[]
): RulebookRetrievalResult | undefined {
    return candidates.find((candidate) =>
        candidate.sourceId === 'core-rulebook' &&
        candidate.section.includes('DISCARD PHASE') &&
        /Sell cards for 1 CP each until you have 6 or fewer/i.test(
            candidate.content
        )
    );
}

function asksWhetherDiscardingEarnsCp(question: string): boolean {
    return /\b(?:gain|get|receive)\b[^?.!]*\bCP\b[^?.!]*\b(?:discard|sell)\b/i.test(question) ||
        /\b(?:discard|sell)\b[^?.!]*\b(?:down to|six|6)\b[^?.!]*\bCP\b/i.test(question);
}

async function resolveCardSelling(
    plan: QuestionPlan,
    question: string,
    candidates: readonly RulebookRetrievalResult[]
): Promise<PolicyResolution | null> {
    if (asksWhetherDiscardingEarnsCp(question)) {
        const _discard = findDiscardRule(candidates);
        if (!_discard) return null;

        return {
            status: 'answered',
            answer: 'Yes. During the Discard Phase, you sell cards for 1 CP each until you have 6 or fewer cards in your hand.',
            evidenceStrength: 'high',
            evidenceSummary: 'A primary rulebook passage directly defines discarding down as selling each card for 1 CP.',
            sources: [{ source: _discard }]
        };
    }

    if (plan.kind !== 'timing') return null;

    const _phaseCandidates = await findRulebookChunks(
        question,
        'Main Phase 1 sell unwanted cards Main Phase 2 identical Discard Phase sell cards until 6',
        30
    );
    const _allPhases = [...candidates, ..._phaseCandidates];
    const _mainOne = _allPhases.find((candidate) =>
        candidate.sourceId === 'core-rulebook' &&
        candidate.section.includes('MAIN PHASE (1)') &&
        /Sell unwanted cards to gain 1 CP for each/i.test(candidate.content)
    );
    const _mainTwo = _allPhases.find((candidate) =>
        candidate.sourceId === 'core-rulebook' &&
        candidate.section.includes('MAIN PHASE (2)') &&
        /Identical to Main Phase \(1\)/i.test(candidate.content)
    );
    const _discard = findDiscardRule(_allPhases);

    if (!_mainOne || !_mainTwo || !_discard) return null;

    return {
        status: 'answered',
        answer: 'You may sell unwanted cards for 1 CP each during Main Phase (1) or Main Phase (2), which is identical to Main Phase (1). During the Discard Phase, if you have more than 6 cards, you must sell cards for 1 CP each until you have 6 or fewer.',
        evidenceStrength: 'high',
        evidenceSummary: 'Three primary rulebook passages establish both optional Main Phase selling and mandatory Discard Phase selling.',
        sources: [
            { source: _mainOne },
            { source: _mainTwo },
            { source: _discard }
        ]
    };
}

async function resolveCombatPointLimit(
    plan: QuestionPlan,
    question: string,
    candidates: readonly RulebookRetrievalResult[]
): Promise<PolicyResolution | null> {
    if (plan.kind !== 'limit' || !/\b(?:spend|spending|per turn|each turn)\b/i.test(question)) {
        return null;
    }

    const _constraintCandidates = await findRulebookChunks(
        question,
        'Combat Points maximum 15 CP spend CP play cards during Main Phase',
        30
    );
    const _allConstraints = [...candidates, ..._constraintCandidates];
    const _spendingRule = _allConstraints.find((candidate) =>
        candidate.sourceId === 'core-rulebook' &&
        /Spend CP to play Hero Upgrade cards or Main Phase Action cards/i.test(
            candidate.content
        )
    );
    const _holdingRule = _allConstraints.find((candidate) =>
        /(?:maximum of 15 CP|Maximum CP Limit[\s\S]{0,180}\b15\s*CP\b)/i.test(
            candidate.content
        )
    );

    if (!_spendingRule || !_holdingRule) return null;

    return {
        status: 'not-specified',
        answer: "I couldn't find an official rule that specifies a per-turn CP spending limit. The rules say CP is spent to play Hero Upgrade or Main Phase Action cards during the Main Phase, and that you may hold at most 15 CP. Those related rules do not establish a separate amount you may spend per turn.",
        evidenceStrength: 'partial',
        evidenceSummary: 'Official passages establish related CP timing and capacity constraints, but do not directly specify the requested per-turn limit.',
        sources: [
            { source: _spendingRule },
            { source: _holdingRule }
        ]
    };
}

function resolveShortDeckLook(
    question: string,
    candidates: readonly RulebookRetrievalResult[]
): PolicyResolution | null {
    if (!/\blook\b[^?.!]*\btop\b[^?.!]*\bcards?\b/i.test(question) ||
        !/\b(?:only|less|fewer|remain)\b/i.test(question)) {
        return null;
    }

    const _ruling = candidates.find((candidate) =>
        candidate.sourceId === 'advanced-rules' &&
        /You cannot shuffle your deck or re-shuffle your deck/i.test(
            candidate.content
        )
    );
    if (!_ruling) return null;

    return {
        status: 'answered',
        answer: 'No. Look only at the cards remaining in your deck; do not shuffle first. You shuffle the discard pile into a new deck only when you need to draw a card and the deck is empty.',
        evidenceStrength: 'high',
        evidenceSummary: 'An official clarification directly addresses looking at more cards than remain in the deck.',
        sources: [{ source: _ruling }]
    };
}

export async function resolveEvidencePolicy(
    plan: QuestionPlan,
    question: string,
    candidates: readonly RulebookRetrievalResult[]
): Promise<PolicyResolution | null> {
    const _shortDeckLook = resolveShortDeckLook(question, candidates);
    if (_shortDeckLook) return _shortDeckLook;

    if (plan.topic === 'card-selling') {
        return resolveCardSelling(plan, question, candidates);
    }

    if (plan.topic === 'combat-points') {
        return resolveCombatPointLimit(plan, question, candidates);
    }

    return null;
}

