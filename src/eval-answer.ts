import { answerQuestion, type AnswerResult } from './answer.js';
import { loadRulebookIndex } from './rulebook-retrieval.js';

type AnswerEvalCase = {
    question: string;
    expectedStatus: AnswerResult['status'];
    requiredAnswerTerms?: string[];
    expectedSection?: string;
};

const _evalCases: readonly AnswerEvalCase[] = [
    {
        question: 'What is the maximum hand size?',
        expectedStatus: 'answered',
        requiredAnswerTerms: ['6'],
        expectedSection: 'DISCARD PHASE'
    },
    {
        question: 'How many roll attempts do I get during an attack?',
        expectedStatus: 'answered',
        requiredAnswerTerms: ['3'],
        expectedSection: 'OFFENSIVE ROLL PHASE'
    },
    {
        question: 'What happens during the Income Phase?',
        expectedStatus: 'answered',
        requiredAnswerTerms: ['draw'],
        expectedSection: 'INCOME PHASE'
    },
    {
        question: 'How do I remove a status effect?',
        expectedStatus: 'answered',
        expectedSection: 'REMOVING STATUS EFFECTS'
    },
    {
        question: 'Do teammates share health in a 2v2 game?',
        expectedStatus: 'answered',
        requiredAnswerTerms: ['health'],
        expectedSection: '2V2 TEAM GAME'
    },
    {
        question: 'What is the strongest Dice Throne hero?',
        expectedStatus: 'unsupported'
    },
    {
        question: 'How much does Dice Throne cost?',
        expectedStatus: 'unsupported'
    },
    {
        question: 'How many lands go in a Commander deck?',
        expectedStatus: 'unsupported'
    },
    {
        question: 'Who won the Super Bowl?',
        expectedStatus: 'unsupported'
    }
] as const;

function includesTerms(answer: string, terms: string[]): boolean {
    const _answer = answer.toLowerCase();
    return terms.every((term) => _answer.includes(term.toLowerCase()));
}

async function main(): Promise<void> {
    await loadRulebookIndex();

    let _statusCorrect = 0;
    let _contentCorrect = 0;
    let _citationCorrect = 0;
    let _answeredCases = 0;

    console.log('\nDice Throne Grounded Answer Evaluation\n');

    for (const _test of _evalCases) {
        const _result = await answerQuestion(_test.question);
        const _statusMatch = _result.status === _test.expectedStatus;

        if (_statusMatch) _statusCorrect++;

        if (_test.expectedStatus === 'answered') {
            _answeredCases++;

            const _contentMatch =
                _statusMatch &&
                includesTerms(_result.answer, _test.requiredAnswerTerms ?? []);

            const _citationMatch =
                _statusMatch &&
                Boolean(
                    _test.expectedSection &&
                    _result.citations.some((citation) =>
                        citation.section
                            .toLowerCase()
                            .includes(_test.expectedSection!.toLowerCase())
                    )
                );

            if (_contentMatch) _contentCorrect++;
            if (_citationMatch) _citationCorrect++;
        }

        console.log(`Question: ${_test.question}`);
        console.log(`Status: ${_result.status} (${_statusMatch ? 'PASS' : 'FAIL'})`);
        console.log(`Answer: ${_result.answer}`);
        console.log(
            `Sources: ${_result.citations
                .map((citation) => `p.${citation.page} ${citation.section}`)
                .join('; ') || 'none'}`
        );
        console.log('-'.repeat(70));
    }

    const _percent = (value: number, total: number) =>
        total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';

    console.log('\nGrounded Answer Evaluation Summary');
    console.log('='.repeat(70));
    console.log(`Status accuracy:          ${_percent(_statusCorrect, _evalCases.length)}%`);
    console.log(`Answer content checks:    ${_percent(_contentCorrect, _answeredCases)}%`);
    console.log(`Citation accuracy:        ${_percent(_citationCorrect, _answeredCases)}%`);
}

main().catch((_error) => {
    console.error('Answer evaluation failed:', _error);
    process.exitCode = 1;
});

