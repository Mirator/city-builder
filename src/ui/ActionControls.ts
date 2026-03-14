export interface ActionControlsGameController {
  clearSelection(): void;
  endPlacementPhase(): void;
}

interface ActionControlsElements {
  clearSelection: HTMLButtonElement;
  endTurn: HTMLButtonElement;
}

export interface ActionControlsBinding {
  dispose(): void;
}

export function bindActionControls(
  elements: ActionControlsElements,
  game: ActionControlsGameController,
): ActionControlsBinding {
  const onClearSelection = () => game.clearSelection();
  const onEndTurn = () => game.endPlacementPhase();

  elements.clearSelection.addEventListener("click", onClearSelection);
  elements.endTurn.addEventListener("click", onEndTurn);

  return {
    dispose() {
      elements.clearSelection.removeEventListener("click", onClearSelection);
      elements.endTurn.removeEventListener("click", onEndTurn);
    },
  };
}
