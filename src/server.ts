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
    _server.listen(_port, _host, () => {
        console.log(`Dice Throne API ready at http://${_host}:${_port}`);
    });
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

