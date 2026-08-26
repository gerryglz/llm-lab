# Chapter-Based Pull Request Workflow

This project grows through small, cohesive pull requests called **chapters**.
Each chapter should teach one architectural idea while delivering a useful,
testable improvement.

## What belongs in one chapter

A chapter should have one clear outcome, such as:

- produce answers grounded in retrieved rulebook passages;
- add citations and uncertainty handling;
- evaluate answer faithfulness;
- introduce a user interface.

Supporting refactors may travel with that outcome when separating them would
make the change harder to understand. Unrelated improvements wait for another
chapter.

## What every chapter explains

Each pull request includes:

1. **The story so far** — where this chapter fits in the project.
2. **The concept** — the technical idea in plain language.
3. **What changed** — behavior and files, grouped by responsibility.
4. **How information flows** — the important runtime sequence.
5. **Evidence** — compilation, evaluation metrics, and example behavior.
6. **Review guide** — a short recommended reading order.
7. **Tradeoffs and next chapter** — what the change deliberately leaves open.

## Approval rhythm

Chapters are opened as pull requests and remain unmerged until reviewed. The
reviewer can ask questions directly on the PR or specific lines. Follow-up
changes stay on the same chapter branch. Approval and merge close the chapter;
the next chapter starts from the updated `main` branch.

## Naming

- Branch: `chapter-NN-short-topic`
- PR title: `Chapter NN — Outcome`
- Commits: describe a meaningful part of that chapter

The goal is a history that reads like a book rather than a stream of patches.


