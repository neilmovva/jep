import * as React from "react";

import { Game } from "~/models/game.server";
import BoardComponent from "~/components/board";
import ClueState from "~/utils/clue-state";
import BoardState from "~/utils/board-state";
import Prompt from "~/components/prompt";
import { Board } from "~/models/board.server";
import Preview from "~/components/preview";
import { Clue } from "~/models/clue.server";

class GameState {
  boardStates: BoardState[];

  constructor(g: Game) {
    this.boardStates = [];
    for (const board of g.boards) {
      this.boardStates.push(new BoardState(board));
    }
  }

  get(round: number) {
    return this.boardStates[round];
  }

  set(round: number, state: BoardState) {
    this.boardStates[round] = state;
    return this;
  }
}

/** GameComponent maintains the game state. */
export default function GameComponent({
  game,
  errorMsg,
}: {
  game: Game;
  errorMsg?: string;
}) {
  const [gameState, setGameState] = React.useState(new GameState(game));
  const [clueIdx, setClueIdx] = React.useState<{ i: number; j: number }>();

  const [round, setRound] = React.useState(0);

  const [showPreview, setShowPreview] = React.useState(true);

  const board: Board | undefined = game.boards[round];

  const getActiveClue = (i: number, j: number) => {
    if (board) {
      const category = board.categories[j];
      return category.clues[i];
    }
  };

  const clue = clueIdx ? getActiveClue(clueIdx.i, clueIdx.j) : undefined;

  const finalBoard = game.boards[game.boards.length - 1];
  const clues = finalBoard.categories[finalBoard.categories.length - 1].clues;
  const finalClue: Clue | undefined = clues[clues.length - 1];

  const handleClickClue = (i: number, j: number) => {
    const boardState = gameState.get(round);
    if (!boardState || boardState.get(i, j)?.isAnswered) {
      return;
    }
    // not yet answered
    const newClueState = new ClueState({
      isActive: true,
      isAnswered: false,
    });
    const newBoardState = boardState.set(i, j, newClueState);
    setGameState((gs) => gs.set(round, newBoardState));
    setClueIdx({ i, j });
  };

  if (errorMsg !== undefined) {
    return <div>Error :({errorMsg}</div>;
  }

  const handleClickPrompt = (i: number, j: number) => {
    const newClueState = new ClueState({
      isAnswered: true,
      isActive: false,
    });
    const newBoardState = gameState.get(round).set(i, j, newClueState);
    setGameState((gs) => gs.set(round, newBoardState));

    if (newBoardState.answered()) {
      setRound((r) => r + 1);
      setShowPreview(true);
    }
    setClueIdx(undefined);
  };

  return (
    <>
      <Preview
        round={round}
        numRounds={game.boards.length}
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        finalClue={finalClue}
      />
      <Prompt
        clue={clue}
        onClick={() =>
          clueIdx ? handleClickPrompt(clueIdx.i, clueIdx.j) : null
        }
      />
      <div className="bg-black">
        {board && (
          <BoardComponent
            board={board}
            roundMultiplier={round + 1}
            boardState={gameState.get(round)}
            onClickClue={handleClickClue}
          />
        )}
      </div>
    </>
  );
}
