import type { AddressInfo } from 'node:net';

import type { AnswerResult } from './answer.js';
import type { ConversationTurn } from './conversation.js';
import { createHttpApi } from './http-api.js';

const _fixture: AnswerResult = {
    status: 'answered',
    answer: 'A test answer.',
    claims: [{ text: 'A test answer.', sourceIds: ['page-1-1'] }],
    evidence: {
        strength: 'high',
        summary: 'A primary rulebook passage directly supports this answer.'
    },
    citations: [
        {
            id: 'page-1-1',
            sourceId: 'core-rulebook',
            sourceTitle: 'Dice Throne Rulebook v2.4.3',
            page: 1,
            section: 'TEST',
            role: 'primary-rule',
            excerpt: 'A directly supporting test passage.',
            relevance: 0.9
        }
    ],
    retrievalQuery: 'test question'
};

async function main(): Promise<void> {
    const _questions: string[] = [];
    const _histories: Array<readonly ConversationTurn[]> = [];
    const _server = createHttpApi(
        async (question, history = []) => {
            _questions.push(question);
            _histories.push(history);
            return _fixture;
        },
        async () => true
    );

    await new Promise<void>((resolve) => {
        _server.listen(0, '127.0.0.1', resolve);
    });

    try {
        const _address = _server.address() as AddressInfo;
        const _baseUrl = `http://127.0.0.1:${_address.port}`;

        const _health = await fetch(`${_baseUrl}/api/health`);
        const _healthBody = await _health.json() as { status?: string };
        const _healthPass = _health.status === 200 &&
            _healthBody.status === 'ready';

        const _home = await fetch(_baseUrl);
        const _homeText = await _home.text();
        const _homePass = _home.status === 200 &&
            _home.headers.get('content-type')?.includes('text/html') === true &&
            _homeText.includes('Dice Throne Rules');

        const _clientScript = await fetch(`${_baseUrl}/app.js`);
        const _clientPass = _clientScript.status === 200 &&
            _clientScript.headers.get('content-type')?.includes('text/javascript') === true &&
            (await _clientScript.text()).includes('conversationHistory');

        const _chat = await fetch(`${_baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: '  test question  ' })
        });
        const _chatBody = await _chat.json() as AnswerResult;
        const _chatPass = _chat.status === 200 &&
            _chatBody.answer === _fixture.answer &&
            _chatBody.evidence.strength === 'high' &&
            _chatBody.claims?.[0]?.sourceIds[0] === 'page-1-1' &&
            _questions[0] === 'test question';

        const _followUp = await fetch(`${_baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question: 'What about that?',
                history: [
                    { role: 'user', content: 'What is my starting hand?' },
                    { role: 'assistant', content: 'Draw four cards.' }
                ]
            })
        });
        const _historyPass = _followUp.status === 200 &&
            _histories[1]?.length === 2 &&
            _histories[1]?.[0]?.role === 'user';

        const _invalid = await fetch(`${_baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: '   ' })
        });
        const _invalidPass = _invalid.status === 400;

        const _oversizedHistory = await fetch(`${_baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question: 'What about that?',
                history: Array.from({ length: 7 }, () => ({
                    role: 'user',
                    content: 'Earlier question'
                }))
            })
        });
        const _historyValidationPass = _oversizedHistory.status === 400;

        const _missing = await fetch(`${_baseUrl}/missing`);
        const _missingPass = _missing.status === 404;

        const _results = [
            ['Chat page', _homePass],
            ['Browser client asset', _clientPass],
            ['Health endpoint', _healthPass],
            ['Chat response contract', _chatPass],
            ['Conversation history contract', _historyPass],
            ['Conversation history limit', _historyValidationPass],
            ['Question validation', _invalidPass],
            ['Unknown route', _missingPass]
        ] as const;

        console.log('\nHTTP API Evaluation\n');
        for (const [_name, _pass] of _results) {
            console.log(`${_pass ? 'PASS' : 'FAIL'} | ${_name}`);
        }

        const _passed = _results.filter(([, pass]) => pass).length;
        console.log(`\nHTTP checks: ${_passed}/${_results.length}`);

        if (_passed !== _results.length) process.exitCode = 1;
    } finally {
        await new Promise<void>((resolve, reject) => {
            _server.close((error) => error ? reject(error) : resolve());
        });
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

