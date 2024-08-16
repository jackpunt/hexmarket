import { GameState as GameStateLib } from "@thegraid/hexlib";
import { Table } from "./table";

export class GameState extends GameStateLib {
  override get table(): Table {
    return super.table as Table;
  }

  override parseState(gameState: any[]): void {
    return;
  }
}
