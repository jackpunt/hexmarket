import { C, F } from "@thegraid/common-lib";
import { Container, Shape, Text } from "@thegraid/easeljs-module";
import { AF, AfColor, AfFill, ATS } from "./AfHex";
import { Hex } from "./hex";
import { EwDir, H } from "./hex-intfs";
import { PC } from "./planet";
import { Player } from "./player";

/** changes in ship for each transit Step */
type ZConfig = {
  zshape: ATS,
  zcolor: AfColor,
  zfill: AfFill, // AF.F | AF.L
  fuel: 0,
}
export class Ship extends Container {
  static step1 = 1
  static idCounter = 0
  static fuelPerStep = 0

  readonly outr = 8;
  gShape: Shape = new Shape();
  Aname: string = `S${Ship.idCounter++}`

  /** current location of this Ship. */
  hex: Hex;
  cargo: Array<[PC, number]> = [];
  // /** fuel remaining this turn, reset to maxFuel at start of turn. */
  // fuel: number = 0;

  get curload() {
    return this.cargo.map(c => c[1]).reduce((n, p) => n + p, 0 )
  }

  get maxLoad() { return this.maxFuel - this.z0 - Ship.step1 }
  get radius() { return this.maxFuel + 2 + this.outr }
  get color() { return this.player?.afColor } // as AfColor!

  /** current Z-configuration */
  zconfig: ZConfig = { zshape: null, zcolor: this.color, zfill: AF.F, fuel: 0 };
  get zshape() { return this.zconfig.zshape; }
  get zcolor() { return this.zconfig.zcolor; }
  get zfill() { return this.zconfig.zfill }
  get fuel() { return this.zconfig.fuel }

  //initially: expect maxFuel = (10 + z0*5) = {15, 20, 25}
  constructor(
    public readonly player?: Player,
    public readonly z0 = 2,
    public readonly maxFuel = 20,
  ) {
    super()
    this.addChild(this.gShape)
    if (player || true) {
      let textSize = 16, nameText = new Text(this.Aname, F.fontSpec(textSize))
      nameText.textAlign = 'center'
      nameText.y = -textSize / 2;
      this.addChild(nameText)
    }
    this.paint()  // TODO: makeDraggable/Dropable on hexMap
  }

  paint(pcolor = this.player?.afColor) {
    let pColor = AF.zcolor[pcolor]
    this.paint1(undefined, pColor)  // TODO: define source/type of Zcolor
  }

  /** repaint with new Zcolor or TP.colorScheme */
  paint1(zcolor: AfColor = this.zcolor, pColor?: string) {
    let r2 = this.radius, r1 = this.maxFuel, g = this.gShape.graphics.c()
    if (pColor) {
      g.f(AF.zcolor[zcolor]).dc(0, 0, r2);
      g.f(C.BLACK).dc(0, 0, r1 + 2)
      g.f(pColor).dc(0, 0, r1)
    }
    this.cache(-r2, -r2, 2 * r2, 2 * r2); // Container of Shape & Text
  }

  paint2(zcolor: AfColor) {
    this.paint1(zcolor)
    this.gShape.graphics.c().f(C.BLACK).dc(0, 0, this.radius/2) // put a hole in it!
    this.updateCache("destination-out") // clear center of Ship!
  }

  /** from zconfig field name to AfHex field name. */
  readonly azmap = { 'zshape': 'aShapes', 'zcolor': 'aColors', 'zfill': 'aFill' }
  /** cost = change in config + mass of cargo */
  moveCost(hex0: Hex, ds: EwDir, hex1 = hex0.nextHex(ds), nconfig = { ...this.zconfig }) {
    let id = H.ewDirs.findIndex(d => d == ds)
    let dc = 0
    for (let x in this.zconfig) {
      let hex0Conf = hex0[this.azmap[x]][id]
      if (this.zconfig[x] !== hex0Conf) dc++
      let hex1Conf = hex1[this.azmap[x]][id]
      if (hex1Conf !== hex0Conf) dc++
      nconfig[id] = hex1Conf
    }
    return this.curload + dc;
  }

  /** move to hex, incur cost to fuel. */
  move(dir: EwDir) {
    let nconfig = { ... this.zconfig }
    let hex = this.hex.nextHex(dir); // this.hex.links[dir];
    let cost = this.moveCost(this.hex, dir, hex, nconfig)
    if (cost > this.fuel) return;
    nconfig.fuel -= cost
    this.hex = hex;
    this.zconfig = nconfig
    hex.map.update()    // TODO: invoke in correct place...
  }

  /**
   * try each Step, across Turns, using maxFuel
   * @param targetHex a [non-planet] hex on this.table.hexMap
   */
  findPaths(targetHex: Hex) {
    // BFS, doing rings (H.ewDirs) around the starting hex.
    let open: Step[] = []
    open.push(new Step(1, this.hex, undefined, this.zconfig))
    for (let ds of H.ewDirs) {
    }
  }


}

class Step {
  constructor(
    public turn: number, // incremental, relative turn?
    public curHex: Hex,
    public prevStep: Step,
    public config: ZConfig,
  ) { }
}

/** abstract the Ship into Step.config */
class Path {
  // ship (initFuel)
  constructor(ship: Ship){
    this.initHex = ship.hex
    this.steps[0] = new Step(0, ship.hex, undefined, ship.zconfig)
  }
  initHex: Hex;
  steps: Step[]; // curHex =
  get curHex() { return this.steps[this.steps.length - 1].curHex; }
  get curFuel() { return this.steps[this.steps.length - 1].config.fuel; }
}
