export type ChunkCorrection = {
    page: number;
    sectionIncludes: string;
    pattern: RegExp;
    replace: string;
};

export const CHUNK_CORRECTIONS: ChunkCorrection[] = [
    {
        page: 3,
        sectionIncludes: 'DISCARD PHASE',
        pattern:
            /until you have\s+or fewer cards in your hand/i,
        replace:
            'until you have 6 or fewer cards in your hand'
    },
    {
        page: 4,
        sectionIncludes: 'Hero cards',
        pattern:
            /you cannot end your turn with more than\s+cards in your hand/i,
        replace:
            'You cannot end your turn with more than 6 cards in your hand'
    }
];
