import fs from 'node:fs/promises';

import type { DocumentChunk } from './document.js';

import {
    createEmbeddings
} from './embeddings.js';

type IndexedDocumentChunk = DocumentChunk & {
    embedding: number[];
};

const _chunkFiles = [
    './documents/dice-throne-chunks.json',
    './documents/dice-throne-advanced-rules-chunks.json'
] as const;

const _indexFile =
    './documents/dice-throne-index.json';

const _batchSize = 10;

async function loadChunks(): Promise<DocumentChunk[]> {
    const _sources = await Promise.all(
        _chunkFiles.map(async (file) => {
            const _json = await fs.readFile(file, 'utf8');
            const _chunks = JSON.parse(_json) as Array<Partial<DocumentChunk> &
                Pick<DocumentChunk, 'id' | 'page' | 'section' | 'content' | 'quality'>>;
            const _isAdvanced = file.includes('advanced-rules');

            return _chunks.map((chunk): DocumentChunk => ({
                ...chunk,
                sourceId: chunk.sourceId ??
                    (_isAdvanced ? 'advanced-rules' : 'core-rulebook'),
                sourceTitle: chunk.sourceTitle ??
                    (_isAdvanced
                        ? 'Official Dice Throne Rulings and Clarifications'
                        : 'Dice Throne Rulebook v2.4.3')
            }));
        })
    );

    return _sources.flat();
}

async function buildIndex(
    chunks: DocumentChunk[]
): Promise<IndexedDocumentChunk[]> {
    const _indexedChunks: IndexedDocumentChunk[] = [];

    for (
        let _start = 0;
        _start < chunks.length;
        _start += _batchSize
    ) {
        const _batch = chunks.slice(
            _start,
            _start + _batchSize
        );

        console.log(
            `Embedding chunks ${_start + 1}-${_start + _batch.length} of ${chunks.length}...`
        );

        const _inputs = _batch.map(
            (chunk) =>
                `search_document: ${chunk.sourceTitle}\n${chunk.section}\n${chunk.content}`
        );

        const _embeddings =
            await createEmbeddings(_inputs);

        if (_embeddings.length !== _batch.length) {
            throw new Error(
                'Embedding count does not match chunk count.'
            );
        }

        for (let i = 0; i < _batch.length; i++) {
            const _chunk = _batch[i];
            const _embedding = _embeddings[i];

            if (!_chunk || !_embedding) {
                throw new Error(
                    `Missing chunk or embedding at batch index ${i}.`
                );
            }

            _indexedChunks.push({
                ..._chunk,
                embedding: _embedding
            });
        }
    }

    return _indexedChunks;
}

async function main(): Promise<void> {
    const _chunks = await loadChunks();

    console.log(
        `Loaded ${_chunks.length} chunks.`
    );

    const _indexedChunks =
        await buildIndex(_chunks);

    await fs.writeFile(
        _indexFile,
        JSON.stringify(
            _indexedChunks,
            null,
            2
        ),
        'utf8'
    );

    console.log(
        `Saved ${_indexedChunks.length} indexed chunks.`
    );

    console.log(
        `Index written to ${_indexFile}`
    );
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

