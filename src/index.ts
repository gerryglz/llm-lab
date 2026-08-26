import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import { answerQuestion } from './answer.js';
import { loadRulebookIndex } from './rulebook-retrieval.js';

async function main(): Promise<void> {
    await loadRulebookIndex();

    const _readline = createInterface({ input, output });

    console.log('\nDice Throne Rules Assistant');
    console.log('Type "exit" to quit.\n');

    try {
        while (true) {
            const _question = (await _readline.question('You: ')).trim();

            if (_question.toLowerCase() === 'exit') break;
            if (!_question) continue;

            try {
                const _result = await answerQuestion(_question);

                console.log(`\nAssistant: ${_result.answer}`);

                if (_result.citations.length > 0) {
                    console.log('\nSources:');

                    for (const _citation of _result.citations) {
                        console.log(
                            `- Page ${_citation.page}, ${_citation.section} [${_citation.id}]`
                        );
                    }
                }
            } catch (_error) {
                console.error('\nFailed to answer question:', _error);
            }

            console.log();
        }
    } finally {
        _readline.close();
    }
}

main().catch((_error) => {
    console.error(_error);
    process.exitCode = 1;
});


