import { strict as assert } from "node:assert";

import { evaluateBudgetAlert } from "../../packages/core/src/budget-alerts";

test("budget alerts use an explicit settled, estimated or combined basis", () => {
  const common = {
    scopeId: "global",
    budgetMinor: 1_000n,
    settledMinor: 600n,
    estimatedMinor: 250n,
  } as const;

  assert.equal(evaluateBudgetAlert({ ...common, basis: "settled" }).level, "notice");
  assert.equal(evaluateBudgetAlert({ ...common, basis: "estimated" }).level, "none");
  assert.equal(evaluateBudgetAlert({ ...common, basis: "combined" }).level, "warning");
});

test("budget alerts escalate at 50, 80 and 100 percent", () => {
  const levelAt = (spentMinor: bigint) => evaluateBudgetAlert({
    scopeId: "session-1",
    budgetMinor: 1_000n,
    settledMinor: spentMinor,
    estimatedMinor: 0n,
    basis: "settled",
  });

  assert.equal(levelAt(499n).level, "none");
  assert.equal(levelAt(500n).level, "notice");
  assert.equal(levelAt(800n).level, "warning");
  assert.equal(levelAt(1_000n).level, "critical");
});

test("budget alerts suppress duplicate notifications and re-arm after recovery", () => {
  const base = {
    scopeId: "session-1",
    budgetMinor: 1_000n,
    estimatedMinor: 0n,
    basis: "settled" as const,
  };
  const first = evaluateBudgetAlert({ ...base, settledMinor: 800n });
  assert.equal(first.shouldNotify, true);
  assert.equal(first.notificationKey, "session-1:settled:80");

  const duplicate = evaluateBudgetAlert({ ...base, settledMinor: 900n, previous: first.state });
  assert.equal(duplicate.level, "warning");
  assert.equal(duplicate.shouldNotify, false);

  const recovered = evaluateBudgetAlert({ ...base, settledMinor: 400n, previous: duplicate.state });
  assert.equal(recovered.level, "none");
  const crossedAgain = evaluateBudgetAlert({ ...base, settledMinor: 800n, previous: recovered.state });
  assert.equal(crossedAgain.shouldNotify, true);
});

test("disabled budgets and invalid negative inputs do not produce misleading alerts", () => {
  assert.equal(evaluateBudgetAlert({
    scopeId: "global",
    budgetMinor: 0n,
    settledMinor: 10_000n,
    estimatedMinor: 0n,
    basis: "settled",
  }).level, "none");
  assert.throws(() => evaluateBudgetAlert({
    scopeId: "global",
    budgetMinor: 1n,
    settledMinor: -1n,
    estimatedMinor: 0n,
    basis: "settled",
  }), /non-negative/);
});
