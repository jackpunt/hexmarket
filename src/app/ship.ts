import { C, F, RC, S, stime } from "@thegraid/common-lib";
import { CenterText, stopPropagation, TextInRect, type CGF, type PaintableShape } from "@thegraid/easeljs-lib";
import { Container, Graphics, MouseEvent, Shape } from "@thegraid/easeljs-module";
import { DragContext, EwDir, H, Hex1, HexDir, IHex2, Meeple, MeepleShape } from "@thegraid/hexlib";
import { AF, AfColor, AfFill, ATS, type AfHex } from "./AfHex";
import { MktHex2 as Hex2, MktHex, MktHex2 } from "./hex";
import { InfoText } from "./info-text";
import { iconForItem, Item } from "./planet";
import { Player, PlayerColor } from "./player";
import type { TableCell } from "./table-cell";
import { TP } from "./table-params";
import { TradePanel } from "./trade-panel";

export type Cargo = { [key in Item]?: number };
export type ShipSpec = { z0: number, Aname?: string, rc: RC, cargo: Cargo };

class PathElt<T extends MktHex> {
  constructor(public dir: HexDir | undefined, public hex: T, public step: Step<T>) {  }
}
type Path<T extends MktHex> = PathElt<T>[]

/** changes in ship for each transit Step */
type ZConfig = {
  zshape?: ATS,
  zcolor?: AfColor,
  zfill?: AfFill, // AF.F | AF.L
  fuel: number,
  step0: boolean,
}

class ShipShape extends MeepleShape {

  constructor(public ship: Ship) {
    super(ship.player, TP.meepleRad); // no color, no g0
    this._cgf = this.sscgf as CGF;
  }
  // during Tile construction, radius is not set, so do it after Meeple constructor
  setRadius(radius = this.ship.radius) {
    const y0 = this.y = TP.meepleY0;
    this.radius = radius;
    this.setMeepleBounds();
    const { x, width: w } = this.getBounds();
    const over = this.backSide;
    over.graphics.c().f(MeepleShape.backColor).dc(x + w / 2, y0, w / 2);
    this.paint();
  }

  zColor?: AfColor;

  override paint(colorn?: string, force?: boolean): Graphics {
    return super.paint(colorn, force || this.zColor !== this.ship.zcolor)
  }

  /** paint ring of Zcolor around pColor */
  sscgf(pColor = this.ship.color, g = this.g0) {
    // stack three disks: r2(zcolor) r1(black) r0(pcolor)
    // zcolor-ring(r2-r1), black-ring(r1-r0), pColor-circle(r0)
    const r = this.ship.radius
    const r2 = r + 8, r1 = r, r0 = r - 2;
    const zcolor = this.ship.zcolor as AfColor; // we handle undefined below:
    g.c() // clear
    if (pColor) {
      g.f(AF.zcolor[zcolor] ?? 'grey').dc(0, 0, r2);
      g.f(C.BLACK).dc(0, 0, r1)
      g.f(pColor).dc(0, 0, r0)
    }
    this.zColor = zcolor
    return g;
  }
}

export class Ship extends Meeple {
  static idCounter = 0;
  /** intrinsic impedance per size; */
  static z0 = [0, 1, 2, 3];
  /** default Ship size in constructor */
  static defaultShipSize = 2;
  static maxFuel = [0, 24 + 2, 36 + 3, 48 + 4]

  /** from zconfig field name to AfHex field name. */
  static readonly azmap: Partial<Record<keyof ZConfig, keyof AfHex>> = { 'zshape': 'aShapes', 'zcolor': 'aColors', 'zfill': 'aFill' }
  static readonly zkeys = Object.keys(this.azmap) as Partial<keyof ZConfig>[];

  // Of shape, color, fill; color & fill are sticky, must re-assert shape to transit...
  /** cost for first step of each turn (after coming out of transit to refuel) */
  static step0Cost = 1;
  /** intrinsic cost for each Step (0 or 1); start of turn pays 1 for null 'shape' */
  static step1 = 1;
  /** scale for transitCost. */
  static maxZ = 2;       // for now: {shape + color + color}
  static fuelPerStep = 0;

  override get radius() { return this.z0 * TP.hexRad / 6 };

  override get hex() { return super.hex as MktHex; }
  override set hex(hex: MktHex) { super.hex = hex; }

  get shipShape() { return this.baseShape as ShipShape; }

  /** show path from srcHex to destHex */
  pCont: Container

  _cargo: Cargo = {};
  get cargo() { return this._cargo }
  set cargo(c: Cargo) {
    this._cargo = c;
    this.showShipInfo(this.infoText.visible); // update if visible
  }
  /** total quantity [amount|weight] of Cargo on this ship. */
  get curload() {
    // each cargo type is weighted equally (== 1)
    return Object.values(this.cargo).reduce((pv, cv) => pv + cv, 0 )
  }
  /**
   * Approx 'worst-case' cost for each/single step; set minMetric
   *
   * See also: configCost()
   *
   * Mass = z0 + curload;
   * Cost = Mass * maxZ + step1
   */
  get transitCost() { return Ship.maxZ * (this.z0 + this.curload) + Ship.step1; }

  get color() { return Player.colorScheme[this.player.index] }

  /** current Z-configuration of Ship */
  zconfig: ZConfig = { zshape: undefined, zcolor: undefined, zfill: AF.F, fuel: 0, step0: false };
  get zshape() { return this.zconfig.zshape; }
  get zcolor() { return this.zconfig.zcolor; }
  get zfill() { return this.zconfig.zfill; }
  get fuel() { return this.zconfig.fuel; }
  get step0() { return this.zconfig.step0; }
  readonly z0 = Ship.z0[Ship.defaultShipSize]; // Set in constructor

  /** turn when ship actually moved */
  movedOnTurn = -1;
  // maxLoad = [0, 8, 12, 16]
  // maxFuel = mL = (mF - z0 - 1)/mZ;  mF = mL*mZ+z0+1

  get maxFuel() { return Ship.maxFuel[this.size] }
   // calc maxLoad: constraint when Trade('buy')
  get maxLoad() { return  (this.maxFuel - this.z0 - Ship.step1) / Ship.maxZ;}

  /** called in Tile constructor */
  override makeShape(): PaintableShape {
    return new ShipShape(this);
  }

  //initially: expect maxFuel = (10 + z0*5) = {15, 20, 25}
  /**
   * @param Aname display name of Ship
   * @param player (undefined for Chooser)
   * @param size index to z0 & maxFuel
   * @param cargo initial cargo
   * @param size 1: scout, 2: freighter, 3: heavy
   */
  constructor(
    Aname?: string,
    player?: Player,
    public readonly size = Ship.defaultShipSize,
    cargo: Cargo = {},
  ) {
    super(Aname ?? `S${Ship.idCounter++}`, player)
    this.cargo = cargo;
    this.z0 = Ship.z0[size]; this.zconfig;
    this.shipShape.setRadius(this.radius); // now that z0 is set
    this.addChild(this.infoText) // last child, top of display
    this.rightClickable() ; //(evt: MouseEvent) => this.showShipInfo(evt)
    this.infoText.mouseEnabled = true; // to get rightClick
    this.paint()  // TODO: makeDraggable/Dropable on hexMap
    this.player = player as Player;             // overriding undefined player
    this.pCont = player?.pathCont as Container; // overriding undefined player
    // this.player.gamePlay.table.makeDragable(this);
  }
  override player: Player;

  override onRightClick(evt: MouseEvent) {
    this.showShipInfo(); // toggle visibility
  }

  /** newTurn: refuel, lose zshape */
  refuel(config = this.zconfig) {
    const refuel = this.maxFuel - config.fuel;
    config.fuel += refuel;
    config.zshape = undefined;
    return refuel;
  }

  /** see also: Meeple.faceUp() */
  newTurn() {
    this.faceUp();   // set startHex
    this.player.coins -= this.refuel();
    if (this.targetHex) this.pathFinder.showPaths(this.targetHex as Hex2)
    return;
  }

  /** TODO move to library: see PaintableShape.setBounds(undefined, 0, 0, 0) */
  /** re-cache Tile if children have changed size or visibility. */
  reCache() {
    this.uncache()
    this.setBoundsNull(); // remove bounds
    const b = this.getBounds();    // of shipShape & InfoBox (vis or !vis, new Info)
    this.setBounds(b.x, b.y, b.width, b.height); // record for debugger
    this.cache(b.x, b.y, b.width, b.height, TP.cacheTiles);
  }
  infoColor = 'rgba(250,250,250,.8)';
  infoText = new InfoText('Fuel: -1', { bgColor: this.infoColor, fontSize: TP.hexRad * .3 });

  showShipInfo(vis = !this.infoText.visible) {
    const fs = this.infoText.fontSize
    this.infoText.updateText(vis, () => {
      const icons = [] as Array<TableCell & TextInRect>
      let infoLine = `Fuel: ${this.fuel}`;
      infoLine = `${infoLine}\nzLoad: ${this.transitCost}`
      Object.entries(this.cargo).sort((a, b) => a[0] < b[0] ? -1 : 1).filter(a => a[1] > 0).forEach(([key, value]) => {
        const cargoLine = `${key}: ${value}`;
        infoLine = `${infoLine}\n${cargoLine}`;
        const icon = iconForItem(key as Item, fs * .86); icons.push(icon);
      })
      // Hack to overlay icon on text:
      this.infoText.removeChildType(TextInRect)
      const text = this.infoText.disp
      text.text = infoLine; //text.textAlign = 'left';
      const { x, y } = text.getBounds();
      const h = text.getMeasuredLineHeight();
      icons.forEach((icon, n) => {
        const { width: w, height } = icon.getBounds();
        icon.setInCell({ x, y: y - 3 + (n + 2) * h, w, h: h-2 })
        this.infoText.addChild(icon);
      })
      return infoLine;
    })
  }

  tradePanel?: TradePanel;
  showTradePanel(vis = true): any {
    if (!vis) {
      this.tradePanel && (this.tradePanel.visible = false);
      return this;
    }
    if (!this.tradePanel) {
      this.tradePanel = new TradePanel(this)
      this.tradePanel.on(S.pressup, stopPropagation)
      this.tradePanel.on(S.pressmove, stopPropagation)
    }
    const planet = this.adjacentPlanet()
    this.faceUp(!!planet)
    if (planet) {
      this.tradePanel.showPanel(planet)
    }
    return this;
  }

  /**
   * show ship with current zcolor (from last transit config)
   * @param pColor AF.zcolor of inner ring ("player" color)
   */
  override paint(pColor = this.pColor as PlayerColor) {
    if (!this.zconfig) return;       // Tile calls paint before initialization is complete
    this.shipShape.paint(pColor);
    return;
  }

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
    const config = (hex: MktHex, zkey: keyof ZConfig, afkey: keyof AfHex, di: number) => {
      const afInDir = (hex.afhex as any)[afkey][di];
      if (nconfig[zkey] !== afInDir) dc++;
      ;(nconfig as Record<keyof ZConfig, any>)[zkey] = afInDir;
    }
    Object.entries(Ship.azmap).forEach(([zkey, afkey]) => {
      config(hex0, zkey as keyof ZConfig, afkey, od)
      config(hex1, zkey as keyof ZConfig, afkey, id)
    })
    const step = (nconfig.step0 ? Ship.step0Cost : 0) + Ship.step1;
    return step + dc * (this.curload + this.z0);
  }

  /** move to adjacent hex, incur cost to fuel.
   * @return false if move not possible (no Hex, insufficient fuel)
   */
  move(dir: EwDir, hex = this.hex.nextHex(dir)) {
    let nconfig = { ... this.zconfig }
    if (!hex || hex.occupied) return false;
    let cost = this.configCost(this.hex, dir, hex, nconfig); // updates nconfig after transit
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
    return;          // not needed, can see the Path
  }

    override dragFunc(hex: IHex2, ctx: DragContext) {
    const hex2 = hex as Hex2, alwaysDraw = TP.drawPath
    if (ctx.info.first) this.targetHex = undefined;
    if (!alwaysDraw && (!ctx?.lastCtrl || hex2 === this.fromHex)) {
      this.pCont.removeAllChildren();  // compute no paths, show no paths
      return            // no path requested
    }
    if (!hex2) return;  // cantMoveTile?
    if (hex2 === this.hex) return  // no path to self
    if (hex2 === this.targetHex) return // same path, don't redraw
    this.targetHex = hex2;
    this.pathFinder.drawDirect2(hex2).then(() => {
      this.pathFinder.showPaths(hex2)      // show extra paths
    })
  }

  // hexlib.Dragger is invoked with hexlib.IHex2
  // our HexMap contains (MktHex2 as Hex2) extends MktHex implements IHex2;
  override dropFunc(targetHex: IHex2, ctx: DragContext) {
    if (ctx.lastShift) {
      super.dropFunc(targetHex, ctx);  // placeTile(targetHex) -- Do a Move !
    } else {
      this.hex = this.fromHex as Hex2; // put it back at beginning
    }
    this.player.touchShip(this);
    if (!ctx?.lastCtrl) this.pCont.removeAllChildren();
    this.lastShift = undefined
  }

  /** find path to this target hex */
  targetHex?: MktHex;
  lastShift?: boolean;
  pathFinder = new PathFinder(this);

  /** Ship has a path set for move. */
  get hasPathMove() {
    return this.pathFinder.hasPath0;
  }

  /** 'm' key --> playerMove() --> shipMove: advance lrt Ship for this 'Move'
   * @returns true if Ship moved (or was already moved)
   */
  moveOnPath() {
    return this.pathFinder.moveOnPath()
  }

  /** Ship is adjacent to at move 1 Planet */
  adjacentPlanet() {
    return H.ewDirs.map(ds => this.hex.nextHex(ds)?.planet).filter(p => !!p)[0]
  }
}

/** PlanC Ship: simplified fuel, cargo and costs */
export class ShipC extends Ship {
  _maxFuel: number
  _maxLoad: number
  override get maxFuel(): number { return this._maxFuel }
  override get maxLoad(): number { return this._maxLoad }

  constructor(Aname?: string,
    player?: Player,
    size = Ship.defaultShipSize,
    cargo: Cargo = {},) {
    super(Aname, player, size, cargo)
    this._maxFuel = [0, 3, 5, 7][this.size]
    this._maxLoad = [0, 3, 4, 6][this.size]
  }
}

class PathFinder {
  constructor(public ship: Ship) {}
  get pCont() { return this.ship.pCont; }
  get fromHex() { return this.ship.hex ?? this.ship.fromHex; } // fromHex when dragging
  get targetHex() { return this.ship.targetHex; }
  set targetHex(hex: MktHex | undefined) { this.ship.targetHex = hex; }

  pathLog = false;
  /**
   * try each Step, across Turns, using maxFuel
   * @param targetHex a Hex on this.table.hexMap
   * @param limit stop searching if path length is limit longer than best path.
   * @return final Step of each path; empty array if no possible path to targetHex
   */
  findPaths<T extends MktHex>(targetHex: T, limit = this.ship.maxFuel) {
    if (targetHex.occupied) return []    // includes: this.hex === targetHex
    const hex0 = this.fromHex as any as T, tc = this.ship.transitCost;
    let minMetric = hex0.radialDist(targetHex) * tc;
    const maxMetric = 5 * minMetric
    let paths: Step<T>[]
    do {
      // minMetric to prune bad paths; try raising it if no good paths:
      paths = this.findPathsWithMetric(hex0, targetHex, limit, minMetric = minMetric + tc)
      if (targetHex !== this.targetHex) return paths     // target moved
    } while (paths.length == 0 && minMetric < maxMetric) // stop looping, no viable paths
    return paths
  }

  /**
   *
   * @param hex0 starting hex
   * @param hex1 target hex
   * @param limit stop if path metric exceeds minMetric by limit
   * @param minMetric lowest fuel-cost path found so far
   * @returns (possibly empty) array of Paths. from hex0 to hex1
   */
  findPathsWithMetric<T extends MktHex>(hex0: T, hex1: T, limit: number, minMetric: number) {
    /** returns true if nStep.hex is in prevStep(s) of nStep */
    const isLoop = (nStep: Step<MktHex>) => { // 'find' for linked list:
      let pStep = nStep.prevStep?.prevStep;   // ASSERT: (nStep.prevStep.hex !== nStep.hex)
      while (pStep) {
        if (pStep.hex === nStep.hex) { return true; }
        pStep = pStep.prevStep
      }
      return false;
    }
    const ship = this.ship;
    if (this.pathLog) {
      const mins = minMetric.toFixed(1), Hex0 = hex0.Aname, Hex1 = hex1.Aname;
      console.log(stime(this, `.findPathsWithMetric:`), { ship: ship.Aname, mins, Hex0, Hex1, hex0, hex1 })
    }
    // BFS, doing rings (H.ewDirs) around the starting hex.
    const fuel = ship.fuel;  // this.moved ? ship.fuel : ship.maxFuel
    const config0 = { ... ship.zconfig, fuel }
    let step0: Step<T> | undefined = new Step<T>(0, hex0 as T, undefined, undefined, config0, 0, hex1)
    const open: Step<T>[] = [step0], closed: Step<T>[] = [], done: Step<T>[] = []
    // loop through all [current/future] open nodes:
    while (step0 = open.shift()) {
      const step: Step<T> = step0;        // a defined Step
      if (hex1 !== this.targetHex) break; // ABORT Search (targetHex has changed)
      let minCost = Number.POSITIVE_INFINITY; // TODO proctively compute/alert on maxLoad
      // cycle turns until Step(s) reach targetHex
      // loop here so we can continue vs return; move each dir from prev step:
      for (let dir of H.ewDirs) {
        const nHex = step.hex.nextHex(dir), nConfig = { ... step.config } // copy of step.config
        if (!nHex || nHex.occupied) continue // off map or occupied
        let cost = ship.configCost(step.hex, dir, nHex, nConfig)
        if (cost === undefined) continue; // no afHex, no transit possible
        minCost = Math.min(minCost, cost);
        let turn = step.turn
        if (cost > nConfig.fuel) {   // Oops: we need to refuel before this Step!
          turn += 1
          ship.refuel(nConfig)       // shape resets each turn
          nConfig.step0 = true;
          if (cost > nConfig.fuel) continue // over max load! (cost > maxFuel)
        }
        nConfig.fuel = nConfig.fuel - cost
        let nStep = new Step<T>(turn, nHex, dir, step, nConfig, cost, hex1)
        if (isLoop(nStep)) continue; // loop: previous visit to nHex already in closed or open.
        if (closed.find(nStep.isMatchingElement, nStep)) continue  // already evaluated & expanded
        if (open.find(nStep.isExistingPath, nStep) ) continue     // already a [better] path to nHex
        // assert: open contains only 1 path to any Step(Hex, config) that path has minimal metric

        let metric = nStep.metric
        if (metric > minMetric + limit) continue // abandon path: too expensive
        if (nHex == hex1) {
          if (done.length === 0) this.pathLog && console.log(stime(this, `.findPathsWithMetric: [0]:${metric}`), nStep)
          if (metric < minMetric) minMetric = metric
          done.push(nStep);
        } else {
          open.push(nStep); // save path, check back later
        }
      }
      if (minCost > ship.maxFuel) console.log(stime(this, `.findPathsWithMetric: minCost(${minCost}) > maxFuel(${ship.maxFuel})`))
      closed.push(step)
      open.sort((a, b) => a.metricb - b.metricb)
    }
    done.sort((a, b) => a.metric - b.metric)
    if (done.length > 0) {
      let met0 = done[0].metric || -1, clen = closed.length
      let pathm = done.map(p => { return { turn: p.turn, fuel: p.config.fuel, metric: this.pathMetric(p), p: p.toString(), s0: p } })
      this.pathLog && console.log(stime(this, `.findPathsWithMetric:`), hex0.Aname, hex1.Aname, this.ship.zcolor, this.ship.curload, met0, clen, `paths:`, pathm)
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
   * Add graphical path (and showTurnFuel) to bottom of pCont
   * @param zStep the final Step, work back until step.prevStep === undefined
   * @param cl color of line
   * @param wl width of line
   * @param ndx [0] which dxy offsets to use
   * @returns the path Shape
   */
  drawPath(zStep: Step<Hex2>, cl: string, wl = 2, ndx = 0) {
    // setStrokeStyle().beginStroke(color).moveto(center).lineto(edge=hex0,dir)
    // [arcto(hex1,~dir)]*, lineto(center), endStroke
    const path: Path<Hex2> = zStep.toPath()
    let pShape = new Shape(), g = pShape.graphics
    pShape.mouseEnabled = false;
    const k = 5, dxy = [{ x: 0, y: 0 }, { x: -1, y: 1 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: -1 }]
    const { x: dx, y: dy } = { x: k * dxy[ndx].x, y: k * dxy[ndx].y }
    pShape.x = dx; pShape.y = dy
    const hexes: Hex2[] = [], brk = true;  // redundant check for loop
    // sTF visits each hex on the path
    const showTurnFuel = (hex: Hex2, step: Step<MktHex>, c = cl) => {
      const { turn, config } = step;
      if (hexes.includes(hex) && brk) { debugger } hexes.push(hex); // isLoop() failed
      const fs = TP.hexRad / 4, fs2 = fs * 2, fsk = fs2 * 27 / 32;
      let tn = new CenterText(`${turn.toFixed(0)} ${config.fuel}`, F.fontSpec(fs), c)
      tn.mouseEnabled = false;
      const [dx, dy] = [[0, -fs2], [-fsk, fs], [fsk, fs]][ndx] ?? [0, fs2];
      tn.x = hex.x + dx; tn.y = hex.y + dy;
      this.pCont.addChildAt(tn, 0) // turn number on hexN
    }
    // Path: [dir, hex] in proper order
    let [{ hex: hex0 }, { dir: dir0 }] = path      // Initial Hex and direction of FIRST Step
    let ep = hex0.edgePoint(dir0 as HexDir);       // dir0 is always defined
    g.ss(wl).s(cl).mt(hex0.x, hex0.y).lt(ep.x, ep.y)
    showTurnFuel(hex0, path[0].step);  // initial turn+fuel
    // all the intermediate steps of the path: coming in on pdir, out on ndir
    path.slice(1, - 1).forEach(({ dir: pdir, hex: hexN, step }, index) => {
      showTurnFuel(hexN, step)         // each step turn+fuel
      // step into & across hexN
      const ndir = path[index + 2].dir as HexDir; // exit direction is defined
      ep = hexN.edgePoint(ndir);
      if (ndir == pdir) {
        g.lt(ep.x, ep.y)        // straight across
      } else {
        g.at(hexN.x, hexN.y, ep.x, ep.y, hexN.radius/2) // arcTo
      }
    })
    const { hex: hexZ, step } = path[path.length - 1]
    showTurnFuel(hexZ, step)    // final turn+fuel
    g.lt(hexZ.x, hexZ.y)        // draw line (final step)
    g.es()
    this.pCont.addChildAt(pShape, 0) // push under the better paths (and tn Text)
    return pShape
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

  _path0: Path<Hex2> = [];
  get path0() { return this._path0; }
  set path0(path: Path<Hex2>) {
    this._path0 = path;
  }
  /**
   * clear pCont and find new paths to targetHex
   * @param targetHex
   * @param limit abandon search if metric exceeds minMetric by limit
   * @param showLim [3] max number of paths to show
   * @returns
   */
  showPaths(targetHex: Hex2, showLim = 4) {
    const player = this.ship.player;
    this.pCont.removeAllChildren()
    let paths = this.setPathToHex(targetHex)  // find paths to show
    this.pCont.parent.addChild(this.pCont);  // put *this* pathCont on top
    // if (targetHex !== this.targetHex) return // without changing display! [if target has moved]
    if (!paths[0]) return                    // no path to targetHex; !this.path0
    paths.length = Math.min(showLim, paths.length);   // show at most 2 paths
    let met0 = paths[0].metric, n = 0, k = 6;
    for (let zStep of paths) {
      let pcolor = player.pathColor(n, undefined, zStep.metric === met0 ? 20 : 30), wl = 2;
      this.drawPath(zStep, pcolor, wl, n)
      n += 1;
    }
    this.pCont.stage.update()
  }

  /** set this.path0, return all Paths to targetHex. */
  setPathToHex(targetHex: Hex2, limit?: number) {
    this.pathLog && console.log(stime(this, `.setPathToHex: from = ${this.fromHex} targetHex = ${targetHex}`), limit);
    this.targetHex = targetHex
    let paths = this.findPaths(targetHex, limit);
    if (paths.length === 0) {
      console.log(stime(this, `.setPathToHex: no path from ${this.fromHex} to ${targetHex}`))
    }
    this.path0 = paths[0]?.toPath() // path0 may be undefined
    this.pathLog && console.log(stime(this, `.setPathToHex: path0 =`), this.path0, this.hasPath0);
    return paths                    // paths may be empty, but NOT undefined
  }

  /** return true if no auto path0 for this ship. */
  get hasPath0() {
    return (!!this.path0 && this.path0.length > 0);
  }
  /**
   * Continue any planned, semi-auto moves toward this.targetHex.
   *
   * @returns true if this ship moved (or was already moved)
   */
  moveOnPath(rePath = true) {
    // TODO: continue move if available fuel
    if (!this.path0 || !this.hasPath0) return false;
    if (!this.path0[0].dir) this.path0.shift();     // skip initial non-Step
    if (rePath || this.pathHasOccupiedHex()) {
      this.ship.fromHex = this.ship.hex as MktHex2; // ship has moved since path...
      this.showPaths(this.targetHex as Hex2)  // make a new plan (unless targetHex is occupied!)
      if (!this.path0) return false   // targetHex now occupied!
      this.path0.shift();             // skip initial non-Step
    }
    return this.takeSteps(); // NOTE: may be other Steps still on Path
  }

  /** assert this.path0 is defined. */
  pathHasOccupiedHex() {
    let turn0 = this.path0[0]?.step.turn
    return this.path0.find(elt => elt.step.turn === turn0 && elt.hex.occupied);
  }

  /** Take a step, repeat after TP.stepDwell, until end of path or end of fuel.
   *
   * Recursive function: returns true if *first* step was taken.
   *
   * @return true if a step was taken, false if [next] step not possible (or no path)
   */
  takeSteps() {
    let elt = this.path0[0]
    if (!elt) return false; // illegal step
    let dir = elt.dir as EwDir, hex = this.ship.hex.nextHex(dir)
    if (hex?.occupied) {
      debugger; // find alternate path...? Already checked above by moveOnPath()
    }
    if (!this.ship.move(dir, hex)) return false;
    this.ship.movedOnTurn = this.ship.gamePlay.turnNumber;
    this.path0.shift()
    setTimeout(() => { this.takeSteps() }, TP.stepDwell) // and do other moves this turn
    return true
  }

}

class Step<T extends MktHex> {
  constructor(
    public turn: number, // incremental, relative turn?
    public hex: T,
    public dir: EwDir | undefined,
    public prevStep: Step<T> | undefined,
    public config: ZConfig,
    public cost: number,             // cost for this Step
    targetHex: T,  // crow-fly distance to target from curHex
  ) {
    this.metricb = this.metric + this.hex.radialDist(targetHex)
  }
  /** Actual cost from original Hex to this Step */
  readonly metric: number = this.cost + (this.prevStep?.metric ?? 0);
  /** best-case metric from this(curHex & config) to targetHex, assume zero config cost */
  readonly metricb: number;

  /** used as predicate for find (ignore ndx & obj) */
  isMatchingElement(s: Step<T>, ndx?: number, obj?: Step<T>[]) {
    return s.hex === this.hex &&
      s.config.zcolor === this.config.zcolor &&
      s.config.zshape === this.config.zshape &&
      s.config.zfill === this.config.zfill
  }

  /**
   * find (and possibly replace) best metric to this Step)
   * if this is better than existing open Step, replace 's' with this
   * @param s a previous step from 'open'
   * @param ndx s = obj[ndx]
   * @param obj s = obj[ndx]
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
    let rv: Path<T> = [], cs = this as Step<T> | undefined
    while (cs !== undefined) {
      rv.unshift(new PathElt<T>(cs.dir, cs.hex, cs))
      cs = cs.prevStep
    }
    return rv;
  }

  toString() {
    return this.toPath().map((pe) => `${pe.dir??'C'}->${pe.hex.Aname}$${pe.step.cost}#${pe.step.turn}`).toString()
  }
}


