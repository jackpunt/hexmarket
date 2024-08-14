import { GameState as GameStateLib } from "@thegraid/hexlib";
import { PlanetLocs } from "./planet";
import { Player } from "./player";
import { Table } from "./table";

export class GameState extends GameStateLib {
  override get table(): Table {
    return super.table as Table;
  }

  override parseState(gameState): void {
    // Maybe these will/should be in SetupElt in parseScenario.
    const { pLocs, ships } = gameState as { pLocs: PlanetLocs, ships: number };
    // TODO: parse gameState and do all the things
    this.table.hexMap.placePlanets(pLocs);

    // initialize Players & Ships & Commodities
    this.gamePlay.forEachPlayer(p0 => {
      const p = p0 as Player;
      // p.makeShips();
      p.placeShips(); // gameState will say where & with what PCs.
      this.gamePlay.hexMap.update()
    })

  }
}
