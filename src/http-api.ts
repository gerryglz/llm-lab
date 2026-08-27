import {
    createServer,
    type IncomingMessage,
    type Server,
    type ServerResponse
} from 'node:http';
import fs from 'node:fs/promises';

import { answerQuestion, type AnswerResult } from './answer.js';

export type AnswerProvider = (question: string) => Promise<AnswerResult>;
export type ReadinessProvider = () => Promise<boolean>;

const _maximumBodyBytes = 16 * 1024;
const _staticFiles = new Map<string, readonly [string, string]>([
    ['/', ['public/index.html', 'text/html; charset=utf-8']],
    ['/styles.css', ['public/styles.css', 'text/css; charset=utf-8']],
    ['/app.js', ['public/app.js', 'text/javascript; charset=utf-8']]
] as const);

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

async function sendStaticFile(
    response: ServerResponse,
    pathname: string
): Promise<boolean> {
    const _file = _staticFiles.get(pathname);
    if (!_file) return false;

    const [_path, _contentType] = _file;
    const _content = await fs.readFile(_path);
    response.writeHead(200, {
        'Content-Type': _contentType,
        'Cache-Control': 'no-cache'
    });
    response.end(_content);
    return true;
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

async function checkLmStudio(): Promise<boolean> {
    try {
        const _response = await fetch('http://127.0.0.1:1234/v1/models', {
            signal: AbortSignal.timeout(2000)
        });
        return _response.ok;
    } catch {
        return false;
    }
}

async function handleRequest(
    request: IncomingMessage,
    response: ServerResponse,
    answer: AnswerProvider,
    readiness: ReadinessProvider
): Promise<void> {
    const _url = new URL(request.url ?? '/', 'http://localhost');

    if (request.method === 'GET' && await sendStaticFile(response, _url.pathname)) {
        return;
    }

    if (request.method === 'GET' && _url.pathname === '/api/health') {
        const _modelReady = await readiness();
        sendJson(response, _modelReady ? 200 : 503, {
            status: _modelReady ? 'ready' : 'waiting',
            service: 'dice-throne-rules-assistant',
            dependencies: {
                rulebookIndex: 'ready',
                lmStudio: _modelReady ? 'ready' : 'unavailable'
            }
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
    answer: AnswerProvider = answerQuestion,
    readiness: ReadinessProvider = checkLmStudio
): Server {
    return createServer((request, response) => {
        void handleRequest(request, response, answer, readiness);
    });
}

