// ── Balanced masonry for the infinite gallery unit ─────────
// Every column has the same width and each piece keeps its true proportions.
// Because the unit repeats vertically, every column must end at the same
// height: tiles are balanced across columns, and whatever difference is left
// is spread over that column's gaps.

// Golden-ratio steps give column offsets that never line up into a "row".
const STAGGER_STEP = 0.618;

/**
 * @param {object} options
 * @param {{ workId: string, aspect: number }[]} options.tiles  aspect = width / height
 * @param {number} options.width    unit width (px)
 * @param {number} options.columns
 * @param {number} options.gap      minimum gap between pieces (px)
 * @param {number} options.stagger  max vertical offset between columns (px)
 * @returns {{ height: number, boxes: { x: number, y: number, w: number, h: number }[] }}
 */
export function layoutMasonry({ tiles, width, columns, gap, stagger }) {
  const cols = Math.max(1, Math.min(columns, tiles.length));
  // Half a gap on each side so the seam between repeated units is a full gap
  const colW = (width - cols * gap) / cols;
  const heights = tiles.map((tile) => colW / tile.aspect);

  const offsets = Array.from({ length: cols }, (_, c) => ((c * STAGGER_STEP) % 1) * stagger);
  const plan = balance(tiles, heights, cols, gap, offsets);
  const length = (col) => col.reduce((sum, i) => sum + heights[i] + gap, 0);
  const unitH = Math.max(...plan.map(length));

  const boxes = [];
  plan.forEach((col, c) => {
    const slack = col.length ? (unitH - length(col)) / col.length : 0;
    const colGap = gap + slack;
    let y = gap / 2 + offsets[c];
    col.forEach((i) => {
      boxes[i] = { x: gap / 2 + c * (colW + gap), y, w: colW, h: heights[i] };
      y += heights[i] + colGap;
    });
  });

  return { height: unitH, boxes };
}

// Greedy shortest-column fill, then local moves/swaps that shrink the spread
// between the longest and shortest column while keeping repeats of the same
// work apart. Restarts from each rotation of the sequence and keeps the best.
// Deterministic for a given input.
function balance(tiles, heights, cols, gap, offsets) {
  const lengthOf = (col) => col.reduce((sum, i) => sum + heights[i] + gap, 0);

  // Same work side by side in neighbouring columns (the last column neighbours
  // the first across the unit seam). Columns repeat every `period`, so compare
  // centres on a circle. Approximates the final positions (ignores the slack
  // added to shorter columns), which is close since columns end up balanced.
  const sideBySide = (p) => {
    const period = Math.max(...p.map(lengthOf));
    const centres = p.map((col, c) => {
      let y = offsets[c];
      return col.map((i) => {
        const centre = y + heights[i] / 2;
        y += heights[i] + gap;
        return { i, centre };
      });
    });
    let count = 0;
    for (let c = 0; c < p.length; c += 1) {
      const next = (c + 1) % p.length;
      if (next === c || (p.length === 2 && c === 1)) continue;
      centres[c].forEach((a) => centres[next].forEach((b) => {
        if (tiles[a.i].workId !== tiles[b.i].workId) return;
        const d = Math.abs(a.centre - b.centre) % period;
        if (Math.min(d, period - d) < (heights[a.i] + heights[b.i]) / 2 + gap) count += 1;
      }));
    }
    return count;
  };

  const SIDE_BY_SIDE_COST = 10000; // a repeat next to itself outweighs any spread gain
  const spread = (p) => {
    const l = p.map(lengthOf);
    const stacked = p.filter((col) => !valid(col)).length;
    return Math.max(...l) - Math.min(...l) + (sideBySide(p) + stacked) * SIDE_BY_SIDE_COST;
  };
  // Tiles keep sequence order within a column; the same work should not sit
  // directly above itself (columns wrap, so first/last are neighbours too).
  const valid = (col) => col.every((i, k) =>
    col.length < 2 || tiles[i].workId !== tiles[col[(k + 1) % col.length]].workId);
  const sorted = (col) => [...col].sort((a, b) => a - b);

  let bestPlan = null;
  let bestCost = Infinity;
  for (let start = 0; start < tiles.length && bestCost > 0.5; start += 1) {
    const plan = Array.from({ length: cols }, () => []);
    const len = plan.map(() => 0);
    tiles.forEach((_, k) => {
      const i = (start + k) % tiles.length;
      const c = len.indexOf(Math.min(...len));
      plan[c].push(i);
      len[c] += heights[i] + gap;
    });
    plan.forEach((col, c) => { plan[c] = sorted(col); });
    const cost = improve(plan);
    if (cost < bestCost) { bestCost = cost; bestPlan = plan; }
  }
  return bestPlan;

  function improve(plan) {
    let best = spread(plan);
    for (let pass = 0; pass < 200; pass += 1) {
      let improved = null;
      for (let a = 0; a < cols; a += 1) {
        for (let b = 0; b < cols; b += 1) {
          if (a === b) continue;
          plan[a].forEach((i) => {
            // Move i from column a to b
            const moveA = plan[a].filter((t) => t !== i);
            const moveB = sorted([...plan[b], i]);
            if (moveA.length) {
              const next = plan.map((col, c) => (c === a ? moveA : c === b ? moveB : col));
              const s = spread(next);
              if (s < best - 0.5) { best = s; improved = next; }
            }
            // Swap i with each tile j in column b
            plan[b].forEach((j) => {
              const swapA = sorted([...plan[a].filter((t) => t !== i), j]);
              const swapB = sorted([...plan[b].filter((t) => t !== j), i]);
              const next = plan.map((col, c) => (c === a ? swapA : c === b ? swapB : col));
              const s = spread(next);
              if (s < best - 0.5) { best = s; improved = next; }
            });
          });
        }
      }
      if (!improved) break;
      improved.forEach((col, c) => { plan[c] = col; });
    }
    return best;
  }
}
