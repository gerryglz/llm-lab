import fs from 'node:fs/promises';
import { PDFParse } from 'pdf-parse';

import type {
    DocumentChunk,
    DocumentPage,
    DocumentSection
} from './document.js';
import { CHUNK_CORRECTIONS } from './corrections.js';

const _sectionHeadings = [
    'GAME SETUP',
    'TURN PHASES',
    'OFFENSIVE ABILITY',
    'ACTIVATION REQUIREMENT',
    'REQUIREMENT',
    'STATUS EFFECTS',
    'COMPANIONS',
    'REMOVING STATUS EFFECTS',
    'SPENDABLE STATUS EFFECTS',
    'PERSISTENT STATUS EFFECTS',
    'STACK LIMITS',
    'INCREASING STACK LIMIT',
    'UNIQUE STATUS EFFECTS',
    'INTERRUPTING STATUS EFFECTS',
    'HERO CARDS',
    'ACTION CARDS',
    'HERO UPGRADES',
    'MAIN PHASE ACTION CARDS',
    'ROLL PHASE ACTION CARDS',
    'INSTANT ACTION CARDS',
    'ATTACK MODIFIERS',
    'DAMAGE TYPES',
    'TARGETING ROLL PHASE',
    '2V2 TEAM GAME',
    'KING OF THE HILL',
    '5-6 PLAYER GAMES'
];

async function extractPdfText(
    filePath: string
): Promise<string> {
    const _buffer = await fs.readFile(filePath);

    const _parser = new PDFParse({
        data: _buffer
    });

    try {
        const _result = await _parser.getText();

        return _result.text;
    } finally {
        await _parser.destroy();
    }
}

function parsePages(
    text: string
): DocumentPage[] {
    return text
        .split(/-- \d+ of \d+ --/)
        .map((content, index) => ({
            page: index + 1,
            content: content.trim()
        }))
        .filter((page) => page.content.length > 0);
}

function parseSections(
    pages: DocumentPage[]
): DocumentSection[] {
    const _sections: DocumentSection[] = [];

    for (const _page of pages) {
        const _lines = _page.content
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);

        let _title = `Page ${_page.page}`;
        let _content: string[] = [];

        for (const _line of _lines) {
            const _normalized = _line.toUpperCase();

            if (_sectionHeadings.includes(_normalized)) {
                if (_content.length > 0) {
                    _sections.push({
                        page: _page.page,
                        title: _title,
                        content: _content.join(' ')
                    });
                }

                _title = _line;
                _content = [];

                continue;
            }

            _content.push(_line);
        }

        if (_content.length > 0) {
            _sections.push({
                page: _page.page,
                title: _title,
                content: _content.join(' ')
            });
        }
    }

    return _sections;
}

function getChunkQuality(
    chunk: Omit<DocumentChunk, 'quality'>
): 'clean' | 'mixed' {
    const _content = chunk.content.toLowerCase();

    const _noiseSignals = [
        'deal dmg deal dmg deal dmg',
        'revolver',
        'bounty hunter',
        'gunslinger',
        'small straight',
        'large straight'
    ];

    const _noiseCount = _noiseSignals.filter(
        (signal) => _content.includes(signal)
    ).length;

    return _noiseCount >= 2
        ? 'mixed'
        : 'clean';
}

function createChunk(
    page: number,
    section: string,
    content: string,
    index: number
): DocumentChunk {
    const _chunk = {
        id: `page-${page}-${index}`,
        sourceId: 'core-rulebook' as const,
        sourceTitle: 'Dice Throne Rulebook v2.4.3',
        page,
        section,
        content
    };

    return {
        ..._chunk,
        quality: getChunkQuality(_chunk)
    };
}

function chunkSections(
    sections: DocumentSection[],
    chunkSize = 1200,
    overlapSentences = 2
): DocumentChunk[] {
    const _chunks: DocumentChunk[] = [];

    for (const _section of sections) {
        const _sentences = _section.content
            .split(/(?<=[.!?])\s+/)
            .map((sentence) => sentence.trim())
            .filter(Boolean);

        if (_sentences.length === 0) {
            continue;
        }

        let _currentSentences: string[] = [];
        let _currentLength = 0;

        for (const _sentence of _sentences) {
            const _sentenceLength = _sentence.length + 1;

            if (
                _currentLength + _sentenceLength > chunkSize &&
                _currentSentences.length > 0
            ) {
                const _content =
                    _currentSentences.join(' ').trim();

                if (_content.length >= 40) {
                    _chunks.push(
                        createChunk(
                            _section.page,
                            _section.title,
                            _content,
                            _chunks.length + 1
                        )
                    );
                }

                _currentSentences =
                    _currentSentences.slice(-overlapSentences);

                _currentLength =
                    _currentSentences.join(' ').length;
            }

            _currentSentences.push(_sentence);

            _currentLength += _sentenceLength;
        }

        const _remainingContent =
            _currentSentences.join(' ').trim();

        if (_remainingContent.length >= 40) {
            _chunks.push(
                createChunk(
                    _section.page,
                    _section.title,
                    _remainingContent,
                    _chunks.length + 1
                )
            );
        }
    }

    return _chunks;
}

function splitTurnPhasesSection(
    section: DocumentSection
): DocumentSection[] {
    if (section.title.toUpperCase() !== 'TURN PHASES') {
        return [section];
    }

    const _normalizedContent =
        section.content.toUpperCase();

    const _discardPhaseIndex =
        _normalizedContent.indexOf(
            '8 DISCARD PHASE'
        );

    const _offensiveAbilityIndex =
        _discardPhaseIndex >= 0
            ? _normalizedContent.indexOf(
                'OFFENSIVE ABILITY',
                _discardPhaseIndex
            )
            : -1;

    const _content =
        _offensiveAbilityIndex >= 0
            ? section.content.slice(
                0,
                _offensiveAbilityIndex
            )
            : section.content;

    const _matches = [
        ..._content.matchAll(
            /(\d+)\s+([A-Z][A-Z\s()0-9-]+?)\s*-\s*/g
        )
    ];

    if (_matches.length === 0) {
        return [section];
    }

    const _sections: DocumentSection[] = [];

    for (let i = 0; i < _matches.length; i++) {
        const _match = _matches[i];
        const _nextMatch = _matches[i + 1];

        if (
            !_match ||
            _match.index === undefined
        ) {
            continue;
        }

        const _start = _match.index;

        const _end =
            _nextMatch?.index ??
            _content.length;

        const _phaseContent =
            _content
                .slice(_start, _end)
                .trim();

        const _phaseName =
            _match[2]?.trim();

        if (!_phaseName || !_phaseContent) {
            continue;
        }

        _sections.push({
            page: section.page,
            title: `Turn phases > ${_phaseName}`,
            content: _phaseContent
        });
    }

    return _sections.length > 0
        ? _sections
        : [section];
}

function applyCorrections(
    sections: DocumentSection[]
): DocumentSection[] {
    return sections.map((section) => {
        let _content = section.content;

        for (const _correction of CHUNK_CORRECTIONS) {
            const _matchesPage =
                section.page === _correction.page;

            const _matchesSection =
                section.title
                    .toLowerCase()
                    .includes(
                        _correction.sectionIncludes.toLowerCase()
                    );

            if (!_matchesPage || !_matchesSection) {
                continue;
            }

            if (!_correction.pattern.test(_content)) {
                console.warn(
                    `Correction not matched: ` +
                    `page ${section.page} | ${section.title}`
                );

                continue;
            }

            _content = _content.replace(
                _correction.pattern,
                _correction.replace
            );

            console.log(
                `Applied correction: ` +
                `page ${section.page} | ${section.title}`
            );
        }

        return {
            ...section,
            content: _content
        };
    });
}

async function main(): Promise<void> {
    const _text = await extractPdfText(
        './documents/dice-throne-rulebook.pdf'
    );

    const _pages = parsePages(_text);

    const _sections = applyCorrections(
        parseSections(_pages)
            .flatMap(splitTurnPhasesSection)
    );

    for (const _section of _sections) {
        if (
            _section.title
                .toLowerCase()
                .startsWith('turn phases >')
        ) {
            console.log(
                `Page ${_section.page} | ${_section.title} | ${_section.content.length} chars`
            );
        }
    }

    const _discardSection = _sections.find(
        (section) =>
            section.title
                .toLowerCase()
                .includes('discard phase')
    );

    console.log('\nCorrected Discard Phase:');
    console.log(_discardSection?.content);

    const _chunks = chunkSections(_sections);

    await fs.writeFile(
        './documents/dice-throne-rulebook.txt',
        _text,
        'utf8'
    );

    await fs.writeFile(
        './documents/dice-throne-chunks.json',
        JSON.stringify(_chunks, null, 2),
        'utf8'
    );

    const _cleanCount =
        _chunks.filter(
            (chunk) => chunk.quality === 'clean'
        ).length;

    const _mixedCount =
        _chunks.filter(
            (chunk) => chunk.quality === 'mixed'
        ).length;

    console.log(`Pages detected: ${_pages.length}`);
    console.log(`Sections detected: ${_sections.length}`);
    console.log(`Total chunks: ${_chunks.length}`);
    console.log(`Clean chunks: ${_cleanCount}`);
    console.log(`Mixed chunks: ${_mixedCount}`);
    console.log('Extraction complete.');
}

main().catch(console.error);

