export type ChunkCorrection = {
    page: number;
    sectionIncludes: string;
    pattern: RegExp;
    replace: string;
};

export const CHUNK_CORRECTIONS: ChunkCorrection[] = [
    {
        page: 2,
        sectionIncludes: 'Page 2',
        pattern: /Set your starting Health to\s*\(for a 1v1 game\)/i,
        replace: 'Set your starting Health to 50 (for a 1v1 game)'
    },
    {
        page: 2,
        sectionIncludes: 'Page 2',
        pattern: /Set your starting CP to\s*\./i,
        replace: 'Set your starting CP to 2.'
    },
    {
        page: 2,
        sectionIncludes: 'Page 2',
        pattern: /Draw the top\s+cards from your deck/i,
        replace: 'Draw the top 4 cards from your deck'
    },
    {
        page: 3,
        sectionIncludes: 'INCOME PHASE',
        pattern: /Gain\s*& draw\s*card from your deck/i,
        replace: 'Gain 1 CP & draw 1 card from your deck'
    },
    {
        page: 3,
        sectionIncludes: 'MAIN PHASE (1)',
        pattern: /Spend\s+to play Hero Upgrade cards/i,
        replace: 'Spend CP to play Hero Upgrade cards'
    },
    {
        page: 3,
        sectionIncludes: 'MAIN PHASE (1)',
        pattern: /Sell unwanted cards to gain\s+for each/i,
        replace: 'Sell unwanted cards to gain 1 CP for each'
    },
    {
        page: 3,
        sectionIncludes: 'DISCARD PHASE',
        pattern: /Sell cards for\s+each/i,
        replace: 'Sell cards for 1 CP each'
    },
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
        sectionIncludes: 'INTERRUPTING STATUS EFFECTS',
        pattern:
            /you cannot end your turn with more than\s*cards in your hand/i,
        replace:
            'You cannot end your turn with more than 6 cards in your hand'
    },
    {
        page: 4,
        sectionIncludes: 'INTERRUPTING STATUS EFFECTS',
        pattern: /cards costing\s+are free to play/i,
        replace: 'cards costing 0 CP are free to play'
    },
    {
        page: 4,
        sectionIncludes: 'INTERRUPTING STATUS EFFECTS',
        pattern: /until you have\s*or fewer cards/i,
        replace: 'until you have 6 or fewer cards'
    },
    {
        page: 4,
        sectionIncludes: 'INTERRUPTING STATUS EFFECTS',
        pattern: /increase your CP Dial by\s*\(all cards are worth\s*when sold/i,
        replace: 'increase your CP Dial by 1 CP (all cards are worth 1 CP when sold'
    },
    {
        page: 6,
        sectionIncludes: '2V2 TEAM GAME',
        pattern: /Health Dial beginning with\s+Health/i,
        replace: 'Health Dial beginning with 50 Health'
    },
    {
        page: 6,
        sectionIncludes: 'KING OF THE HILL',
        pattern: /begins the game with\s+Health/i,
        replace: 'begins the game with 35 Health'
    },
    {
        page: 6,
        sectionIncludes: 'KING OF THE HILL',
        pattern: /you draw\s+card from your deck/i,
        replace: 'you draw 1 card from your deck'
    },
    {
        page: 6,
        sectionIncludes: 'KING OF THE HILL',
        pattern: /still draw\s+bonus card/i,
        replace: 'still draw 1 bonus card'
    },
    {
        page: 6,
        sectionIncludes: 'KING OF THE HILL',
        pattern: /with at least\s+dmg/i,
        replace: 'with at least 1 dmg'
    },
    {
        page: 7,
        sectionIncludes: 'Page 7',
        pattern: /simultaneously reduced to\s+Health/i,
        replace: 'simultaneously reduced to 0 Health'
    },
    {
        page: 7,
        sectionIncludes: 'Page 7',
        pattern: /until you have or fewer cards/i,
        replace: 'until you have 6 or fewer cards'
    },
    {
        page: 7,
        sectionIncludes: 'Page 7',
        pattern: /Increase your CP Dial by\s+for each card sold/i,
        replace: 'Increase your CP Dial by 1 CP for each card sold'
    },
    {
        page: 7,
        sectionIncludes: 'Page 7',
        pattern: /Increase your CP Dial by\s*\(skip this step if you already have the maximum of\s*\)/i,
        replace: 'Increase your CP Dial by 1 CP (skip this step if you already have the maximum of 15 CP)'
    },
    {
        page: 7,
        sectionIncludes: 'Page 7',
        pattern: /Draw\s+card from the top of your deck/i,
        replace: 'Draw 1 card from the top of your deck'
    },
    {
        page: 9,
        sectionIncludes: 'Page 9',
        pattern: /Players can have a maximum of\s*\. Players gain\s+during their Income Phase/i,
        replace: 'Players can have a maximum of 15 CP. Players gain 1 CP during their Income Phase'
    },
    {
        page: 9,
        sectionIncludes: 'Page 9',
        pattern: /You may Heal up to\s+Health beyond your starting Health/i,
        replace: 'You may Heal up to 10 Health beyond your starting Health'
    },
    {
        page: 9,
        sectionIncludes: 'Page 9',
        pattern: /then gain\s+\(i\.e\. increase their CP Dial by\s*\)/i,
        replace: 'then gain 1 CP (i.e. increase their CP Dial by 1 CP)'
    },
    {
        page: 9,
        sectionIncludes: 'Page 9',
        pattern: /This has no\s+cost/i,
        replace: 'This has no CP cost'
    }
];

