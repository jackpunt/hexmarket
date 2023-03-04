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
  _hex: Hex;
  get hex() { return this._hex; }
  set hex(hex: Hex) {
    if (this.hex !== undefined) this.hex.ship = undefined
    this._hex = hex
    hex.ship = this
  }
  cargo: Array<[PC, number]> = [[PC.F1, 5]];

  get curload() {
    return this.cargo.map(c => c[1]).reduce((n, p) => n + p, 0 )
  }

  get maxLoad() { return this.maxFuel - this.z0 - Ship.step1 }
  get radius() { return this.maxFuel + 2 + this.outr }
  get color() { return this.player?.afColor } // as AfColor!
  readonly colorValues = C.nameToRgba(AF.zcolor[this.color]); // with alpha component
  readonly shipCost = Math.round((this.maxFuel - 10) / 5);

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
   * @return cost to re-config + curload + shipCost
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
    return dc + this.curload + this.shipCost;
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
    if (targetHex.occupied) return []    // includes: this.hex === targetHex
    let transitCost = 2.5 + this.shipCost + this.curload; // approximate 'worst-case' impedance of distance
    let minMetric = this.hex.radialDist(targetHex) * transitCost
    let done: Step<Hex>[], closed: Step<Hex>[]
    do {
      [done, closed] = this.findPathWithMetric(targetHex, limit, minMetric = minMetric + 5)
    } while (done.length == 0)
    return [done, closed]
  }
  findPathWithMetric(targetHex: Hex, limit, minMetric) {
    let isLoop = (nStep: Step<Hex>) => {
      let nHex = nStep.curHex, pStep = nStep.prevStep
      while (pStep && pStep.curHex !== nHex) pStep = pStep.prevStep
      return pStep?.curHex === nHex
    }
    // BFS, doing rings (H.ewDirs) around the starting hex.
    let open: Step<Hex>[] = [], closed: Step<Hex>[] = [], done: Step<Hex>[] = []
    let step = new Step(0, this.hex, undefined, undefined, this.zconfig, 0, targetHex)
    let mins = minMetric.toFixed(1), Hex0 = this.hex.Aname, Hex1 = targetHex.Aname, hex0 = this.hex
    console.log(stime(this, `.findPaths`), { ship: this, mins, Hex0, Hex1, hex0, targetHex })
    open.push(step)
    // loop through all [current/future] open nodes:
    while (step = open.shift()) {
      // cycle turns until Step(s) reach targetHex
      // loop here so we can continue vs return; move each dir from prev step:
      for (let dir of H.ewDirs) {
        let nHex = step.curHex.nextHex(dir), nConfig = { ... step.config } // copy of step.config
        if (nHex.occupied) continue // occupied
        let cost = this.configCost(step.curHex, dir, nHex, nConfig)
        if (cost === undefined) continue; // off-map or planet or occupied?
        let turn = step.turn
        nConfig.fuel = nConfig.fuel - cost
        if (nConfig.fuel < 0) {
          turn += 1
          nConfig.fuel = this.maxFuel - cost;
        }
        let nStep = new Step(turn, nHex, dir, step, nConfig, cost, targetHex)
        if (closed.find(nStep.isMatchingElement, nStep)) continue  // already evaluated & expanded
        if (open.find(nStep.isExistingPath, nStep) ) continue     // already a [better] path to nHex
        // assert: open contains only 1 path to any Step(Hex, config) that path has minimal metric

        let metric = nStep.metric
        if (metric > minMetric + limit) continue // abandon path: too expensive
        if (nHex == targetHex) {
          if (done.length == 0) console.log(stime(this, `.findPathWithMetric: first done ${metric}`), nStep, )
          done.push(nStep)
          if (metric < minMetric) minMetric = metric
        } else {
          if (isLoop(nStep)) continue; // abandon path: looping
          open.push(nStep); // save path, check back later
        }
      }
      closed.push(step)
      open.sort((a, b) => a.metricb - b.metricb)
    }
    return [done, closed]
  }
  pathMetric(step: Step<Hex>) {
    return step.toPath().map(([dir, hex, step]) => step.cost).reduce((pv, cv) => pv + cv, 0)
    //return step.turn * this.maxFuel - step.config.fuel
  }
  drawDirect(target: Hex2, g: Graphics, cl: string , wl = 2) {
    let hex0 = this.hex as Hex2
    g.ss(wl).s(cl).mt(hex0.x, hex0.y).lt(target.x, target.y).es()
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
    let [, hex0] = path[0]
    let [dir0, ] = path[1]      // direction of FIRST step
    let ep = hex0.edgePoint(dir0)
    g.ss(wl).s(cl).mt(hex0.x, hex0.y).lt(ep.x, ep.y)

    // all the intermediate steps of the path: coming in on pdir, out on ndir
    path.slice(1, - 1).forEach(([pdir, hexN, step], index) => {
      // step into & across hexN
      let [ndir] = path[index + 2] // exit direction
      ep = hexN.edgePoint(ndir)
      if (ndir == pdir) {
        g.lt(ep.x, ep.y)        // straight across
      } else {
        g.at(hexN.x, hexN.y, ep.x, ep.y, hexN.radius/2) // arcTo
      }
    })
    let [, hexZ] = path[path.length - 1]
    g.lt(hexZ.x, hexZ.y)        // draw line (final step)
    g.es()
  }

  pathColor(n: number = 0, alpha?: number | string, decr = 20) {
    let v = this.colorValues.map(vn => vn + n * (vn > 230 ? -decr : decr))
    v[3] = 255    // reset alpha
    return `rgba(${v[0]},${v[1]},${v[2]},${alpha || (v[3]/255).toFixed(2)})`
  }

  targetHex: Hex2;
  originHex: Hex2;
  lastShift: boolean;

  // TODO: retain previous paths (to adjacent hex) to speed the search?
  // at least set minMetric to last path + 1 step
  // OR: expand from open node with least radialDist? <-- DID THIS
  // OR: get estimate of 'minMetric' to prune far branches <-- DID THIS
  // OR: open [only] cells near the 'direct path' from hex to target
  dragFunc(hex: Hex2, ctx: DragInfo) {
    if (ctx?.first) {
      this.originHex = this.hex as Hex2
      this.lastShift = undefined
    }
    if (!hex || hex.occupied) return; // do not move over non-existant or occupied hex
    const shiftKey = ctx?.event?.nativeEvent?.shiftKey
    if (shiftKey === this.lastShift && !ctx?.first && this.targetHex === hex) return;   // nothing new (unless/until ShiftKey)
    this.lastShift = shiftKey
    let cont = hex.map.mapCont.pathCont
    if (this.targetHex !== hex) cont.removeAllChildren()
    this.targetHex = hex;
    if (hex === this.hex) return; // no path to originating hex
    this.drawDirect2(hex).then(() => {
      if (!shiftKey) return         // no path requested
      this.originHex = this.hex as Hex2;
      this.showPath(hex, cont)
    })
  }
  async drawDirect2(hex: Hex2, cont = hex.map.mapCont.pathCont) {
    let dshape = new Shape()
    this.drawDirect(hex, dshape.graphics, this.pathColor(0, .5))
    cont.addChild(dshape)
    hex.map.update()
    return new Promise<void>((resolve) => {
      setTimeout(() => { resolve() }, 1);
    });
  }

  showPath(hex: Hex2, cont = hex.map.mapCont.pathCont) {
    let [done, closed] = this.findPaths(hex, 1), n = 0;
    done.sort((a,b) => a.metric - b.metric)
    let mina = done[0]?.metric || -1
    let pathm = done.map(p => { return { turn: p.turn, fuel: p.config.fuel, metric: this.pathMetric(p), p: p.toString(), s0: p } })
    console.log(stime(this, `.showPath`), this.hex.Aname, this.targetHex.Aname, this.color, this.curload, mina, closed.length, `paths:`, pathm)
    for (let path of done) {
      let pcolor = this.pathColor(n, 1, path.metric == mina ? 20 : 30)
      let pshape = new Shape()
      this.drawPath(path as Step<Hex2>, pshape.graphics, pcolor, 2)
      pshape.x += n * (-1 + 2 * Math.random()); pshape.y -= n * (-1 + 2 * Math.random())
      cont.addChildAt(pshape, 0) // push under the better paths
      n += 1;
    }
    hex.map.update();
  }

  dropFunc(hex: Hex2, ctx: DragInfo) {
    if (!!this.targetHex) {
      this.hex = this.targetHex
    }
    let cont = hex.map.mapCont.pathCont
    const shiftKey = ctx?.event?.nativeEvent?.shiftKey
    if (!shiftKey) cont.removeAllChildren();
    this.lastShift = undefined
  }

  dragBack() {
    this.hex = this.targetHex = this.originHex
    this.originHex.ship = this;
    this.hex.map.update()
  }
  dragAgain() {
    let targetHex = this.targetHex;
    this.dragBack()
    this.dragFunc(this.hex as Hex2, undefined); // targetHex = this; removeChildren
    this.showPath(this.targetHex = targetHex);
    this.hex = targetHex
    this.hex.map.update()
  }
}

class Step<T extends Hex> {
  constructor(
    public turn: number, // incremental, relative turn?
    public curHex: T,
    public dir: EwDir,
    public prevStep: Step<T>,
    public config: ZConfig,
    public cost: number,             // cost for this Step
    targetHex: T,  // crow-fly distance to target from curHex
  ) {
    this.metricb = this.metric + this.curHex.radialDist(targetHex)
  }
  /** Actual cost from original Hex to this Step */
  readonly metric = this.cost + (this.prevStep?.metric || 0);
  /** best-case metric from this(curHex & config) to targetHex, assume zero config cost */
  readonly metricb: number;

  /** used as predicate for find (ignore ndx & obj) */
  isMatchingElement(s: Step<T>, ndx?: number, obj?: Step<T>[]) {
    return s.curHex === this.curHex &&
      s.config.zcolor === this.config.zcolor &&
      s.config.zshape === this.config.zshape &&
      s.config.zfill === this.config.zfill
  }

  /**
   * find (and possibly replace) best metric to this Step)
   * if this is better than existing open Step, replace 's' with this */
  isExistingPath(s: Step<T>, ndx: number, obj: Step<T>[]) {
    if (!s.isMatchingElement(this)) return false
    //if (this.metric == s.metric) return false  // try see parallel/equiv paths
    if (this.metric < s.metric) {
      obj[ndx] = this
    }
    return true
  }

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
