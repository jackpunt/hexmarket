import { stime } from "@thegraid/common-lib"
import { Container } from "@thegraid/easeljs-module"
import { GamePlay as GamePlayLib, Hex1 as Hex1Lib, HexMap as HexMapLib, newPlanner, Player as PlayerLib } from "@thegraid/hexlib"
import { ZColor } from "./AfHex"
import { GamePlay } from "./game-play"
import { Ship, ShipSpec } from "./ship"
import { TP } from "./table-params"

export class Player extends PlayerLib {
  static initialCoins = 400;
  name: string
  get afColor() { return ZColor[this.index]; }
  readonly ships: Ship[] = []
  override gamePlay: GamePlay;

  constructor(index: number, gamePlay: GamePlay) {
    // color: PlayerColor from Player.colorScheme[index]; red, blue, green, violet, gold...
    super(index, gamePlay);
    this.pathCont = gamePlay.hexMap.mapCont[this.pathCname];
  }

  static override allPlayers: Player[];
  static pathCName(index = 0) { return `pathCont${index}`}
  get pathCname() { return Player.pathCName(this.index); }

  addShip(shipSpec: ShipSpec) {
    this.ships.length = 0;
    const { Aname, z0, rc, cargo } = shipSpec;
    const ship = new Ship(Aname, this, z0, cargo);
    this.ships.push(ship)  // initial default Ship (Freighter)
    ship.hex = this.gamePlay.hexMap[rc.row][rc.col];
    return ship;
  }
  /** put this.ships in their places. */
  placeShips(shipSpecs: ShipSpec[]) {
    shipSpecs.forEach((shipSpec) => {
      const ship = this.addShip(shipSpec), rc = shipSpec.rc;
      ship.hex = this.gamePlay.hexMap[rc.row][rc.col];
    })
  }

  /** place ship initially on a Hex adjacent to planet0
   * some day use a GUI...
   */
  chooseShipHex() {
    const map = this.gamePlay.table.hexMap;
    // find un-occupied hexes surrounding planet0
    const hexes = Object.values(map.centerHex.links).filter(hex => !hex.occupied);
    const dn = Math.floor(Math.random() * hexes.length);
    const hex = hexes[dn];
    console.log(stime(this, `.chooseShipHex: `), hex);
    return hex;
  }
  pathCont: Container;  // set from mapCont[this.pathCont]

  /**
   * Before start each new game.
   *
   * [make newPlanner for this Player]
   */
  override newGame(gamePlay: GamePlayLib, url = TP.networkUrl) {
    super.newGame(gamePlay, url);
    this.planner = newPlanner(gamePlay.hexMap as any as HexMapLib<Hex1Lib>, this.index)
  }
  override newTurn() {
    this.ships.forEach(ship => ship.newTurn());
    return;
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
