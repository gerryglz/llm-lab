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

## Sources and authority

The source order matters:

1. **Dice Throne Rulebook v2.4.3** is the primary source for normal play and turn structure. Its PDF stays local because of its size; the corrected extracted text and chunks are versioned.
2. **Official Dice Throne Rulings and Clarifications** is the second source for edge cases, card interactions, timing questions, heroes, and advanced game modes. The repository includes a PDF snapshot and its extracted text/chunks. The living source is the [official Google Doc](https://docs.google.com/document/d/1_GJz22nkGmcEjThXgEUlb8OykrNNigs33xpSywnwTRc/edit?usp=sharing).

The assistant keeps provenance on every chunk. Citations therefore identify which document established the answer instead of presenting all retrieved text as one anonymous rulebook.

## Local setup

Requirements:

- Node.js and npm
- [LM Studio](https://lmstudio.ai/) running its local OpenAI-compatible server at `http://127.0.0.1:1234/v1`
- `qwen/qwen3-8b` loaded for rewriting, classification, reranking, and answers
- `text-embedding-nomic-embed-text-v1.5` loaded for embeddings
- `documents/dice-throne-rulebook.pdf` supplied locally before rebuilding the core source

Install and build:

```sh
npm install
npm run check
npm run build
```

Rebuild source data and the combined index:

```sh
npm run ingest:core
npm run ingest:advanced
npm run index
```

Start the assistant:

```sh
npm start
```

## Evaluation suites

Each suite has a distinct job:

- `npm run eval:normal` protects the original retrieval baseline.
- `npm run eval:hard` is the visible development and stress suite.
- `npm run eval:blind` is the unseen holdout and must not be tuned against.
- `npm run eval:answers` checks answer grounding and citations.
- `npm run eval:evidence` checks the UI-ready evidence explanation contract.
- `npm run eval:source` checks repaired core-rulebook facts.
- `npm run eval:advanced` checks advanced rulings and document provenance.

Run `npm run build` before evaluations so `dist/` reflects the latest TypeScript.

## Development as chapters

Changes are delivered as focused pull requests that read like book chapters. Each PR explains the idea, why it matters, the important implementation choices, and the measured result. See [docs/PR_WORKFLOW.md](docs/PR_WORKFLOW.md) for the review and approval workflow.

## Project status

The core retrieval baseline is 100% Top-1, Top-10, and out-of-domain accuracy on the normal suite. The hard suite is the active stress test, while the blind suite remains a protected holdout. Chapter 03 expands the knowledge base with official advanced rulings without changing the configured LM Studio models.

