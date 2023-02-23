import { createClient } from "@supabase/supabase-js";
import * as React from "react";

import { Game, Clue, Board } from "~/models/convert.server";
import { applyRoomEventsToState, processRoomEvent } from "~/models/room-event";
import { RoomEvent } from "~/models/room-event.server";
import { generateGrid } from "~/utils/utils";

export enum GameState {
  Preview = "Preview",
  WaitForClueChoice = "WaitForClueChoice",
  Prompt = "Prompt",
}

export interface Player {
  userId: string;
  name: string;
}

export interface State {
  type: GameState;
  activeClue?: [number, number];
  boardControl?: string;
  game: Game;
  isAnswered: boolean[][];
  numAnswered: number;
  numCluesInBoard: number;
  players: Map<string, Player>;
  round: number;
}

function createInitialState(game: Game, round: number): State {
  const board = game.boards[round];

  const numCluesInBoard = board
    ? board.categories.reduce(
        (acc, category) => (acc += category.clues.length),
        0
      )
    : 0;
  const n = board ? board.categories[0].clues.length : 0;
  const m = board ? board.categories.length : 0;

  return {
    type: GameState.Preview,
    game: game,
    isAnswered: generateGrid(n, m, false),
    numAnswered: 0,
    numCluesInBoard,
    players: new Map(),
    round,
  };
}

export enum ActionType {
  ClickClue = "ClickClue",
  AnswerClue = "AnswerClue",
  PlayerJoin = "PlayerJoin",
  PlayerChangeName = "PlayerChangeName",
  StartRound = "StartRound",
}

export interface Action {
  type: ActionType;
  payload?: unknown;
}

interface IndexedAction extends Action {
  type: ActionType.ClickClue;
  payload: [number, number];
}

interface PlayerAction extends Action {
  type: ActionType;
  payload: Player;
}

interface RoundAction extends Action {
  type: ActionType.StartRound;
  payload: number;
}

function isIndexedAction(action: Action): action is IndexedAction {
  return action.type === ActionType.ClickClue;
}

function isPlayerAction(action: Action): action is PlayerAction {
  return (
    action.type === ActionType.PlayerJoin ||
    action.type === ActionType.PlayerChangeName
  );
}

function isRoundAction(action: Action): action is RoundAction {
  return action.type === ActionType.StartRound;
}

/** gameReducer is the state machine which implements the game. */
function gameReducer(state: State, action: Action): State {
  switch (action.type) {
    case ActionType.StartRound: {
      if (isRoundAction(action)) {
        const actionRound = action.payload;
        if (actionRound === state.round) {
          const nextState = { ...state };
          nextState.type = GameState.WaitForClueChoice;
          return nextState;
        }
        return state;
      }
      throw new Error("StartRound action must have an associated round number");
    }
    case ActionType.ClickClue: {
      if (isIndexedAction(action)) {
        const [i, j] = action.payload;
        if (state.isAnswered[i][j]) {
          return state;
        }

        const nextState = { ...state };
        nextState.type = GameState.Prompt;
        nextState.activeClue = [i, j];

        return nextState;
      }
      throw new Error("ClickClue action must have an associated index");
    }
    case ActionType.AnswerClue: {
      const newNumAnswered = state.numAnswered + 1;

      if (newNumAnswered === state.numCluesInBoard) {
        const newRound = state.round++;
        const nextState = createInitialState(state.game, newRound);
        return nextState;
      }

      const nextState = { ...state };
      const activeClue = state.activeClue;
      if (!activeClue) {
        throw new Error("cannot answer clue if no clue was active");
      }
      const [i, j] = activeClue;
      nextState.isAnswered[i][j] = true;
      nextState.activeClue = undefined;
      nextState.type = GameState.WaitForClueChoice;
      nextState.numAnswered = newNumAnswered;

      return nextState;
    }
    case ActionType.PlayerJoin: {
      if (isPlayerAction(action)) {
        const nextState = { ...state };
        nextState.players.set(action.payload.userId, action.payload);
        // If this is the first player joining, give them board control.
        if (nextState.players.size === 1) {
          nextState.boardControl = action.payload.userId;
        }
        return nextState;
      }
      throw new Error("PlayerJoin action must have an associated player");
    }
    case ActionType.PlayerChangeName: {
      if (isPlayerAction(action)) {
        const nextState = { ...state };
        nextState.players.set(action.payload.userId, action.payload);
        return nextState;
      }
      throw new Error("PlayerChangeName action must have an associated player");
    }
  }
}

/** useGame provides all the state variables associated with a game and methods
 * to change them. */
export function useGame(
  game: Game,
  serverRoomEvents: RoomEvent[],
  roomId: number,
  SUPABASE_URL: string,
  SUPABASE_ANON_KEY: string
) {
  const [seenRoomEvents, setSeenRoomEvents] = React.useState(
    new Set<number>(serverRoomEvents.map((re) => re.id))
  );

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    realtime: {
      params: {
        eventsPerSecond: 1,
      },
    },
  });

  // TODO: spectator, points

  const [state, dispatch] = React.useReducer(
    gameReducer,
    { game, serverRoomEvents },
    (arg) =>
      applyRoomEventsToState(
        createInitialState(arg.game, 0),
        arg.serverRoomEvents
      )
  );

  // When new room events come in, process any we haven't seen.
  React.useEffect(() => {
    for (const re of serverRoomEvents) {
      if (!seenRoomEvents.has(re.id)) {
        setSeenRoomEvents((prev) => new Set(prev).add(re.id));
        processRoomEvent(re, dispatch);
      }
    }
  }, [serverRoomEvents]);

  React.useEffect(() => {
    const channel = client
      .channel(`room:${roomId}`)
      .on<RoomEvent>(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "room_events",
          filter: "room_id=eq." + roomId,
        },
        (payload) => {
          const newEvent: RoomEvent = payload.new;
          // Only process events we haven't seen yet
          if (!seenRoomEvents.has(newEvent.id)) {
            setSeenRoomEvents((prev) => new Set(prev).add(newEvent.id));
            processRoomEvent(newEvent, dispatch);
          }
        }
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [client, seenRoomEvents, setSeenRoomEvents]);

  const board = game.boards[state.round];

  let clue: Clue | undefined;
  let category: string | undefined;
  if (state.activeClue) {
    const [i, j] = state.activeClue;
    clue = state.activeClue ? board.categories[j].clues[i] : undefined;
    category = state.activeClue ? board.categoryNames[j] : undefined;
  }

  const onClosePrompt = () => {
    dispatch({ type: ActionType.AnswerClue });
  };

  const isAnswered = (i: number, j: number) => state.isAnswered[i][j];

  return {
    type: state.type,
    board,
    category,
    clue,
    isAnswered,
    onClosePrompt,
    players: state.players,
    round: state.round,
    boardControl: state.boardControl,
  };
}
