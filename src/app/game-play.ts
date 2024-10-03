import { KeyBinder } from "@thegraid/easeljs-lib";
import { GamePlay as GamePlayLib, GameSetup, Player as PlayerLib } from "@thegraid/hexlib";
import { Player } from "./player";
//import { GameStats, TableStats } from "./stats";
import { GameState } from "./game-state";
import { HexMap } from "./hex";
import { Planet, PlanetDir, PlanetPlacer } from "./planet";
import { Ship, ShipSpec } from "./ship";
import { Table } from "./table";
import { PlayerColor, TP } from "./table-params";
import { stime } from "@thegraid/common-lib";

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
  declare gameSetup: GameSetup;
  declare readonly hexMap: HexMap;
  declare table: Table;
  declare curPlayer: Player;

  override readonly gameState: GameState = new GameState(this);
  override get allPlayers() { return Player.allPlayers; };
  planetPlacer = new PlanetPlacer(this.hexMap);

  // Args to f are local Player, not PlayerLib
  override forEachPlayer(f: (p: Player, index: number, players: Player[]) => void): void {
    return super.forEachPlayer(f as (p: PlayerLib, index: number, player: PlayerLib[]) => void)
  }

  forEachPlanet(f: (p: Planet, key: PlanetDir, ps: Map<PlanetDir, Planet>) => void): void {
    this.planetPlacer.planetByDir.forEach((planet, key, map) => f(planet, key, map))
  }

  /** return initial ship positions. some day use a GUI... */
  initialShips(player: Player): ShipSpec[] {
    // make and place one Ship for player
    const hex = player.chooseShipHex();
    const rc = { row: hex.row, col: hex.col };
    const cargo = { ...TP.initialCargo[player.index] }; // load some cargo for testing { F1: 5 }
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

  /** set at start of GamePlay [constructor] */
  clock = 0;
  /** implement the Clock action; all planets Produce * Consume */
  advanceClock(dir = 1) { // dir = -1 for testing, maybe for undo...
    this.forEachPlanet((planet: Planet, key) => {
      let hasAllCons = 1;
      planet.consPCs.forEach(cons => {
        cons.quant = Math.max(0, Math.min(cons.lim, cons.quant + dir * cons.rate))
        if (cons.quant === 0) { hasAllCons = 0; }
      })
      planet.prodPCs.forEach(prod => {
        prod.quant = Math.max(0, Math.min(prod.lim, prod.quant + dir * prod.rate * hasAllCons))
      })
      if (planet.infoCont.visible) {
        planet.showPlanetPC(true)
      }
    })
    this.clock += 1
    return this.clock;
  }

  /** makeMove ('m' key): advance one [lrt] Ship on its path. */
  override makeMove(auto?: boolean, ev?: any, incb?: number): void {
    if (this.gamePhase?.Aname !== 'Move') return;
    super.makeMove(auto, ev, incb); // --> Player.playerMove() --> ship.moveOnPath()
  }

  override bindKeys() {
    let table = this.table
    let roboPause = () => { this.forEachPlayer(p => this.pauseGame(p) )}
    let roboResume = () => { this.forEachPlayer(p => this.resumeGame(p) )}
    let roboStep = () => {
      let p = this.curPlayer, op = this.nextPlayer(p)
      this.pauseGame(op); this.resumeGame(p);
    }
    KeyBinder.keyBinder.setKey('p', () => roboPause())
    KeyBinder.keyBinder.setKey('r', () => roboResume())
    KeyBinder.keyBinder.setKey('s', () => roboStep())
    KeyBinder.keyBinder.setKey('R', () => this.runRedo = true)
    KeyBinder.keyBinder.setKey('q', () => this.runRedo = false)
    KeyBinder.keyBinder.setKey(/1-9/, (e: string) => { TP.maxBreadth = Number.parseInt(e) })

    KeyBinder.keyBinder.setKey('M-z', { thisArg: this, func: this.undoMove })
    KeyBinder.keyBinder.setKey('b', { thisArg: this, func: this.undoMove })
    KeyBinder.keyBinder.setKey('f', { thisArg: this, func: this.redoMove })
    // KeyBinder.keyBinder.setKey('S', { thisArg: this, func: this.skipMove })
    // KeyBinder.keyBinder.setKey('M-K', { thisArg: this, func: this.resignMove })// S-M-k
    KeyBinder.keyBinder.setKey('Escape', {thisArg: table, func: table.stopDragging}) // Escape
    KeyBinder.keyBinder.setKey('C-s', () => this.gameSetup.restart({}))// C-s START
    KeyBinder.keyBinder.setKey('C-c', () => this.stopPlayer())         // C-c Stop Planner
    // KeyBinder.keyBinder.setKey('C', () => this.table.reCacheTiles())   // reCacheTiles
    KeyBinder.keyBinder.setKey('C', () => this.gameState.selectAction('Clock'))
    KeyBinder.keyBinder.setKey('M', () => this.gameState.selectAction('Move'))
    KeyBinder.keyBinder.setKey('T', () => this.gameState.selectAction('Trade'))
    // auto move:
    KeyBinder.keyBinder.setKey('m', () => this.makeMove(true))
    // KeyBinder.keyBinder.setKey('M', () => this.makeMoveAgain(true))
    KeyBinder.keyBinder.setKey('n', () => this.autoMove(false))
    KeyBinder.keyBinder.setKey('N', () => this.autoMove(true))
    KeyBinder.keyBinder.setKey('c', () => this.autoPlay(0))
    KeyBinder.keyBinder.setKey('v', () => this.autoPlay(1))

    // click the confirm/cancel buttons:
    KeyBinder.keyBinder.setKey('c', () => this.clickConfirm(false));
    KeyBinder.keyBinder.setKey('y', () => this.clickConfirm(true));
    KeyBinder.keyBinder.setKey('d', () => this.clickDone());

    // diagnostics:
    KeyBinder.keyBinder.setKey('I', () => this.table.enableHexInspector())
    KeyBinder.keyBinder.setKey('t', () => this.table.toggleText())

    KeyBinder.keyBinder.setKey('M-r', () => { this.gameSetup.netState = "ref" })
    KeyBinder.keyBinder.setKey('M-J', () => { this.gameSetup.netState = "new" })
    KeyBinder.keyBinder.setKey('M-j', () => { this.gameSetup.netState = "join" })
    KeyBinder.keyBinder.setKey('M-d', () => { this.gameSetup.netState = "no" })
    // table.undoShape.on(S.click, () => this.undoMove(), this)
    // table.redoShape.on(S.click, () => this.redoMove(), this)
    // table.skipShape.on(S.click, () => this.skipMove(), this)
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

  setRepCount(history: { board: Board }[]) {   // TODO: { board: type }
    return this.repCount = history.filter(hmove => hmove.board === this).length
  }
  get signature() { return `[${TP.mHexes}x${TP.nHexes}]${this.id}` }
}
