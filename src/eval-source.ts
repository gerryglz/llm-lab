import fs from 'node:fs/promises';

import type { DocumentChunk } from './document.js';

type SourceExpectation = {
    chunkId: string;
    description: string;
    requiredText: string;
};

const _expectations: readonly SourceExpectation[] = [
    { chunkId: 'page-2-2', description: '1v1 starting Health', requiredText: 'starting Health to 50' },
    { chunkId: 'page-2-2', description: 'starting CP', requiredText: 'starting CP to 2' },
    { chunkId: 'page-2-2', description: 'starting hand', requiredText: 'top 4 cards' },
    { chunkId: 'page-3-9', description: 'Income Phase resources', requiredText: 'Gain 1 CP & draw 1 card' },
    { chunkId: 'page-3-10', description: 'upgrade cost resource', requiredText: 'Spend CP to play' },
    { chunkId: 'page-3-10', description: 'card sale value', requiredText: 'gain 1 CP for each' },
    { chunkId: 'page-3-15', description: 'discard sale value', requiredText: 'for 1 CP each' },
    { chunkId: 'page-4-23', description: 'zero-cost cards', requiredText: 'costing 0 CP' },
    { chunkId: 'page-4-23', description: 'hero-card hand limit', requiredText: 'more than 6 cards' },
    { chunkId: 'page-4-23', description: 'hero-card sale value', requiredText: 'worth 1 CP when sold' },
    { chunkId: 'page-6-38', description: '2v2 shared Health', requiredText: 'beginning with 50 Health' },
    { chunkId: 'page-6-39', description: 'King of the Hill Health', requiredText: '35 Health' },
    { chunkId: 'page-6-39', description: 'King of the Hill bonus card', requiredText: 'draw 1 card' },
    { chunkId: 'page-6-40', description: 'minimum attack damage', requiredText: 'at least 1 dmg' },
    { chunkId: 'page-7-47', description: 'draw condition', requiredText: '0 Health' },
    { chunkId: 'page-7-47', description: 'detailed hand limit', requiredText: '6 or fewer cards' },
    { chunkId: 'page-7-48', description: 'detailed Income Phase', requiredText: 'maximum of 15 CP' },
    { chunkId: 'page-9-61', description: 'maximum CP', requiredText: 'maximum of 15 CP' },
    { chunkId: 'page-9-62', description: 'maximum healing', requiredText: 'up to 10 Health' },
    { chunkId: 'page-9-63', description: 'glossary sale value', requiredText: 'gain 1 CP' },
    { chunkId: 'page-9-64', description: 'spendable effect cost', requiredText: 'no CP cost' }
] as const;

async function main(): Promise<void> {
    const _raw = await fs.readFile('./documents/dice-throne-chunks.json', 'utf8');
    const _chunks = JSON.parse(_raw) as DocumentChunk[];
    const _byId = new Map(_chunks.map((chunk) => [chunk.id, chunk]));
    let _passed = 0;

    console.log('\nDice Throne Source Quality Evaluation\n');

    for (const _expectation of _expectations) {
        const _chunk = _byId.get(_expectation.chunkId);
        const _pass = Boolean(
            _chunk?.content
                .toLowerCase()
                .includes(_expectation.requiredText.toLowerCase())
        );

        if (_pass) _passed++;

        console.log(
            `${_pass ? 'PASS' : 'FAIL'} | ${_expectation.chunkId} | ` +
            `${_expectation.description} | ${_expectation.requiredText}`
        );
    }

    console.log('\nSource Quality Evaluation Summary');
    console.log('='.repeat(70));
    console.log(`Verified facts:           ${_passed}/${_expectations.length}`);
    console.log(`Source accuracy:          ${((_passed / _expectations.length) * 100).toFixed(1)}%`);

    if (_passed !== _expectations.length) {
        process.exitCode = 1;
    }
}

main().catch((_error) => {
    console.error('Source evaluation failed:', _error);
    process.exitCode = 1;
});

