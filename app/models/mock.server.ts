import { readFile } from "fs/promises";
import { Convert } from "./convert.server";

import type { Game } from "./game.server";

/** MOCK_GAME has two rounds. The first round has 1 category with 2 clues and the
 * second round has 1 category with 1 clue.
 */
export const MOCK_GAME: Game = {
  id: "mock",
  title: "Mock Game",
  author: "",
  copyright: "",
  note: "",
  boards: [
    {
      categoryNames: ["Round 1, Category 1"],
      categories: [
        {
          name: "Round 1, Category 1",
          clues: [
            { clue: "a", answer: "b", value: 200 },
            { clue: "c", answer: "d", value: 400 },
          ],
        },
      ],
    },
    {
      categoryNames: ["Round 2, Category 1"],
      categories: [
        {
          name: "Round 2, Category 1",
          clues: [{ clue: "e", answer: "f", value: 400 }],
        },
      ],
    },
  ],
};

export async function getMockGame(): Promise<Game> {
  // Find the absolute path of the json directory
  // Note: Vercel doesn't include the json directory when using process.cwd() or
  // path.join(). The workaround is to use __dirname and concatenate the json
  // directory to it.
  const jsonDirectory = __dirname + "/../app/static";
  // Read the json data file data.json
  const fileContents = await readFile(jsonDirectory + "/mock.jep.json", "utf8");

  const game = Convert.toGame(fileContents);
  return { id: "mock", ...game };
}