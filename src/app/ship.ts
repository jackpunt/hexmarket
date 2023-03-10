import { C, F, stime } from "@thegraid/common-lib";
import { DragInfo } from "@thegraid/easeljs-lib";
import { Container, Graphics, Shape, Text } from "@thegraid/easeljs-module";
import { AF, AfColor, AfFill, ATS } from "./AfHex";
import { Hex, Hex2 } from "./hex";
import { EwDir, H, HexDir } from "./hex-intfs";
import { PC } from "./planet";
import { Player } from "./player";
import { TP } from "./table-params";

class PathElt<T extends Hex> {
  constructor(public dir: HexDir, public hex: T, public step: Step<T>) {  }
}
type Path<T extends Hex> = PathElt<T>[]

/** changes in ship for each transit Step */
type ZConfig = {
  zshape: ATS,
  zcolor: AfColor,
  zfill: AfFill, // AF.F | AF.L
  fuel: number,
}
export class Ship extends Container {
  /** intrinsic cost for each Step (0 or 1); start of turn pays 1 for null 'shape' */
  static step1 = 1
  static maxZ = 3  // for now: {shape + color + color}
  static idCounter = 0
  static fuelPerStep = 0

  readonly outr = 8;
  readonly radius = this.z0 * 10 + 2 + this.outr;
  gShape: Shape = new Shape();
  Aname: string = `S${Ship.idCounter++}`

  /** current location of this Ship. */
  _hex: Hex;
  get hex() { return this._hex; }
  set hex(hex: Hex) {
    if (this.hex !== undefined) this.hex.ship = undefined
    this._hex = hex
    hex.ship = this
    this.pCont = hex.map.mapCont.pathCont
  }
  pCont: Container
  cargo: Array<[PC, number]> = [[PC.F1, 5]];

  get curload() {
    return this.cargo.map(c => c[1]).reduce((n, p) => n + p, 0 )
  }

  get color() { return this.player?.afColor } // as AfColor!
  readonly colorValues = C.nameToRgba(AF.zcolor[this.color]); // with alpha component

  /** current Z-configuration */
  zconfig: ZConfig = { zshape: null, zcolor: this.color, zfill: AF.F, fuel: 0 };
  get zshape() { return this.zconfig.zshape; }
  get zcolor() { return this.zconfig.zcolor; }
  get zfill() { return this.zconfig.zfill; }
  get fuel() { return this.zconfig.fuel; }
  // maxLoad = [0, 8, 12, 16]
  // maxFuel = mL = (mF - z0 - 1)/mZ;  mF = mL*mZ+z0+1
  readonly maxFuel = [0, 24+2, 36+3, 48+4][this.z0]; // [26,39,52]
  readonly maxLoad = (this.maxFuel - this.z0 - Ship.step1) / Ship.maxZ; // calc maxLoad
  newTurn() { this.zconfig.fuel = this.maxFuel; this.moved = false; }

  //initially: expect maxFuel = (10 + z0*5) = {15, 20, 25}
  /**
   *
   * @param player
   * @param z0 = basic impedance of ship (== this.size !!)
   * @param size 1: scout, 2: freighter, 3: heavy
   */
  constructor(
    public readonly player?: Player,
    public readonly z0 = 2,
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

  /**
   * show ship with current zcolor (from last transit config)
   * @param pcolor AF.zcolor of inner ring ("player" color)
   */
  paint(pcolor = this.player?.afColor) {
    this.paint1(undefined, pcolor)  // TODO: define source/type of Zcolor
  }

  /** repaint with new Zcolor or TP.colorScheme */
  paint1(zcolor: AfColor = this.zcolor, pColor?: AfColor) {
    let r2 = this.radius, r1 = r2 - this.outr, r0 = r1 - 2, g = this.gShape.graphics.c()
    if (pColor) {
      g.f(AF.zcolor[zcolor]).dc(0, 0, r2);
      g.f(C.BLACK).dc(0, 0, r1)
      g.f(AF.zcolor[pColor]).dc(0, 0, r0)
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
    if (!hex0?.afhex || !hex1?.afhex) return undefined
    let od = H.ewDirs.findIndex(d => d == ds)
    let id = H.ewDirs.findIndex(d => d == H.dirRev[ds])
    let dc = 0    // number of config changes incured in transition from hex0 to hex1
    for (let x of this.zkeys) {
      let hex0Conf = hex0.afhex[this.azmap[x]][od]
      if (nconfig[x] !== hex0Conf) dc++
      let hex1Conf = hex1.afhex[this.azmap[x]][id]
      if (hex1Conf !== hex0Conf) dc++
      nconfig[x] = hex1Conf
    }
    return dc * (this.curload + this.z0) + Ship.step1;
  }

  /** move to hex, incur cost to fuel.
   * @return false if move not possible (no Hex, insufficient fuel)
   */
  move(dir: EwDir) {
    let nconfig = { ... this.zconfig }
    let hex = this.hex.nextHex(dir); // this.hex.links[dir];
    let cost = this.configCost(this.hex, dir, hex, nconfig)
    if (!cost || cost > this.fuel) return false;
    nconfig.fuel -= cost
    this.hex = hex;
    this.zconfig = nconfig
    hex.map.update()    // TODO: invoke in correct place...
    return true
  }

  /**
   * try each Step, across Turns, using maxFuel
   * @param targetHex a [non-planet] hex on this.table.hexMap
   * @param tLimit stop searching if path length is tLimit longer than best path.
   */
  findPaths<T extends Hex | Hex2>(targetHex: T, limit = 2) {
    if (targetHex.occupied) return []    // includes: this.hex === targetHex
    let transitCost = Ship.maxZ * (this.z0 + this.curload) + Ship.step1; // approximate 'worst-case' impedance of distance
    let minMetric = this.hex.radialDist(targetHex) * transitCost
    let done: Step<T>[]
    do {
      done = this.findPathWithMetric(targetHex, limit, minMetric = minMetric + 5)
      if (targetHex !== this.targetHex) return done  // target moved
    } while (done.length == 0)
    return done
  }
  findPathWithMetric<T extends Hex | Hex2>(targetHex: T, limit, minMetric) {
    let isLoop = (nStep: Step<Hex>) => {
      let nHex = nStep.curHex, pStep = nStep.prevStep
      while (pStep && pStep.curHex !== nHex) pStep = pStep.prevStep
      return pStep?.curHex === nHex
    }
    // BFS, doing rings (H.ewDirs) around the starting hex.
    let open: Step<T>[] = [], closed: Step<T>[] = [], done: Step<T>[] = []
    let step = new Step<T>(0, this.hex as T, undefined, undefined, this.zconfig, 0, targetHex)
    let mins = minMetric.toFixed(1), Hex0 = this.hex.Aname, Hex1 = targetHex.Aname, hex0 = this.hex
    console.log(stime(this, `.findPathWithMetric:`), { ship: this, mins, Hex0, Hex1, hex0, targetHex })
    open.push(step)
    // loop through all [current/future] open nodes:
    while (step = open.shift()) {
      if (targetHex !== this.targetHex) break; // ABORT Search
      // cycle turns until Step(s) reach targetHex
      // loop here so we can continue vs return; move each dir from prev step:
      for (let dir of H.ewDirs) {
        let nHex = step.curHex.nextHex(dir) as T, nConfig = { ... step.config } // copy of step.config
        if (nHex.occupied) continue // occupied
        let cost = this.configCost(step.curHex, dir, nHex, nConfig)
        if (cost === undefined) continue; // off-map or planet or occupied?
        let turn = step.turn
        nConfig.fuel = nConfig.fuel - cost
        if (nConfig.fuel < 0) {   // Oops: we need to refuel before this Step!
          turn += 1
          nConfig.zshape = null;  // shape resets each turn
          nConfig.fuel = this.maxFuel - cost;
          if (nConfig.fuel < 0) break // over max load!
        }
        let nStep = new Step<T>(turn, nHex, dir, step, nConfig, cost, targetHex)
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
    done.sort((a, b) => a.metric - b.metric)
    if (done.length > 0) {
      let met0 = done[0].metric || -1, clen = closed.length
      let pathm = done.map(p => { return { turn: p.turn, fuel: p.config.fuel, metric: this.pathMetric(p), p: p.toString(), s0: p } })
      console.log(stime(this, `.findPathWithMetric:`), this.hex.Aname, this.targetHex.Aname, this.color, this.curload, met0, clen, `paths:`, pathm)
    }
    return done
  }
  /** Sum of metric for all Steps. */
  pathMetric(step0: Step<Hex>) {
    // return step0.toPath().map(([dir, hex, step]) => step.cost).reduce((pv, cv) => pv + cv, 0)
    let step = step0, sum = 0
    while (step.prevStep) {
      sum += step.cost
      step = step.prevStep
    }
    return sum
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
  drawPath(path: Path<Hex2>, cont: Container, cl: string, wl = 2) {
    // setStrokeStyle().beginStroke(color).moveto(center).lineto(edge=hex0,dir)
    // [arcto(hex1,~dir)]*, lineto(center), endStroke
    let pShape = new Shape(), g = pShape.graphics
    let showTurn = (hex, turn, c = cl) => {
      let tn = new Text(turn.toFixed(0), F.fontSpec(12), c)
        tn.x = hex.x - 3; tn.y = hex.y - 39
        cont.addChildAt(tn, 0) // turn number on hexN
    }
    // Path: [dir, hex] in proper order
    let [{ hex: hex0 }, { dir: dir0 }] = path      // Initial Hex and direction of FIRST Step
    let ep = hex0.edgePoint(dir0)
    g.ss(wl).s(cl).mt(hex0.x, hex0.y).lt(ep.x, ep.y)

    // all the intermediate steps of the path: coming in on pdir, out on ndir
    path.slice(1, - 1).forEach(({ dir: pdir, hex: hexN, step }, index) => {
      if (step.turn !== step.prevStep.turn) showTurn(hexN, step.turn)
      // step into & across hexN
      let { dir: ndir } = path[index + 2] // exit direction
      ep = hexN.edgePoint(ndir)
      if (ndir == pdir) {
        g.lt(ep.x, ep.y)        // straight across
      } else {
        g.at(hexN.x, hexN.y, ep.x, ep.y, hexN.radius/2) // arcTo
      }
    })
    let { dir, hex: hexZ, step } = path[path.length - 1]
    if (step.turn !== step.prevStep.turn) showTurn(hexZ, step.turn)
    g.lt(hexZ.x, hexZ.y)        // draw line (final step)
    g.es()
    return pShape
  }

  pathColor(n: number = 0, alpha?: number | string, decr = 20) {
    let v = this.colorValues.map(vn => vn + n * (vn > 230 ? -decr : decr))
    v[3] = 255    // reset alpha
    return `rgba(${v[0]},${v[1]},${v[2]},${alpha || (v[3]/255).toFixed(2)})`
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

  path0: Path<Hex2>
  showPaths(targetHex: Hex2, cont = targetHex.map.mapCont.pathCont) {
    let paths = this.findPaths(targetHex, 1)
    if (targetHex !== this.targetHex) return // without changing display! [if target has moved]
    this.path0 = paths[0].toPath()        // may be undefined!
    let met0 = paths[0]?.metric || -1, n = 0, k = 4;
    for (let stepZ of paths) {
      let pcolor = this.pathColor(n, 1, stepZ.metric == met0 ? 20 : 30)
      let pshape = this.showPath(stepZ, pcolor, cont)
      pshape.x += n * (k * (Math.random() - .5));
      pshape.y -= n * (k * (Math.random() - .5));
      n += 1;
    }
    cont.stage.update()
  }

  showPath(stepZ: Step<Hex2>, pcolor: string, cont = stepZ.curHex.map.mapCont.pathCont) {
    let path = stepZ.toPath()
    let pshape = this.drawPath(path, cont, pcolor, 2)
    return cont.addChildAt(pshape, 0) // push under the better paths
  }

  targetHex: Hex2;
  originHex: Hex2;
  lastShift: boolean;

  // expand from open node with least (radialDist + metric) <-- DID THIS
  // get estimate of 'minMetric' to prune far branches <-- DID THIS
  dragFunc(hex: Hex2, ctx: DragInfo) {
    if (ctx?.first) {
      this.originHex = this.hex as Hex2
      this.lastShift = undefined
    }
    if (hex == this.originHex) {
      this.targetHex = hex
      this.pCont.removeAllChildren()
    }
    if (!hex || hex.occupied) return; // do not move over non-existant or occupied hex
    const shiftKey = ctx?.event?.nativeEvent?.shiftKey
    if (shiftKey === this.lastShift && !ctx?.first && this.targetHex === hex) return;   // nothing new (unless/until ShiftKey)
    this.lastShift = shiftKey
    if (this.targetHex !== hex) this.pCont.removeAllChildren()
    this.targetHex = hex;
    if (hex === this.hex) return; // no path to originating hex
    if (!shiftKey) return         // no path requested
    this.drawDirect2(hex).then(() => {
      this.showPaths(hex, this.pCont)
    })
  }

  dropFunc(hex: Hex2, ctx: DragInfo) {
    // TODO: move ship to hex --> do each Step, pay Fuel, change zconfig
    if (hex !== this.targetHex || !this.path0 || this.path0[this.path0.length - 1]?.hex !== hex) {
      this.targetHex = hex
      let done = this.findPaths(hex, 0);
      if (!done || done.length === 0) {
        console.log(stime(this, `.dropFunc: no path to hex`), hex)
        this.hex = this.hex;
        return;                  // no path: don't move
      }
      this.path0 = done[0].toPath()
    }
    this.hex = this.originHex;
    // this.zconfig = { ... this.path0.config, zshape: null, fuel: this.maxFuel }
    this.paint()
    //
    const shiftKey = ctx?.event?.nativeEvent?.shiftKey
    if (!shiftKey) this.pCont.removeAllChildren();
    this.lastShift = undefined
  }

  dragBack() {
    this.hex = this.targetHex = this.originHex
    this.originHex.ship = this;
    this.hex.map.update()
  }
  dragAgain() {
    let targetHex = this.targetHex;
    this.pCont.removeAllChildren()
    this.dragBack()
    this.dragFunc(this.hex as Hex2, undefined); // targetHex = this; removeChildren
    this.showPaths(this.targetHex = targetHex);
    this.hex.map.update()
  }
  // false if [still] available to move this turn
  moved = true;
  /** continue any planned, semi-auto moves */
  shipMove() {
    if (!this.moved && this.path0?.length > 0) {
      if (!this.path0[0].dir) this.path0.shift(); // skip initial non-Step
      this.moved = this.takeSteps();
    }
    return this.moved; // NOTE: other Steps still in progress!
  }

  takeSteps() {
    let elt = this.path0[0]
    if (!elt || !this.move(elt.dir as EwDir)) return false
    this.path0.shift()
    setTimeout(() => { this.takeSteps() }, TP.stepDwell) // and do other moves this turn
    return true
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
   * if this is better than existing open Step, replace 's' with this
   */
  isExistingPath(s: Step<T>, ndx: number, obj: Step<T>[]) {
    if (!s.isMatchingElement(this)) return false
    //if (this.metric == s.metric) return false  // try see parallel/equiv paths
    if (this.metric < s.metric) {
      obj[ndx] = this
    }
    return true
  }

  /** reverse chain of Steps to an Array [HexDir, Hex, Step<T>] */
  toPath() {
    let rv: Path<T> = [], cs = this as Step<T>
    while (cs !== undefined) {
      rv.unshift(new PathElt<T>(cs.dir, cs.curHex, cs))
      cs = cs.prevStep
    }
    return rv;
  }

  toString() {
    return this.toPath().map((pe) => `${pe.dir||'0'}->${pe.hex.Aname}$${pe.step.cost}#${pe.step.turn}`).toString()
  }
}
