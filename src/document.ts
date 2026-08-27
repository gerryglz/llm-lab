export type DocumentPage = {
    page: number;
    content: string;
};

export type DocumentSection = {
    page: number;
    title: string;
    content: string;
};

export type DocumentChunk = {
    id: string;
    sourceId: 'core-rulebook' | 'advanced-rules';
    sourceTitle: string;
    page: number;
    section: string;
    content: string;
    quality: 'clean' | 'mixed';
};

