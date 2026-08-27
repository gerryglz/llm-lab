import {
    createServer,
    type IncomingMessage,
    type Server,
    type ServerResponse
} from 'node:http';

import { answerQuestion, type AnswerResult } from './answer.js';

export type AnswerProvider = (question: string) => Promise<AnswerResult>;

const _maximumBodyBytes = 16 * 1024;

function sendJson(
    response: ServerResponse,
    statusCode: number,
    body: unknown
): void {
    response.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
    });
    response.end(JSON.stringify(body));
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
    const _chunks: Buffer[] = [];
    let _size = 0;

    for await (const _chunk of request) {
        const _buffer = Buffer.isBuffer(_chunk)
            ? _chunk
            : Buffer.from(_chunk);
        _size += _buffer.length;

        if (_size > _maximumBodyBytes) {
            throw new Error('request-too-large');
        }

        _chunks.push(_buffer);
    }

    return JSON.parse(Buffer.concat(_chunks).toString('utf8')) as unknown;
}

async function handleRequest(
    request: IncomingMessage,
    response: ServerResponse,
    answer: AnswerProvider
): Promise<void> {
    const _url = new URL(request.url ?? '/', 'http://localhost');

    if (request.method === 'GET' && _url.pathname === '/api/health') {
        sendJson(response, 200, {
            status: 'ready',
            service: 'dice-throne-rules-assistant'
        });
        return;
    }

    if (request.method !== 'POST' || _url.pathname !== '/api/chat') {
        sendJson(response, 404, {
            error: 'not-found',
            message: 'Use POST /api/chat to ask a rules question.'
        });
        return;
    }

    try {
        const _body = await readJsonBody(request);
        const _question = typeof _body === 'object' && _body !== null &&
            'question' in _body && typeof _body.question === 'string'
            ? _body.question.trim()
            : '';

        if (!_question) {
            sendJson(response, 400, {
                error: 'invalid-question',
                message: 'Provide a non-empty question string.'
            });
            return;
        }

        const _result = await answer(_question);
        sendJson(response, 200, _result);
    } catch (error) {
        const _knownClientError = error instanceof SyntaxError ||
            (error instanceof Error && error.message === 'request-too-large');

        if (_knownClientError) {
            sendJson(response, 400, {
                error: 'invalid-request',
                message: 'Send valid JSON no larger than 16 KB.'
            });
            return;
        }

        console.error('Chat request failed:', error);
        sendJson(response, 500, {
            error: 'answer-failed',
            message: 'The assistant could not answer this request.'
        });
    }
}

export function createHttpApi(
    answer: AnswerProvider = answerQuestion
): Server {
    return createServer((request, response) => {
        void handleRequest(request, response, answer);
    });
}

