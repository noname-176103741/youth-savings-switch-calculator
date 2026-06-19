import {
  DEFAULT_SETTINGS,
  FUTURE_CONTRIBUTION_TYPES,
  INCOME_BRACKETS,
  calculateComparison,
  generateYouthLeapPayments,
  taxAdjustedAnnualRate,
  validateYouthLeapPayments,
} from "./calc.js?v=default-rates-20260619";
import {
  SOURCE_LINKS,
  YOUTH_FUTURE_BANKS,
  YOUTH_FUTURE_RULES,
  YOUTH_LEAP_CONTRIBUTION_SNAPSHOT,
} from "./data.js?v=default-rates-20260619";

const els = {
  inputs: {
    youthLeapSignupDate: document.querySelector("#youthLeapSignupDate"),
    youthLeapExitDate: document.querySelector("#youthLeapExitDate"),
    youthFutureStartDate: document.querySelector("#youthFutureStartDate"),
    paymentDay: document.querySelector("#paymentDay"),
    historyMonthlyAmount: document.querySelector("#historyMonthlyAmount"),
    futureMonthlyAmount: document.querySelector("#futureMonthlyAmount"),
    youthLeapSpecialRate: document.querySelector("#youthLeapSpecialRate"),
    youthLeapMaturityRate: document.querySelector("#youthLeapMaturityRate"),
    youthLeapMaturityRateYear4: document.querySelector("#youthLeapMaturityRateYear4"),
    youthLeapMaturityRateYear5: document.querySelector("#youthLeapMaturityRateYear5"),
    youthLeapContributionRate: document.querySelector("#youthLeapContributionRate"),
    youthLeapContributionRateYear4: document.querySelector("#youthLeapContributionRateYear4"),
    youthLeapContributionRateYear5: document.querySelector("#youthLeapContributionRateYear5"),
    youthFutureRate: document.querySelector("#youthFutureRate"),
    youthFutureContributionRate: document.querySelector("#youthFutureContributionRate"),
    externalPreTaxRate: document.querySelector("#externalPreTaxRate"),
    futureContributionType: document.querySelector("#futureContributionType"),
  },
  incomeBracketFields: document.querySelector("#incomeBracketFields"),
  bankSelect: document.querySelector("#bankSelect"),
  selectedBankDetails: document.querySelector("#selectedBankDetails"),
  paymentRows: document.querySelector("#paymentRows"),
  limitWarnings: document.querySelector("#limitWarnings"),
  bankList: document.querySelector("#bankList"),
  bankSearch: document.querySelector("#bankSearch"),
  rateAsOfText: document.querySelector("#rateAsOfText"),
  sourceList: document.querySelector("#sourceList"),
  logicList: document.querySelector("#logicList"),
  winnerText: document.querySelector("#winnerText"),
  winnerCaption: document.querySelector("#winnerCaption"),
  differenceText: document.querySelector("#differenceText"),
  injectedText: document.querySelector("#injectedText"),
  afterTaxRateText: document.querySelector("#afterTaxRateText"),
  afterTaxInline: document.querySelector("#afterTaxInline"),
  breakEvenText: document.querySelector("#breakEvenText"),
  endDateText: document.querySelector("#endDateText"),
  keepFinalText: document.querySelector("#keepFinalText"),
  switchFinalText: document.querySelector("#switchFinalText"),
  keepBar: document.querySelector("#keepBar"),
  switchBar: document.querySelector("#switchBar"),
  componentList: document.querySelector("#componentList"),
  injectionList: document.querySelector("#injectionList"),
  calculateButton: document.querySelector("#calculateButton"),
  calcStatus: document.querySelector("#calcStatus"),
  summaryBand: document.querySelector(".summary-band"),
};

let paymentRows = [];
let lastResult = null;
let paymentRowsTouched = false;
let storageReady = false;
let isApplyingSavedState = false;
let hasPendingChanges = false;

const STORAGE_KEY = "youthSavingsSwitchCalculator:v1";
const TAB_NAMES = ["inputs", "history", "rates", "details", "logic"];
const HISTORY_DRIVER_FIELDS = new Set([
  "youthLeapSignupDate",
  "youthLeapExitDate",
  "paymentDay",
  "historyMonthlyAmount",
]);

init();

function init() {
  fillDefaultInputs();
  renderContributionTypeOptions();
  renderIncomeFields();
  renderBankOptions();
  renderSources();
  const savedState = readSavedState();
  if (savedState) {
    applySavedState(savedState);
  } else {
    paymentRows = generateYouthLeapPayments(getSettings());
  }
  bindEvents();
  renderPaymentRows();
  storageReady = true;
  switchTab(savedState?.activeTab || "inputs");
  recalculate();
}

function fillDefaultInputs() {
  for (const [key, input] of Object.entries(els.inputs)) {
    if (input && key in DEFAULT_SETTINGS) {
      input.value = DEFAULT_SETTINGS[key];
    }
  }
}

function renderContributionTypeOptions() {
  els.inputs.futureContributionType.innerHTML = Object.entries(FUTURE_CONTRIBUTION_TYPES)
    .map(([id, item]) => `<option value="${id}">${item.label}</option>`)
    .join("");
  els.inputs.futureContributionType.value = DEFAULT_SETTINGS.futureContributionType;
}

function renderIncomeFields(values = DEFAULT_SETTINGS.incomeBracketsByYear) {
  const selectedValues = Array.isArray(values) ? values : DEFAULT_SETTINGS.incomeBracketsByYear;
  els.incomeBracketFields.innerHTML = DEFAULT_SETTINGS.incomeBracketsByYear
    .map((value, index) => {
      const selectedValue = INCOME_BRACKETS.some((bracket) => bracket.id === selectedValues[index])
        ? selectedValues[index]
        : value;
      const options = INCOME_BRACKETS.map(
        (bracket) =>
          `<option value="${bracket.id}" ${bracket.id === selectedValue ? "selected" : ""}>${bracket.label}</option>`,
      ).join("");
      return `
        <label>
          ${index + 1}년차 소득구간
          <select class="income-bracket" data-index="${index}">${options}</select>
        </label>
      `;
    })
    .join("");
}

function renderBankOptions(selectedBank = "우리은행") {
  els.bankSelect.innerHTML = YOUTH_FUTURE_BANKS.map(
    (bank) => `<option value="${escapeAttr(bank.bank)}">${bank.bank}</option>`,
  ).join("");
  els.bankSelect.value = YOUTH_FUTURE_BANKS.some((bank) => bank.bank === selectedBank)
    ? selectedBank
    : "우리은행";
  els.rateAsOfText.textContent = `전국은행연합회 비교공시 기준일자: 2026. 6. 19.`;
  renderSelectedBank();
  renderBankList();
}

function bindEvents() {
  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      switchTab(button.dataset.tab);
      saveState();
    });
  });

  Object.entries(els.inputs).forEach(([key, input]) => {
    input.addEventListener("input", () => handleSettingsInput(key));
    input.addEventListener("change", () => handleSettingsInput(key));
  });

  els.calculateButton.addEventListener("click", recalculate);
  els.incomeBracketFields.addEventListener("change", markCalculationStale);
  els.bankSelect.addEventListener("change", () => {
    renderSelectedBank();
    saveState();
  });
  els.bankSearch.addEventListener("input", renderBankList);

  document.querySelector("#regenerateHistory").addEventListener("click", () => {
    paymentRows = generateYouthLeapPayments(getSettings());
    paymentRowsTouched = false;
    renderPaymentRows();
    markCalculationStale();
  });

  document.querySelector("#resetSavedState").addEventListener("click", resetSavedState);

  document.querySelector("#addPaymentRow").addEventListener("click", () => {
    paymentRowsTouched = true;
    paymentRows.push({
      id: `manual-${Date.now()}`,
      date: els.inputs.youthLeapExitDate.value,
      amount: Number(els.inputs.historyMonthlyAmount.value || 0),
    });
    renderPaymentRows();
    markCalculationStale();
  });
}

function handleSettingsInput(key) {
  if (HISTORY_DRIVER_FIELDS.has(key) && !paymentRowsTouched) {
    paymentRows = generateYouthLeapPayments(getSettings());
    renderPaymentRows();
  }
  renderAfterTaxInline(getSettings());
  markCalculationStale();
}

function switchTab(tabName) {
  if (!TAB_NAMES.includes(tabName)) {
    return;
  }
  document.querySelectorAll(".tab").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tab === tabName);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("is-active", panel.id === `tab-${tabName}`);
  });
}

function getSettings() {
  return {
    youthLeapSignupDate: els.inputs.youthLeapSignupDate.value,
    youthLeapExitDate: els.inputs.youthLeapExitDate.value,
    youthFutureStartDate: els.inputs.youthFutureStartDate.value,
    paymentDay: Number(els.inputs.paymentDay.value),
    historyMonthlyAmount: Number(els.inputs.historyMonthlyAmount.value),
    futureMonthlyAmount: Number(els.inputs.futureMonthlyAmount.value),
    youthLeapSpecialRate: Number(els.inputs.youthLeapSpecialRate.value),
    youthLeapMaturityRate: Number(els.inputs.youthLeapMaturityRate.value),
    youthLeapMaturityRateYear4: Number(els.inputs.youthLeapMaturityRateYear4.value),
    youthLeapMaturityRateYear5: Number(els.inputs.youthLeapMaturityRateYear5.value),
    youthLeapContributionRate: Number(els.inputs.youthLeapContributionRate.value),
    youthLeapContributionRateYear4: Number(els.inputs.youthLeapContributionRateYear4.value),
    youthLeapContributionRateYear5: Number(els.inputs.youthLeapContributionRateYear5.value),
    youthFutureRate: Number(els.inputs.youthFutureRate.value),
    youthFutureContributionRate: Number(els.inputs.youthFutureContributionRate.value),
    externalPreTaxRate: Number(els.inputs.externalPreTaxRate.value),
    futureContributionType: els.inputs.futureContributionType.value,
    incomeBracketsByYear: Array.from(document.querySelectorAll(".income-bracket")).map(
      (select) => select.value,
    ),
  };
}

function readSavedState() {
  try {
    const raw = window.localStorage?.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return parsed?.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

function applySavedState(savedState) {
  isApplyingSavedState = true;
  try {
    const settings = savedState.settings || {};
    for (const [key, input] of Object.entries(els.inputs)) {
      if (input && settings[key] !== undefined && settings[key] !== null) {
        input.value = settings[key];
      }
    }
    renderIncomeFields(settings.incomeBracketsByYear);
    renderBankOptions(savedState.selectedBank);

    const savedRows = normalizeSavedRows(savedState.paymentRows);
    paymentRows = savedRows.length ? savedRows : generateYouthLeapPayments(getSettings());
    paymentRowsTouched = savedRows.length ? Boolean(savedState.paymentRowsTouched) : false;
  } finally {
    isApplyingSavedState = false;
  }
}

function normalizeSavedRows(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows
    .filter((row) => typeof row?.date === "string")
    .map((row, index) => ({
      id: String(row.id || `saved-${index}-${row.date}`),
      date: row.date,
      amount: Number(row.amount || 0),
    }));
}

function saveState() {
  if (!storageReady || isApplyingSavedState) {
    return;
  }
  try {
    window.localStorage?.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        savedAt: new Date().toISOString(),
        settings: getSettings(),
        selectedBank: els.bankSelect.value,
        activeTab: activeTabName(),
        paymentRows: paymentRows.map((row) => ({
          id: row.id,
          date: row.date,
          amount: row.amount,
        })),
        paymentRowsTouched,
      }),
    );
  } catch {
    // Storage can be unavailable in hardened browser modes; calculation still works without persistence.
  }
}

function resetSavedState() {
  try {
    window.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors and still reset the in-memory form.
  }

  isApplyingSavedState = true;
  try {
    paymentRowsTouched = false;
    fillDefaultInputs();
    renderIncomeFields();
    renderBankOptions();
    paymentRows = generateYouthLeapPayments(getSettings());
  } finally {
    isApplyingSavedState = false;
  }

  renderPaymentRows();
  switchTab("inputs");
  markCalculationStale();
}

function renderPaymentRows() {
  els.paymentRows.innerHTML = paymentRows
    .map(
      (row) => `
        <tr data-id="${row.id}">
          <td><input type="date" value="${row.date}" data-field="date" aria-label="납입일" /></td>
          <td><input type="number" min="0" step="1000" value="${row.amount}" data-field="amount" aria-label="납입금액" /></td>
          <td><button class="danger-button" type="button" data-action="delete">삭제</button></td>
        </tr>
      `,
    )
    .join("");

  els.paymentRows.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", handlePaymentRowEdit);
    input.addEventListener("change", handlePaymentRowEdit);
  });
  els.paymentRows.querySelectorAll("[data-action='delete']").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.closest("tr").dataset.id;
      paymentRowsTouched = true;
      paymentRows = paymentRows.filter((row) => row.id !== id);
      renderPaymentRows();
      markCalculationStale();
    });
  });
}

function handlePaymentRowEdit(event) {
  const rowEl = event.target.closest("tr");
  const row = paymentRows.find((item) => item.id === rowEl.dataset.id);
  if (!row) return;
  paymentRowsTouched = true;
  row[event.target.dataset.field] =
    event.target.dataset.field === "amount" ? Number(event.target.value || 0) : event.target.value;
  markCalculationStale();
}

function renderSelectedBank() {
  const bank = YOUTH_FUTURE_BANKS.find((item) => item.bank === els.bankSelect.value) || YOUTH_FUTURE_BANKS[0];
  els.selectedBankDetails.innerHTML = `
    <div class="rate-line">
      <span class="pill">기본 ${formatPercent(bank.baseRate)}</span>
      <span class="pill">최고 ${formatPercent(bank.maxRate)}</span>
      <span class="pill">제공일 ${bank.providedDate}</span>
    </div>
    ${renderTextBlock("요약", bank.summary)}
    ${renderTextBlock("상세조건", bank.conditions)}
    ${renderTextBlock("만기 후 금리", bank.afterMaturity)}
    ${bank.notes ? renderTextBlock("유의사항", bank.notes) : ""}
  `;
}

function renderBankList() {
  const keyword = els.bankSearch.value.trim().toLowerCase();
  const banks = YOUTH_FUTURE_BANKS.filter((bank) => {
    const text = `${bank.bank} ${bank.summary} ${bank.conditions}`.toLowerCase();
    return !keyword || text.includes(keyword);
  });

  els.bankList.innerHTML = banks
    .map(
      (bank) => `
        <article class="bank-card">
          <h3>${bank.bank}</h3>
          <div class="rate-line">
            <span class="pill">기본 ${formatPercent(bank.baseRate)}</span>
            <span class="pill">최고 ${formatPercent(bank.maxRate)}</span>
            <span class="pill">제공일 ${bank.providedDate}</span>
          </div>
          ${renderTextBlock("우대항목", bank.summary)}
          ${renderTextBlock("상세조건", bank.conditions)}
          ${renderTextBlock("만기 후 금리", bank.afterMaturity)}
          ${bank.notes ? renderTextBlock("유의사항", bank.notes) : ""}
        </article>
      `,
    )
    .join("");
}

function recalculate() {
  const settings = getSettings();
  renderAfterTaxInline(settings);

  const validation = validateYouthLeapPayments(paymentRows, settings.youthLeapSignupDate);
  renderValidation(validation);

  try {
    lastResult = calculateComparison(settings, paymentRows);
    renderResult(lastResult);
  } catch (error) {
    lastResult = null;
    els.winnerText.textContent = "입력값 확인 필요";
    els.winnerCaption.textContent = error.message;
  } finally {
    hasPendingChanges = false;
    updateCalculationState();
    renderLogic(settings, lastResult, validation);
    saveState();
  }
}

function renderAfterTaxInline(settings) {
  els.afterTaxInline.textContent = formatPercent(taxAdjustedAnnualRate(settings.externalPreTaxRate));
}

function markCalculationStale() {
  if (isApplyingSavedState) {
    return;
  }
  hasPendingChanges = true;
  updateCalculationState();
  saveState();
}

function updateCalculationState() {
  els.calcStatus.textContent = hasPendingChanges ? "변경사항 있음" : "계산 완료";
  els.calcStatus.classList.toggle("is-pending", hasPendingChanges);
  els.calculateButton.classList.toggle("is-pending", hasPendingChanges);
  els.summaryBand.classList.toggle("is-stale", hasPendingChanges);
}

function renderValidation(validation) {
  if (!validation.issues.length) {
    els.limitWarnings.innerHTML = "";
    return;
  }
  els.limitWarnings.innerHTML = validation.issues
    .map(
      (issue) =>
        `<div class="warning-item">${issue.message} 현재 ${formatMoney(issue.total)}, 한도 ${formatMoney(issue.limit)}</div>`,
    )
    .join("");
}

function renderResult(result) {
  const differenceAbs = Math.abs(result.difference);
  const keepText = formatMoney(result.cash.finalA);
  const switchText = formatMoney(result.cash.finalB);

  if (result.winner === "switch") {
    els.winnerText.textContent = "청년미래적금 전환 우위";
    els.winnerCaption.textContent = `전환 시 최종 외부 현금이 ${formatMoney(differenceAbs)} 더 큽니다.`;
  } else if (result.winner === "keep") {
    els.winnerText.textContent = "청년도약계좌 유지 우위";
    els.winnerCaption.textContent = `유지 시 최종 외부 현금이 ${formatMoney(differenceAbs)} 더 큽니다.`;
  } else {
    els.winnerText.textContent = "두 선택이 거의 동일";
    els.winnerCaption.textContent = "최종 외부 현금 차이가 1원 미만입니다.";
  }

  els.differenceText.textContent = `${result.difference >= 0 ? "+" : "-"}${formatMoney(differenceAbs)}`;
  els.injectedText.textContent = formatMoney(result.cash.totalInjected);
  els.afterTaxRateText.textContent = formatPercent(result.rates.externalAfterTaxRate);
  els.breakEvenText.textContent = result.breakEven
    ? `${formatPercent(result.breakEven.preTaxRate)} 세전 (${formatPercent(result.breakEven.afterTaxRate)} 세후)`
    : "범위 내 없음";
  els.endDateText.textContent = result.dates.comparisonEndDate;
  els.keepFinalText.textContent = keepText;
  els.switchFinalText.textContent = switchText;

  const maxFinal = Math.max(1, result.cash.finalA, result.cash.finalB);
  els.keepBar.style.width = `${Math.max(2, (result.cash.finalA / maxFinal) * 100)}%`;
  els.switchBar.style.width = `${Math.max(2, (result.cash.finalB / maxFinal) * 100)}%`;

  renderComponents(result);
  renderInjections(result);
}

function renderComponents(result) {
  const groups = [
    ["도약 특별중도해지 지급", result.payouts.earlyLeapPayout],
    ["도약 유지 만기 지급", result.payouts.maintainedLeapPayout],
    ["미래적금 만기 지급", result.payouts.futurePayout],
  ];

  els.componentList.innerHTML = groups
    .map(
      ([title, payout]) => `
        <article class="component-item">
          <h3>${title}</h3>
          <div class="kv-grid">
            <span>원금</span><strong>${formatMoney(payout.principal)}</strong>
            <span>원금 이자</span><strong>${formatMoney(payout.principalInterest)}</strong>
            <span>정부기여금</span><strong>${formatMoney(payout.contribution)}</strong>
            <span>기여금 이자</span><strong>${formatMoney(payout.contributionInterest)}</strong>
            <span>합계</span><strong>${formatMoney(payout.total)}</strong>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderInjections(result) {
  if (!result.cash.injections.length) {
    els.injectionList.innerHTML = `<div class="event-item">추가 납입필요가 발생하지 않았습니다.</div>`;
    return;
  }
  els.injectionList.innerHTML = result.cash.injections
    .slice(0, 30)
    .map(
      (event) => `
        <article class="event-item">
          <h3>${event.date}</h3>
          <div class="kv-grid">
            <span>추가 투입</span><strong>${formatMoney(event.amount)}</strong>
            <span>도약 유지 잔액</span><strong>${formatMoney(event.balanceA)}</strong>
            <span>미래 전환 잔액</span><strong>${formatMoney(event.balanceB)}</strong>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderSources() {
  const contributionRows = YOUTH_LEAP_CONTRIBUTION_SNAPSHOT.rows
    .map((row) => `${row.label}: 월 최대 ${formatMoney(row.monthlyCap)}`)
    .join("<br>");
  els.sourceList.innerHTML = `
    <div class="source-item">
      <strong>청년도약계좌 기여금</strong>
      <p>${YOUTH_LEAP_CONTRIBUTION_SNAPSHOT.note}<br>${contributionRows}</p>
    </div>
    <div class="source-item">
      <strong>청년미래적금 구조</strong>
      <p>월 최대 ${formatMoney(YOUTH_FUTURE_RULES.monthlyCap)}, 연 ${formatMoney(YOUTH_FUTURE_RULES.yearlyCap)}, ${YOUTH_FUTURE_RULES.months}개월. 일반형 6%, 우대형 12% 정부기여금을 반영하고, 정부기여금 이자는 기본금리 기준으로 별도 계산합니다.</p>
    </div>
    ${SOURCE_LINKS.map(
      (source) =>
        `<div class="source-item"><a href="${source.url}" target="_blank" rel="noopener noreferrer">${source.label}</a></div>`,
    ).join("")}
  `;
}

function renderLogic(settings, result, validation) {
  const futureContributionType =
    FUTURE_CONTRIBUTION_TYPES[settings.futureContributionType] || FUTURE_CONTRIBUTION_TYPES.regular;
  const maturityScheduleText = result?.rates?.youthLeapMaturitySchedule
    ? formatSchedule(result.rates.youthLeapMaturitySchedule)
    : "계산 성공 후 표시됩니다.";
  const contributionScheduleText = result?.rates?.youthLeapContributionSchedule
    ? formatSchedule(result.rates.youthLeapContributionSchedule)
    : "계산 성공 후 표시됩니다.";
  const limitText = validation.issues.length
    ? validation.issues.map((issue) => `${issue.message} 현재 ${formatMoney(issue.total)}`).join("\n")
    : "현재 납입 이력에는 월/납입연도 한도 위반이 없습니다.";

  const sections = [
    {
      title: "비교 기준일",
      body: [
        `청년도약계좌 특별중도해지일은 ${settings.youthLeapExitDate}, 청년미래적금 가입일은 ${settings.youthFutureStartDate}로 둡니다.`,
        `비교 종료일은 두 상품 만기일 중 늦은 날짜입니다${result ? `: ${result.dates.comparisonEndDate}` : ""}.`,
        "전환 시나리오는 해지일에 도약계좌 특별중도해지 지급액을 외부 현금 계정에 받는 것으로 처리합니다.",
      ],
    },
    {
      title: "청년도약계좌 납입일",
      body: [
        `가입일은 ${settings.youthLeapSignupDate}, 기본 입금일은 매월 ${settings.paymentDay}일입니다.`,
        "가입월과 매년 가입월은 max(기본 입금일, 해당 연도 가입기념일)을 납입 가능일로 봅니다.",
        "가입월이 아닌 달은 기본 입금일을 사용하되, 그 달에 해당 일이 없으면 말일로 보정합니다.",
        "2월 29일 기준은 비윤년 2월 28일을 같은 납입 가능일로 봅니다.",
        "해지월의 납입 가능일이 해지일보다 늦으면 그 달 납입은 생성하지 않습니다.",
      ],
    },
    {
      title: "청년도약계좌 한도",
      body: [
        `월 한도는 ${formatMoney(700000)}, 납입연도 한도는 ${formatMoney(8400000)}입니다.`,
        "연 한도는 달력연도가 아니라 가입일 기준 1년 단위 납입연도로 검증합니다.",
        limitText,
      ],
    },
    {
      title: "청년도약계좌 금리",
      body: [
        `특별중도해지 원금 이자는 단일 입력금리 ${formatPercent(settings.youthLeapSpecialRate)}로 계산합니다.`,
        "만기 유지 시 원금 이자는 1~36개월 고정금리, 37~48개월 변동금리 예상값, 49~60개월 변동금리 예상값으로 나눠 단리 일할 계산합니다.",
        maturityScheduleText,
        "정부기여금 이자도 정산일부터 만기일까지 같은 방식의 3구간 금리 스케줄로 나눠 계산합니다.",
        contributionScheduleText,
      ],
    },
    {
      title: "청년도약계좌 기여금",
      body: [
        "월 납입총액을 기준으로 다음 달 10일 정부기여금이 정산되는 것으로 처리합니다.",
        "2025년 1월 납입분부터 확대 기여금 구조를 적용합니다.",
        "소득구간 1년차는 가입일부터 다음 해 가입월 말일까지, 2년차부터는 매년 가입월 다음 달 1일부터 적용합니다.",
        "2026년 7월 전환 가정에서는 도약계좌 7월 납입분 기여금을 받는 것으로 보되, 정산일이 해지일 이후이면 이자는 0원입니다.",
      ],
    },
    {
      title: "청년미래적금",
      body: [
        `월 납입액은 설정 월납입액 ${formatMoney(settings.futureMonthlyAmount)}과 월 한도 ${formatMoney(500000)} 중 작은 금액입니다.`,
        "가입월과 매년 가입월의 납입일 보정은 청년도약계좌와 같은 방식으로 적용합니다.",
        `정부기여금 유형은 ${futureContributionType.label}입니다.`,
        "일반형은 월 납입액의 6%, 월 30,000원 한도이고 우대형은 월 납입액의 12%, 월 60,000원 한도입니다.",
        `정부기여금 이자는 미래적금 적용 금리와 분리해 ${formatPercent(settings.youthFutureContributionRate)}로 계산합니다.`,
      ],
    },
    {
      title: "외부 현금 계정",
      body: [
        `외부 돈 세전 연이율 ${formatPercent(settings.externalPreTaxRate)}를 15.4% 과세 후 ${formatPercent(taxAdjustedAnnualRate(settings.externalPreTaxRate))} 세후 연이율로 바꿉니다.`,
        "세후 연이율은 (1 + 세후연이율)^(1/365) - 1 방식으로 일이율 복리 환산합니다.",
        "각 날짜의 해지/만기 지급과 납입 이벤트를 반영한 뒤, 음수 잔액이 생기면 두 시나리오가 모두 0 이상이 되는 최소 금액을 추가 투입으로 기록합니다.",
        "날짜가 다음 날로 넘어갈 때 외부 현금 계정 잔액에 일이율을 곱해 이자를 반영합니다.",
      ],
    },
    {
      title: "손익분기",
      body: [
        "손익분기 외부 세전 연이율은 -20%~30% 범위에서 부호 변화를 찾고 이분법으로 근사합니다.",
        result?.breakEven
          ? `현재 손익분기값은 세전 ${formatPercent(result.breakEven.preTaxRate)}, 세후 ${formatPercent(result.breakEven.afterTaxRate)}입니다.`
          : "현재 설정에서는 탐색 범위 안에서 손익분기값이 없습니다.",
      ],
    },
  ];

  els.logicList.innerHTML = sections
    .map(
      (section) => `
        <article class="logic-item">
          <h3>${escapeHtml(section.title)}</h3>
          <ul>
            ${section.body.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
          </ul>
        </article>
      `,
    )
    .join("");
}

function formatSchedule(schedule) {
  return schedule
    .map(
      (segment) =>
        `${segment.label}: ${segment.startDate}부터 ${segment.endDate} 전일까지 ${formatPercent(segment.annualRate)}`,
    )
    .join("\n");
}

function renderTextBlock(title, value) {
  if (!value) {
    return "";
  }
  return `<p class="text-block"><strong>${escapeHtml(title)}</strong>${escapeHtml(value)}</p>`;
}

function activeTabName() {
  return document.querySelector(".tab.is-active")?.dataset.tab || "inputs";
}

function formatMoney(value) {
  return `${new Intl.NumberFormat("ko-KR").format(Math.round(Number(value || 0)))}원`;
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
    .replaceAll("\n", "<br>");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("<br>", " ");
}
