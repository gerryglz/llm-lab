import { answerQuestion } from './answer.js';
import { loadRulebookIndex } from './rulebook-retrieval.js';

async function main(): Promise<void> {
    await loadRulebookIndex();

    const _firstQuestion = "What's my starting hand?";
    const _first = await answerQuestion(_firstQuestion);
    const _followUp = await answerQuestion(
        'So do I need to shuffle first before I draw?',
        [
            { role: 'user', content: _firstQuestion },
            { role: 'assistant', content: _first.answer }
        ]
    );

    const _passed =
        _first.status === 'answered' &&
        _followUp.status === 'answered' &&
        /shuffle/i.test(_followUp.answer) &&
        _followUp.citations.some((citation) => citation.page === 2);

    console.log(`Conversation follow-up: ${_passed ? 'PASS' : 'FAIL'}`);
    console.log(`First answer: ${_first.answer}`);
    console.log(`Follow-up answer: ${_followUp.answer}`);
    console.log(`Sources: ${_followUp.citations.map((citation) => `p.${citation.page} ${citation.section}`).join('; ') || 'none'}`);

    if (!_passed) process.exitCode = 1;
}

main().catch((error) => {
    console.error('Conversation evaluation failed:', error);
    process.exitCode = 1;
});

