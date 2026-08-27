import {
    planQuestion,
    type EvidenceStrategy,
    type QuestionKind,
    type QuestionTopic
} from './question-planner.js';

type PlannerCase = {
    question: string;
    kind: QuestionKind;
    topic: QuestionTopic;
    strategy: EvidenceStrategy;
};

const _cases: readonly PlannerCase[] = [
    {
        question: 'When can I sell unwanted cards?',
        kind: 'timing',
        topic: 'card-selling',
        strategy: 'all-applicable-windows'
    },
    {
        question: 'How many CP can I spend per turn?',
        kind: 'limit',
        topic: 'combat-points',
        strategy: 'related-constraints'
    },
    {
        question: 'What happens before the Income Phase?',
        kind: 'sequence',
        topic: 'general',
        strategy: 'linked-rules'
    },
    {
        question: 'Does the same rule apply during Main Phase 2?',
        kind: 'inheritance',
        topic: 'general',
        strategy: 'linked-rules'
    },
    {
        question: "What's my starting hand?",
        kind: 'direct',
        topic: 'general',
        strategy: 'direct-passage'
    }
] as const;

let _passed = 0;
for (const _test of _cases) {
    const _plan = planQuestion(_test.question);
    const _pass =
        _plan.kind === _test.kind &&
        _plan.topic === _test.topic &&
        _plan.evidenceStrategy === _test.strategy;
    if (_pass) _passed++;
    console.log(`${_pass ? 'PASS' : 'FAIL'} | ${_test.question}`);
    console.log(`  ${_plan.kind} · ${_plan.topic} · ${_plan.evidenceStrategy}`);
}

console.log(`\nPlanner checks: ${_passed}/${_cases.length}`);
if (_passed !== _cases.length) process.exitCode = 1;

