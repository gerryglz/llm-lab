import { createHttpApi } from './http-api.js';
import { loadRulebookIndex } from './rulebook-retrieval.js';

const _host = '127.0.0.1';
const _port = Number.parseInt(process.env.PORT ?? '3000', 10);

async function main(): Promise<void> {
    if (!Number.isInteger(_port) || _port < 0 || _port > 65535) {
        throw new Error('PORT must be an integer between 0 and 65535.');
    }

    await loadRulebookIndex();

    const _server = createHttpApi();
    await new Promise<void>((resolve, reject) => {
        const _onError = (error: Error) => reject(error);

        _server.once('error', _onError);
        _server.listen(_port, _host, () => {
            _server.off('error', _onError);
            console.log(`Dice Throne API ready at http://${_host}:${_port}`);
            resolve();
        });
    });
}

main().catch((error) => {
    if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'EADDRINUSE'
    ) {
        console.error(
            `Port ${_port} is already in use. Stop the previous Dice Throne server, then run npm run serve again.`
        );
        process.exitCode = 1;
        return;
    }

    console.error(error);
    process.exitCode = 1;
});

