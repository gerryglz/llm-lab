import { answerQuestion } from './answer.js';
import { loadRulebookIndex } from './rulebook-retrieval.js';

type EvidenceCase = {
    question: string;
    expectedStatus: 'answered' | 'unsupported';
    expectedRole?: 'primary-rule' | 'official-clarification';
};

const _cases: readonly EvidenceCase[] = [
    {
        question: 'What is the maximum hand size?',
        expectedStatus: 'answered',
        expectedRole: 'primary-rule'
    },
    {
        question: 'Can Twice as Wild change only one die?',
        expectedStatus: 'answered',
        expectedRole: 'official-clarification'
    },
    {
        question: 'What is the strongest Dice Throne hero?',
        expectedStatus: 'unsupported'
    }
] as const;

async function main(): Promise<void> {
    await loadRulebookIndex();
    let _passed = 0;

    console.log('\nEvidence Explanation Evaluation\n');

    for (const _test of _cases) {
        const _result = await answerQuestion(_test.question);
        const _statusMatches = _result.status === _test.expectedStatus;
        const _evidenceMatches = _test.expectedStatus === 'unsupported'
            ? _result.evidence.strength === 'none' && _result.citations.length === 0
            : _result.evidence.strength !== 'none' &&
                _result.evidence.summary.length > 20 &&
                _result.citations.some((citation) =>
                    citation.role === _test.expectedRole &&
                    citation.excerpt.length > 20 &&
                    citation.relevance > 0
                );
        const _pass = _statusMatches && _evidenceMatches;

        if (_pass) _passed++;

        console.log(`${_pass ? 'PASS' : 'FAIL'} | ${_test.question}`);
        console.log(
            `  ${_result.evidence.strength.toUpperCase()} — ${_result.evidence.summary}`
        );
    }

    console.log(`\nEvidence explanations: ${_passed}/${_cases.length}`);

    if (_passed !== _cases.length) process.exitCode = 1;
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

