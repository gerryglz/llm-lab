type EmbeddingResponse = {
    data: {
        embedding: number[];
    }[];
};

async function _createEmbedding(
    input: string
): Promise<number[]> {
    const _response = await fetch(
        'http://127.0.0.1:1234/v1/embeddings',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'text-embedding-nomic-embed-text-v1.5',
                input
            })
        }
    );

    if (!_response.ok) {
        throw new Error(
            `Embedding request failed: ${_response.status}`
        );
    }

    const _data =
        (await _response.json()) as EmbeddingResponse;

    const _embedding = _data.data[0]?.embedding;

    if (!_embedding) {
        throw new Error('No embedding returned.');
    }

    return _embedding;
}

function _cosineSimilarity(
    a: number[],
    b: number[]
): number {
    if (a.length !== b.length) {
        throw new Error('Embedding dimensions do not match.');
    }

    let _dotProduct = 0;
    let _magnitudeA = 0;
    let _magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
        const _a = a[i] ?? 0;
        const _b = b[i] ?? 0;

        _dotProduct += _a * _b;
        _magnitudeA += _a * _a;
        _magnitudeB += _b * _b;
    }

    return (
        _dotProduct /
        (Math.sqrt(_magnitudeA) * Math.sqrt(_magnitudeB))
    );
}

const _question =
    await _createEmbedding(
        'search_query: How much currency do I receive at the beginning of my turn?'
    );

const _incomeRule =
    await _createEmbedding(
        'search_document: Income Phase: At the beginning of your turn, gain 1 CP (Command Point, the game currency) and draw 1 card.'
    );

const _discardRule =
    await _createEmbedding(
        'search_document: At the end of the turn, a player must discard down to a maximum hand size of 6 cards.'
    );

console.log(
    'Income similarity:',
    _cosineSimilarity(_question, _incomeRule)
);

console.log(
    'Discard similarity:',
    _cosineSimilarity(_question, _discardRule)
);
