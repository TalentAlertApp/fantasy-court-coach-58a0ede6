/**
 * Deterministic lineup optimizer.
 * Greedy swap: for each bench/starter pair, check if swapping increases total FP5
 * while maintaining salary cap and FC/BC constraints.
 */

export interface OptimizerPlayer {
  id: number;
  name: string;
  team: string;
  fc_bc: "FC" | "BC";
  salary: number;
  fp5: number;
}

export interface OptimizerSwap {
  benchPlayer: OptimizerPlayer;
  starterPlayer: OptimizerPlayer;
  deltaFp5: number;
}

export interface OptimizerResult {
  swaps: OptimizerSwap[];
  totalDeltaFp5: number;
  newStarters: number[];
  newBench: number[];
}

function countPositions(players: OptimizerPlayer[]) {
  let fc = 0, bc = 0;
  for (const p of players) {
    if (p.fc_bc === "FC") fc++;
    else bc++;
  }
  return { fc, bc };
}

export function optimizeLineup(
  starters: OptimizerPlayer[],
  bench: OptimizerPlayer[],
  constraints: { salary_cap: number; starter_fc_min: number; starter_bc_min: number }
): OptimizerResult {
  const currentStarters = [...starters];
  const currentBench = [...bench];
  const swaps: OptimizerSwap[] = [];
  let improved = true;

  while (improved) {
    improved = false;
    let bestSwap: { si: number; bi: number; delta: number } | null = null;

    for (let si = 0; si < currentStarters.length; si++) {
      for (let bi = 0; bi < currentBench.length; bi++) {
        const starter = currentStarters[si];
        const benchP = currentBench[bi];
        const delta = benchP.fp5 - starter.fp5;
        if (delta <= 0) continue;

        // Check constraints after swap
        const newStarters = [...currentStarters];
        newStarters[si] = benchP;
        const { fc, bc } = countPositions(newStarters);
        if (fc < constraints.starter_fc_min || bc < constraints.starter_bc_min) continue;

        // Check salary cap (total roster salary stays same since it's a swap)
        if (!bestSwap || delta > bestSwap.delta) {
          bestSwap = { si, bi, delta };
        }
      }
    }

    if (bestSwap) {
      const starterOut = currentStarters[bestSwap.si];
      const benchIn = currentBench[bestSwap.bi];
      swaps.push({
        benchPlayer: benchIn,
        starterPlayer: starterOut,
        deltaFp5: bestSwap.delta,
      });
      currentStarters[bestSwap.si] = benchIn;
      currentBench[bestSwap.bi] = starterOut;
      improved = true;
    }
  }

  return {
    swaps,
    totalDeltaFp5: swaps.reduce((sum, s) => sum + s.deltaFp5, 0),
    newStarters: currentStarters.map(p => p.id),
    newBench: currentBench.map(p => p.id),
  };
}
