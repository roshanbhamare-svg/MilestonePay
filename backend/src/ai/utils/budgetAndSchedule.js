export function roundCurrency(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/**
 * Deterministically allocate totalBudget across milestones using integer cents
 * and largest-remainder rounding so sum(paymentAmount) === roundCurrency(totalBudget).
 */
export function reconcileMilestoneBudgets(milestones = [], totalBudget) {
  const budget = roundCurrency(totalBudget);
  if (!Array.isArray(milestones) || milestones.length === 0) {
    return [];
  }
  if (!Number.isFinite(budget) || budget <= 0) {
    throw new Error("Project budget must be a positive number for milestone allocation");
  }

  const totalCents = Math.round(budget * 100);
  const count = milestones.length;
  const weights = milestones.map((m) => {
    const w = Number(m.weightPercentage ?? m.paymentAmount ?? 1);
    return Number.isFinite(w) && w > 0 ? w : 1;
  });
  const weightSum = weights.reduce((acc, w) => acc + w, 0);

  let centsAllocation;
  if (totalCents >= count) {
    // Reserve at least 1 cent per milestone, then distribute remaining cents proportionally
    const baseCents = Array(count).fill(1);
    const distributable = totalCents - count;
    const rawExtra = weights.map((w) => (distributable * w) / weightSum);
    const flooredExtra = rawExtra.map((val) => Math.floor(val));
    let remainder = distributable - flooredExtra.reduce((acc, v) => acc + v, 0);

    const ranked = rawExtra
      .map((val, idx) => ({ idx, frac: val - flooredExtra[idx] }))
      .sort((a, b) => b.frac - a.frac);

    for (let i = 0; i < ranked.length && remainder > 0; i += 1) {
      flooredExtra[ranked[i].idx] += 1;
      remainder -= 1;
    }

    centsAllocation = baseCents.map((base, idx) => base + flooredExtra[idx]);
  } else {
    centsAllocation = Array(count).fill(0);
    centsAllocation[0] = totalCents;
  }

  return milestones.map((m, idx) => ({
    ...m,
    paymentAmount: roundCurrency(centsAllocation[idx] / 100),
    order: idx + 1,
  }));
}

/**
 * Deterministically compute valid monotonic ISO deadlines up to projectDeadline.
 */
export function reconcileMilestoneDeadlines(
  milestones = [],
  projectDeadline,
  startDate = new Date()
) {
  if (!Array.isArray(milestones) || milestones.length === 0) {
    return [];
  }

  const startMs = new Date(startDate).getTime();
  const parsedEnd = projectDeadline ? new Date(projectDeadline).getTime() : NaN;
  const minEnd = startMs + milestones.length * 86400000;
  const effectiveEnd =
    Number.isFinite(parsedEnd) && parsedEnd > startMs + 3600000
      ? parsedEnd
      : minEnd + 20 * 86400000;
  const span = Math.max(effectiveEnd - startMs, 3600000);

  let prevRatio = 0;
  return milestones.map((m, idx) => {
    const defaultRatio = (idx + 1) / milestones.length;
    const candidate = Number(m.estimatedDaysRatio);
    let ratio =
      Number.isFinite(candidate) && candidate > 0 && candidate <= 1
        ? candidate
        : defaultRatio;

    if (idx === milestones.length - 1) {
      ratio = 1;
    } else {
      const minStep = (idx + 1) / (milestones.length + 1);
      ratio = Math.min(0.95, Math.max(ratio, prevRatio + 0.05, minStep * 0.5));
    }
    prevRatio = ratio;

    const deadlineMs = Math.min(effectiveEnd, Math.round(startMs + span * ratio));
    return {
      ...m,
      deadline: new Date(deadlineMs).toISOString(),
    };
  });
}

/**
 * Deterministic structural & financial validation of planned milestones.
 */
export function validateMilestonePlan(milestones = [], projectBudget) {
  const errors = [];
  const budget = roundCurrency(projectBudget);

  if (!Array.isArray(milestones) || milestones.length === 0) {
    errors.push("Milestone plan must contain at least 1 milestone.");
    return { isValid: false, errors };
  }

  if (budget >= 2 && milestones.length < 2) {
    errors.push("Projects with budget >= $2 should be split into at least 2 milestones.");
  }

  if (milestones.length > 8) {
    errors.push("Milestone count should not exceed 8 milestones.");
  }

  let sum = 0;
  let prevDeadline = 0;

  milestones.forEach((m, idx) => {
    const label = `Milestone #${idx + 1}`;
    if (!m.title || !String(m.title).trim()) {
      errors.push(`${label} is missing a title.`);
    }
    if (!m.description || !String(m.description).trim()) {
      errors.push(`${label} is missing a description.`);
    }
    if (!Array.isArray(m.deliverables) || m.deliverables.length === 0) {
      errors.push(`${label} must include at least one deliverable.`);
    } else if (m.deliverables.some((d) => !d?.title || !String(d.title).trim())) {
      errors.push(`${label} has a deliverable with an empty title.`);
    }
    if (!Array.isArray(m.acceptanceCriteria) || m.acceptanceCriteria.length === 0) {
      errors.push(`${label} must include at least one acceptance criterion.`);
    } else if (m.acceptanceCriteria.some((c) => !c?.criteria || !String(c.criteria).trim())) {
      errors.push(`${label} has an empty acceptance criterion.`);
    }

    const amount = Number(m.paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push(`${label} paymentAmount must be positive.`);
    } else {
      sum = roundCurrency(sum + amount);
    }

    const ts = new Date(m.deadline).getTime();
    if (!Number.isFinite(ts)) {
      errors.push(`${label} has an invalid deadline.`);
    } else if (ts < prevDeadline) {
      errors.push(`${label} deadline precedes the previous milestone.`);
    } else {
      prevDeadline = ts;
    }
  });

  if (Math.abs(sum - budget) > 0.01) {
    errors.push(`Sum of milestone amounts (${sum.toFixed(2)}) does not equal project budget (${budget.toFixed(2)}).`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Strip planning-only fields so each milestone matches Member B's Mongoose schema.
 */
export function formatMilestonesForPersistence(milestones = []) {
  return milestones.map((m, idx) => ({
    title: String(m.title).trim(),
    description: String(m.description || "").trim(),
    paymentAmount: roundCurrency(m.paymentAmount),
    deadline: new Date(m.deadline).toISOString(),
    deliverables: (m.deliverables || []).map((d) => ({
      title: String(d.title || "Deliverable").trim(),
      description: String(d.description || "").trim(),
    })),
    acceptanceCriteria: (m.acceptanceCriteria || []).map((c) => ({
      criteria: String(c.criteria || "").trim(),
      completed: false,
    })),
    order: idx + 1,
  }));
}
