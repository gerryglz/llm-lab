# Dice Throne Rules Assistant

`llm-lab` is a local, source-grounded Dice Throne rules assistant. It combines semantic search, deterministic rules signals, a local language model, and source citations so an answer can be traced back to the official material that supports it.

## What this project is exploring

The project is a practical lab for building a trustworthy retrieval-augmented generation (RAG) system. The important question is not only whether a model can produce a plausible answer, but whether the system can retrieve the correct rule, reject questions the sources cannot answer, and show where its answer came from.

The flow is:

1. Extract and clean the official source documents.
2. Split them into source-aware chunks.
3. Create embeddings with LM Studio.
4. Retrieve with semantic, lexical, structural, and deterministic intent signals.
5. Rerank the evidence and generate a concise grounded answer.
6. Return the source title, page, section, and chunk ID with the answer.

The answer contract also includes an evidence summary designed for a future chat UI. It labels evidence strength, explains why the sources are sufficient, distinguishes primary rules from official clarifications, and includes short source excerpts that can be expanded in the interface.

The browser keeps the six most recent user and assistant messages so follow-ups such as “Do I shuffle first?” can be rewritten as standalone questions. Conversation text is used only to resolve references; every final answer must still be supported by newly retrieved official evidence. Use **New conversation** to clear that local context.

The assistant also distinguishes an explicit rule from silence in the rules. When official passages establish related constraints but do not state the requested limit, the result is labeled **partial evidence** and says that the rule was not specified. It never converts “no limit was found” into “unlimited” or permission to act.

Questions that ask **when** something may happen are checked for every applicable timing window. For example, card selling combines Main Phase (1), Main Phase (2)'s inherited rules, and the mandatory Discard Phase procedure instead of returning the first correct passage as though it were complete.

Before retrieval policies run, a deterministic question planner labels the request as a direct fact, timing question, limit, sequence, or inheritance question. That plan selects an evidence strategy such as one direct passage, every applicable window, related constraints, or linked rules. The API returns this interpretation and the browser displays it beneath the answer, making retrieval behavior easier to inspect.

Generated answers are also divided into independently supported claims. Every claim carries the exact IDs of the passages that justify it; if the model returns a missing or unknown source ID, the whole generated answer is rejected. The browser shows this claim-to-source map before the expandable excerpts, so answer grounding can be audited without reading implementation logs.

## Sources and authority

The source order matters:

1. **Dice Throne Rulebook v2.4.3** is the primary source for normal play and turn structure. Its PDF stays local because of its size; the corrected extracted text and chunks are versioned.
2. **Official Dice Throne Rulings and Clarifications** is the second source for edge cases, card interactions, timing questions, heroes, and advanced game modes. The repository includes a PDF snapshot and its extracted text/chunks. The living source is the [official Google Doc](https://docs.google.com/document/d/1_GJz22nkGmcEjThXgEUlb8OykrNNigs33xpSywnwTRc/edit?usp=sharing).

The assistant keeps provenance on every chunk. Citations therefore identify which document established the answer instead of presenting all retrieved text as one anonymous rulebook.

## Run the chat interface locally

Requirements:

- Node.js and npm
- [LM Studio](https://lmstudio.ai/) running its local OpenAI-compatible server at `http://127.0.0.1:1234/v1`
- `qwen/qwen3-8b` loaded for rewriting, classification, reranking, and answers
- `text-embedding-nomic-embed-text-v1.5` loaded for embeddings
- `documents/dice-throne-rulebook.pdf` is needed only if you intentionally rebuild the core source data

The repository already contains the extracted chunks and searchable index. You do **not** need to run either ingestion command for normal use.

### 1. Prepare LM Studio

1. Start LM Studio's local server at `http://127.0.0.1:1234/v1`.
2. Load `qwen/qwen3-8b`.
3. Load `text-embedding-nomic-embed-text-v1.5`.

Both models must be available to the local server. The chat model handles classification, rewriting, reranking, and grounded answers; the embedding model handles retrieval.

### 2. Install and build

```sh
npm install
npm run check
npm run build
```

### 3. Start the browser chat

```sh
npm run serve
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). The status badge should say **Rules index ready** before you submit a question.

Try these questions:

- `What's my starting hand?`
- `Explain the Income Phase.`
- `Can Twice as Wild change only one die?`

If the badge says **Service unavailable**, confirm that LM Studio is running on port `1234` and that both configured models are loaded. If you change TypeScript files, rerun `npm run build` before restarting the server.

If startup reports `EADDRINUSE` for port `3000`, an older copy of the server is still running. The new build did not start, and the browser is still using that older process. Return to the terminal running it, press `Ctrl+C`, and then run:

```sh
npm run build
npm run serve
```

If you cannot find the old terminal, identify its process in PowerShell:

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object OwningProcess
```

Stop only the returned process ID with `Stop-Process -Id <process-id>`, then start the server again. A successful restart ends with:

```text
Dice Throne API ready at http://127.0.0.1:3000
```

### Optional: terminal chat

```sh
npm start
```

### Optional: rebuild the source data

Only do this when changing the source documents or ingestion code. The core PDF is intentionally excluded from GitHub, so first place it at `documents/dice-throne-rulebook.pdf`.

```sh
npm run ingest:core
npm run ingest:advanced
npm run index
npm run build
```

### Optional: call the HTTP API directly

With `npm run serve` still running:

```sh
curl -X POST http://127.0.0.1:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"question":"Can Twice as Wild change only one die?"}'
```

The response contains the answer, evidence strength and explanation, source roles, excerpts, and relevance metadata. This is the stable boundary the future browser chat will consume.

## Evaluation suites

Each suite has a distinct job:

- `npm run eval:normal` protects the original retrieval baseline.
- `npm run eval:hard` is the visible development and stress suite.
- `npm run eval:blind` is the unseen holdout and must not be tuned against.
- `npm run eval:answers` checks answer grounding and citations.
- `npm run eval:evidence` checks the UI-ready evidence explanation contract.
- `npm run eval:conversation` checks contextual follow-up resolution and grounding.
- `npm run eval:assumptions` checks that an unstated limit is not turned into permission.
- `npm run eval:completeness` checks multi-passage timing answers and inherited phase rules.
- `npm run eval:planner` checks question categories and evidence strategies without calling LM Studio.
- `npm run eval:http` checks the local API protocol without calling LM Studio.
- `npm run eval:source` checks repaired core-rulebook facts.
- `npm run eval:advanced` checks advanced rulings and document provenance.

Run `npm run build` before evaluations so `dist/` reflects the latest TypeScript.

## Development as chapters

Changes are delivered as focused pull requests that read like book chapters. Each PR explains the idea, why it matters, the important implementation choices, and the measured result. See [docs/PR_WORKFLOW.md](docs/PR_WORKFLOW.md) for the review and approval workflow.

## Project status

The core retrieval baseline is 100% Top-1, Top-10, and out-of-domain accuracy on the normal suite. The hard suite is the active stress test, while the blind suite remains a protected holdout. Chapter 03 expands the knowledge base with official advanced rulings without changing the configured LM Studio models.

