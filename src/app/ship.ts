import { C, F, RC, stime } from "@thegraid/common-lib";
import { Container, Graphics, Shape, Text, MouseEvent } from "@thegraid/easeljs-module";
import { DragContext, EwDir, H, Hex1, HexDir, IHex2, Meeple } from "@thegraid/hexlib";
import { AF, AfColor, AfFill, ATS } from "./AfHex";
import { MktHex2 as Hex2, MktHex } from "./hex";
import { Item } from "./planet";
import { Player } from "./player";
import { TP } from "./table-params";

export type Cargo = { [key in Item]?: number };
export type ShipSpec = { z0: number, Aname: string, rc: RC, cargo: Cargo };

class PathElt<T extends MktHex> {
  constructor(public dir: HexDir, public hex: T, public step: Step<T>) {  }
}
type Path<T extends MktHex> = PathElt<T>[]

/** changes in ship for each transit Step */
type ZConfig = {
  zshape: ATS,
  zcolor: AfColor,
  zfill: AfFill, // AF.F | AF.L
  fuel: number,
}
export class Ship extends Meeple {
  /** intrinsic cost for each Step (0 or 1); start of turn pays 1 for null 'shape' */
  static step1 = 1;
  static maxZ = 3;       // for now: {shape + color + color}
  static idCounter = 0;
  static fuelPerStep = 0;
  static initCoins = 200;

  // readonly radius = this.z0 * 10;
  override get radius() { return this.z0 * TP.hexRad / 6 };

  override get hex() { return super.hex as MktHex; }
  override set hex(hex: MktHex) { super.hex = hex; }

  // override fromHex: MktHex;

  readonly shipShape: Shape = new Shape();
  // readonly Aname: string = `S${Ship.idCounter++}`

  /** show path from srcHex to destHex */
  pCont: Container
  coins: number = Ship.initCoins

  /** total quantity [amount|weight] of Cargo on this ship. */
  get curload() {
    return Object.keys(this.cargo).map((c: Item) => this.cargo[c]).reduce((n, p) => n + p, 0 )
  }
  /** 'worst-case' cost for single step */
  get transitCost() { return Ship.maxZ * (this.z0 + this.curload) + Ship.step1; }

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
  /** see also: Meeple.faceUp() */
  newTurn() {
    this.zconfig.fuel = this.maxFuel;
    this.pathFinder.moved = false;
    return;
  }

  //initially: expect maxFuel = (10 + z0*5) = {15, 20, 25}
  /**
   *
   * @param player (undefined for Chooser)
   * @param z0 = basic impedance of ship (== this.size !!)
   * @param size 1: scout, 2: freighter, 3: heavy
   */
  constructor(
    Aname?: string,
    player?: Player,
    public readonly z0 = 2,
    public cargo: Cargo = {},
  ) {
    super(Aname ?? `S${Ship.idCounter++}`, player)
    this.addChild(this.shipShape)
    let textSize = 16, nameText = new Text(this.Aname, F.fontSpec(textSize))
    nameText.textAlign = 'center'
    nameText.y = -textSize / 2;
    this.addChild(nameText)
    this.paint()  // TODO: makeDraggable/Dropable on hexMap
    this.pCont = player?.pathCont;
    // this.player.gamePlay.table.makeDragable(this);
  }
  override player: Player;

  override onRightClick(evt: MouseEvent) {
    console.log(stime(this, `.rightclick:`), this.Aname, evt)
    // TODO: display Ship fuel & cargo
  }

  /**
   * show ship with current zcolor (from last transit config)
   * @param pcolor AF.zcolor of inner ring ("player" color)
   */
  override paint(pcolor = this.player?.afColor) {
    if (!this.shipShape) return;       // Tile calls paint before initialization is complete
    this.paint1(undefined, pcolor)  // TODO: define source/type of Zcolor
  }

  /** repaint with new Zcolor or TP.colorScheme */
  paint1(zcolor: AfColor = this.zcolor, pColor?: AfColor) {
    // zcolor-ring(r2-r1), black-ring(r1-r0), pColor-circle(r0)
    let r2 = this.radius + 8, r1 = this.radius, r0 = this.radius - 2
    let g = this.shipShape.graphics.c() // clear
    if (pColor) {
      g.f(AF.zcolor[zcolor]).dc(0, 0, r2);
      g.f(C.BLACK).dc(0, 0, r1)
      g.f(AF.zcolor[pColor]).dc(0, 0, r0)
    }
    this.cache(-r2, -r2, 2 * r2, 2 * r2); // Container of Shape & Text
  }

  paint2(zcolor: AfColor) {
    this.paint1(zcolor)
    this.shipShape.graphics.c().f(C.BLACK).dc(0, 0, this.radius/2) // put a hole in it!
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
  configCost(hex0: MktHex, ds: EwDir, hex1 = hex0.nextHex(ds), nconfig = { ...this.zconfig }) {
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
  move(dir: EwDir, hex = this.hex.nextHex(dir)) {
    let nconfig = { ... this.zconfig }
    if (hex.occupied) return false;
    let cost = this.configCost(this.hex, dir, hex, nconfig)
    if (!cost || cost > this.fuel) return false;
    nconfig.fuel -= cost
    this.hex = hex;
    this.zconfig = nconfig
    this.paint()
    hex.map.update()    // TODO: invoke in correct place...
    return true
  }

  /** called before tile.moveTo(undefined) */
  override dragStart(ctx: DragContext): void {
    return;
  }

  override isLegalTarget(toHex: Hex1, ctx?: DragContext): boolean {
    if (!toHex) return false;
    if (toHex.occupied) return false;
    return true;
  }

  override showTargetMark(hex: IHex2 | undefined, ctx: DragContext): void {
    return;          // not needed: all Hex that path goes to are legal...
  }

  override dragFunc(hex: IHex2, ctx: DragContext) {
    const hex2 = hex as Hex2;
    const shiftKey = ctx?.info?.event?.nativeEvent?.shiftKey
    if (!shiftKey || hex2 === this.fromHex) {
      this.pCont.removeAllChildren();
      return          // no path requested
    }
    if (hex2 === this.hex) return  // no path to self
    if (hex2 === this.targetHex) return // same path, don't redraw
    this.targetHex = hex2;
    this.pathFinder.drawDirect2(hex2).then(() => {
      this.pathFinder.showPaths(hex2, 1)      // show extra paths
    })
  }

  // hexlib.Dragger is invoked with hexlib.IHex2
  // our HexMap contains (MktHex2 as Hex2) extends MktHex implements IHex2;
  override dropFunc(targetHex: IHex2, ctx: DragContext) {
    const hex = targetHex as Hex2;
    if (ctx.lastCtrl) {
      super.dropFunc(targetHex, ctx);  // placeTile(targetHex) -- Do a Move !
    } else {
      this.hex = this.fromHex as Hex2; // put it back at beginning
    }
    const path0 = this.pathFinder.path0;
    if (hex !== this.targetHex || !path0 || path0[path0.length - 1]?.hex !== hex) {
      this.pathFinder.setPathToHex(hex)   // find a path not shown
    }
    this.paint()
    //
    const shiftKey = ctx?.info?.event?.nativeEvent?.shiftKey
    if (!shiftKey) this.pCont.removeAllChildren();
    this.lastShift = undefined
  }

  /** find path to this target hex */
  targetHex: MktHex;
  lastShift: boolean;
  pathFinder = new PathFinder(this);

  /** false if [still] available to move this turn. [see also: meep.faceUp] */
  moved = true;

  /** Ship has a path set for move. */
  get hasPathMove() {
    return this.pathFinder.hasPath0;
  }

  shipMove() {
    return this.pathFinder.moveOnPath()
  }
}

class PathFinder {
  constructor(public ship: Ship) {}
  get pCont() { return this.ship.pCont; }
  get fromHex() { return this.ship.fromHex; }
  get targetHex() { return this.ship.targetHex; }
  set targetHex(hex: MktHex) { this.ship.targetHex = hex; }
  get moved() { return this.ship.moved; }
  set moved(v: boolean) { this.ship.moved = v; }

  pathLog = false;
  /**
   * try each Step, across Turns, using maxFuel
   * @param targetHex a Hex on this.table.hexMap
   * @param tLimit stop searching if path length is tLimit longer than best path.
   * @return final Step of each path; empty array if no possible path to targetHex
   */
  findPaths<T extends MktHex>(targetHex: T, limit = 2) {
    if (targetHex.occupied) return []    // includes: this.hex === targetHex
    const hex = this.fromHex as any as T;
    let minMetric = hex.radialDist(targetHex) * this.ship.transitCost
    let paths: Step<T>[]
    do {
      paths = this.findPathsWithMetric(hex, targetHex, limit, minMetric = minMetric + 5)
      if (targetHex !== this.targetHex) return paths  // target moved
    } while (paths.length == 0)
    return paths
  }
  /** @return (possibly empty) array of Paths. */
  findPathsWithMetric<T extends MktHex>(hex0: T, hex1: T, limit: number, minMetric: number) {
    let isLoop = (nStep: Step<MktHex>) => { // 'find' for linked list:
      let nHex = nStep.curHex, pStep = nStep.prevStep
      while (pStep && pStep.curHex !== nHex) pStep = pStep.prevStep
      return pStep?.curHex === nHex
    }
    // BFS, doing rings (H.ewDirs) around the starting hex.
    let fuel = this.moved ? this.ship.fuel : this.ship.maxFuel
    let nConfig = { ... this.ship.zconfig, fuel }
    let step = new Step<T>(0, hex0 as T, undefined, undefined, nConfig, 0, hex1)
    let mins = minMetric.toFixed(1), Hex0 = hex0.Aname, Hex1 = hex1.Aname
    this.pathLog && console.log(stime(this, `.findPathsWithMetric:`), { ship: this, mins, Hex0, Hex1, hex0, hex1 })
    let open: Step<T>[] = [step], closed: Step<T>[] = [], done: Step<T>[] = []
    // loop through all [current/future] open nodes:
    while (step = open.shift()) {
      if (hex1 !== this.targetHex) break; // ABORT Search
      // cycle turns until Step(s) reach targetHex
      // loop here so we can continue vs return; move each dir from prev step:
      for (let dir of H.ewDirs) {
        const nHex = step.curHex.nextHex(dir), nConfig = { ... step.config } // copy of step.config
        if (!nHex || nHex.occupied) continue // off map or occupied
        let cost = this.ship.configCost(step.curHex, dir, nHex, nConfig)
        if (cost === undefined) continue; // no afHex, no transit possible
        let turn = step.turn
        nConfig.fuel = nConfig.fuel - cost
        if (nConfig.fuel < 0) {   // Oops: we need to refuel before this Step!
          turn += 1
          nConfig.zshape = null;  // shape resets each turn
          nConfig.fuel = this.ship.maxFuel - cost;
          if (nConfig.fuel < 0) break // over max load!
        }
        let nStep = new Step<T>(turn, nHex, dir, step, nConfig, cost, hex1)
        if (closed.find(nStep.isMatchingElement, nStep)) continue  // already evaluated & expanded
        if (open.find(nStep.isExistingPath, nStep) ) continue     // already a [better] path to nHex
        // assert: open contains only 1 path to any Step(Hex, config) that path has minimal metric

        let metric = nStep.metric
        if (metric > minMetric + limit) continue // abandon path: too expensive
        if (nHex == hex1) {
          if (done.length === 0) this.pathLog && console.log(stime(this, `.findPathsWithMetric: first done ${metric}`), nStep)
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
      this.pathLog && console.log(stime(this, `.findPathsWithMetric:`), hex0.Aname, hex1.Aname, this.ship.color, this.ship.curload, met0, clen, `paths:`, pathm)
    }
    return done
  }
  /** Sum of metric for all Steps. */
  pathMetric(step0: Step<MktHex>) {
    // return step0.toPath().map(([dir, hex, step]) => step.cost).reduce((pv, cv) => pv + cv, 0)
    let step = step0, sum = 0
    while (step.prevStep) {
      sum += step.cost
      step = step.prevStep
    }
    return sum
  }
  drawDirect(target: Hex2, g: Graphics, cl: string , wl = 2) {
    const hex0 = this.ship.fromHex;
    g.ss(wl).s(cl).mt(hex0.x, hex0.y).lt(target.x, target.y).es()
  }
  /**
   *
   * @param step the final step, work back until step.prevHex === undefined
   * @param g Graphics
   * @param cl color of line
   * @param wl width of line
   */
  drawPath(path: Path<Hex2>, cl: string, wl = 2) {
    // setStrokeStyle().beginStroke(color).moveto(center).lineto(edge=hex0,dir)
    // [arcto(hex1,~dir)]*, lineto(center), endStroke
    let pShape = new Shape(), g = pShape.graphics
    pShape.mouseEnabled = false;
    const showTurn = (hex: Hex2, turn: number, c = cl) => {
      let tn = new Text(turn.toFixed(0), F.fontSpec(16), c)
      tn.textAlign = 'center'; tn.mouseEnabled = false;
        tn.x = hex.x; tn.y = hex.y - 39
        this.pCont.addChildAt(tn, 0) // turn number on hexN
    }
    // Path: [dir, hex] in proper order
    let [{ hex: hex0 }, { dir: dir0 }] = path      // Initial Hex and direction of FIRST Step
    let ep = hex0.edgePoint(dir0)
    g.ss(wl).s(cl).mt(hex0.x, hex0.y).lt(ep.x, ep.y)

    // all the intermediate steps of the path: coming in on pdir, out on ndir
    path.slice(1, - 1).forEach(({ dir: pdir, hex: hexN, step }, index) => {
      showTurn(hexN, step.turn)
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
    showTurn(hexZ, step.turn)
    g.lt(hexZ.x, hexZ.y)        // draw line (final step)
    g.es()
    return pShape
  }

  pathColor(n: number = 0, alpha?: number | string, decr = 20) {
    let v = this.ship.colorValues.map(vn => vn + n * (vn > 230 ? -decr : decr))
    v[3] = 255    // reset alpha
    return `rgba(${v[0]},${v[1]},${v[2]},${alpha || (v[3]/255).toFixed(2)})`
  }
  /** Draw straight white line from this.fromHex to target hex */
  async drawDirect2(hex: Hex2) {
    let dshape = new Shape()
    dshape.mouseEnabled = false;
    this.drawDirect(hex, dshape.graphics, 'rgba(250,250,250,.5')
    this.pCont.addChild(dshape)
    hex.map.update()
    return new Promise<void>((resolve) => {
      setTimeout(() => { resolve() }, 1);
    });
  }

  _path0: Path<Hex2>
  get path0() { return this._path0; }
  set path0(path: Path<Hex2>) {
    this._path0 = path;
  }
  showPaths(targetHex: Hex2, limit = 1) {
    this.pCont.removeAllChildren()
    let paths = this.setPathToHex(targetHex, limit)  // find paths to show
    this.pCont.parent.addChild(this.pCont);  // put *this* pathCont on top
    // if (targetHex !== this.targetHex) return // without changing display! [if target has moved]
    if (!paths[0]) return                    // no path to targetHex; !this.path0
    let met0 = paths[0].metric, n = 0, k = 4;
    for (let stepZ of paths) {
      let pcolor = this.pathColor(n, 1, stepZ.metric === met0 ? 20 : 30)
      let pshape = this.showPath(stepZ, pcolor)
      pshape.x += n * (k * (Math.random() - .5));
      pshape.y -= n * (k * (Math.random() - .5));
      n += 1;
    }
    this.pCont.stage.update()
  }

  showPath(stepZ: Step<Hex2>, pcolor: string) {
    let path = stepZ.toPath()
    let pshape = this.drawPath(path, pcolor, 2)
    this.pCont.addChildAt(pshape, 0) // push under the better paths (and tn Text)
    return pshape
  }

  /** set this.path0, return all Paths to hex. */
  setPathToHex(targetHex: Hex2, limit = 0) {
    this.targetHex = targetHex
    let paths = this.findPaths(targetHex, limit);
    if (paths.length === 0) {
      console.log(stime(this, `.setPathToHex: no path to hex`), targetHex)
    }
    this.path0 = paths[0]?.toPath() // path0 may be undefined
    console.log(stime(this, `.setPathToHex: path0 =`), this.path0, this.hasPath0);
    return paths                    // paths may be empty, but NOT undefined
  }

  /** return true if no auto path0 for this ship. */
  get hasPath0() {
    return (this.path0 && this.path0.length > 0);
  }
  /** continue any planned, semi-auto moves toward this.targetHex */
  moveOnPath() {
    // TODO: continue move if available fuel
    if (this.moved || !this.hasPath0) return this.moved;
    if (!this.path0[0].dir) this.path0.shift();           // skip initial non-Step
    if (this.pathHasOccupiedHex()) {
      this.showPaths(this.targetHex as Hex2)  // make a new plan (unless targetHex is occupied!)
      if (!this.path0) return false   // targetHex now occupied!
      this.path0.shift();             // skip initial non-Step
    }
    this.moved = this.takeSteps();
    return this.moved; // NOTE: other Steps still in progress!
  }

  /** assert this.path0 is defined. */
  pathHasOccupiedHex() {
    let turn0 = this.path0[0]?.step.turn
    return this.path0.find(elt => elt.step.turn === turn0 && elt.hex.occupied);
  }

  takeSteps() {
    let elt = this.path0[0]
    if (!elt) return false; // illegal step
    let dir = elt.dir as EwDir, hex = this.ship.hex.nextHex(dir)
    if (hex.occupied) {
      // find alternate path...?
    }
    if (!this.ship.move(dir, hex)) return false
    this.path0.shift()
    setTimeout(() => { this.takeSteps() }, TP.stepDwell) // and do other moves this turn
    return true
  }

}

class Step<T extends MktHex> {
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
