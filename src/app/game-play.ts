import { KeyBinder, S, Undo } from "@thegraid/easeljs-lib";
import { GamePlay as GamePlayLib, Scenario } from "@thegraid/hexlib";
import { Hex, HexMap } from "./hex";
import { Player } from "./player";
//import { GameStats, TableStats } from "./stats";
import { Table } from "./table";
import { PlayerColor, TP } from "./table-params";
import { GameSetup } from "./game-setup";

class HexEvent {}
class Move{}

/** Implement game, enforce the rules, manage GameStats & hexMap; no GUI/Table required.
 *
 * Move actions are:
 * - move ship to hex
 * - buy/sell commodity or upgrade
 * - launch sub-space mine/disrupter?
 * - alter alignment of ship
 * - alter alignment of hex
 *
 */
export class GamePlay0 {
  static gpid = 0
  readonly id = GamePlay0.gpid++
  ll(n: number) { return TP.log > n }

  readonly hexMap: HexMap = new HexMap()
  readonly history   = []          // sequence of Move that bring board to its state
  readonly redoMoves = []

  constructor() {

  }

  turnNumber: number = 0    // = history.lenth + 1 [by this.setNextPlayer]
  curPlayerNdx: number = 0  // curPlayer defined in GamePlay extends GamePlay0

  /** Planner may override with alternative impl. */
  newMoveFunc: (hex: Hex, sc: PlayerColor, caps: Hex[], gp: GamePlay0) => Move
  newMove(hex: Hex, sc: PlayerColor, caps: Hex[], gp: GamePlay0) {
    return this.newMoveFunc? this.newMoveFunc(hex,sc, caps, gp) : new Move()
  }
  undoRecs: Undo = new Undo().enableUndo();
  addUndoRec(obj: Object, name: string, value: any | Function = obj[name]) {
    this.undoRecs.addUndoRec(obj, name, value);
  }

}

/** GamePlayD has compatible hexMap(mh, nh) but does not share components. used by Planner */
export class GamePlayD extends GamePlay0 {
  //override hexMap: HexMaps = new HexMap();
  constructor(dbp: number = TP.dbp, dop: number = TP.dop) {
    super()
    this.hexMap[S.Aname] = `GamePlayD#${this.id}`
    this.hexMap.makeAllDistricts(dbp, dop)
    return
  }
}

/** GamePlay with Table & GUI (KeyBinder, ParamGUI & Dragger) */
export class GamePlay extends GamePlayLib {

  constructor(gameSetup: GameSetup, scenario: Scenario) {
    super(gameSetup, scenario)
  }

  override table: Table;
  override curPlayer: Player;

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
    KeyBinder.keyBinder.setKey('S', { thisArg: this, func: this.skipMove })
    KeyBinder.keyBinder.setKey('M-K', { thisArg: this, func: this.resignMove })// S-M-k
    KeyBinder.keyBinder.setKey('Escape', {thisArg: table, func: table.stopDragging}) // Escape
    KeyBinder.keyBinder.setKey('C-s', { thisArg: this.gameSetup, func: () => { this.gameSetup.restart({}) } })// C-s START
    KeyBinder.keyBinder.setKey('C-c', { thisArg: this, func: this.stopPlayer })// C-c Stop Planner
    KeyBinder.keyBinder.setKey('m', { thisArg: this, func: this.makeMove, argVal: true })
    KeyBinder.keyBinder.setKey('M', { thisArg: this, func: this.makeMoveAgain, argVal: true })
    KeyBinder.keyBinder.setKey('n', { thisArg: this, func: this.autoMove, argVal: false })
    KeyBinder.keyBinder.setKey('N', { thisArg: this, func: this.autoMove, argVal: true})
    KeyBinder.keyBinder.setKey('c', { thisArg: this, func: this.autoPlay, argVal: 0})
    KeyBinder.keyBinder.setKey('v', { thisArg: this, func: this.autoPlay, argVal: 1})

    // diagnostics:
    KeyBinder.keyBinder.setKey('x', { thisArg: this, func: () => {this.table.enableHexInspector(); }})
    KeyBinder.keyBinder.setKey('t', { thisArg: this, func: () => {this.table.toggleText(undefined); }})
    KeyBinder.keyBinder.setKey('.', { thisArg: this, func: () => {this.table.dragShip.dragAgain(); }})
    KeyBinder.keyBinder.setKey(',', { thisArg: this, func: () => {this.table.dragShip.dragBack(); }})

    KeyBinder.keyBinder.setKey('M-r', { thisArg: this, func: () => { this.gameSetup.netState = "ref" } })
    KeyBinder.keyBinder.setKey('M-J', { thisArg: this, func: () => { this.gameSetup.netState = "new" } })
    KeyBinder.keyBinder.setKey('M-j', { thisArg: this, func: () => { this.gameSetup.netState = "join" } })
    KeyBinder.keyBinder.setKey('M-d', { thisArg: this, func: () => { this.gameSetup.netState = "no" } })
    table.undoShape.on(S.click, () => this.undoMove(), this)
    table.redoShape.on(S.click, () => this.redoMove(), this)
    table.skipShape.on(S.click, () => this.skipMove(), this)
  }

  skipMove() {
    this.table.stopDragging() // drop on nextHex (no Move)
  }
  resignMove() {
    this.table.stopDragging() // drop on nextHex (no Move)
  }
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
