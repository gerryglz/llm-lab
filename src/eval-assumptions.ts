import { answerQuestion } from './answer.js';
import { loadRulebookIndex } from './rulebook-retrieval.js';

async function main(): Promise<void> {
    await loadRulebookIndex();

    const _result = await answerQuestion('How many CP can I spend per turn?');
    const _turnsSilenceIntoPermission =
        /\b(?:no (?:spending )?limit|unlimited|as much as you want)\b/i.test(
            _result.answer
        );
    const _hasMainPhaseRule = _result.citations.some((citation) =>
        citation.section.includes('MAIN PHASE')
    );
    const _hasCapacityRule = _result.citations.some((citation) =>
        /(?:maximum of 15 CP|Maximum CP Limit[\s\S]{0,180}\b15\s*CP\b)/i.test(
            citation.excerpt
        )
    );
    const _passed =
        _result.status === 'not-specified' &&
        !_turnsSilenceIntoPermission &&
        _result.evidence.strength === 'partial' &&
        _hasMainPhaseRule &&
        _hasCapacityRule;

    console.log(`Unstated-limit handling: ${_passed ? 'PASS' : 'FAIL'}`);
    console.log(`Status: ${_result.status}`);
    console.log(`Answer: ${_result.answer}`);
    console.log(`Evidence: ${_result.evidence.summary}`);
    console.log(`Sources: ${_result.citations.map((citation) => `p.${citation.page} ${citation.section}`).join('; ') || 'none'}`);

    if (!_passed) process.exitCode = 1;
}

main().catch((error) => {
    console.error('Assumption evaluation failed:', error);
    process.exitCode = 1;
});

