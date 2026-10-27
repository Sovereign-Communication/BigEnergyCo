/**
 * Answer the budget question from the cached frontier without changing the
 * independent bill-cut target. Points use x=up-front cost and y=the outcome
 * the curve measures (bill cut in grid-tie mode).
 */
export function bestAffordableCurvePoint(points, budgetUsd) {
  if (budgetUsd === null || budgetUsd === undefined || budgetUsd === "")
    return null;
  const budget = Number(budgetUsd);
  if (!Array.isArray(points) || !Number.isFinite(budget)) return null;

  let best = null;
  for (const point of points) {
    if (
      !point ||
      !Number.isFinite(point.x) ||
      !Number.isFinite(point.y) ||
      point.x > budget
    )
      continue;
    if (!best || point.y > best.y || (point.y === best.y && point.x < best.x)) {
      best = point;
    }
  }
  return best;
}
