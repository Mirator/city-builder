import type { GameConfig, GameState } from "../game/types";

export interface StatusEvaluation {
  status: "running" | "won" | "lost";
  reason: string | null;
}

export function evaluateStatus(state: GameState, config: GameConfig): StatusEvaluation {
  if (state.resources.gold < 0) {
    return { status: "lost", reason: "Bankruptcy: Gold dropped below 0." };
  }
  if (state.resources.happiness <= 0) {
    return { status: "lost", reason: "Civil unrest: Happiness reached 0." };
  }
  if (
    state.turn >= config.populationCollapseTurn &&
    state.resources.population < config.populationCollapseThreshold
  ) {
    return {
      status: "lost",
      reason: `Population collapse: stay above ${config.populationCollapseThreshold} by turn ${config.populationCollapseTurn}.`,
    };
  }
  if (state.resources.population >= config.victoryPopulation) {
    return { status: "won", reason: "Victory: Population target reached." };
  }
  return { status: "running", reason: null };
}
