import { RC, stime } from "@thegraid/common-lib";
import { SetupElt as SetupEltLib, ScenarioParser as SPLib } from "@thegraid/hexlib";
import { AfColor, AfFill, ATS } from "./AfHex";
import { GamePlay } from "./game-play";
import { HexMap } from "./hex";
import { PlanetElt } from "./planet";
import { ShipSpec } from "./ship";

/** quantity of each Cargo Item produced/consumed on Planet or Ship */
type AfHexSpec = { aShape: ATS, aColor: AfColor, aFill: AfFill, Aname: string, spin: number };
type AfSpec = { rc: RC, afHex: AfHexSpec };


export interface SetupElt extends SetupEltLib {
  planets?: PlanetElt[];
  ships?: ShipSpec[][]; // ShipSpec[] per Player
  afspec?: AfSpec[];
}

export class ScenarioParser extends SPLib {
  override map: HexMap; // HexMapLib<MktHex>
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
    const turnNumber = (turnSet) ? turn : -1;
    {
      gamePlay.turnNumber = turnNumber;
      table.logText(`turn = ${turnNumber}`, `parseScenario`);
      //
      this.gamePlay.allTiles.forEach(tile => tile.hex?.isOnMap ? tile.sendHome() : undefined); // clear existing map
    }
    { // make & place Planets:
      const planetMap = gamePlay.planets;
      planetMap.makePlanets();  // generic Planets with initialPCs
      if (planets) {
        planets.forEach(pElt => planetMap.resetPlanet(pElt))
      } else {
        planetMap.placePlanets(); // generic Planets in randomHex
      }
    }
    // place ships:
    gamePlay.forEachPlayer(player => {
      const shipSpecs = ships?.pop() ?? gamePlay.initialShips(player);
      player.placeShips(shipSpecs);
    })
    if (gameState) {
      this.gamePlay.gameState.parseState(gameState);
    }
    this.gamePlay.hexMap.update();
  }
}
