import OpenAI from 'openai';

const _client = new OpenAI({
    baseURL: 'http://127.0.0.1:1234/v1',
    apiKey: 'lm-studio'
});

const _model = 'qwen/qwen3-8b';

export async function isDiceThroneQuestion(
    question: string
): Promise<boolean> {
    const _unsupportedIntent =
        /\b(best|strongest|tier\s*list|win\s*rate|meta|strategy|beginner(?:s|'s)?|recommend(?:ed|ation)?|which\s+(?:hero|character))\b/i.test(question) ||
        /\b(cost|price|buy|release(?:d| date)?|publication date)\b/i.test(question);

    if (_unsupportedIntent) {
        return false;
    }

    const _explicitRuleIntent =
        /\b(?:income|upkeep|discard|offensive roll|defensive roll|targeting roll|main) phase\b/i.test(question) ||
        /\b(?:starting hand|hand size|combat points?|\bCP\b|status effects?|roll attempts?|game setup)\b/i.test(question);

    if (_explicitRuleIntent) {
        return true;
    }

    const _response =
        await _client.chat.completions.create({
            model: _model,
            temperature: 0,
            max_tokens: 10,
            messages: [
                {
                    role: 'system',
                    content: `
/no_think

Decide whether the supplied Dice Throne rulebook can answer the user's question directly.

YES means the question asks for an objective rule, definition, timing, setup instruction, game component procedure, or supported multiplayer-mode rule.

NO means the question is unrelated to Dice Throne OR asks for opinions, strategy, recommendations, rankings, hero strength, win rates, prices, purchase advice, product history, release dates, or other information that a rulebook does not provide.

Return ONLY one word:

YES
or
NO

Examples:

Question:
How many times can I roll during an attack?

Answer:
YES

Question:
What is the maximum hand size?

Answer:
YES

Question:
How do status effects work?

Answer:
YES

Question:
What is the best Dice Throne hero for beginners?

Answer:
NO

Question:
Which character is strongest?

Answer:
NO

Question:
How many cards do players draw during setup?

Answer:
YES

Question:
How many cards are in a Magic the Gathering deck?

Answer:
NO

Question:
What temperature should I bake pizza at?

Answer:
NO

Question:
Who won the Super Bowl?

Answer:
NO
          `.trim()
                },
                {
                    role: 'user',
                    content: question
                }
            ]
        });

    const _result =
        _response.choices[0]?.message.content
            ?.trim()
            .toUpperCase();

    return _result === 'YES';
}

