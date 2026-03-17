(function () {
  "use strict";

  const DA_RATE = 0.46;

  let payMatrix = [];

  const payLevelSelect = document.getElementById("payLevel");
  const progressionSelect = document.getElementById("progressionIndex");
  const fitmentInput = document.getElementById("fitmentFactor");
  const taInput = document.getElementById("taAmount");
  const otherAllowancesInput = document.getElementById("otherAllowances");
  const hraSelect = document.getElementById("hraPercent");
  const otherDeductionsInput = document.getElementById("otherDeductions");
  const calcBtn = document.getElementById("calcBtn");

  const resultIds = [
    "newBasic", "hra", "da", "gross", "deductions", "net",
    "annualGross", "postTaxAnnual", "incomeTax", "postTaxMonthly"
  ];

  function formatMoney(n) {
    return "₹ " + (Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 }));
  }

  function getInputNumber(id, def) {
    const el = document.getElementById(id);
    const v = el ? parseFloat(el.value) : def;
    return isNaN(v) ? def : v;
  }

  function populatePayLevels() {
    payLevelSelect.innerHTML = '<option value="">Select level</option>';
    payMatrix.forEach(function (row) {
      const level = row.level;
      const opt = document.createElement("option");
      opt.value = row.level;
      opt.textContent = "Level " + level;
      payLevelSelect.appendChild(opt);
    });
  }

  function populateProgression(levelRow) {
    progressionSelect.innerHTML = '<option value="">Select cell</option>';
    if (!levelRow || !levelRow.progression || !levelRow.progression.length) return;
    progressionSelect.disabled = false;
    levelRow.progression.forEach(function (pay, i) {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = "Cell " + (i + 1) + " — " + formatMoney(pay);
      progressionSelect.appendChild(opt);
    });
  }

  function getCurrentBasic() {
    const levelVal = payLevelSelect.value;
    const cellVal = progressionSelect.value;
    if (levelVal === "" || cellVal === "") return 0;
    const row = payMatrix.find(function (r) { return String(r.level) === String(levelVal); });
    if (!row || !row.progression) return 0;
    const idx = parseInt(cellVal, 10);
    return row.progression[idx] || 0;
  }

  // FY 2025-26 new regime (Budget 2025) — ₹75,000 standard deduction + 87A rebate up to ₹12L
  function calcTax(annualGross) {
    if (annualGross <= 0) return 0;
    const STANDARD_DEDUCTION = 75000;
    const taxable = Math.max(0, annualGross - STANDARD_DEDUCTION);
    const slabs = [
      { limit: 400000,  rate: 0    },
      { limit: 800000,  rate: 0.05 },
      { limit: 1200000, rate: 0.10 },
      { limit: 1600000, rate: 0.15 },
      { limit: 2000000, rate: 0.20 },
      { limit: 2400000, rate: 0.25 },
      { limit: Infinity, rate: 0.30 }
    ];
    let tax = 0;
    let prevLimit = 0;
    for (let i = 0; i < slabs.length; i++) {
      const slab = slabs[i];
      const taxableInSlab = Math.max(0, Math.min(taxable, slab.limit) - prevLimit);
      tax += taxableInSlab * slab.rate;
      prevLimit = slab.limit;
      if (taxable <= slab.limit) break;
    }
    tax = Math.round(tax);
    // Section 87A rebate: nil tax if taxable income ≤ ₹12 lakh
    return taxable <= 1200000 ? 0 : tax;
  }

  function updateResults() {
    const emptyEl = document.getElementById("resultsEmpty");
    const dataEl  = document.getElementById("resultsData");

    const currentBasic = getCurrentBasic();

    if (currentBasic === 0) {
      if (emptyEl) emptyEl.hidden = false;
      if (dataEl)  dataEl.hidden  = true;
      return;
    }

    if (emptyEl) emptyEl.hidden = true;
    if (dataEl)  dataEl.hidden  = false;

    const fitment = getInputNumber("fitmentFactor", 2);
    const ta = getInputNumber("taAmount", 3600);
    const otherAllowances = getInputNumber("otherAllowances", 0);
    const hraPercent = getInputNumber("hraPercent", 24);
    const otherDeductions = getInputNumber("otherDeductions", 0);

    const newBasic = Math.round(currentBasic * fitment);
    const hra = Math.round((newBasic * hraPercent) / 100);
    const da = Math.round(newBasic * DA_RATE);
    const gross = newBasic + hra + da + ta + otherAllowances;
    const deductions = otherDeductions;
    const net = gross - deductions;

    const annualGross = gross * 12;
    const incomeTax = calcTax(annualGross);
    const postTaxAnnual = annualGross - incomeTax;
    const postTaxMonthly = Math.round(postTaxAnnual / 12);

    document.getElementById("newBasic").textContent = formatMoney(newBasic);
    document.getElementById("hra").textContent = formatMoney(hra);
    document.getElementById("da").textContent = formatMoney(da);
    document.getElementById("gross").textContent = formatMoney(gross);
    document.getElementById("deductions").textContent = formatMoney(deductions);
    document.getElementById("net").textContent = formatMoney(net);
    document.getElementById("annualGross").textContent = formatMoney(annualGross);
    document.getElementById("incomeTax").textContent = formatMoney(incomeTax);
    document.getElementById("postTaxAnnual").textContent = formatMoney(postTaxAnnual);
    document.getElementById("postTaxMonthly").textContent = formatMoney(postTaxMonthly);
  }

  function addListeners() {
    payLevelSelect.addEventListener("change", function () {
      const levelVal = payLevelSelect.value;
      const row = payMatrix.find(function (r) { return String(r.level) === String(levelVal); });
      populateProgression(row);
      updateResults();
    });
    progressionSelect.addEventListener("change", updateResults);
    calcBtn.addEventListener("click", updateResults);
    [fitmentInput, taInput, otherAllowancesInput, otherDeductionsInput].forEach(function (el) {
      if (el) el.addEventListener("input", updateResults);
    });
    if (hraSelect) hraSelect.addEventListener("change", updateResults);
  }

  function init() {
    fetch("paylevel.json")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        payMatrix = data.pay_matrix || [];
        populatePayLevels();
        addListeners();
      })
      .catch(function () {
        payLevelSelect.innerHTML = '<option value="">Failed to load pay matrix</option>';
      });
  }

  init();
})();
