import OpenAI from 'openai';

const _client = new OpenAI({
    baseURL: 'http://127.0.0.1:1234/v1',
    apiKey: 'lm-studio'
});

const _model = 'qwen/qwen3-8b';

export async function rewriteQuery(
    question: string
): Promise<string> {
    const _response =
        await _client.chat.completions.create({
            model: _model,
            temperature: 0,
            max_tokens: 100,
            messages: [
                {
                    role: 'system',
                    content: `
/no_think

You rewrite user questions into concise search queries
for a Dice Throne rulebook retrieval system.

Your job is to improve retrieval, not answer the question.

Rules:
- Preserve every constraint, action, object, comparison, and timing relationship in the user's original meaning.
- Do not answer the question.
- Do not add facts that are not implied by the question.
- Rewrite concepts into how a Dice Throne rulebook is likely to describe them.
- Prefer concrete game actions, phases, timing, cards, dice, status effects, and limits over abstract wording.
- Use official Dice Throne terminology only when the user's wording unambiguously establishes it.
- Preserve important timing concepts such as beginning of turn, end of turn, before attacking, after rolling, or during defense.
- Never infer or introduce a phase, section, rule, or game mode that the user did not name.
- In particular, do not turn "after attacking", "before drawing", "start of game", or similar relative wording into a named phase.
- Keep relative timing language relative: preserve "before", "after", "first", "next", and "at the start/end".
- If the user asks how to remove, spend, increase, target, defend, discard, or upgrade something, prefer the rulebook term for that concept when strongly implied.
- Keep the rewritten query concise.
- Return ONLY the rewritten search query.

Safe Dice Throne terminology mappings:
- attack rolls / rerolls when attacking -> Offensive Roll Phase
- choose opponent / choose target -> Targeting Roll Phase
- opponent defends -> Defensive Roll Phase
- too many cards / hand limit -> Discard Phase
- remove status effects / get rid of status effects -> Removing Status Effects
- status effect stacking -> Stack Limits
- increase status effect stacking -> Increasing Stack Limit

Examples:

User:
What is the maximum hand size?

Search query:
What is the maximum number of cards a player can have in hand?

User:
How many chances do I get to roll my dice when attacking?

Search query:
How many roll attempts can a player make during the Offensive Roll Phase?

User:
What happens at the beginning of my turn?

Search query:
What happens at the beginning of a player's turn?

User:
What do I do first when my turn starts?

Search query:
What happens first at the start of a player's turn?

User:
When do I gain CP and draw a card?

Search query:
When does a player gain CP and draw a card?

User:
When can I play upgrades?

Search query:
When can a player play Hero Upgrade cards?

User:
When do I choose who I am attacking?

Search query:
When does a player choose their attack target?

User:
When does my opponent get to defend?

Search query:
When does the defending player use their Defensive Ability?

User:
How can status effects be removed?

Search query:
How do Removing Status Effects rules work?
          `.trim()
                },
                {
                    role: 'user',
                    content: question
                }
            ]
        });

    const _rewritten =
        _response.choices[0]?.message.content?.trim();

    if (!_rewritten) {
        return question;
    }

    return _rewritten;
}

