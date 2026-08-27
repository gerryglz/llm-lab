import fs from 'node:fs/promises';

import {
    cosineSimilarity,
    createEmbedding
} from './embeddings.js';

type RulebookChunk = {
    id: string;
    sourceId: 'core-rulebook' | 'advanced-rules';
    sourceTitle: string;
    page: number;
    section: string;
    content: string;
    quality: 'clean' | 'mixed';
    embedding: number[];
};

export type RulebookRetrievalResult = {
    id: string;
    sourceId: 'core-rulebook' | 'advanced-rules';
    sourceTitle: string;
    page: number;
    section: string;
    content: string;
    quality: 'clean' | 'mixed';
    score: number;
};

type RankedChunk = RulebookChunk & {
    semanticScore: number;
    lexicalScore: number;
    structureScore: number;
    relationshipScore: number;
    intentScore: number;
    phraseScore: number;
    rankingScore: number;
};

function getPhraseScore(question: string, chunk: RulebookChunk): number {
    const _isClarificationQuestion =
        /^(can|may|if|when)\b/i.test(question.trim());
    const _isAdvancedRuling =
        chunk.sourceId === 'advanced-rules' &&
        /\b(?:Interaction Name|Situation|Ruling):/i.test(chunk.content);

    if (!_isClarificationQuestion || !_isAdvancedRuling) {
        return 0;
    }

    const _questionTokens = tokenize(question);
    const _haystack = `${chunk.section} ${chunk.content}`.toLowerCase();
    const _phrases = new Set<string>();

    for (const _size of [3, 2]) {
        for (let i = 0; i <= _questionTokens.length - _size; i++) {
            _phrases.add(_questionTokens.slice(i, i + _size).join(' '));
        }
    }

    let _matches = 0;
    for (const _phrase of _phrases) {
        if (_haystack.includes(_phrase)) _matches++;
    }

    return Math.min(_matches * 0.04, 0.20);
}

const _indexPath =
    './documents/dice-throne-index.json';

let _chunks: RulebookChunk[] | null = null;

const _sourceTitles: Record<RulebookChunk['sourceId'], string> = {
    'core-rulebook': 'Dice Throne Rulebook v2.4.3',
    'advanced-rules': 'Official Dice Throne Rulings and Clarifications'
};

const _turnPhases = [
    'UPKEEP PHASE',
    'INCOME PHASE',
    'MAIN PHASE (1)',
    'OFFENSIVE ROLL PHASE',
    'TARGETING ROLL PHASE',
    'DEFENSIVE ROLL PHASE',
    'MAIN PHASE (2)',
    'DISCARD PHASE'
] as const;

async function loadChunks(): Promise<RulebookChunk[]> {
    if (_chunks) {
        return _chunks;
    }

    const _raw = await fs.readFile(
        _indexPath,
        'utf-8'
    );

    _chunks = (JSON.parse(_raw) as RulebookChunk[]).map((chunk) => ({
        ...chunk,
        sourceTitle: _sourceTitles[chunk.sourceId]
    }));

    console.log(
        `Loaded ${_chunks.length} indexed rulebook chunks.`
    );

    return _chunks;
}

export async function loadRulebookIndex(): Promise<void> {
    await loadChunks();
}

function normalizeSection(
    section: string
): string {
    const _parts =
        section.split('>');

    return _parts[
        _parts.length - 1
    ]
        .trim()
        .toUpperCase();
}

function getTurnPhaseIndex(
    section: string
): number {
    const _normalized =
        normalizeSection(section);

    return _turnPhases.findIndex(
        (phase) =>
            phase === _normalized
    );
}

function findMentionedTurnPhase(
    question: string
): number {
    const _question =
        question.toUpperCase();

    return _turnPhases.findIndex(
        (phase) =>
            _question.includes(
                phase
            )
    );
}

function getRelationshipScore(
    question: string,
    chunk: RulebookChunk
): number {
    const _chunkPhaseIndex =
        getTurnPhaseIndex(
            chunk.section
        );

    if (_chunkPhaseIndex === -1) {
        return 0;
    }

    const _mentionedPhaseIndex =
        findMentionedTurnPhase(
            question
        );

    let _score = 0;

    const _isPhase =
        (phase: typeof _turnPhases[number]) =>
            _chunkPhaseIndex === _turnPhases.indexOf(phase);

    if (/\b(after|following)\b[^?.!]*\b(attack|attacking|offensive ability)\b/i.test(question)) {
        if (_isPhase('MAIN PHASE (2)')) _score += 0.22;
        if (_isPhase('OFFENSIVE ROLL PHASE')) _score -= 0.08;
    }

    if (/\bbefore\b[^?.!]*\b(discard|end(?:ing)? (?:my |the )?turn)\b/i.test(question)) {
        if (_isPhase('MAIN PHASE (2)')) _score += 0.16;
    }

    if (/\bbefore\b[^?.!]*\b(draw|gain CP|income)\b/i.test(question)) {
        if (_isPhase('UPKEEP PHASE')) _score += 0.18;
        if (_isPhase('INCOME PHASE')) _score -= 0.05;
    }

    if (/\b(second main phase|after my second main|after the second main)\b/i.test(question)) {
        if (_isPhase('DISCARD PHASE')) _score += 0.22;
        if (_isPhase('MAIN PHASE (2)')) _score -= 0.08;
    }

    /*
     * --------------------------------------------------
     * BEFORE / PREVIOUS
     * --------------------------------------------------
     */
    const _asksBefore =
        /\b(before|previous|preceding|prior to)\b/i
            .test(question);

    if (
        _asksBefore &&
        _mentionedPhaseIndex > 0
    ) {
        const _expectedIndex =
            _mentionedPhaseIndex - 1;

        if (
            _chunkPhaseIndex ===
            _expectedIndex
        ) {
            _score += 0.15;
        }

        if (
            _chunkPhaseIndex ===
            _mentionedPhaseIndex
        ) {
            _score -= 0.06;
        }
    }

    /*
     * --------------------------------------------------
     * AFTER / NEXT
     * --------------------------------------------------
     */
    const _asksAfter =
        /\b(after|next|following)\b/i
            .test(question);

    if (
        _asksAfter &&
        _mentionedPhaseIndex !== -1 &&
        _mentionedPhaseIndex <
        _turnPhases.length - 1
    ) {
        const _expectedIndex =
            _mentionedPhaseIndex + 1;

        if (
            _chunkPhaseIndex ===
            _expectedIndex
        ) {
            _score += 0.15;
        }

        if (
            _chunkPhaseIndex ===
            _mentionedPhaseIndex
        ) {
            _score -= 0.06;
        }
    }

    /*
     * --------------------------------------------------
     * BEGINNING OF TURN
     * --------------------------------------------------
     */
    const _asksBeginning =
        /\b(first|beginning|start)\b/i
            .test(question) &&
        /\bturn\b/i.test(question);

    if (
        _asksBeginning &&
        _chunkPhaseIndex === 0
    ) {
        _score += 0.10;
    }

    /*
     * --------------------------------------------------
     * END OF TURN
     * --------------------------------------------------
     */
    const _asksEnd =
        /\b(end|ending|last)\b/i
            .test(question) &&
        /\bturn\b/i.test(question);

    if (
        _asksEnd &&
        _chunkPhaseIndex ===
        _turnPhases.length - 1
    ) {
        _score += 0.08;
    }

    /*
     * --------------------------------------------------
     * BETWEEN TWO EXPLICIT PHASES
     * --------------------------------------------------
     */
    const _phaseMentions =
        _turnPhases
            .map(
                (phase, index) => ({
                    phase,
                    index
                })
            )
            .filter(
                ({ phase }) =>
                    question
                        .toUpperCase()
                        .includes(phase)
            );

    if (_phaseMentions.length >= 2) {
        const _indices =
            _phaseMentions
                .map(
                    ({ index }) =>
                        index
                )
                .sort(
                    (a, b) =>
                        a - b
                );

        const _minimum =
            _indices[0];

        const _maximum =
            _indices[
            _indices.length - 1
            ];

        if (
            _chunkPhaseIndex >
            _minimum &&
            _chunkPhaseIndex <
            _maximum
        ) {
            _score += 0.04;
        }
    }

    return _score;
}

function getIntentScore(
    question: string,
    chunk: RulebookChunk
): number {
    const _section = normalizeSection(chunk.section);
    let _score = 0;

    const _setupIntent =
        /\b(set(?:up|ting up)|before (?:the )?game|start(?:ing)? (?:the )?game|starting (?:hand|cards?|player)|first player|shuffle (?:my |the )?deck)\b/i.test(question);

    if (_setupIntent) {
        if (_section === 'GAME SETUP') _score += 0.20;
        if (
            /\bstarting (?:hand|cards?)\b/i.test(question) &&
            /\b(?:this is your starting hand|draw the top 4 cards)\b/i.test(chunk.content)
        ) {
            _score += 0.32;
        }
        if (_section.includes('PHASE')) _score -= 0.04;
    }

    if (/\b(maximum hand|hand size|too many cards|holding (?:six|seven|eight|nine|\d+) cards)\b/i.test(question)) {
        if (_section === 'DISCARD PHASE') _score += 0.18;
        if (_section === 'STACK LIMITS') _score -= 0.08;
    }

    if (/\b(play|spend CP on)\b[^?.!]*\b(upgrades?|hero upgrades?)\b/i.test(question) &&
        !/\bafter (?:an? )?(?:attack|attacking)\b/i.test(question)) {
        if (_section === 'MAIN PHASE (1)') _score += 0.18;
    }

    if (/\b(starting player|first turn)\b[^?.!]*\b(draw|card|income)\b/i.test(question)) {
        if (_section === 'INCOME PHASE') _score += 0.24;
        if (_section === 'GAME SETUP') _score -= 0.06;
    }

    if (/\b(total rolls|first roll|reroll)\b[^?.!]*\b(attack|activate|ability|dice)\b/i.test(question) &&
        !/\b(defend|defense|defensive)\b/i.test(question)) {
        if (_section === 'OFFENSIVE ROLL PHASE') _score += 0.22;
        if (_section === 'DEFENSIVE ROLL PHASE') _score -= 0.06;
    }

    if (/\b(defender|defending player)\b[^?.!]*\b(attempt|roll|defensive ability|defense)\b/i.test(question)) {
        if (_section === 'DEFENSIVE ROLL PHASE') _score += 0.22;
    }

    if (/\b(play|spend)\b[^?.!]*\b(cards?|CP)\b[^?.!]*\bafter attack(?:ing)?\b/i.test(question)) {
        if (_section === 'MAIN PHASE (2)') _score += 0.34;
        if (_section === 'MAIN PHASE (1)') _score -= 0.08;
    }

    if (/\b(number next to|normal limit|stack (?:mean|maximum|limit))\b/i.test(question)) {
        if (_section === 'STACK LIMITS') _score += 0.20;
        if (_section === 'INCREASING STACK LIMIT') _score -= 0.06;
    }

    if (/\b(undefendable|collateral damage|ignores? (?:a )?defensive ability|kind of damage|types? of damage)\b/i.test(question)) {
        if (_section === 'DAMAGE TYPES') _score += 0.22;
        if (_section === 'DEFENSIVE ROLL PHASE') _score -= 0.05;
    }

    if (/\b(attack modifiers?|modify the damage)\b/i.test(question)) {
        if (_section === 'ATTACK MODIFIERS') _score += 0.22;
    }

    if (/\b(choose|select|figure out)\b[^?.!]*\b(target|who (?:I am|I'm) attacking|opponent)\b/i.test(question)) {
        if (_section === 'TARGETING ROLL PHASE') _score += 0.18;
    }

    if (/\b(play|spend CP on)\b[^?.!]*\b(upgrade|card)\b[^?.!]*\bafter (?:an? )?(?:attack|attacking)\b/i.test(question)) {
        if (_section === 'MAIN PHASE (2)') _score += 0.20;
        if (_section === 'MAIN PHASE (1)') _score -= 0.06;
    }

    return _score;
}

function getStructureScore(
    question: string,
    chunk: RulebookChunk
): number {
    const _section =
        chunk.section.toLowerCase();

    if (
        _section ===
        `page ${chunk.page}`
    ) {
        return 0;
    }

    let _score = 0.03;

    if (_section.includes('>')) {
        _score += 0.02;
    }

    const _sectionWords =
        tokenize(
            chunk.section
        );

    const _questionWords =
        new Set(
            tokenize(
                question
            )
        );

    const _matches =
        _sectionWords.filter(
            (word) =>
                _questionWords.has(
                    word
                )
        ).length;

    if (_sectionWords.length > 0) {
        _score +=
            (
                _matches /
                _sectionWords.length
            ) *
            0.05;
    }

    return _score;
}

function tokenize(
    text: string
): string[] {
    const _stopWords =
        new Set([
            'what',
            'when',
            'where',
            'which',
            'that',
            'this',
            'with',
            'from',
            'during',
            'many',
            'does',
            'have',
            'your',
            'into',
            'about',
            'should',
            'could',
            'would',
            'there',
            'their',
            'the',
            'and',
            'are',
            'for',
            'you',
            'how',
            'can',
            'get'
        ]);

    return text
        .toLowerCase()
        .replace(
            /[^\p{L}\p{N}\s]/gu,
            ' '
        )
        .split(/\s+/)
        .filter(
            (word) =>
                word.length > 2 &&
                !_stopWords.has(
                    word
                )
        );
}

function lexicalSimilarity(
    question: string,
    chunk: RulebookChunk
): number {
    const _questionTokens =
        new Set(
            tokenize(
                question
            )
        );

    if (_questionTokens.size === 0) {
        return 0;
    }

    const _chunkTokens =
        new Set(
            tokenize(
                `${chunk.section} ${chunk.content}`
            )
        );

    let _matches = 0;

    for (
        const _token of
        _questionTokens
    ) {
        if (
            _chunkTokens.has(
                _token
            )
        ) {
            _matches++;
        }
    }

    return (
        _matches /
        _questionTokens.size
    );
}

async function embedQuestion(
    question: string
): Promise<number[]> {
    return createEmbedding(
        `search_query: ${question}`
    );
}

export async function findRulebookChunks(
    originalQuestion: string,
    retrievalQuery: string,
    limit = 10
): Promise<RulebookRetrievalResult[]> {
    const _rulebookChunks =
        await loadChunks();

    console.log(
        '\nRetrieval inputs:'
    );

    console.log(
        `Original: ${originalQuestion}`
    );

    console.log(
        `Rewritten: ${retrievalQuery}`
    );

    /*
     * Semantic retrieval uses the rewritten query.
     */
    const _questionEmbedding =
        await embedQuestion(
            retrievalQuery
        );

    /*
     * Each signal now receives the representation
     * best suited to its job.
     *
     * semantic     -> rewritten query
     * lexical      -> original question
     * structure    -> rewritten query
     * relationship -> original question
     */
    const _ranked: RankedChunk[] =
        _rulebookChunks.map(
            (chunk) => {
                const _semanticScore =
                    cosineSimilarity(
                        _questionEmbedding,
                        chunk.embedding
                    );

                const _lexicalScore =
                    lexicalSimilarity(
                        originalQuestion,
                        chunk
                    );

                const _structureScore =
                    getStructureScore(
                        retrievalQuery,
                        chunk
                    );

                const _relationshipScore =
                    getRelationshipScore(
                        originalQuestion,
                        chunk
                    );

                const _intentScore =
                    getIntentScore(
                        originalQuestion,
                        chunk
                    );

                const _phraseScore =
                    getPhraseScore(
                        originalQuestion,
                        chunk
                    );

                const _rankingScore =
                    _semanticScore +
                    (
                        _lexicalScore *
                        0.05
                    ) +
                    _structureScore +
                    _relationshipScore +
                    _intentScore +
                    _phraseScore;

                return {
                    ...chunk,
                    semanticScore:
                        _semanticScore,
                    lexicalScore:
                        _lexicalScore,
                    structureScore:
                        _structureScore,
                    relationshipScore:
                        _relationshipScore,
                    intentScore:
                        _intentScore,
                    phraseScore:
                        _phraseScore,
                    rankingScore:
                        _rankingScore
                };
            }
        );

    const _semanticRanked =
        [..._ranked].sort(
            (a, b) =>
                b.rankingScore -
                a.rankingScore
        );

    console.log(
        '\nTop ranked matches:'
    );

    for (
        const _result of
        _semanticRanked.slice(
            0,
            10
        )
    ) {
        console.log(
            `${_result.id} | ` +
            `rank=${_result.rankingScore.toFixed(4)} | ` +
            `semantic=${_result.semanticScore.toFixed(4)} | ` +
            `lexical=${_result.lexicalScore.toFixed(4)} | ` +
            `structure=${_result.structureScore.toFixed(4)} | ` +
            `relationship=${_result.relationshipScore.toFixed(4)} | ` +
            `${_result.section}`
        );
    }

    const _lexicallyRanked =
        [..._ranked].sort(
            (a, b) =>
                b.lexicalScore -
                a.lexicalScore
        );

    console.log(
        '\nTop semantic matches:'
    );

    for (
        const _result of
        _semanticRanked.slice(
            0,
            10
        )
    ) {
        console.log(
            `${_result.id} | ` +
            `semantic=${_result.semanticScore.toFixed(4)} | ` +
            `lexical=${_result.lexicalScore.toFixed(4)} | ` +
            `relationship=${_result.relationshipScore.toFixed(4)} | ` +
            `${_result.section}`
        );
    }

    console.log(
        '\nTop lexical matches:'
    );

    for (
        const _result of
        _lexicallyRanked.slice(
            0,
            10
        )
    ) {
        console.log(
            `${_result.id} | ` +
            `semantic=${_result.semanticScore.toFixed(4)} | ` +
            `lexical=${_result.lexicalScore.toFixed(4)} | ` +
            `${_result.section}`
        );
    }

    const _bestSemantic =
        _semanticRanked[0]
            ?.semanticScore ?? 0;

    const _bestLexical =
        _lexicallyRanked[0]
            ?.lexicalScore ?? 0;

    const _minimumSemanticSimilarity =
        0.65;

    const _minimumLexicalSimilarity =
        0.5;

    if (
        _bestSemantic <
        _minimumSemanticSimilarity &&
        _bestLexical <
        _minimumLexicalSimilarity
    ) {
        return [];
    }

    const _semanticCandidates =
        _semanticRanked.slice(
            0,
            limit
        );

    const _lexicalCandidates =
        _lexicallyRanked.slice(
            0,
            limit
        );

    const _candidateMap =
        new Map<
            string,
            RankedChunk
        >();

    for (
        const _candidate of [
            ..._semanticCandidates,
            ..._lexicalCandidates
        ]
    ) {
        _candidateMap.set(
            _candidate.id,
            _candidate
        );
    }

    const _candidates =
        [
            ..._candidateMap.values()
        ];

    console.log(
        `\nHybrid candidate pool: ` +
        `${_candidates.length} chunks`
    );

    for (
        const _candidate of
        _candidates
    ) {
        console.log(
            `${_candidate.id} | ` +
            `semantic=${_candidate.semanticScore.toFixed(4)} | ` +
            `lexical=${_candidate.lexicalScore.toFixed(4)} | ` +
            `relationship=${_candidate.relationshipScore.toFixed(4)} | ` +
            `${_candidate.section}`
        );
    }

    /*
     * Keep public score mapped to semantic similarity.
     */
    return _candidates.map(
        (
            result
        ): RulebookRetrievalResult => ({
            id: result.id,
            sourceId: result.sourceId,
            sourceTitle: result.sourceTitle,
            page: result.page,
            section:
                result.section,
            content:
                result.content,
            quality:
                result.quality,
            score:
                result.semanticScore
        })
    );
}

