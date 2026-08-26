import OpenAI from 'openai';

import {
  createInterface
} from 'node:readline/promises';

import {
  stdin as input,
  stdout as output
} from 'node:process';

import {
  findRulebookChunks,
  loadRulebookIndex
} from './rulebook-retrieval.js';

import {
  rerankChunks
} from './reranker.js';

import {
  rewriteQuery
} from './query-rewriter.js';

import {
  isDiceThroneQuestion
} from './domain-classifier.js';

const _client =
  new OpenAI({
    baseURL:
      'http://127.0.0.1:1234/v1',
    apiKey:
      'lm-studio'
  });

const _model =
  'qwen/qwen3-8b';

async function askQuestion(
  question: string
): Promise<void> {
  /*
   * --------------------------------------------------
   * DOMAIN CLASSIFICATION
   * --------------------------------------------------
   *
   * Run this against the ORIGINAL question.
   *
   * We do not want the query rewriter turning an
   * unrelated question into something that merely
   * sounds like Dice Throne.
   */
  const _isDiceThrone =
    await isDiceThroneQuestion(
      question
    );

  if (!_isDiceThrone) {
    console.log(
      '\nQwen:'
    );

    console.log(
      'I can only answer questions supported by the Dice Throne rulebook.'
    );

    return;
  }

  /*
   * --------------------------------------------------
   * QUERY REWRITING
   * --------------------------------------------------
   *
   * The rewritten query is optimized for semantic
   * retrieval.
   *
   * The original question is preserved separately for
   * lexical and relationship-aware scoring.
   */
  const _retrievalQuery =
    await rewriteQuery(
      question
    );

  console.log(
    '\nRetrieval query:'
  );

  console.log(
    _retrievalQuery
  );

  /*
   * --------------------------------------------------
   * HYBRID RETRIEVAL
   * --------------------------------------------------
   *
   * Pass BOTH forms:
   *
   * original question
   *     -> lexical + relationship signals
   *
   * rewritten query
   *     -> embedding + structural signals
   */
  const _candidates =
    await findRulebookChunks(
      question,
      _retrievalQuery,
      10
    );

  /*
   * --------------------------------------------------
   * STRONG STRUCTURED MATCH
   * --------------------------------------------------
   *
   * If retrieval already gives us a highly relevant,
   * specifically named rulebook section, skip the
   * expensive reranker.
   */
  const _topCandidate =
    _candidates[0];

  const _hasStrongStructuredMatch =
    Boolean(
      _topCandidate &&
      _topCandidate.score >=
      0.75 &&
      _topCandidate.section
        .toLowerCase() !==
      `page ${_topCandidate.page}`
    );

  let _results;

  if (
    _hasStrongStructuredMatch &&
    _topCandidate
  ) {
    console.log(
      '\nStrong structured match detected.'
    );

    console.log(
      'Skipping reranker.'
    );

    _results = [
      _topCandidate
    ];
  } else {
    /*
     * Retrieval is ambiguous.
     *
     * Give the reranker the ORIGINAL user question
     * and candidate chunks.
     */
    _results =
      await rerankChunks(
        question,
        _candidates,
        3
      );
  }

  /*
   * --------------------------------------------------
   * SELECTED CHUNKS
   * --------------------------------------------------
   */
  console.log(
    '\nSelected chunks:'
  );

  if (
    _results.length === 0
  ) {
    console.log(
      'No relevant chunks found.'
    );
  } else {
    for (
      const _result of
      _results
    ) {
      console.log(
        `[${_result.id}] ` +
        `Page ${_result.page} | ` +
        `${_result.section} | ` +
        `${_result.score.toFixed(4)}`
      );
    }
  }

  /*
   * --------------------------------------------------
   * RULEBOOK CONTEXT
   * --------------------------------------------------
   */
  const _context =
    _results
      .map(
        (result) =>
          `[Source: Page ${result.page}, ${result.section}]\n` +
          result.content
      )
      .join(
        '\n\n'
      );

  /*
   * --------------------------------------------------
   * FINAL ANSWER
   * --------------------------------------------------
   *
   * Answer the ORIGINAL user question.
   *
   * The model must stay grounded in the retrieved
   * rulebook context.
   */
  const _response =
    await _client.chat.completions.create({
      model: _model,
      temperature: 0.1,
      messages: [
        {
          role:
            'system',
          content: `
/no_think

You are a Dice Throne rules assistant.

Answer the user's question using only the provided Dice Throne rulebook context.

Rules:

- Do not use outside knowledge.
- Do not guess missing information.
- Do not invent rules.
- Prefer the most directly relevant source.
- If multiple sources conflict, do not resolve the conflict using outside knowledge.
- If the context does not contain enough information to answer, say exactly:

"I don't have enough information to answer that."

- Keep the answer concise.
- If the answer is supported by the context, include the relevant page number.
                    `.trim()
        },
        {
          role:
            'user',
          content: `
RULEBOOK CONTEXT:

${_context ||
            'No relevant rulebook context was found.'}

QUESTION:

${question}
                    `.trim()
        }
      ]
    });

  const _answer =
    _response
      .choices[0]
      ?.message
      .content;

  console.log(
    '\nQwen:'
  );

  console.log(
    _answer ??
    'No response was generated.'
  );

  /*
   * --------------------------------------------------
   * TOKEN USAGE
   * --------------------------------------------------
   */
  console.log(
    '\nUsage:'
  );

  console.log(
    `Prompt tokens:     ${_response
      .usage
      ?.prompt_tokens ??
    0
    }`
  );

  console.log(
    `Completion tokens: ${_response
      .usage
      ?.completion_tokens ??
    0
    }`
  );

  console.log(
    `Total tokens:      ${_response
      .usage
      ?.total_tokens ??
    0
    }`
  );
}

async function main(): Promise<void> {
  /*
   * Load the vector index once when the application
   * starts.
   */
  await loadRulebookIndex();

  const _readline =
    createInterface({
      input,
      output
    });

  console.log(
    '\nDice Throne RAG Assistant'
  );

  console.log(
    'Type "exit" to quit.\n'
  );

  try {
    while (true) {
      const _question =
        await _readline.question(
          'You: '
        );

      const _trimmedQuestion =
        _question.trim();

      if (
        _trimmedQuestion
          .toLowerCase() ===
        'exit'
      ) {
        break;
      }

      if (
        !_trimmedQuestion
      ) {
        continue;
      }

      try {
        await askQuestion(
          _trimmedQuestion
        );
      } catch (_error) {
        console.error(
          '\nFailed to answer question:',
          _error
        );
      }

      console.log();
    }
  } finally {
    _readline.close();
  }
}

main().catch(
  (_error) => {
    console.error(
      _error
    );

    process.exitCode = 1;
  }
);
