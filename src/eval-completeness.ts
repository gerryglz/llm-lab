import { answerQuestion } from './answer.js';
import { loadRulebookIndex } from './rulebook-retrieval.js';

async function main(): Promise<void> {
    await loadRulebookIndex();

    const _timing = await answerQuestion('When can I sell unwanted cards?');
    const _sections = _timing.citations.map((citation) => citation.section);
    const _timingPass =
        _timing.status === 'answered' &&
        /Main Phase \(1\)/i.test(_timing.answer) &&
        /Main Phase \(2\)/i.test(_timing.answer) &&
        /Discard Phase/i.test(_timing.answer) &&
        /must sell/i.test(_timing.answer) &&
        _sections.some((section) => section.includes('MAIN PHASE (1)')) &&
        _sections.some((section) => section.includes('MAIN PHASE (2)')) &&
        _sections.some((section) => section.includes('DISCARD PHASE'));

    const _discard = await answerQuestion(
        'Do I gain CP when I discard down to six cards?'
    );
    const _discardPass =
        _discard.status === 'answered' &&
        /1 CP/i.test(_discard.answer) &&
        _discard.citations.some((citation) =>
            citation.section.includes('DISCARD PHASE')
        );

    console.log(`Complete selling windows: ${_timingPass ? 'PASS' : 'FAIL'}`);
    console.log(`Answer: ${_timing.answer}`);
    console.log(`Sources: ${_sections.join('; ') || 'none'}`);
    console.log(`Discard-down rule: ${_discardPass ? 'PASS' : 'FAIL'}`);
    console.log(`Answer: ${_discard.answer}`);

    if (!_timingPass || !_discardPass) process.exitCode = 1;
}

main().catch((error) => {
    console.error('Completeness evaluation failed:', error);
    process.exitCode = 1;
});

