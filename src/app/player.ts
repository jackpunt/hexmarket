import { C, stime } from "@thegraid/common-lib"
import { Container } from "@thegraid/easeljs-module"
import { GamePlay as GamePlayLib, Hex1 as Hex1Lib, HexMap as HexMapLib, newPlanner, Player as PlayerLib } from "@thegraid/hexlib"
import { GamePlay } from "./game-play"
import { Random } from "./random"
import { EditNumber, Ship, ShipSpec } from "./ship"
import { TP } from "./table-params"

const playerColors = ['red', 'lightblue', 'green', 'violet', 'gold'] as const;
export type PlayerColor = typeof playerColors[number];
export class Player extends PlayerLib {
  static initialCoins = 400;
  // set our multi-player colors (concept from Ankh?); we don't use the TP.colorScheme
  static { PlayerLib.colorScheme = playerColors.concat() }
  static override colorScheme: PlayerColor[];
  override get color(): PlayerColor {
    return super.color as PlayerColor;
  }
  override set color(c:  PlayerColor) {
    super.color = c;
  }

  get afColor() { return Player.colorScheme[this.index]; } // === player.color as PlayerColor
  readonly ships: Ship[] = []
  override gamePlay!: GamePlay;

  constructor(index: number, gamePlay: GamePlay) {
    super(index, gamePlay);
    const cName = this.pathCname, mapCont = gamePlay.hexMap.mapCont;
    if (mapCont.isContName(cName)) {
      this.pathCont = gamePlay.hexMap.mapCont.getCont(cName);
    }
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
      this.addShip(shipSpec)
    })
  }

  /** place ship initially on a Hex adjacent to planet0
   * some day use a GUI...
   */
  chooseShipHex() {
    const map = this.gamePlay.table.hexMap;
    // find un-occupied hexes surrounding planet0
    const hexes = Object.values(map.centerHex.links).filter(hex => !hex.occupied);
    const dn = Math.floor(Random.random() * hexes.length);
    const hex = hexes[dn];
    console.log(stime(this, `.chooseShipHex: `), hex);
    return hex;
  }
  pathCont!: Container;  // set from mapCont[this.pathCont]

  /**
   * Before start each new game.
   *
   * [make newPlanner for this Player]
   */
  override newGame(gamePlay: GamePlayLib, url = TP.networkUrl) {
    super.newGame(gamePlay, url);
    this.planner = newPlanner(gamePlay.hexMap as any as HexMapLib<Hex1Lib>, this.index)
  }
  // only invoked on the newly curPlayer!
  override newTurn() {
    // nothing to do... until 'Move' action.
    // this.ships.forEach(ship => ship.newTurn());
    // return;
  }

  /** new 'Move' Action: refuel, show paths, wait for 'm' */
  enableMove() {
    this.ships.forEach(ship => {
      ship.newTurn();    // using ship.newTurn() as semantically: enableMove()
    })
  }

  /** Ships with targets & paths, [least-recenctly-touched, ..., most-recently-touched] */
  lrtShips: Ship[] = []
  touchShip(ship: Ship) {
    const lrts = this.lrtShips
    const ndx = lrts.indexOf(ship);
    if (ndx >= 0) {
      lrts.splice(ndx, 1)
    }
    lrts.push(ship)
    return ship;
  }

  /** color used for showing paths */
  readonly colorBytes = C.nameToRgba(this.color); // with alpha component

  /**
   * modify r,g,b from this.colorBytes
   * @param n path metric ordinal: 0 is best path, 1 is more expensive
   * @param alpha [decr] alpha (fractional) for resulting color
   * @param decr [20] if component is bright, diminish it; if dim, enhance it.
   * @returns a modified version of this.colorBytes
   */
  pathColor(n: number = 0, alpha?: number, decr = 20) {
    let v = this.colorBytes.map(vn => vn + n * (vn > 230 ? -decr : decr))
    // v[3] = Math.floor(255 * alpha)    // reset alpha
    return `rgba(${v[0]},${v[1]},${v[2]},${alpha ?? (v[3]/255).toFixed(2)})` as PlayerColor;
  }
  override stopMove() {
    this.planner?.roboMove(false)
  }
  /** move the currently selected Ship. */
  moveShip() {

  }
  /** if Planner is not running, maybe start it; else wait for GUI */ // TODO: move Table.dragger to HumanPlanner
  override playerMove(useRobo = this.useRobo, incb = 0) {
    let running = this.plannerRunning
    // feedback for KeyMove:

    TP.log > 0 && console.log(stime(this, `(${this.plyrId}).playerMove(${useRobo}): useRobo=${this.useRobo}, running=${running}`))
    if (running) return
    if (useRobo || this.useRobo) {
      // continue any semi-auto moves for ship:
      const ship = this.lrtShips.find(s => s.pathFinder.path0?.[0].step.turn === 0)
      if (ship) ship.moveOnPath()
    }
    return      // robo or GUI will invoke gamePlay.doPlayerMove(...)
  }

  /** Space-key: select this ship as the dragObj */
  shipToMove() {
    return this.ships.find(ship => !ship.hasPathMove)
  }
  // Test/demo EditNumber
  override makePlayerBits(): void {
    super.makePlayerBits()
    const qText = new EditNumber('888', { bgColor: C.WHITE})
    qText.minWidth = qText.maxLen = 3;
    qText.border = .3; qText.dy = 0
    qText.repaint();                     // position cursor
    qText.setBounds(undefined, 0, 0, 0); // calcBounds with border {-1, -1, 22, 22}
    qText.paint(undefined, true);        // paint bgRect

    const [dx0] = qText.borders
    // qText.x = -dx0
    qText.setInCell({ x: 0, y: 0, w: 200, h: 0 }); // TODO: testing
    this.panel.addChild(qText)
  }
}
