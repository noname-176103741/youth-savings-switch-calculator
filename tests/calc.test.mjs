import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SETTINGS,
  calculateComparison,
  calculateSegmentedSimpleInterest,
  calculateYouthFutureContribution,
  calculateYouthLeapContribution,
  contributionYearKey,
  findBreakEvenPreTaxRate,
  generateScenarioPayments,
  generateYouthLeapPayments,
  scheduledDateForMonth,
  taxAdjustedAnnualRate,
  validateYouthLeapPayments,
} from "../src/calc.js";

test("signup month uses max(payment day, signup date)", () => {
  const rows = generateYouthLeapPayments({
    ...DEFAULT_SETTINGS,
    youthLeapSignupDate: "2024-06-29",
    youthLeapExitDate: "2024-08-02",
    paymentDay: 1,
    historyMonthlyAmount: 700000,
  });

  assert.deepEqual(
    rows.map((row) => row.date),
    ["2024-06-29", "2024-07-01", "2024-08-01"],
  );
});

test("anniversary month also starts from signup day every year", () => {
  const rows = generateYouthLeapPayments({
    ...DEFAULT_SETTINGS,
    youthLeapSignupDate: "2024-06-29",
    youthLeapExitDate: "2025-07-02",
    paymentDay: 1,
    historyMonthlyAmount: 700000,
  });

  assert.equal(rows.some((row) => row.date === "2025-06-01"), false);
  assert.equal(rows.some((row) => row.date === "2025-06-29"), true);
});

test("exit before anniversary payment day excludes that month's payment", () => {
  const rows = generateYouthLeapPayments({
    ...DEFAULT_SETTINGS,
    youthLeapSignupDate: "2024-07-29",
    youthLeapExitDate: "2026-07-27",
    paymentDay: 1,
    historyMonthlyAmount: 700000,
  });

  assert.equal(rows.some((row) => row.date === "2026-07-01"), false);
  assert.equal(rows.some((row) => row.date === "2026-07-29"), false);
  assert.equal(rows.at(-1).date, "2026-06-01");
});

test("future account also uses anniversary month payment window", () => {
  const rows = generateScenarioPayments("2026-07-28", "2027-08-01", 1, 500000, 500000);

  assert.equal(rows.some((row) => row.date === "2027-07-01"), false);
  assert.equal(rows.some((row) => row.date === "2027-07-28"), true);
});

test("february 29 payment day falls back to february 28 on non-leap years", () => {
  const scheduled = scheduledDateForMonth("2024-02-29", "2025-02-01", 29);
  assert.equal(scheduled.toISOString().slice(0, 10), "2025-02-28");
});

test("yearly cap is based on signup anniversary year", () => {
  assert.equal(
    contributionYearKey("2025-06-28", "2024-06-29"),
    "2024-06-29~2025-06-28",
  );
  assert.equal(
    contributionYearKey("2025-06-29", "2024-06-29"),
    "2025-06-29~2026-06-28",
  );
});

test("youth leap monthly and yearly caps are reported", () => {
  const validation = validateYouthLeapPayments([
    { id: "a", date: "2026-01-01", amount: 500000 },
    { id: "b", date: "2026-01-15", amount: 300000 },
    ...[
      "2024-06-29",
      "2024-07-01",
      "2024-08-01",
      "2024-09-01",
      "2024-10-01",
      "2024-11-01",
      "2024-12-01",
      "2025-01-01",
      "2025-02-01",
      "2025-03-01",
      "2025-04-01",
      "2025-05-01",
      "2025-06-28",
    ].map((date, index) => ({
      id: `y-${index}`,
      date,
      amount: 700000,
    })),
  ], "2024-06-29");

  assert.equal(validation.issues.some((issue) => issue.type === "monthly"), true);
  assert.equal(validation.issues.some((issue) => issue.type === "yearly"), true);
});

test("youth leap contribution expands from 2025-01", () => {
  assert.equal(calculateYouthLeapContribution(700000, "lte2400", "2024-12-01"), 24000);
  assert.equal(calculateYouthLeapContribution(700000, "lte2400", "2025-01-01"), 33000);
  assert.equal(calculateYouthLeapContribution(700000, "lte3600", "2025-01-01"), 29000);
  assert.equal(calculateYouthLeapContribution(700000, "lte4800", "2025-01-01"), 25200);
  assert.equal(calculateYouthLeapContribution(700000, "lte6000", "2025-01-01"), 21000);
});

test("youth future contribution types apply rate and cap", () => {
  assert.equal(calculateYouthFutureContribution(500000, "regular"), 30000);
  assert.equal(calculateYouthFutureContribution(500000, "preferred"), 60000);
  assert.equal(calculateYouthFutureContribution(500000, "none"), 0);
});

test("external pretax rate is adjusted by 15.4 percent tax", () => {
  assert.ok(Math.abs(taxAdjustedAnnualRate(5) - 4.23) < 1e-9);
});

test("segmented simple interest applies youth leap fixed and variable periods by day", () => {
  const amount = 1000000;
  const interest = calculateSegmentedSimpleInterest(amount, "2024-06-29", "2029-06-29", [
    {
      startDate: "2024-06-29",
      endDate: "2027-06-29",
      annualRate: 3,
    },
    {
      startDate: "2027-06-29",
      endDate: "2028-06-29",
      annualRate: 4,
    },
    {
      startDate: "2028-06-29",
      endDate: "2029-06-29",
      annualRate: 5,
    },
  ]);
  const expected =
    amount * (0.03 / 365) * 1095 +
    amount * (0.04 / 365) * 366 +
    amount * (0.05 / 365) * 365;

  assert.ok(Math.abs(interest - expected) < 1e-6);
});

test("default comparison returns finite result and break-even search is callable", () => {
  const rows = generateYouthLeapPayments(DEFAULT_SETTINGS);
  const result = calculateComparison(DEFAULT_SETTINGS, rows);
  assert.equal(Number.isFinite(result.difference), true);
  assert.equal(Number.isFinite(result.cash.finalA), true);
  assert.equal(Number.isFinite(result.cash.finalB), true);

  const breakEven = findBreakEvenPreTaxRate(DEFAULT_SETTINGS, rows);
  assert.equal(breakEven === null || Number.isFinite(breakEven.preTaxRate), true);
});
