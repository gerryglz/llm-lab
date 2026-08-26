type EmbeddingResponse = {
    data: {
        embedding: number[];
    }[];
};

export async function createEmbedding(
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

export function cosineSimilarity(
    a: number[],
    b: number[]
): number {
    if (a.length !== b.length) {
        throw new Error(
            'Embedding dimensions do not match.'
        );
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

export async function createEmbeddings(
    inputs: string[]
): Promise<number[][]> {
    const _response = await fetch(
        'http://127.0.0.1:1234/v1/embeddings',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'text-embedding-nomic-embed-text-v1.5',
                input: inputs
            })
        }
    );

    if (!_response.ok) {
        throw new Error(
            `Embedding request failed: ${_response.status}`
        );
    }

    const _data = (await _response.json()) as {
        data: {
            index: number;
            embedding: number[];
        }[];
    };

    return _data.data
        .sort((a, b) => a.index - b.index)
        .map((item) => item.embedding);
}
