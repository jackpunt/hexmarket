import { stime, S } from "@thegraid/common-lib"
import { AF, AfColor, ZColor } from "./AfHex"
import { GamePlay } from "./game-play"
import { Hex, Hex2, IHex } from "./hex"
import { H } from "./hex-intfs"
import { IPlanner, newPlanner } from "./plan-proxy"
import { Ship } from "./ship"
import { Table } from "./table"
import { PlayerColor, playerColors, TP } from "./table-params"

export class Player {
  static allPlayers: Player[] = [];
  static initialCoins = 400;
  name: string
  index: number = 0; // index in playerColors & allPlayers
  color: PlayerColor = playerColors[this.index]
  get afColor() { return ZColor[this.index]; }
  table: Table
  coins: number = Player.initialCoins;
  ships: Ship[] = []
  otherPlayer: Player
  planner: IPlanner
  /** if true then invoke plannerMove */
  useRobo: boolean = false
  get colorn() { return TP.colorScheme[this.color] }

  constructor(index: number, color: PlayerColor, table: Table) {
    this.index = index
    this.color = color
    this.table = table
    this.name = `Player${index}-${this.colorn}`
    Player.allPlayers[index] = this;
  }
  initShips() {
    let ship0 = new Ship(this);  // initial default Ship (Freighter)
    this.ships.push(ship0)
    let shex = this.chooseShipHex(ship0)
    while (shex.occupied) shex = this.chooseShipHex(ship0)
    ship0.hex = shex
  }
  /** place ship initially on a hex adjacent to planet0 */
  chooseShipHex(ship: Ship) {
    let map = this.table.hexMap, cphex = map.planet0
    let dir = Math.floor(Math.random() * H.ewDirs.length);
    let hex = cphex.nextHex(H.ewDirs[dir]) as Hex2;
    console.log(stime(this, `.chooseShipHex: `), ship, hex)
    return hex
  }
  endGame(): void {
    this.planner?.terminate()
    this.planner = undefined
  }
  static remotePlayer = 1 // temporary, bringup-debug: index of 'remotePlayer' (see below)
  /** make newPlanner for this Player */
  newGame(gamePlay: GamePlay, url = TP.networkUrl) {
    this.planner?.terminate()
    // this.hgClient = (this.index == Player.remotePlayer) ? new HgClient(url, (hgClient) => {
    //   console.log(stime(this, `.hgClientOpen!`), hgClient)
    // }) : undefined
    this.planner = newPlanner(gamePlay.hexMap, this.index)
  }
  stopMove() {
    this.planner?.roboMove(false)
  }
  /** if Planner is not running, maybe start it; else wait for GUI */ // TODO: move Table.dragger to HumanPlanner
  playerMove(sc: PlayerColor, useRobo = this.useRobo, incb = 0) {
    let running = this.plannerRunning
    // feedback for KeyMove:

    TP.log > 0 && console.log(stime(this, `(${this.colorn}).playerMove(${useRobo}): useRobo=${this.useRobo}, running=${running}`))
    if (running) return
    if (useRobo || this.useRobo) {
      // start plannerMove from top of stack:
      setTimeout(() => this.plannerMove(sc, incb))
    }
    // continue any semi-auto moves for ship:
    this.ships.forEach(ship => ship.shipMove())
    return      // robo or GUI will invoke gamePlay.doPlayerMove(...)
  }
  plannerRunning = false
  plannerMove(sc: PlayerColor, incb = 0) {
    this.planner?.roboMove(true)
    this.plannerRunning = true
    // let iHistory = this.table.gamePlay.iHistory
    // let ihexPromise = this.planner.makeMove(sc, iHistory, incb)
    // ihexPromise.then((ihex: IHex) => {
    //   this.plannerRunning = false
    //   this.table.moveStoneToHex(ihex, sc)
    // })
  }
}
class RemotePlayer extends Player {
  override newGame(gamePlay: GamePlay) {
    this.planner?.terminate()
    // this.hgClient = (this.index == RemotePlayer.remotePlayer) ? new HgClient() : undefined
    // this.planner = newPlanner(gamePlay.hexMap, this.index, gamePlay.logWriter)
  }
}
