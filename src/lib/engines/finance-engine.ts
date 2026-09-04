import type { EmiInput, EmiResult, ScheduleRow } from "../types";

// Deterministic, indicative EMI calculation.
//   r = annual_rate / 12 / 100
//   EMI = P * r * (1+r)^n / ((1+r)^n - 1)
// Zero-interest loans are handled separately (EMI = P / n).
// Moratorium behaviour is scheme-configured:
//   none          -> repayment starts immediately
//   interest_only -> only interest is paid during moratorium; principal unchanged
//   capitalized   -> interest accrues and is added to principal during moratorium

export class FinanceInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FinanceInputError";
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeEmi(principal: number, annualRate: number, tenureMonths: number): number {
  if (!Number.isFinite(principal) || principal <= 0) throw new FinanceInputError("Principal must be greater than zero.");
  if (!Number.isInteger(tenureMonths) || tenureMonths <= 0) throw new FinanceInputError("Tenure must be a positive whole number of months.");
  if (!Number.isFinite(annualRate) || annualRate < 0) throw new FinanceInputError("Interest rate cannot be negative.");
  const r = annualRate / 12 / 100;
  if (r === 0) return round2(principal / tenureMonths);
  const pow = Math.pow(1 + r, tenureMonths);
  return round2((principal * r * pow) / (pow - 1));
}

export function buildRepaymentPlan(input: EmiInput): EmiResult {
  const { principal, annualRate, tenureMonths } = input;
  const moratoriumMonths = Math.max(0, Math.floor(input.moratoriumMonths || 0));
  const moratoriumType = moratoriumMonths > 0 ? input.moratoriumType : "none";

  if (!Number.isFinite(principal) || principal <= 0) throw new FinanceInputError("Principal must be greater than zero.");
  if (!Number.isInteger(tenureMonths) || tenureMonths <= 0) throw new FinanceInputError("Tenure must be a positive whole number of months.");
  if (!Number.isFinite(annualRate) || annualRate < 0) throw new FinanceInputError("Interest rate cannot be negative.");

  const r = annualRate / 12 / 100;
  const schedule: ScheduleRow[] = [];
  let balance = principal;
  let month = 0;
  let moratoriumMonthlyPayment = 0;
  let totalInterest = 0;
  let totalPaid = 0;

  for (let m = 0; m < moratoriumMonths; m++) {
    month++;
    const interest = round2(balance * r);
    if (moratoriumType === "interest_only") {
      moratoriumMonthlyPayment = interest;
      schedule.push({ month, phase: "Moratorium", openingBalance: round2(balance), payment: interest, interest, principal: 0, closingBalance: round2(balance) });
      totalInterest += interest;
      totalPaid += interest;
    } else {
      // capitalized
      const opening = balance;
      balance = round2(balance + interest);
      schedule.push({ month, phase: "Moratorium", openingBalance: round2(opening), payment: 0, interest, principal: 0, closingBalance: balance });
      totalInterest += interest;
    }
  }

  const effectivePrincipal = round2(balance);
  const emi = computeEmi(effectivePrincipal, annualRate, tenureMonths);

  for (let m = 0; m < tenureMonths; m++) {
    month++;
    const opening = balance;
    const interest = round2(balance * r);
    let principalPart = round2(emi - interest);
    let payment = emi;
    if (m === tenureMonths - 1 || principalPart > balance) {
      principalPart = round2(balance);
      payment = round2(principalPart + interest);
    }
    balance = round2(balance - principalPart);
    if (balance < 0.005) balance = 0;
    schedule.push({ month, phase: "Repayment", openingBalance: round2(opening), payment, interest, principal: principalPart, closingBalance: balance });
    totalInterest += interest;
    totalPaid += payment;
  }

  return {
    input: { ...input, moratoriumMonths, moratoriumType },
    emi,
    moratoriumMonthlyPayment: round2(moratoriumMonthlyPayment),
    effectivePrincipal,
    totalInterest: round2(totalInterest),
    totalRepayment: round2(totalPaid),
    totalMonths: moratoriumMonths + tenureMonths,
    schedule,
  };
}
