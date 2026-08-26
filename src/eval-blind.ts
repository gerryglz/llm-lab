import { isDiceThroneQuestion } from './domain-classifier.js';
import { rewriteQuery } from './query-rewriter.js';
import { findRulebookChunks, loadRulebookIndex } from './rulebook-retrieval.js';

type EvalCase = {
    question: string;
    expectedSection?: string;
    expectNoResults?: boolean;
};

// Frozen holdout: do not use individual failures here to tune retrieval.
const _evalCases: readonly EvalCase[] = [
    { question: 'Once my attack is over, what can I do before ending my turn?', expectedSection: 'MAIN PHASE (2)' },
    { question: 'Before taking income, do status effects resolve?', expectedSection: 'UPKEEP PHASE' },
    { question: 'Who goes first and what cards do we begin with?', expectedSection: 'Game setup' },
    { question: 'Must I throw all five dice again during an attack reroll?', expectedSection: 'OFFENSIVE ROLL PHASE' },
    { question: 'In a duel, do we skip choosing an opponent by rolling?', expectedSection: 'TARGETING ROLL PHASE' },
    { question: 'What happens immediately after Main Phase 2?', expectedSection: 'DISCARD PHASE' },
    { question: 'Can the defending player reroll their defense dice?', expectedSection: 'DEFENSIVE ROLL PHASE' },
    { question: 'May a token exceed the printed stack maximum?', expectedSection: 'INCREASING STACK LIMIT' },
    { question: 'Does damage that cannot be defended against trigger defense?', expectedSection: 'Damage types' },
    { question: 'In teams, is one health dial shared by both partners?', expectedSection: '2V2 TEAM GAME' },
    { question: 'Recommend a top-tier Dice Throne hero.', expectNoResults: true },
    { question: 'Which Dice Throne character should a new player buy?', expectNoResults: true },
    { question: 'What year did the first Dice Throne set come out?', expectNoResults: true },
    { question: 'How should I build a competitive Pokémon deck?', expectNoResults: true },
    { question: 'What is the boiling point of water?', expectNoResults: true }
] as const;

async function main(): Promise<void> {
    await loadRulebookIndex();
    let _top1 = 0;
    let _top10 = 0;
    let _inDomain = 0;
    let _oodPassed = 0;
    let _ood = 0;
    const _failures: string[] = [];

    console.log('\nDice Throne BLIND Retrieval Evaluation\n');

    for (const _test of _evalCases) {
        const _answerable = await isDiceThroneQuestion(_test.question);

        if (_test.expectNoResults) {
            _ood++;
            if (!_answerable) _oodPassed++;
            else _failures.push(_test.question);
            continue;
        }

        _inDomain++;
        if (!_answerable || !_test.expectedSection) {
            _failures.push(_test.question);
            continue;
        }

        const _rewritten = await rewriteQuery(_test.question);
        const _results = await findRulebookChunks(_test.question, _rewritten, 10);
        const _expected = _test.expectedSection.toLowerCase();
        const _rank = _results.findIndex((result) =>
            result.section.toLowerCase().includes(_expected)
        );

        if (_rank === 0) _top1++;
        if (_rank >= 0) _top10++;
        if (_rank < 0) _failures.push(_test.question);
    }

    console.log('='.repeat(70));
    console.log('BLIND Evaluation Summary');
    console.log('='.repeat(70));
    console.log(`In-domain tests:         ${_inDomain}`);
    console.log(`Top-1 correct:           ${_top1}`);
    console.log(`Top-10 correct:          ${_top10}`);
    console.log(`Top-1 Accuracy:          ${((_top1 / _inDomain) * 100).toFixed(1)}%`);
    console.log(`Top-10 Recall:           ${((_top10 / _inDomain) * 100).toFixed(1)}%`);
    console.log(`Out-of-domain tests:     ${_ood}`);
    console.log(`Out-of-domain rejected:  ${_oodPassed}`);
    console.log(`Out-of-domain Accuracy:  ${((_oodPassed / _ood) * 100).toFixed(1)}%`);

    if (_failures.length > 0) {
        console.log('\nFailed cases:');
        for (const _failure of _failures) console.log(`- ${_failure}`);
    }
}

main().catch((_error) => {
    console.error('Blind evaluation failed:', _error);
    process.exitCode = 1;
});

