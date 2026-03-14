import type { GameConfig, GameState, Resources, VictoryRequirements } from "../game/types";

export interface StatusEvaluation {
  status: "running" | "won" | "lost";
  reason: string | null;
  victoryProgress: number;
}

export function evaluateStatus(state: GameState, config: GameConfig): StatusEvaluation {
  if (state.resources.gold < 0) {
    return { status: "lost", reason: "Bankruptcy: Gold dropped below 0.", victoryProgress: 0 };
  }
  if (state.resources.happiness <= 0) {
    return { status: "lost", reason: "Civil unrest: Happiness reached 0.", victoryProgress: 0 };
  }
  if (state.resources.pollution >= config.pollutionLossThreshold) {
    return {
      status: "lost",
      reason: `Ecological collapse: Pollution reached ${config.pollutionLossThreshold}.`,
      victoryProgress: 0,
    };
  }
  if (
    state.turn >= config.populationCollapseTurn &&
    state.resources.population < config.populationCollapseThreshold
  ) {
    return {
      status: "lost",
      reason: `Population collapse: stay above ${config.populationCollapseThreshold} by turn ${config.populationCollapseTurn}.`,
      victoryProgress: 0,
    };
  }

  const meetsVictory = meetsVictoryRequirements(state.resources, config.victoryRequirements);
  const victoryProgress = meetsVictory ? state.victoryProgress + 1 : 0;
  if (victoryProgress >= config.victoryRequirements.sustainTurns) {
    return {
      status: "won",
      reason: `Victory: Balanced city sustained for ${config.victoryRequirements.sustainTurns} turns.`,
      victoryProgress,
    };
  }

  return { status: "running", reason: null, victoryProgress };
}

export function meetsVictoryRequirements(
  resources: Resources,
  requirements: VictoryRequirements,
): boolean {
  return (
    resources.population >= requirements.population &&
    resources.happiness >= requirements.minHappiness &&
    resources.pollution <= requirements.maxPollution &&
    resources.gold >= requirements.minGold
  );
}
