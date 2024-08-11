import { RC, stime } from "@thegraid/common-lib";
import { ScenarioParser as SPLib, SetupElt as SetupEltLib } from "@thegraid/hexlib";
import { AfColor, AfFill, ATS } from "./AfHex";
import { Item, Planet, PlanetElt } from "./planet";
import { GamePlay } from "./game-play";

/** quantity of each Cargo Item produced/consumed on Planet or Ship */
type Cargo = { [key in Item]?: number };
type ShipSpec = { rc: RC, Cargo: Cargo };
type AfHexSpec = { aShape: ATS, aColor: AfColor, aFill: AfFill, Aname: string, spin: number };
type AfSpec = { rc: RC, afHex: AfHexSpec };


export interface SetupElt extends SetupEltLib {
  planets?: PlanetElt[];
  ships?: ShipSpec[];
  afspec?: AfSpec[];
}

export class ScenarioParser extends SPLib {
  override gamePlay: GamePlay;
  /**
   * 3 cases of SetupElt[0]
   * a. (turn == undefined) initialize a new game, write out planetSpec/afSpec.
   * b. (turn == -1) special record with planetSpec/afSpec
   * c. (turn >= 0) normal start of turn; do NOT set planets/afSpec!
   *
   * @param setup
   */
  override parseScenario(setup: SetupElt) {
    console.log(stime(this, `.parseScenario: newState =`), setup);

    const { gameState, turn, planets, ships } = setup;
    const map = this.map, gamePlay = this.gamePlay, allPlayers = gamePlay.allPlayers, table = gamePlay.table;
    const turnSet = (turn !== undefined); // indicates a Saved Scenario: assign & place everything
    if (turnSet) {
      gamePlay.turnNumber = turn;
      table.logText(`turn = ${turn}`, `parseScenario`);
      //
      this.gamePlay.allTiles.forEach(tile => tile.hex?.isOnMap ? tile.sendHome() : undefined); // clear existing map
    }
    if (planets) {
      // TODO: to here from gameState.parseState()
    }
    if (gameState) {
      this.gamePlay.gameState.parseState(gameState);
    }
    this.gamePlay.hexMap.update();
  }
}
