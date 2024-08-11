import { stime } from "@thegraid/common-lib"
import { Container } from "@thegraid/easeljs-module"
import { GamePlay as GamePlayLib, Hex1 as Hex1Lib, HexMap as HexMapLib, newPlanner, Player as PlayerLib } from "@thegraid/hexlib"
import { ZColor } from "./AfHex"
import { MktHex, HexMap } from "./hex"
import { H } from "./hex-intfs"
import { Ship } from "./ship"
import { Table } from "./table"
import { TP } from "./table-params"
import { GamePlay } from "./game-play"

export class Player extends PlayerLib {
  static initialCoins = 400;
  name: string
  get afColor() { return ZColor[this.index]; }
  ships: Ship[] = []

  constructor(index: number, gamePlay: GamePlay) {
    // color: PlayerColor from Player.colorScheme[index]; red, blue, green, violet, gold...
    super(index, gamePlay);
  }

  static override allPlayers: Player[];
  static pathCName(index = 0) { return `pathCont${index}`}
  get pathCname() { return Player.pathCName(this.index); }

  makeShips() {
    this.ships = []
    this.ships.push(new Ship(this))  // initial default Ship (Freighter)
  }
  placeShips() {
    this.ships.forEach(ship => ship.hex = this.chooseShipHex(ship))
  }
  /** place ship initially on a Hex adjacent to planet0 */
  chooseShipHex(ship: Ship) {
    let map = this.gamePlay.table.hexMap as any as HexMap, hexes: MktHex[] = []
    // find un-occupied hexes surrounding planet0
    H.ewDirs.forEach(dir => {
      let hex = map.planet0Hex.nextHex(dir) as MktHex; // assert: planet0 has 6 neighbors
      if (!hex.occupied) hexes.push(hex)
    })
    let dn = Math.floor(Math.random() * hexes.length);
    let hex = hexes[dn]
    console.log(stime(this, `.chooseShipHex: `), ship, hex)
    return hex
  }
  pathCont?: Container;

  /**
   * Before start each new game.
   *
   * [make newPlanner for this Player]
   */
  override newGame(gamePlay: GamePlayLib, url = TP.networkUrl) {
    this.makeShips()
    super.newGame(gamePlay, url);
    this.planner = newPlanner(gamePlay.hexMap as any as HexMapLib<Hex1Lib>, this.index)
  }
  override newTurn() {
    this.ships.forEach(ship => ship.newTurn())
  }
  override stopMove() {
    this.planner?.roboMove(false)
  }
  /** if Planner is not running, maybe start it; else wait for GUI */ // TODO: move Table.dragger to HumanPlanner
  override playerMove(useRobo = this.useRobo, incb = 0) {
    let running = this.plannerRunning
    // feedback for KeyMove:

    TP.log > 0 && console.log(stime(this, `(${this.colorn}).playerMove(${useRobo}): useRobo=${this.useRobo}, running=${running}`))
    if (running) return
    if (useRobo || this.useRobo) {
    // continue any semi-auto moves for ship:
      if (!this.ships.find(ship => !ship.shipMove())) {
        this.gamePlay.setNextPlayer();    // if all ships moved
      }
      // start plannerMove from top of stack:
      // setTimeout(() => this.plannerMove(incb))
    }
    return      // robo or GUI will invoke gamePlay.doPlayerMove(...)
  }
  shipToMove() {
    return this.ships.find(ship => !ship.hasPath0)
  }
}
