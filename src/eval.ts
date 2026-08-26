import {
    findRulebookChunks,
    loadRulebookIndex
} from './rulebook-retrieval.js';

import {
    rewriteQuery
} from './query-rewriter.js';

import {
    isDiceThroneQuestion
} from './domain-classifier.js';

interface EvalCase {
    question: string;
    expectedSection?: string;
    expectNoResults?: boolean;
}

const _evalCases: EvalCase[] = [
    {
        question:
            'What is the maximum hand size?',
        expectedSection:
            'DISCARD PHASE'
    },
    {
        question:
            'How many chances do I get to roll my dice when attacking?',
        expectedSection:
            'OFFENSIVE ROLL PHASE'
    },
    {
        question:
            'What happens at the beginning of my turn?',
        expectedSection:
            'UPKEEP PHASE'
    },
    {
        question:
            'What happens during the Income Phase?',
        expectedSection:
            'INCOME PHASE'
    },
    {
        question:
            'How many times can I reroll during my Offensive Roll Phase?',
        expectedSection:
            'OFFENSIVE ROLL PHASE'
    },
    {
        question:
            'What happens during the Discard Phase?',
        expectedSection:
            'DISCARD PHASE'
    },
    {
        question:
            'What do I do first when my turn starts?',
        expectedSection:
            'UPKEEP PHASE'
    },
    {
        question:
            'When do I gain CP and draw a card?',
        expectedSection:
            'INCOME PHASE'
    },
    {
        question:
            'Do I get income on my very first turn?',
        expectedSection:
            'INCOME PHASE'
    },
    {
        question:
            'When can I play upgrades?',
        expectedSection:
            'MAIN PHASE (1)'
    },
    {
        question:
            'Can I reroll all of my dice when attacking?',
        expectedSection:
            'OFFENSIVE ROLL PHASE'
    },
    {
        question:
            'When do I choose who I am attacking?',
        expectedSection:
            'TARGETING ROLL PHASE'
    },
    {
        question:
            'When does my opponent get to defend?',
        expectedSection:
            'DEFENSIVE ROLL PHASE'
    },
    {
        question:
            'What do I do if I have too many cards at the end of my turn?',
        expectedSection:
            'DISCARD PHASE'
    },
    {
        question:
            'How do stack limits work for status effects?',
        expectedSection:
            'STACK LIMITS'
    },
    {
        question:
            'What is a persistent status effect?',
        expectedSection:
            'PERSISTENT STATUS EFFECTS'
    },
    {
        question:
            'How can status effects be removed?',
        expectedSection:
            'REMOVING STATUS EFFECTS'
    },
    {
        question:
            'What is an attack modifier?',
        expectedSection:
            'Attack modifiers'
    },
    {
        question:
            'What types of damage are there?',
        expectedSection:
            'Damage types'
    },
    {
        question:
            'How does a 2v2 team game work?',
        expectedSection:
            '2V2 TEAM GAME'
    },
    {
        question:
            'How does King of the Hill work?',
        expectedSection:
            'KING OF THE HILL'
    },
    {
        question:
            'What temperature should I bake a pizza at?',
        expectNoResults:
            true
    },
    {
        question:
            'What is the capital of Michigan?',
        expectNoResults:
            true
    },
    {
        question:
            'How many cards are in a Magic the Gathering deck?',
        expectNoResults:
            true
    },
    {
        question:
            'Who won the Super Bowl?',
        expectNoResults:
            true
    }
];

async function main(): Promise<void> {
    await loadRulebookIndex();

    let _top1Correct = 0;
    let _top10Correct = 0;
    let _domainTests = 0;

    let _outOfDomainPassed = 0;
    let _outOfDomainTests = 0;

    const _failedCases: string[] = [];

    console.log(
        '\nDice Throne Retrieval Evaluation\n'
    );

    console.log(
        '='.repeat(70)
    );

    for (
        const _test of
        _evalCases
    ) {
        console.log(
            `\nQuestion: ${_test.question}`
        );

        /*
         * DOMAIN CLASSIFICATION
         */
        const _isDiceThrone =
            await isDiceThroneQuestion(
                _test.question
            );

        console.log(
            `Domain classification: ${_isDiceThrone
                ? 'Dice Throne'
                : 'Out of domain'
            }`
        );

        /*
         * OUT-OF-DOMAIN
         */
        if (
            _test.expectNoResults
        ) {
            _outOfDomainTests++;

            if (!_isDiceThrone) {
                _outOfDomainPassed++;

                console.log(
                    'Result: PASS'
                );

                console.log(
                    'Domain classifier rejected question.'
                );

                console.log(
                    '-'.repeat(70)
                );

                continue;
            }

            console.log(
                'Domain classifier allowed question.'
            );

            const _retrievalQuery =
                await rewriteQuery(
                    _test.question
                );

            console.log(
                `Retrieval query: ${_retrievalQuery}`
            );

            const _results =
                await findRulebookChunks(
                    _test.question,
                    _retrievalQuery,
                    10
                );

            const _topResult =
                _results[0];

            console.log(
                'Result: FAIL'
            );

            console.log(
                'Expected: out-of-domain rejection'
            );

            if (_topResult) {
                console.log(
                    `Top result: ${_topResult.section}`
                );

                console.log(
                    `Top score: ${_topResult.score.toFixed(4)}`
                );
            }

            _failedCases.push(
                _test.question
            );

            console.log(
                '-'.repeat(70)
            );

            continue;
        }

        /*
         * IN-DOMAIN
         */
        _domainTests++;

        if (!_isDiceThrone) {
            console.log(
                'Result: FAIL'
            );

            console.log(
                'Domain classifier incorrectly rejected an in-domain question.'
            );

            if (
                _test.expectedSection
            ) {
                console.log(
                    `Expected section: ${_test.expectedSection}`
                );
            }

            _failedCases.push(
                _test.question
            );

            console.log(
                '-'.repeat(70)
            );

            continue;
        }

        /*
         * QUERY REWRITE
         */
        const _retrievalQuery =
            await rewriteQuery(
                _test.question
            );

        console.log(
            `Retrieval query: ${_retrievalQuery}`
        );

        /*
         * DUAL-INPUT RETRIEVAL
         *
         * original question:
         * lexical + relationship signals
         *
         * rewritten query:
         * semantic + structure signals
         */
        const _results =
            await findRulebookChunks(
                _test.question,
                _retrievalQuery,
                10
            );

        const _topResult =
            _results[0];

        const _expectedSection =
            _test.expectedSection;

        if (!_expectedSection) {
            throw new Error(
                `Missing expectedSection for: ${_test.question}`
            );
        }

        const _expected =
            _expectedSection
                .toLowerCase();

        /*
         * TOP-1
         */
        const _top1Match =
            Boolean(
                _topResult &&
                _topResult.section
                    .toLowerCase()
                    .includes(
                        _expected
                    )
            );

        if (_top1Match) {
            _top1Correct++;
        }

        /*
         * TOP-10
         */
        const _matchIndex =
            _results.findIndex(
                (result) =>
                    result.section
                        .toLowerCase()
                        .includes(
                            _expected
                        )
            );

        const _foundInTop10 =
            _matchIndex !== -1;

        if (_foundInTop10) {
            _top10Correct++;
        }

        /*
         * DISPLAY
         */
        if (_top1Match) {
            console.log(
                'Result: PASS'
            );

            console.log(
                `Expected section: ${_expectedSection}`
            );

            console.log(
                `Top result: ${_topResult?.section}`
            );

            console.log(
                `Top score: ${_topResult?.score.toFixed(4)}`
            );
        } else if (
            _foundInTop10
        ) {
            console.log(
                'Result: PARTIAL'
            );

            console.log(
                `Expected section: ${_expectedSection}`
            );

            console.log(
                `Found at rank: ${_matchIndex + 1}`
            );

            if (_topResult) {
                console.log(
                    `Top result: ${_topResult.section}`
                );

                console.log(
                    `Top score: ${_topResult.score.toFixed(4)}`
                );
            }
        } else {
            console.log(
                'Result: FAIL'
            );

            console.log(
                `Expected section: ${_expectedSection}`
            );

            if (_topResult) {
                console.log(
                    `Top result: ${_topResult.section}`
                );

                console.log(
                    `Top score: ${_topResult.score.toFixed(4)}`
                );
            } else {
                console.log(
                    'No chunks retrieved.'
                );
            }

            _failedCases.push(
                _test.question
            );
        }

        console.log(
            '-'.repeat(70)
        );
    }

    /*
     * METRICS
     */
    const _top1Accuracy =
        _domainTests > 0
            ? (
                _top1Correct /
                _domainTests
            ) * 100
            : 0;

    const _top10Recall =
        _domainTests > 0
            ? (
                _top10Correct /
                _domainTests
            ) * 100
            : 0;

    const _outOfDomainAccuracy =
        _outOfDomainTests > 0
            ? (
                _outOfDomainPassed /
                _outOfDomainTests
            ) * 100
            : 0;

    /*
     * SUMMARY
     */
    console.log('\n');

    console.log(
        '='.repeat(70)
    );

    console.log(
        'Evaluation Summary'
    );

    console.log(
        '='.repeat(70)
    );

    console.log(
        `In-domain tests:         ${_domainTests}`
    );

    console.log(
        `Top-1 correct:           ${_top1Correct}`
    );

    console.log(
        `Top-10 correct:          ${_top10Correct}`
    );

    console.log();

    console.log(
        `Top-1 Accuracy:          ${_top1Accuracy.toFixed(1)}%`
    );

    console.log(
        `Top-10 Recall:           ${_top10Recall.toFixed(1)}%`
    );

    console.log();

    console.log(
        `Out-of-domain tests:     ${_outOfDomainTests}`
    );

    console.log(
        `Out-of-domain rejected:  ${_outOfDomainPassed}`
    );

    console.log(
        `Out-of-domain Accuracy:  ${_outOfDomainAccuracy.toFixed(1)}%`
    );

    if (
        _failedCases.length > 0
    ) {
        console.log();

        console.log(
            'Failed cases:'
        );

        for (
            const _question of
            _failedCases
        ) {
            console.log(
                `- ${_question}`
            );
        }
    }

    console.log();
}

main().catch(
    (_error) => {
        console.error(
            'Evaluation failed:',
            _error
        );

        process.exitCode = 1;
    }
);
