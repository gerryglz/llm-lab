import fs from 'node:fs/promises';
import { PDFParse } from 'pdf-parse';

import type { DocumentChunk, DocumentPage } from './document.js';

const _sourceTitle = 'Official Dice Throne Rulings and Clarifications';
const _majorHeadings = [
    'General Concepts',
    'Turn Order',
    'Advanced Concepts',
    'Game Modes',
    'Heroes',
    'Dice Throne Adventures',
    'Dice Throne Missions'
] as const;

async function extractPdfText(filePath: string): Promise<string> {
    const _parser = new PDFParse({ data: await fs.readFile(filePath) });

    try {
        return (await _parser.getText()).text;
    } finally {
        await _parser.destroy();
    }
}

function parsePages(text: string): DocumentPage[] {
    return text
        .split(/-- \d+ of \d+ --/)
        .map((content, index) => ({
            page: index + 1,
            content: content
                .replace(/^\s*\d+\s*$/m, '')
                .replace(/\s+/g, ' ')
                .trim()
        }))
        .filter((page) => page.content.length >= 40);
}

function findSection(content: string, current: string): string {
    for (const _heading of _majorHeadings) {
        if (content.includes(_heading)) return _heading;
    }

    const _specific = content.match(
        /(?:^|\s)(?:Cards|Combat Points|Dice Rolling|Status Effects|Key Terms|Timing|Roll Phase|Targeting Roll Phase|Defensive Roll Phase|Discard Phase)(?=\s|$)/i
    )?.[0]?.trim();

    return _specific ?? current;
}

function chunkPages(pages: DocumentPage[], chunkSize = 1400): DocumentChunk[] {
    const _chunks: DocumentChunk[] = [];
    let _currentSection = 'Introduction';

    for (const _page of pages) {
        _currentSection = findSection(_page.content, _currentSection);

        for (let _start = 0, _part = 1; _start < _page.content.length; _part++) {
            let _end = Math.min(_start + chunkSize, _page.content.length);
            const _boundary = _page.content.lastIndexOf('. ', _end);

            if (_boundary > _start + 500 && _end < _page.content.length) {
                _end = _boundary + 1;
            }

            const _content = _page.content.slice(_start, _end).trim();

            if (_content.length >= 40) {
                _chunks.push({
                    id: `advanced-page-${_page.page}-${_part}`,
                    sourceId: 'advanced-rules',
                    sourceTitle: _sourceTitle,
                    page: _page.page,
                    section: _currentSection,
                    content: _content,
                    quality: 'clean'
                });
            }

            if (_end >= _page.content.length) break;
            _start = Math.max(_end - 180, _start + 1);
        }
    }

    return _chunks;
}

async function main(): Promise<void> {
    const _text = await extractPdfText(
        './documents/dice-throne-advanced-rules.pdf'
    );
    const _pages = parsePages(_text);
    const _chunks = chunkPages(_pages);

    await fs.writeFile(
        './documents/dice-throne-advanced-rules.txt',
        _text,
        'utf8'
    );
    await fs.writeFile(
        './documents/dice-throne-advanced-rules-chunks.json',
        JSON.stringify(_chunks, null, 2),
        'utf8'
    );

    console.log(`Advanced-rules pages detected: ${_pages.length}`);
    console.log(`Advanced-rules chunks created: ${_chunks.length}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

