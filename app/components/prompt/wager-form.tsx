import { useFetcher } from "@remix-run/react";
import * as React from "react";

import Button from "~/components/button";
import type { Action, Player } from "~/engine";
import { useEngineContext } from "~/engine";
import { useSoloAction } from "~/utils/use-solo-action";
import { getNormalizedClueValue } from "~/utils/utils";

const formatter = Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0, // Round to whole dollars.
});

function WagerForm({
  highestClueValue,
  score,
  loading,
  players,
  userId,
}: {
  highestClueValue: number;
  score: number;
  loading: boolean;
  players: Player[];
  userId: string;
}) {
  const maxWager = Math.max(score, highestClueValue);

  // Sort from highest to lowest score.
  const playerScores = players.sort((a, b) => b.score - a.score);

  const [inputRequired, setInputRequired] = React.useState(true);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-col items-center gap-2 w-full">
        <p className="text-white font-bold">
          How much will you wager on this clue?
        </p>
        <p className="text-gray-300 text-sm text-center">
          You can wager up to {formatter.format(maxWager)}.
        </p>
        <div className="text-gray-300 text-sm flex self-start gap-2 w-full overflow-x-scroll">
          {playerScores.map((p, i) => (
            <div
              className="flex flex-col items-center justify-between"
              key={`player-${i}`}
            >
              <p className="text-center">
                {p.name} {p.userId === userId ? "(you)" : null}
              </p>
              <p>{formatter.format(p.score)}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <input
          type="number"
          min={5}
          max={maxWager}
          id="wager"
          name="wager"
          className={
            "px-4 text-sm text-gray-900 border border-gray-300 rounded-lg bg-gray-50 " +
            "focus:ring-blue-500 focus:border-blue-500"
          }
          placeholder="choose wager amount"
          required={inputRequired}
        />
        <Button
          type="default"
          htmlType="submit"
          loading={loading}
          onClick={() => setInputRequired(true)}
        >
          submit
        </Button>
      </div>
      <Button
        type="primary"
        htmlType="submit"
        name="full"
        value={maxWager.toString()}
        loading={loading}
        onClick={() => setInputRequired(false)}
      >
        True double down ({formatter.format(maxWager)})
      </Button>
    </div>
  );
}

export default function ConnectedWagerForm({
  roomName,
  userId,
}: {
  roomName: string;
  userId: string;
}) {
  const { board, players, round, soloDispatch, activeClue } =
    useEngineContext();
  const fetcher = useFetcher<Action>();
  useSoloAction(fetcher, soloDispatch);
  const loading = fetcher.state === "loading";

  const [i, j] = activeClue ? activeClue : [-1, -1];

  const score = players.get(userId)?.score ?? 0;

  const numRows = board?.categories[0].clues.length ?? 0;
  const highestClueValueInRound = getNormalizedClueValue(numRows - 1, round);

  return (
    <fetcher.Form method="post" action={`/room/${roomName}/wager`}>
      <input type="hidden" value={userId} name="userId" />
      <input type="hidden" value={i} name="i" />
      <input type="hidden" value={j} name="j" />
      <WagerForm
        highestClueValue={highestClueValueInRound}
        loading={loading}
        players={Array.from(players.values())}
        score={score}
        userId={userId}
      />
    </fetcher.Form>
  );
}