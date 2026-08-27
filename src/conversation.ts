import OpenAI from 'openai';

const _client = new OpenAI({
    baseURL: 'http://127.0.0.1:1234/v1',
    apiKey: 'lm-studio'
});

const _model = 'qwen/qwen3-8b';
const _contextualLanguage =
    /^(?:so|and|but|then|what about)\b|\b(?:it|its|that|those|this|they|them|first|before that|after that)\b/i;

export type ConversationTurn = {
    role: 'user' | 'assistant';
    content: string;
};

export async function resolveConversationalQuestion(
    question: string,
    history: readonly ConversationTurn[] = []
): Promise<string> {
    const _recentHistory = history.slice(-6);

    if (_recentHistory.length === 0 || !_contextualLanguage.test(question.trim())) {
        return question;
    }

    const _transcript = _recentHistory
        .map((turn) => `${turn.role.toUpperCase()}: ${turn.content}`)
        .join('\n');

    const _response = await _client.chat.completions.create({
        model: _model,
        temperature: 0,
        max_tokens: 80,
        messages: [
            {
                role: 'system',
                content: `
/no_think

Rewrite the CURRENT QUESTION as one standalone Dice Throne rules question.

Use conversation history only to resolve references such as “it”, “that”, “first”, or “so”. Preserve the user's intent and wording wherever possible. Do not answer the question. Do not add a rule, phase, card, hero, or fact that the conversation did not establish.

Return only the standalone question.
                `.trim()
            },
            {
                role: 'user',
                content: `CONVERSATION:\n${_transcript}\n\nCURRENT QUESTION:\n${question}`
            }
        ]
    });

    return _response.choices[0]?.message.content?.trim() || question;
}

