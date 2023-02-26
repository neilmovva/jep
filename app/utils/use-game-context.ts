import * as React from "react";

import { GameState } from "../../engine/use-game-engine";
import type { useGameEngine } from "../../engine/use-game-engine";

export const GameContext = React.createContext<
  ReturnType<typeof useGameEngine>
>({
  type: GameState.Preview,
  activeClue: undefined,
  board: { categories: [], categoryNames: [] },
  boardControl: undefined,
  buzzes: new Map(),
  category: undefined,
  clue: undefined,
  isAnswered: () => false,
  numAnswered: 0,
  numCluesInBoard: 0,
  players: new Map(),
  round: 0,
  winningBuzzer: undefined,
});

export function useGameContext() {
  return React.useContext(GameContext);
}
