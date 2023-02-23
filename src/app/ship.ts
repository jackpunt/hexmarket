import { C, F, stime } from "@thegraid/common-lib";
import { DragInfo } from "@thegraid/easeljs-lib";
import { Container, Graphics, Shape, Text } from "@thegraid/easeljs-module";
import { AF, AfColor, AfFill, ATS } from "./AfHex";
import { Hex, Hex2 } from "./hex";
import { EwDir, H, HexDir } from "./hex-intfs";
import { PC } from "./planet";
import { Player } from "./player";

/** changes in ship for each transit Step */
type ZConfig = {
  zshape: ATS,
  zcolor: AfColor,
  zfill: AfFill, // AF.F | AF.L
  fuel: number,
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
  cargo: Array<[PC, number]> = [[PC.F1, 5]];

  get curload() {
    return this.cargo.map(c => c[1]).reduce((n, p) => n + p, 0 )
  }

  get maxLoad() { return this.maxFuel - this.z0 - Ship.step1 }
  get radius() { return this.maxFuel + 2 + this.outr }
  get color() { return this.player?.afColor } // as AfColor!
  readonly colorValues = C.nameToRgba(AF.zcolor[this.color]); // with alpha component

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
  readonly zkeys = Object.keys(this.azmap);
  /**
   * cost for change in config (shape, color, fill)
   * @param nconfig updated zconfig after spending re-configuration cost
   */
  configCost(hex0: Hex, ds: EwDir, hex1 = hex0.nextHex(ds), nconfig = { ...this.zconfig }) {
    if (!hex0.afhex || !hex1.afhex) return undefined
    let od = H.ewDirs.findIndex(d => d == ds)
    let id = H.ewDirs.findIndex(d => d == H.dirRev[ds])
    let dc = 0
    for (let x of this.zkeys) {
      let hex0Conf = hex0.afhex[this.azmap[x]][od]
      if (nconfig[x] !== hex0Conf) dc++
      let hex1Conf = hex1.afhex[this.azmap[x]][id]
      if (hex1Conf !== hex0Conf) dc++
      nconfig[x] = hex1Conf
    }
    return dc //+ this.curload + Math.round((this.maxFuel - 10) / 5);
  }

  /** move to hex, incur cost to fuel. */
  move(dir: EwDir) {
    let nconfig = { ... this.zconfig }
    let hex = this.hex.nextHex(dir); // this.hex.links[dir];
    let cost = this.configCost(this.hex, dir, hex, nconfig)
    if (cost > this.fuel) return;
    nconfig.fuel -= cost
    this.hex = hex;
    this.zconfig = nconfig
    hex.map.update()    // TODO: invoke in correct place...
  }

  /**
   * try each Step, across Turns, using maxFuel
   * @param targetHex a [non-planet] hex on this.table.hexMap
   * @param tLimit stop searching if path length is tLimit longer than best path.
   */
  findPaths(targetHex: Hex, limit = 2) {
    let loop = (nStep: Step<Hex>) => {
      let nHex = nStep.curHex, pStep = nStep.prevStep
      while (pStep && pStep.curHex !== nHex) pStep = pStep.prevStep
      return pStep?.curHex === nHex
    }
    // BFS, doing rings (H.ewDirs) around the starting hex.
    let open: Step<Hex>[] = [], done: Step<Hex>[] = [], minMetric = Infinity
    let step0 = new Step(0, this.hex, undefined, undefined, this.zconfig, 0)
    open.push(step0)
    console.log(stime(this, `.findPaths`), { ship: this, hex: this.hex, hex0: this.hex.Aname, targetHex, hex1: targetHex.Aname })
    // loop through all [current/future] open nodes:
    for (let ndx = 0; ndx < open.length; ndx++) {
      let step = open[ndx]
      // cycle turns until Step(s) reach targetHex

      // loop here so we can continue vs return; move each dir from prev step:
      for (let dir of H.ewDirs) {
        let nHex = step.curHex.nextHex(dir), nConfig = { ... step.config } // copy of step.config
        if (nHex.ship || nHex.planet) continue // occupied
        let cost = this.configCost(step.curHex, dir, nHex, nConfig)
        if (cost === undefined) continue; // off-map or planet or occupied?
        let turn = step.turn
        nConfig.fuel = nConfig.fuel - cost
        if (nConfig.fuel < 0) {
          turn += 1
          nConfig.fuel = this.maxFuel - cost;
        }
        let nStep = new Step(turn, nHex, dir, step, nConfig, cost)
        let metric = nStep.metric
        if (metric >= minMetric + limit) continue // abandon path: too expensive
        if (nHex == targetHex) {
          done.push(nStep)
          if (metric < minMetric) minMetric = metric
        } else {
          if (loop(nStep)) continue; // abandon path: looping
          open.push(nStep); // save path, check back later
        }
      }
    }
    return done
  }
  pathMetric(step: Step<Hex>) {
    return step.toPath().map(([dir, hex, step]) => step.cost).reduce((pv, cv) => pv + cv, 0)
    //return step.turn * this.maxFuel - step.config.fuel
  }

  /**
   *
   * @param step the final step, work back until step.prevHex === undefined
   * @param g Graphics
   * @param cl color of line
   * @param wl width of line
   */
  drawPath(fStep: Step<Hex2>, g: Graphics, cl: string, wl = 2) {
    // setStrokeStyle().beginStroke(color).moveto(center).lineto(edge=hex0,dir)
    // [arcto(hex1,~dir)]*, lineto(center), endStroke
    let path = fStep.toPath();  // Path: [dir, hex] in proper order
    // console.log(stime(this, `.drawPath: ${cl}`), fStep.toString(), path.map(([dir, hex]) => { return { dir, n: hex.Aname, hex } }))
    let [dir, hex0, step0] = path[0]
    let [x, y] = hex0.xywh(hex0.radius)   // centered on mapCont
    let dir0 = path[1][0]
    let ep = hex0.edgePoint(dir0)
    g.ss(wl).s(cl).mt(x, y).lt(ep.x, ep.y)
    // console.log(stime(this, `.drawPath0`), { hex0: hex0.Aname, dir0, nhex: path[1][1].Aname, x: ep.x.toFixed(0), y: ep.y.toFixed(0), step0 })

    // all the intermediate steps of the path: coming in on pdir, out on ndir
    path.slice(1, - 1).forEach(([pdir, chex, step], index) => {
      let ndir = path[index + 2][0], pp = ep
      // step into & across nhex
      ep = chex.edgePoint(ndir)
      if (ndir == pdir) {
        g.lt(ep.x, ep.y)        // straight across
        // console.log(stime(this, `.drawPathS`), { chex: chex.Aname, pdir, ndir, x: ep.x.toFixed(0), y: ep.y.toFixed(0), step })
      } else {
        // g.mt(pp.x, pp.y)
        g.at(chex.x, chex.y, ep.x, ep.y, chex.radius/2) // arcTo
        // console.log(stime(this, `.drawPathA`), { chex: chex.Aname, pdir, ndir, cx: chex.x.toFixed(0), cy: chex.y.toFixed(0), x: ep.x.toFixed(0), y: ep.y.toFixed(0), step })
      }
    })
    let [pdir, chex, step] = path[path.length - 1]
    // draw line (final step)
    g.lt(chex.x, chex.y)
    // console.log(stime(this, `.drawPathF`), { chex: chex.Aname, dir, nhex: hex0.Aname, x: chex.x.toFixed(0), y: chex.y.toFixed(0), step })
    g.es()
  }

  pathColor(n: number, alpha?: number | string) {
    let v = this.colorValues.map(vn => vn + n * (vn > 230 ? -20 : 20))
    v[3] = 255    // reset alpha
    return `rgba(${v[0]},${v[1]},${v[2]},${alpha || (v[3]/255).toFixed(2)})`
  }

  targetHex: Hex2
  originHex: Hex2
  dragFunc(hex: Hex2, ctx: DragInfo) {
    if (!ctx?.first && this.targetHex === hex) return;   // nothing new (unless/until ShiftKey)
    this.targetHex = hex;
    let cont = hex.map.mapCont.pathCont
    // remove old marks, show new marks
    cont.removeAllChildren();
    const shiftKey = ctx?.event?.nativeEvent ? ctx.event.nativeEvent.shiftKey : false
    if (!shiftKey || hex === this.hex) return; // no path to originating hex
    this.originHex = this.hex as Hex2;
    this.showPath(hex, cont)
  }
  showPath(hex: Hex2, cont = hex.map.mapCont.pathCont) {
    let paths = this.findPaths(hex), n = 0;
    console.log(stime(this, `.dragFunc`), this.hex.Aname, this.targetHex.Aname, this.color, this.curload, `paths:`,
      paths.map(p => { return { turn: p.turn, fuel: p.config.fuel, metric: this.pathMetric(p), p: p.toString(), s0: p } })
      )
    for (let path of paths) {
      let pcolor = this.pathColor(n)
      let pshape = new Shape()
      this.drawPath(path as Step<Hex2>, pshape.graphics, pcolor, 2)
      pshape.x += n * (-1 + 2 * Math.random()); pshape.y -= n * (-1 + 2 * Math.random())
      cont.addChild(pshape)
      n += 1;
    }
    hex.map.update();
  }

  dropFunc(hex: Hex2, ctx: DragInfo) {
    hex.ship = this
    this.hex = hex
    // TODO: remove [old] marks
    let cont = hex.map.mapCont.pathCont
    const shiftKey = ctx.event.nativeEvent ? ctx.event.nativeEvent.shiftKey : false
    if (!shiftKey) cont.removeAllChildren();
  }

  dragAgain() {
    let targetHex = this.targetHex;
    this.hex = this.originHex
    this.originHex.ship = this;
    this.dragFunc(this.hex as Hex2, undefined); // targetHex = this; removeChildren
    this.showPath(this.targetHex = targetHex);
  }
}

class Step<T extends Hex> {
  constructor(
    public turn: number, // incremental, relative turn?
    public curHex: T,
    public dir: EwDir,
    public prevStep: Step<T>,
    public config: ZConfig,
    public cost: number,
  ) {
    this.metric = cost + (prevStep?.metric || 0)
  }
  readonly metric: number;

  toPath() {
    let rv = [], cs = this as Step<T>
    while (cs !== undefined) {
      rv.unshift([cs.dir, cs.curHex, cs])
      cs = cs.prevStep
    }
    return rv as [HexDir, T, Step<T>][];
  }

  toString() {
    return this.toPath().map(([dir, hex, step]) => `${dir||'0'}->${hex.Aname}$${step.cost}`).toString()
  }
}
