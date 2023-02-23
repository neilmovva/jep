import type { RoomEvent } from "~/models/room-event.server";
import type { Action, State } from "~/utils/use-game";
import { ActionType, GameState } from "~/utils/use-game";

export enum RoomEventType {
  Join = "join",
  ChangeName = "change_name",
  StartRound = "start_round",
  ChooseClue = "choose_clue",
}

export function isPlayerEvent(re: RoomEvent): re is {
  id: number;
  ts: string;
  room_id: number;
  type: RoomEventType.Join;
  payload: { userId: string; name: string };
} {
  return (
    (re.type === RoomEventType.Join || re.type === RoomEventType.ChangeName) &&
    re.payload !== null &&
    typeof re.payload === "object" &&
    "userId" in re.payload &&
    "name" in re.payload
  );
}

function isRoundEvent(re: RoomEvent): re is {
  id: number;
  ts: string;
  room_id: number;
  type: RoomEventType.StartRound;
  payload: { round: number };
} {
  return (
    re.type === RoomEventType.StartRound &&
    re.payload !== null &&
    typeof re.payload === "object" &&
    "round" in re.payload
  );
}

function isChooseClueEvent(re: RoomEvent): re is {
  id: number;
  ts: string;
  room_id: number;
  type: RoomEventType.ChooseClue;
  payload: { userId: string; i: number; j: number };
} {
  return (
    re.type === RoomEventType.ChooseClue &&
    re.payload !== null &&
    typeof re.payload === "object" &&
    "userId" in re.payload &&
    "i" in re.payload &&
    "j" in re.payload
  );
}

/** processRoomEvent dispatches the appropriate Action to the reducer based on
 * the room event. */
export function processRoomEvent(
  roomEvent: RoomEvent,
  dispatch: React.Dispatch<Action>
) {
  switch (roomEvent.type) {
    case RoomEventType.Join:
      if (isPlayerEvent(roomEvent)) {
        return dispatch({
          type: ActionType.Join,
          payload: {
            userId: roomEvent.payload.userId,
            name: roomEvent.payload.name,
          },
        });
      }
      throw new Error("Join event must have a payload");
    case RoomEventType.ChangeName:
      if (isPlayerEvent(roomEvent)) {
        return dispatch({
          type: ActionType.ChangeName,
          payload: {
            userId: roomEvent.payload.userId,
            name: roomEvent.payload.name,
          },
        });
      }
      throw new Error("ChangeName event must have a payload");
    case RoomEventType.StartRound:
      if (isRoundEvent(roomEvent)) {
        return dispatch({
          type: ActionType.StartRound,
          payload: roomEvent.payload.round,
        });
      }
      throw new Error("StartRound event must have a payload");
    case RoomEventType.ChooseClue:
      if (isChooseClueEvent(roomEvent)) {
        return dispatch({
          type: ActionType.ChooseClue,
          payload: roomEvent.payload,
        });
      }
      throw new Error("ChooseClue event must have a payload");
    default:
      throw new Error("unhandled room event type: " + roomEvent.type);
  }
}

/** applyRoomEventToState modifies State to account for the room event. */
function applyRoomEventToState(roomEvent: RoomEvent, state: State) {
  switch (roomEvent.type) {
    case RoomEventType.Join:
      if (isPlayerEvent(roomEvent)) {
        state.players.set(roomEvent.payload.userId, {
          userId: roomEvent.payload.userId,
          name: roomEvent.payload.name,
        });
        // If this is the first player joining, give them board control.
        if (state.players.size === 1) {
          state.boardControl = roomEvent.payload.userId;
        }
      }
      return state;
    case RoomEventType.ChangeName:
      if (isPlayerEvent(roomEvent)) {
        state.players.set(roomEvent.payload.userId, {
          userId: roomEvent.payload.userId,
          name: roomEvent.payload.name,
        });
      }
      return state;
    case RoomEventType.StartRound:
      if (isRoundEvent(roomEvent)) {
        const actionRound = roomEvent.payload.round;
        if (actionRound === state.round) {
          state.type = GameState.WaitForClueChoice;
        }
      }
      return state;
    case RoomEventType.ChooseClue:
      if (isChooseClueEvent(roomEvent)) {
        const { userId, i, j } = roomEvent.payload;
        if (
          state.type === GameState.WaitForClueChoice &&
          state.boardControl === userId &&
          !state.isAnswered[i][j]
        ) {
          state.type = GameState.ReadClue;
          state.activeClue = [i, j];
        }
      }
      return state;
    default:
      throw new Error("unhandled room event type: " + roomEvent.type);
  }
}

/** applyRoomEventsToState mutates State to account for each room event. */
export function applyRoomEventsToState(
  state: State,
  serverRoomEvents: RoomEvent[]
) {
  for (const re of serverRoomEvents) {
    applyRoomEventToState(re, state);
  }
  return state;
}
