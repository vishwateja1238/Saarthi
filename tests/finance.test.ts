import { describe, expect, it } from "vitest";
import { FinanceInputError, buildRepaymentPlan, computeEmi } from "@/lib/engines/finance-engine";

describe("finance engine", () => {
  it("computes a standard EMI (₹1,00,000 @ 12% for 12 months ≈ ₹8,884.88)", () => {
    expect(computeEmi(100000, 12, 12)).toBeCloseTo(8884.88, 1);
  });

  it("handles zero-interest loans separately", () => {
    expect(computeEmi(120000, 0, 12)).toBe(10000);
    const plan = buildRepaymentPlan({ principal: 120000, annualRate: 0, tenureMonths: 12, moratoriumMonths: 0, moratoriumType: "none" });
    expect(plan.totalInterest).toBe(0);
    expect(plan.totalRepayment).toBe(120000);
  });

  it("rejects invalid principal", () => {
    expect(() => computeEmi(0, 10, 12)).toThrow(FinanceInputError);
    expect(() => computeEmi(-5, 10, 12)).toThrow(FinanceInputError);
    expect(() => buildRepaymentPlan({ principal: NaN, annualRate: 10, tenureMonths: 12, moratoriumMonths: 0, moratoriumType: "none" })).toThrow(FinanceInputError);
  });

  it("rejects invalid tenure", () => {
    expect(() => computeEmi(1000, 10, 0)).toThrow(FinanceInputError);
    expect(() => computeEmi(1000, 10, 2.5)).toThrow(FinanceInputError);
  });

  it("applies interest-only moratorium: interest paid, principal unchanged, then EMI", () => {
    const plan = buildRepaymentPlan({ principal: 100000, annualRate: 12, tenureMonths: 12, moratoriumMonths: 3, moratoriumType: "interest_only" });
    expect(plan.totalMonths).toBe(15);
    expect(plan.schedule.slice(0, 3).every((r) => r.phase === "Moratorium" && r.principal === 0 && r.payment === 1000)).toBe(true);
    expect(plan.effectivePrincipal).toBe(100000);
    expect(plan.emi).toBeCloseTo(8884.88, 1);
    expect(plan.moratoriumMonthlyPayment).toBe(1000);
  });

  it("applies capitalised moratorium: interest accrues into principal", () => {
    const plan = buildRepaymentPlan({ principal: 100000, annualRate: 12, tenureMonths: 12, moratoriumMonths: 2, moratoriumType: "capitalized" });
    expect(plan.schedule[0].payment).toBe(0);
    expect(plan.effectivePrincipal).toBeCloseTo(102010, 0);
    expect(plan.emi).toBeGreaterThan(8884.88);
  });

  it("produces a repayment schedule that amortises to zero and sums consistently", () => {
    const plan = buildRepaymentPlan({ principal: 400000, annualRate: 7.5, tenureMonths: 84, moratoriumMonths: 12, moratoriumType: "capitalized" });
    expect(plan.schedule).toHaveLength(96);
    expect(plan.schedule[plan.schedule.length - 1].closingBalance).toBe(0);
    const paid = plan.schedule.reduce((s, r) => s + r.payment, 0);
    expect(paid).toBeCloseTo(plan.totalRepayment, 0);
    const interest = plan.schedule.reduce((s, r) => s + r.interest, 0);
    expect(interest).toBeCloseTo(plan.totalInterest, 0);
    for (let i = 1; i < plan.schedule.length; i++) {
      expect(plan.schedule[i].openingBalance).toBeCloseTo(plan.schedule[i - 1].closingBalance, 2);
    }
  });
});
