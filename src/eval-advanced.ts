import { answerQuestion } from './answer.js';
import { loadRulebookIndex } from './rulebook-retrieval.js';

type AdvancedCase = {
    question: string;
    terms: string[];
};

const _cases: readonly AdvancedCase[] = [
    {
        question: 'If I must look at the top five cards but only three remain, do I shuffle first?',
        terms: ['no', 'shuffle']
    },
    {
        question: 'Can I play a Level III hero upgrade over its Level II upgrade?',
        terms: ['yes']
    },
    {
        question: 'Can Twice as Wild change only one die?',
        terms: ['yes']
    },
    {
        question: 'When can I play a card that says When Attacked?',
        terms: ['target']
    },
    {
        question: 'Can a status-removal effect be retargeted after an original status target is spent?',
        terms: ['yes']
    }
] as const;

async function main(): Promise<void> {
    await loadRulebookIndex();
    let _passed = 0;

    console.log('\nAdvanced Rules Evaluation\n');

    for (const _test of _cases) {
        const _result = await answerQuestion(_test.question);
        const _answer = _result.answer.toLowerCase();
        const _usesAdvancedSource = _result.citations.some(
            (citation) =>
                citation.sourceId === 'advanced-rules' &&
                citation.sourceTitle ===
                    'Official Dice Throne Rulings and Clarifications'
        );
        const _hasTerms = _test.terms.every((term) =>
            _answer.includes(term.toLowerCase())
        );
        const _pass =
            _result.status === 'answered' && _usesAdvancedSource && _hasTerms;

        if (_pass) _passed++;

        console.log(`${_pass ? 'PASS' : 'FAIL'} | ${_test.question}`);
        console.log(`  ${_result.answer}`);
        console.log(
            `  ${_result.citations.map((citation) =>
                `${citation.sourceTitle} p.${citation.page}`
            ).join('; ') || 'No citation'}`
        );
    }

    console.log(`\nAdvanced rulings: ${_passed}/${_cases.length}`);

    if (_passed !== _cases.length) process.exitCode = 1;
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

