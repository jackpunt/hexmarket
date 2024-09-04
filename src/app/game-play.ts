import { KeyBinder, stime } from "@thegraid/easeljs-lib";
import { GamePlay as GamePlayLib, GameSetup } from "@thegraid/hexlib";
import { Player } from "./player";
//import { GameStats, TableStats } from "./stats";
import { GameState } from "./game-state";
import { HexMap } from "./hex";
import { PlanetMap } from "./planet";
import { Ship, ShipSpec } from "./ship";
import { Table } from "./table";
import { PlayerColor, TP } from "./table-params";

class HexEvent {}
class Move{}

/**
 * GamePlay with Table & GUI (KeyBinder, ParamGUI & Dragger)
 *
 * Implement game, enforce the rules, manage GameStats & hexMap; no GUI/Table required.
 *
 * Player actions are:
 * - move ship to hex
 * - buy/sell commodity or upgrade/ship
 * - attach: launch sub-space mine/disrupter?
 * - alter alignment of ship?
 * - alter alignment of hex?
 *
 */
export class GamePlay extends GamePlayLib {
  override gameSetup: GameSetup;
  override gameState: GameState = new GameState(this);
  override readonly hexMap: HexMap;
  override table: Table;
  override curPlayer: Player;
  override get allPlayers() { return Player.allPlayers; };
  planets = new PlanetMap(this.hexMap);

  // Args to f are local Player, not PlayerLib
  override forEachPlayer(f: (p: Player, index: number, players: Player[]) => void): void {
    return super.forEachPlayer(f);
  }

  /** return initial ship positions. some day use a GUI... */
  initialShips(player: Player): ShipSpec[] {
    // make and place one Ship for player
    const hex = player.chooseShipHex();
    const rc = { row: hex.row, col: hex.col };
    const cargo = TP.load;    // load some cargo for testing { F1: 5 }
    const spec = { z0: Ship.z0[Ship.defaultShipSize], rc, cargo } as ShipSpec;
    return [spec];
  }

  override logNextPlayer(from: string): void {
    const { logAt } = this.logWriterInfo();
    this.table.logText(`${stime.fs()} ${this.curPlayer.Aname}`, from, false);
    ; (document.getElementById('readFileName') as HTMLTextAreaElement).value = logAt;
  }

  override setNextPlayer(turnNumber?: number): void {
    super.setNextPlayer(turnNumber);
  }

  override bindKeys() {
    let table = this.table
    let roboPause = () => { this.forEachPlayer(p => this.pauseGame(p) )}
    let roboResume = () => { this.forEachPlayer(p => this.resumeGame(p) )}
    let roboStep = () => {
      let p = this.curPlayer, op = this.nextPlayer(p)
      this.pauseGame(op); this.resumeGame(p);
    }
    KeyBinder.keyBinder.setKey('p', { thisArg: this, func: roboPause })
    KeyBinder.keyBinder.setKey('r', { thisArg: this, func: roboResume })
    KeyBinder.keyBinder.setKey('s', { thisArg: this, func: roboStep })
    KeyBinder.keyBinder.setKey('R', { thisArg: this, func: () => this.runRedo = true })
    KeyBinder.keyBinder.setKey('q', { thisArg: this, func: () => this.runRedo = false })
    KeyBinder.keyBinder.setKey(/1-9/, { thisArg: this, func: (e: string) => { TP.maxBreadth = Number.parseInt(e) } })

    KeyBinder.keyBinder.setKey('M-z', { thisArg: this, func: this.undoMove })
    KeyBinder.keyBinder.setKey('b', { thisArg: this, func: this.undoMove })
    KeyBinder.keyBinder.setKey('f', { thisArg: this, func: this.redoMove })
    // KeyBinder.keyBinder.setKey('S', { thisArg: this, func: this.skipMove })
    // KeyBinder.keyBinder.setKey('M-K', { thisArg: this, func: this.resignMove })// S-M-k
    KeyBinder.keyBinder.setKey('Escape', {thisArg: table, func: table.stopDragging}) // Escape
    KeyBinder.keyBinder.setKey('C-s', { thisArg: this.gameSetup, func: () => { this.gameSetup.restart({}) } })// C-s START
    KeyBinder.keyBinder.setKey('C-c', { thisArg: this, func: this.stopPlayer })// C-c Stop Planner
    KeyBinder.keyBinder.setKey('C', () => this.table.reCacheTiles())// reCacheTiles
    // auto move:
    KeyBinder.keyBinder.setKey('m', { thisArg: this, func: this.makeMove, argVal: true })
    KeyBinder.keyBinder.setKey('M', { thisArg: this, func: this.makeMoveAgain, argVal: true })
    KeyBinder.keyBinder.setKey('n', { thisArg: this, func: this.autoMove, argVal: false })
    KeyBinder.keyBinder.setKey('N', { thisArg: this, func: this.autoMove, argVal: true})
    KeyBinder.keyBinder.setKey('c', { thisArg: this, func: this.autoPlay, argVal: 0})
    KeyBinder.keyBinder.setKey('v', { thisArg: this, func: this.autoPlay, argVal: 1})

    // click the confirm/cancel buttons:
    KeyBinder.keyBinder.setKey('c', { thisArg: this, func: this.clickConfirm, argVal: false })
    KeyBinder.keyBinder.setKey('y', { thisArg: this, func: this.clickConfirm, argVal: true })
    KeyBinder.keyBinder.setKey('d', { thisArg: this, func: this.clickDone, argVal: true })

    // diagnostics:
    KeyBinder.keyBinder.setKey('I', { thisArg: this, func: () => {this.table.enableHexInspector(); }})
    KeyBinder.keyBinder.setKey('t', { thisArg: this, func: () => {this.table.toggleText(undefined); }})

    KeyBinder.keyBinder.setKey('M-r', { thisArg: this, func: () => { this.gameSetup.netState = "ref" } })
    KeyBinder.keyBinder.setKey('M-J', { thisArg: this, func: () => { this.gameSetup.netState = "new" } })
    KeyBinder.keyBinder.setKey('M-j', { thisArg: this, func: () => { this.gameSetup.netState = "join" } })
    KeyBinder.keyBinder.setKey('M-d', { thisArg: this, func: () => { this.gameSetup.netState = "no" } })
    // table.undoShape.on(S.click, () => this.undoMove(), this)
    // table.redoShape.on(S.click, () => this.redoMove(), this)
    // table.skipShape.on(S.click, () => this.skipMove(), this)
  }

  // skipMove() {
  //   this.table.stopDragging() // drop on nextHex (no Move)
  // }
  // resignMove() {
  //   this.table.stopDragging() // drop on nextHex (no Move)
  // }
}

/** a uniquifying 'symbol table' of Board.id */
class BoardRegister extends Map<string, Board> {}
/** Identify state of HexMap by itemizing all the extant Stones
 * id: string = Board(nextPlayer.color, captured)resigned?
 * resigned: PlayerColor
 * repCount: number
 */
export class Board {
  readonly id: string = ""   // Board(nextPlayer,captured[])Resigned?,Stones[]
  readonly resigned: PlayerColor //
  repCount: number = 1;

  /**
   * Record the current state of the game: {Stones, turn, captures}
   * @param move Move: color, resigned & captured [not available for play by next Player]
   */
  constructor(id: string, resigned: PlayerColor) {
    this.resigned = resigned
    this.id = id
  }
  toString() { return `${this.id}#${this.repCount}` }

  setRepCount(history: {board}[]) {
    return this.repCount = history.filter(hmove => hmove.board === this).length
  }
  get signature() { return `[${TP.mHexes}x${TP.nHexes}]${this.id}` }
}
