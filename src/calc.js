export const TAX_RATE = 0.154;
export const YOUTH_LEAP_MONTHLY_CAP = 700000;
export const YOUTH_LEAP_YEARLY_CAP = 8400000;
export const YOUTH_FUTURE_MONTHLY_CAP = 500000;
export const YOUTH_FUTURE_YEARLY_CAP = 6000000;
export const YOUTH_FUTURE_DEFAULT_CONTRIBUTION_RATE = 5;

const DAY_MS = 24 * 60 * 60 * 1000;
const EXPANDED_LEAP_CONTRIBUTION_START = parseDate("2025-01-01");

export const INCOME_BRACKETS = [
  {
    id: "lte2400",
    label: "총급여 2,400만원 이하",
    oldLimit: 400000,
    oldRate: 0.06,
    extraRate: 0.03,
    monthlyCap: 33000,
  },
  {
    id: "lte3600",
    label: "총급여 3,600만원 이하",
    oldLimit: 500000,
    oldRate: 0.046,
    extraRate: 0.03,
    monthlyCap: 29000,
  },
  {
    id: "lte4800",
    label: "총급여 4,800만원 이하",
    oldLimit: 600000,
    oldRate: 0.037,
    extraRate: 0.03,
    monthlyCap: 25200,
  },
  {
    id: "lte6000",
    label: "총급여 6,000만원 이하",
    oldLimit: 700000,
    oldRate: 0.03,
    extraRate: 0,
    monthlyCap: 21000,
  },
  {
    id: "lte7500",
    label: "총급여 7,500만원 이하",
    oldLimit: 0,
    oldRate: 0,
    extraRate: 0,
    monthlyCap: 0,
  },
];

export const FUTURE_CONTRIBUTION_TYPES = {
  none: {
    label: "미지급",
    rate: 0,
    cap: 0,
  },
  regular: {
    label: "일반형 6%",
    rate: 0.06,
    cap: 30000,
  },
  preferred: {
    label: "우대형 12%",
    rate: 0.12,
    cap: 60000,
  },
};

export const DEFAULT_SETTINGS = {
  youthLeapSignupDate: "2024-06-29",
  paymentDay: 1,
  historyMonthlyAmount: 700000,
  futureMonthlyAmount: 700000,
  youthLeapExitDate: "2026-07-27",
  youthFutureStartDate: "2026-07-28",
  youthLeapSpecialRate: 4.5,
  youthLeapMaturityRate: 6,
  youthLeapMaturityRateYear4: 5.5,
  youthLeapMaturityRateYear5: 5.5,
  youthLeapContributionRate: 4.5,
  youthLeapContributionRateYear4: 4,
  youthLeapContributionRateYear5: 4,
  youthFutureRate: 8,
  youthFutureContributionRate: YOUTH_FUTURE_DEFAULT_CONTRIBUTION_RATE,
  externalPreTaxRate: 4.5,
  futureContributionType: "regular",
  incomeBracketsByYear: ["lte3600", "lte3600", "lte3600", "lte3600", "lte3600"],
};

export function parseDate(value) {
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatDate(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(date, days) {
  const copy = parseDate(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

export function addMonths(date, months) {
  const source = parseDate(date);
  const targetMonth = source.getUTCMonth() + months;
  const year = source.getUTCFullYear() + Math.floor(targetMonth / 12);
  const month = ((targetMonth % 12) + 12) % 12;
  const day = Math.min(source.getUTCDate(), lastDayOfMonth(year, month));
  return new Date(Date.UTC(year, month, day));
}

export function addYears(date, years) {
  return addMonths(date, years * 12);
}

export function daysBetween(startDate, endDate) {
  return Math.max(0, Math.round((parseDate(endDate) - parseDate(startDate)) / DAY_MS));
}

export function compareDates(a, b) {
  return parseDate(a).getTime() - parseDate(b).getTime();
}

export function monthKey(date) {
  const parsed = parseDate(date);
  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function yearKey(date) {
  return String(parseDate(date).getUTCFullYear());
}

export function contributionYearKey(dateValue, anchorDateValue) {
  const date = parseDate(dateValue);
  const anchorDate = parseDate(anchorDateValue);
  let start = anniversaryDateForYear(anchorDate, date.getUTCFullYear());
  if (compareDates(date, start) < 0) {
    start = anniversaryDateForYear(anchorDate, date.getUTCFullYear() - 1);
  }
  const end = addDays(addYears(start, 1), -1);
  return `${formatDate(start)}~${formatDate(end)}`;
}

export function lastDayOfMonth(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function taxAdjustedAnnualRate(preTaxPercent) {
  return Number(preTaxPercent || 0) * (1 - TAX_RATE);
}

export function annualPercentToDailyRate(annualPercent) {
  return Math.pow(1 + Number(annualPercent || 0) / 100, 1 / 365) - 1;
}

export function calculateSegmentedSimpleInterest(amount, startDateValue, endDateValue, rateInput) {
  const normalizedAmount = normalizeAmount(amount);
  if (!Array.isArray(rateInput)) {
    return (
      normalizedAmount *
      (Number(rateInput || 0) / 100 / 365) *
      daysBetween(startDateValue, endDateValue)
    );
  }

  const startDate = parseDate(startDateValue);
  const endDate = parseDate(endDateValue);
  return rateInput.reduce((sum, segment) => {
    const segmentStart = maxDate(startDate, parseDate(segment.startDate));
    const segmentEnd = minDate(endDate, parseDate(segment.endDate));
    const days = daysBetween(segmentStart, segmentEnd);
    if (days <= 0) {
      return sum;
    }
    return sum + normalizedAmount * (Number(segment.annualRate || 0) / 100 / 365) * days;
  }, 0);
}

export function generateYouthLeapPayments(settings) {
  const signupDate = parseDate(settings.youthLeapSignupDate);
  const throughDate = parseDate(settings.youthLeapExitDate);
  const paymentDay = clampDay(settings.paymentDay);
  const amount = normalizeAmount(settings.historyMonthlyAmount);
  const rows = [];
  let monthCursor = new Date(Date.UTC(signupDate.getUTCFullYear(), signupDate.getUTCMonth(), 1));
  const endMonth = new Date(Date.UTC(throughDate.getUTCFullYear(), throughDate.getUTCMonth(), 1));

  while (compareDates(monthCursor, endMonth) <= 0) {
    const scheduled = scheduledDateForMonth(signupDate, monthCursor, paymentDay);
    if (compareDates(scheduled, throughDate) <= 0) {
      rows.push({
        id: `yl-${formatDate(scheduled)}`,
        date: formatDate(scheduled),
        amount,
      });
    }
    monthCursor = addMonths(monthCursor, 1);
  }

  return rows;
}

export function generateScenarioPayments(startDateValue, maturityDateValue, paymentDayValue, amountValue, monthlyCap) {
  const startDate = parseDate(startDateValue);
  const maturityDate = parseDate(maturityDateValue);
  const paymentDay = clampDay(paymentDayValue);
  const amount = Math.min(normalizeAmount(amountValue), monthlyCap);
  const rows = [];
  let monthCursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));

  while (compareDates(monthCursor, maturityDate) < 0) {
    const scheduled = scheduledDateForMonth(startDate, monthCursor, paymentDay);
    if (compareDates(scheduled, startDate) >= 0 && compareDates(scheduled, maturityDate) < 0) {
      rows.push({
        id: `future-${formatDate(scheduled)}`,
        date: formatDate(scheduled),
        amount,
      });
    }
    monthCursor = addMonths(monthCursor, 1);
  }

  return rows;
}

export function scheduledDateForMonth(anchorDateValue, monthStartValue, paymentDayValue) {
  const anchorDate = parseDate(anchorDateValue);
  const monthStart = parseDate(monthStartValue);
  const year = monthStart.getUTCFullYear();
  const month = monthStart.getUTCMonth();
  const day = Math.min(clampDay(paymentDayValue), lastDayOfMonth(year, month));
  const candidate = new Date(Date.UTC(year, month, day));

  if (month === anchorDate.getUTCMonth()) {
    const anniversary = anniversaryDateForYear(anchorDate, year);
    return compareDates(candidate, anniversary) >= 0 ? candidate : anniversary;
  }

  return candidate;
}

export function validateYouthLeapPayments(rows, anchorDateValue = DEFAULT_SETTINGS.youthLeapSignupDate) {
  const monthlyTotals = new Map();
  const yearlyTotals = new Map();
  const issues = [];

  for (const row of normalizePayments(rows)) {
    monthlyTotals.set(monthKey(row.date), (monthlyTotals.get(monthKey(row.date)) || 0) + row.amount);
    const contributionYear = contributionYearKey(row.date, anchorDateValue);
    yearlyTotals.set(contributionYear, (yearlyTotals.get(contributionYear) || 0) + row.amount);
  }

  for (const [key, total] of monthlyTotals) {
    if (total > YOUTH_LEAP_MONTHLY_CAP) {
      issues.push({
        type: "monthly",
        key,
        total,
        limit: YOUTH_LEAP_MONTHLY_CAP,
        message: `${key} 월 납입액이 70만원을 초과합니다.`,
      });
    }
  }

  for (const [key, total] of yearlyTotals) {
    if (total > YOUTH_LEAP_YEARLY_CAP) {
      issues.push({
        type: "yearly",
        key,
        total,
        limit: YOUTH_LEAP_YEARLY_CAP,
        message: `${key} 납입연도 납입액이 840만원을 초과합니다.`,
      });
    }
  }

  return {
    issues,
    monthlyTotals,
    yearlyTotals,
  };
}

export function calculateYouthLeapContribution(monthlyAmount, incomeBracketId, monthDateValue) {
  const bracket = INCOME_BRACKETS.find((item) => item.id === incomeBracketId) || INCOME_BRACKETS.at(-1);
  if (!bracket.oldLimit || !bracket.oldRate) {
    return 0;
  }

  const amount = Math.min(normalizeAmount(monthlyAmount), YOUTH_LEAP_MONTHLY_CAP);
  const monthDate = parseDate(monthDateValue);
  const oldPart = Math.min(amount, bracket.oldLimit) * bracket.oldRate;

  if (compareDates(monthDate, EXPANDED_LEAP_CONTRIBUTION_START) < 0) {
    return Math.round(oldPart);
  }

  const expandedPart = Math.max(0, amount - bracket.oldLimit) * bracket.extraRate;
  return Math.round(Math.min(oldPart + expandedPart, bracket.monthlyCap));
}

export function calculateYouthFutureContribution(monthlyAmount, contributionType) {
  const type = FUTURE_CONTRIBUTION_TYPES[contributionType] || FUTURE_CONTRIBUTION_TYPES.regular;
  return Math.round(Math.min(normalizeAmount(monthlyAmount) * type.rate, type.cap));
}

export function calculateComparison(inputSettings, inputRows) {
  const settings = coerceSettings(inputSettings);
  const rows = normalizePayments(inputRows);
  const core = runComparisonCore(settings, rows, settings.externalPreTaxRate);
  const breakEven = findBreakEvenPreTaxRate(settings, rows);
  return {
    ...core,
    breakEven,
  };
}

export function findBreakEvenPreTaxRate(inputSettings, inputRows, minPercent = -20, maxPercent = 30) {
  const settings = coerceSettings(inputSettings);
  const rows = normalizePayments(inputRows);
  const samples = 100;
  let leftRate = minPercent;
  let leftValue = runComparisonCore(settings, rows, leftRate).difference;

  if (Math.abs(leftValue) < 0.5) {
    return buildBreakEven(leftRate);
  }

  for (let index = 1; index <= samples; index += 1) {
    const rightRate = minPercent + ((maxPercent - minPercent) * index) / samples;
    const rightValue = runComparisonCore(settings, rows, rightRate).difference;

    if (Math.abs(rightValue) < 0.5) {
      return buildBreakEven(rightRate);
    }

    if (leftValue * rightValue < 0) {
      let lo = leftRate;
      let hi = rightRate;
      let fLo = leftValue;

      for (let step = 0; step < 60; step += 1) {
        const mid = (lo + hi) / 2;
        const fMid = runComparisonCore(settings, rows, mid).difference;
        if (Math.abs(fMid) < 0.5) {
          return buildBreakEven(mid);
        }
        if (fLo * fMid <= 0) {
          hi = mid;
        } else {
          lo = mid;
          fLo = fMid;
        }
      }

      return buildBreakEven((lo + hi) / 2);
    }

    leftRate = rightRate;
    leftValue = rightValue;
  }

  return null;
}

function runComparisonCore(settings, rows, externalPreTaxRate) {
  const signupDate = parseDate(settings.youthLeapSignupDate);
  const exitDate = parseDate(settings.youthLeapExitDate);
  const futureStartDate = parseDate(settings.youthFutureStartDate);
  const youthLeapMaturityDate = addMonths(signupDate, 60);
  const youthFutureMaturityDate = addMonths(futureStartDate, 36);
  const comparisonEndDate =
    compareDates(youthLeapMaturityDate, youthFutureMaturityDate) >= 0
      ? youthLeapMaturityDate
      : youthFutureMaturityDate;

  const historyPayments = rows.filter((row) => compareDates(row.date, exitDate) <= 0);
  const allLeapScheduledPayments = generateScenarioPayments(
    settings.youthLeapSignupDate,
    formatDate(youthLeapMaturityDate),
    settings.paymentDay,
    Math.min(settings.futureMonthlyAmount, YOUTH_LEAP_MONTHLY_CAP),
    YOUTH_LEAP_MONTHLY_CAP,
  );
  const futureLeapPayments = allLeapScheduledPayments.filter(
    (row) => compareDates(row.date, exitDate) > 0,
  );
  const maintainedLeapPayments = sortPayments([...historyPayments, ...futureLeapPayments]);
  const futurePayments = generateScenarioPayments(
    settings.youthFutureStartDate,
    formatDate(youthFutureMaturityDate),
    settings.paymentDay,
    settings.futureMonthlyAmount,
    YOUTH_FUTURE_MONTHLY_CAP,
  );

  const earlyLeapPayout = calculateYouthLeapPayout({
    settings,
    payments: historyPayments,
    payoutDate: exitDate,
    annualRate: settings.youthLeapSpecialRate,
    contributionAnnualRate: settings.youthLeapContributionRate,
  });
  const maintainedLeapPayout = calculateYouthLeapPayout({
    settings,
    payments: maintainedLeapPayments,
    payoutDate: youthLeapMaturityDate,
    annualRate: buildYouthLeapRateSchedule(settings, "maturity"),
    contributionAnnualRate: buildYouthLeapRateSchedule(settings, "contribution"),
  });
  const futurePayout = calculateYouthFuturePayout({
    settings,
    payments: futurePayments,
    payoutDate: youthFutureMaturityDate,
  });

  const externalAfterTaxRate = taxAdjustedAnnualRate(externalPreTaxRate);
  const dailyRate = annualPercentToDailyRate(externalAfterTaxRate);
  const cash = simulateExternalCash({
    startDate: exitDate,
    endDate: comparisonEndDate,
    dailyRate,
    events: [
      {
        date: formatDate(exitDate),
        scenario: "B",
        amount: earlyLeapPayout.total,
        label: "청년도약계좌 특별중도해지 지급",
      },
      ...futureLeapPayments.map((row) => ({
        date: row.date,
        scenario: "A",
        amount: -row.amount,
        label: "청년도약계좌 유지 납입",
      })),
      ...futurePayments.map((row) => ({
        date: row.date,
        scenario: "B",
        amount: -row.amount,
        label: "청년미래적금 납입",
      })),
      {
        date: formatDate(youthLeapMaturityDate),
        scenario: "A",
        amount: maintainedLeapPayout.total,
        label: "청년도약계좌 만기 지급",
      },
      {
        date: formatDate(youthFutureMaturityDate),
        scenario: "B",
        amount: futurePayout.total,
        label: "청년미래적금 만기 지급",
      },
    ],
  });

  const difference = cash.finalB - cash.finalA;
  return {
    settings,
    dates: {
      youthLeapMaturityDate: formatDate(youthLeapMaturityDate),
      youthFutureMaturityDate: formatDate(youthFutureMaturityDate),
      comparisonEndDate: formatDate(comparisonEndDate),
    },
    rates: {
      externalPreTaxRate,
      externalAfterTaxRate,
      externalDailyRate: dailyRate,
      youthLeapMaturitySchedule: buildYouthLeapRateSchedule(settings, "maturity").map(formatRateSegment),
      youthLeapContributionSchedule: buildYouthLeapRateSchedule(settings, "contribution").map(formatRateSegment),
    },
    schedules: {
      historyPayments,
      futureLeapPayments,
      futurePayments,
      maintainedLeapPayments,
    },
    payouts: {
      earlyLeapPayout,
      maintainedLeapPayout,
      futurePayout,
    },
    cash,
    difference,
    winner: Math.abs(difference) < 1 ? "tie" : difference > 0 ? "switch" : "keep",
  };
}

function calculateYouthLeapPayout({
  settings,
  payments,
  payoutDate,
  annualRate,
  contributionAnnualRate,
}) {
  const contributionEvents = buildMonthlyContributionEvents({
    settings,
    payments,
    payoutDate,
    product: "youthLeap",
  });

  return calculateProductPayout({
    payments,
    annualRate,
    contributionAnnualRate,
    contributionEvents,
    payoutDate,
  });
}

function calculateYouthFuturePayout({ settings, payments, payoutDate }) {
  const contributionEvents = buildMonthlyContributionEvents({
    settings,
    payments,
    payoutDate,
    product: "youthFuture",
  });

  return calculateProductPayout({
    payments,
    annualRate: settings.youthFutureRate,
    contributionAnnualRate: settings.youthFutureContributionRate,
    contributionEvents,
    payoutDate,
  });
}

function calculateProductPayout({
  payments,
  annualRate,
  contributionAnnualRate,
  contributionEvents,
  payoutDate,
}) {
  const payout = parseDate(payoutDate);
  const principal = payments.reduce((sum, row) => sum + row.amount, 0);
  const principalInterest = payments.reduce((sum, row) => {
    return sum + calculateSegmentedSimpleInterest(row.amount, row.date, payout, annualRate);
  }, 0);
  const contribution = contributionEvents.reduce((sum, event) => sum + event.amount, 0);
  const contributionInterest = contributionEvents.reduce((sum, event) => {
    const interestStart = compareDates(event.settleDate, payout) <= 0 ? parseDate(event.settleDate) : payout;
    return sum + calculateSegmentedSimpleInterest(
      event.amount,
      interestStart,
      payout,
      contributionAnnualRate,
    );
  }, 0);

  return {
    principal,
    principalInterest,
    contribution,
    contributionInterest,
    total: principal + principalInterest + contribution + contributionInterest,
    contributionEvents,
  };
}

function buildMonthlyContributionEvents({ settings, payments, payoutDate, product }) {
  const monthlyTotals = new Map();
  const monthDates = new Map();
  const payout = parseDate(payoutDate);

  for (const row of payments) {
    const key = monthKey(row.date);
    monthlyTotals.set(key, (monthlyTotals.get(key) || 0) + row.amount);
    if (!monthDates.has(key) || compareDates(row.date, monthDates.get(key)) < 0) {
      monthDates.set(key, row.date);
    }
  }

  return Array.from(monthlyTotals.entries())
    .map(([key, total]) => {
      const firstPaymentDate = parseDate(monthDates.get(key));
      const [year, month] = key.split("-").map(Number);
      const settleDate = new Date(Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 10));
      const amount =
        product === "youthLeap"
          ? calculateYouthLeapContribution(
              total,
              incomeBracketForDate(firstPaymentDate, settings),
              new Date(Date.UTC(year, month - 1, 1)),
            )
          : calculateYouthFutureContribution(total, settings.futureContributionType);

      return {
        month: key,
        paymentTotal: total,
        amount,
        settleDate: formatDate(settleDate),
      };
    })
    .filter((event) => event.amount > 0 && compareDates(event.month + "-01", payout) <= 0);
}

function incomeBracketForDate(dateValue, settings) {
  const date = parseDate(dateValue);
  const signupDate = parseDate(settings.youthLeapSignupDate);
  let index = 0;
  for (let year = 1; year < 5; year += 1) {
    if (compareDates(date, firstDayOfNextMonth(addYears(signupDate, year))) >= 0) {
      index = year;
    }
  }
  return settings.incomeBracketsByYear[Math.min(index, settings.incomeBracketsByYear.length - 1)];
}

function firstDayOfNextMonth(dateValue) {
  const date = parseDate(dateValue);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

function anniversaryDateForYear(anchorDate, year) {
  const month = anchorDate.getUTCMonth();
  const day = Math.min(anchorDate.getUTCDate(), lastDayOfMonth(year, month));
  return new Date(Date.UTC(year, month, day));
}

function buildYouthLeapRateSchedule(settings, type) {
  const signupDate = parseDate(settings.youthLeapSignupDate);
  const month36 = addMonths(signupDate, 36);
  const month48 = addMonths(signupDate, 48);
  const month60 = addMonths(signupDate, 60);
  const rates =
    type === "maturity"
      ? [
          settings.youthLeapMaturityRate,
          settings.youthLeapMaturityRateYear4,
          settings.youthLeapMaturityRateYear5,
        ]
      : [
          settings.youthLeapContributionRate,
          settings.youthLeapContributionRateYear4,
          settings.youthLeapContributionRateYear5,
        ];

  return [
    {
      label: "1~36개월",
      startDate: formatDate(signupDate),
      endDate: formatDate(month36),
      annualRate: Number(rates[0] || 0),
    },
    {
      label: "37~48개월",
      startDate: formatDate(month36),
      endDate: formatDate(month48),
      annualRate: Number(rates[1] || 0),
    },
    {
      label: "49~60개월",
      startDate: formatDate(month48),
      endDate: formatDate(month60),
      annualRate: Number(rates[2] || 0),
    },
  ];
}

function formatRateSegment(segment) {
  return {
    label: segment.label,
    startDate: segment.startDate,
    endDate: segment.endDate,
    annualRate: segment.annualRate,
  };
}

function simulateExternalCash({ startDate, endDate, dailyRate, events }) {
  const eventsByDate = new Map();
  for (const event of events) {
    if (!eventsByDate.has(event.date)) {
      eventsByDate.set(event.date, []);
    }
    eventsByDate.get(event.date).push(event);
  }

  let balanceA = 0;
  let balanceB = 0;
  let totalInjected = 0;
  const injections = [];
  const dailySnapshots = [];

  for (let cursor = parseDate(startDate); compareDates(cursor, endDate) <= 0; cursor = addDays(cursor, 1)) {
    const key = formatDate(cursor);
    for (const event of eventsByDate.get(key) || []) {
      if (event.scenario === "A") {
        balanceA += event.amount;
      } else {
        balanceB += event.amount;
      }
    }

    const required = Math.max(0, -Math.min(balanceA, balanceB));
    if (required > 0) {
      balanceA += required;
      balanceB += required;
      totalInjected += required;
      injections.push({
        date: key,
        amount: required,
        balanceA,
        balanceB,
      });
    }

    if (
      key === formatDate(startDate) ||
      key === formatDate(endDate) ||
      eventsByDate.has(key) ||
      required > 0
    ) {
      dailySnapshots.push({
        date: key,
        balanceA,
        balanceB,
      });
    }

    if (compareDates(cursor, endDate) < 0) {
      balanceA *= 1 + dailyRate;
      balanceB *= 1 + dailyRate;
    }
  }

  return {
    finalA: balanceA,
    finalB: balanceB,
    totalInjected,
    injections,
    events,
    dailySnapshots,
  };
}

function buildBreakEven(preTaxRate) {
  return {
    preTaxRate,
    afterTaxRate: taxAdjustedAnnualRate(preTaxRate),
  };
}

function coerceSettings(input) {
  return {
    ...DEFAULT_SETTINGS,
    ...input,
    paymentDay: clampDay(input.paymentDay),
    historyMonthlyAmount: normalizeAmount(input.historyMonthlyAmount),
    futureMonthlyAmount: normalizeAmount(input.futureMonthlyAmount),
    youthLeapSpecialRate: Number(input.youthLeapSpecialRate ?? DEFAULT_SETTINGS.youthLeapSpecialRate),
    youthLeapMaturityRate: Number(input.youthLeapMaturityRate ?? DEFAULT_SETTINGS.youthLeapMaturityRate),
    youthLeapMaturityRateYear4: Number(
      input.youthLeapMaturityRateYear4 ?? DEFAULT_SETTINGS.youthLeapMaturityRateYear4,
    ),
    youthLeapMaturityRateYear5: Number(
      input.youthLeapMaturityRateYear5 ?? DEFAULT_SETTINGS.youthLeapMaturityRateYear5,
    ),
    youthLeapContributionRate: Number(input.youthLeapContributionRate ?? DEFAULT_SETTINGS.youthLeapContributionRate),
    youthLeapContributionRateYear4: Number(
      input.youthLeapContributionRateYear4 ?? DEFAULT_SETTINGS.youthLeapContributionRateYear4,
    ),
    youthLeapContributionRateYear5: Number(
      input.youthLeapContributionRateYear5 ?? DEFAULT_SETTINGS.youthLeapContributionRateYear5,
    ),
    youthFutureRate: Number(input.youthFutureRate ?? DEFAULT_SETTINGS.youthFutureRate),
    youthFutureContributionRate: Number(
      input.youthFutureContributionRate ?? DEFAULT_SETTINGS.youthFutureContributionRate,
    ),
    externalPreTaxRate: Number(input.externalPreTaxRate ?? DEFAULT_SETTINGS.externalPreTaxRate),
    incomeBracketsByYear:
      Array.isArray(input.incomeBracketsByYear) && input.incomeBracketsByYear.length
        ? input.incomeBracketsByYear
        : DEFAULT_SETTINGS.incomeBracketsByYear,
  };
}

export function normalizePayments(rows) {
  return sortPayments(
    rows
      .map((row, index) => ({
        id: row.id || `row-${index}`,
        date: formatDate(parseDate(row.date)),
        amount: normalizeAmount(row.amount),
      }))
      .filter((row) => Number.isFinite(row.amount) && row.amount > 0),
  );
}

function sortPayments(rows) {
  return [...rows].sort((a, b) => compareDates(a.date, b.date) || a.id.localeCompare(b.id));
}

function maxDate(a, b) {
  return compareDates(a, b) >= 0 ? parseDate(a) : parseDate(b);
}

function minDate(a, b) {
  return compareDates(a, b) <= 0 ? parseDate(a) : parseDate(b);
}

function normalizeAmount(value) {
  return Math.max(0, Math.round(Number(value || 0)));
}

function clampDay(value) {
  return Math.min(31, Math.max(1, Math.round(Number(value || 1))));
}
