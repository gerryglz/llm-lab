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
    // ==================================================
    // TURN PHASES: INDIRECT / CONVERSATIONAL
    // ==================================================

    {
        question:
            'Before I gain CP or draw anything, is there something I have to resolve?',
        expectedSection:
            'UPKEEP PHASE'
    },
    {
        question:
            'What comes before the Income Phase?',
        expectedSection:
            'UPKEEP PHASE'
    },
    {
        question:
            'When exactly do I get my card for the turn?',
        expectedSection:
            'INCOME PHASE'
    },
    {
        question:
            'Does the starting player draw a card before taking their first actions?',
        expectedSection:
            'INCOME PHASE'
    },
    {
        question:
            'When am I allowed to spend CP on upgrades?',
        expectedSection:
            'MAIN PHASE (1)'
    },
    {
        question:
            'Can I play an upgrade before I roll my dice?',
        expectedSection:
            'MAIN PHASE (1)'
    },
    {
        question:
            'How many total rolls can I make while trying to activate an attack?',
        expectedSection:
            'OFFENSIVE ROLL PHASE'
    },
    {
        question:
            'Can I keep some dice and reroll the others?',
        expectedSection:
            'OFFENSIVE ROLL PHASE'
    },
    {
        question:
            'Do I need to roll to choose a target in a one versus one game?',
        expectedSection:
            'TARGETING ROLL PHASE'
    },
    {
        question:
            'If there are three players, when do I figure out who I am attacking?',
        expectedSection:
            'TARGETING ROLL PHASE'
    },
    {
        question:
            'Does the defender get multiple attempts to roll their defense?',
        expectedSection:
            'DEFENSIVE ROLL PHASE'
    },
    {
        question:
            'When is the defending player allowed to use their Defensive Ability?',
        expectedSection:
            'DEFENSIVE ROLL PHASE'
    },
    {
        question:
            'Can I play more cards after attacking?',
        expectedSection:
            'MAIN PHASE (2)'
    },
    {
        question:
            'What happens after my second Main Phase?',
        expectedSection:
            'DISCARD PHASE'
    },
    {
        question:
            'I have eight cards when my turn ends. What happens?',
        expectedSection:
            'DISCARD PHASE'
    },

    // ==================================================
    // STATUS EFFECTS
    // ==================================================

    {
        question:
            'Can I have more copies of a status effect than its normal limit?',
        expectedSection:
            'INCREASING STACK LIMIT'
    },
    {
        question:
            'What does the number next to a status effect stack mean?',
        expectedSection:
            'STACK LIMITS'
    },
    {
        question:
            'Are persistent status effects removed automatically?',
        expectedSection:
            'PERSISTENT STATUS EFFECTS'
    },
    {
        question:
            'Can a status effect be spent by the player who has it?',
        expectedSection:
            'SPENDABLE STATUS EFFECTS'
    },
    {
        question:
            'What kind of status effect can interrupt another action?',
        expectedSection:
            'INTERRUPTING STATUS EFFECTS'
    },
    {
        question:
            'What makes a status effect unique?',
        expectedSection:
            'UNIQUE STATUS EFFECTS'
    },
    {
        question:
            'How do I get rid of a status effect token?',
        expectedSection:
            'REMOVING STATUS EFFECTS'
    },

    // ==================================================
    // DAMAGE / ATTACKS
    // ==================================================

    {
        question:
            'What is the difference between defendable and undefendable damage?',
        expectedSection:
            'Damage types'
    },
    {
        question:
            'What kind of damage ignores a Defensive Ability?',
        expectedSection:
            'Damage types'
    },
    {
        question:
            'What does collateral damage mean?',
        expectedSection:
            'Damage types'
    },
    {
        question:
            'What can modify the damage from an attack?',
        expectedSection:
            'Attack modifiers'
    },
    {
        question:
            'When can attack modifiers be used?',
        expectedSection:
            'Attack modifiers'
    },

    // ==================================================
    // MULTIPLAYER
    // ==================================================

    {
        question:
            'What changes when I play with five people?',
        expectedSection:
            '5-6 player games'
    },
    {
        question:
            'How does priority work with more than two players?',
        expectedSection:
            '5-6 player games'
    },
    {
        question:
            'Do teammates share health in a team game?',
        expectedSection:
            '2V2 TEAM GAME'
    },
    {
        question:
            'How do teammates win in two versus two?',
        expectedSection:
            '2V2 TEAM GAME'
    },
    {
        question:
            'How do I score points in King of the Hill?',
        expectedSection:
            'KING OF THE HILL'
    },
    {
        question:
            'What changes when playing the King of the Hill mode?',
        expectedSection:
            'KING OF THE HILL'
    },

    // ==================================================
    // SETUP
    // ==================================================

    {
        question:
            'How many cards do I start the game with?',
        expectedSection:
            'Game setup'
    },
    {
        question:
            'What do I do with my deck before the game begins?',
        expectedSection:
            'Game setup'
    },
    {
        question:
            'How is the first player determined?',
        expectedSection:
            'Game setup'
    },

    // ==================================================
    // AMBIGUOUS / MULTI-CONCEPT
    // ==================================================

    {
        question:
            'At the start of my turn, what happens before I draw?',
        expectedSection:
            'UPKEEP PHASE'
    },
    {
        question:
            'After attacking, can I spend CP before I discard?',
        expectedSection:
            'MAIN PHASE (2)'
    },
    {
        question:
            'If I attack someone, when do they roll and how many times?',
        expectedSection:
            'DEFENSIVE ROLL PHASE'
    },
    {
        question:
            'If I fail to activate an ability on my first roll, am I done?',
        expectedSection:
            'OFFENSIVE ROLL PHASE'
    },

    // ==================================================
    // NEGATIVE / TRICK WORDING
    // ==================================================

    {
        question:
            'Do I always draw a card at the start of every turn?',
        expectedSection:
            'INCOME PHASE'
    },
    {
        question:
            'Is the Targeting Roll Phase always required?',
        expectedSection:
            'TARGETING ROLL PHASE'
    },
    {
        question:
            'Can the attacker activate two Offensive Abilities from one roll?',
        expectedSection:
            'OFFENSIVE ROLL PHASE'
    },
    {
        question:
            'Can I end my turn holding seven cards?',
        expectedSection:
            'DISCARD PHASE'
    },

    // ==================================================
    // OUT OF DOMAIN
    // ==================================================

    {
        question:
            'How many lands should I run in my Commander deck?',
        expectNoResults:
            true
    },
    {
        question:
            'How many actions do you get in Dungeons and Dragons combat?',
        expectNoResults:
            true
    },
    {
        question:
            'What temperature should chicken reach before eating it?',
        expectNoResults:
            true
    },
    {
        question:
            'Who is the current president of the United States?',
        expectNoResults:
            true
    },
    {
        question:
            'What is the best opening move in chess?',
        expectNoResults:
            true
    },

    // ==================================================
    // DICE-THRONE-SOUNDING BUT UNSUPPORTED
    // ==================================================

    {
        question:
            'Which Dice Throne hero has the highest win rate?',
        expectNoResults:
            true
    },
    {
        question:
            'What is the best Dice Throne hero for beginners?',
        expectNoResults:
            true
    },
    {
        question:
            'What is the strongest Dice Throne character?',
        expectNoResults:
            true
    },
    {
        question:
            'How much does Dice Throne cost?',
        expectNoResults:
            true
    },
    {
        question:
            'When was Dice Throne first released?',
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
        '\nDice Throne HARD Retrieval Evaluation\n'
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
         * OUT-OF-DOMAIN TESTS
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
                'Result: FAIL'
            );

            console.log(
                'Domain classifier allowed unsupported question.'
            );

            _failedCases.push(
                _test.question
            );

            console.log(
                '-'.repeat(70)
            );

            continue;
        }

        /*
         * IN-DOMAIN TESTS
         */
        _domainTests++;

        if (!_isDiceThrone) {
            console.log(
                'Result: FAIL'
            );

            console.log(
                'Domain classifier rejected valid Dice Throne question.'
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
                `Missing expectedSection: ${_test.question}`
            );
        }

        const _expected =
            _expectedSection
                .toLowerCase();

        /*
         * TOP-1 ACCURACY
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

        /*
         * TOP-10 RECALL
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

        if (_top1Match) {
            _top1Correct++;
        }

        if (_foundInTop10) {
            _top10Correct++;
        }

        /*
         * RESULT DISPLAY
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
        'HARD Evaluation Summary'
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
            'Hard evaluation failed:',
            _error
        );

        process.exitCode = 1;
    }
);
