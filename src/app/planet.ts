import { C } from "@thegraid/common-lib";
import { MouseEvent, Shape } from "@thegraid/easeljs-module";
import { DragContext, EwDir, H, Hex1, MapTile, rightClickable, TP as TPLib } from "@thegraid/hexlib";
import { HexMap, MktHex, MktHex2 } from "./hex";
import { InfoText } from "./info-box";
import { TP } from "./table-params";

export type PlanetLocs = { [key in EwDir]?: MktHex2 };

export const Items = ['F1', 'F2', 'F3', 'O1', 'O2', 'O3', 'L1', 'L2', 'X1', 'X2'] as const;
export type Item = typeof Items[number];
export type PCstat = { [key in Item]?: IPC } // status of given PC on a Planet
type PCdef = { [key in Item]?: [ quant: n, rate: n]};
type PlanetPC = PCdef;
type n = number;
// 5-tuple, id -> ewDir[id]
export type PlanetElt = { id: PlanetDir, row: n, col: n, prod: PCdef, cons: PCdef };
export type PlanetDir = (typeof H.C) | EwDir;

// type PublicInterface<T> = { [K in keyof T]: T[K] };
// type IPC0 = PublicInterface<PC>
/** describe the market for a resource. */
export interface IPC {
  max: number;
  min: number;
  lim: number;
}
interface IPlanetPC {
  item: Item;
  quant: number;
  rate: number;
}

/** production/commodity; quantity changes at rate; quantity determines price. */
export class PC {
  static readonly refspec: {[key in Item]: [max: n, min: n, lim: n, color: string]} = {
    F1: [30, 10, 20, 'darkgreen'],
    F2: [30, 10, 20, 'yellow'],
    F3: [45, 15, 16, 'springgreen'],
    O1: [20, 10, 32, 'red'],
    O2: [30, 20, 40, 'GoldenRod'],
    O3: [20, 10, 32, 'orange'],
    L1: [50, 30,  4, 'blue'],       // luxury (produced in center)
    L2: [80, 40,  4, 'darkviolet'], // luxury
    X1: [80, 40,  4, 'violet'],     // exotic
    X2: [50, 30,  4, 'lightblue'],  // exotic (consumed in center)
  }
  static readonly allPCs = Object.keys(PC.refspec).map((key) => {
    const [max, min, lim, color] = PC.refspec[key];
    return new PC(key as Item, max, min, lim, color)
  });
  /** canonical reference PCs, clone to add (rate, quant) from PCdef */
  static readonly reference = PC.allPCs.reduce((pv, cv) => {
    pv[cv.item] = cv;
    return pv}, {} as {[key in Item]?: PC});

  constructor(
    /** identify the Item */
    public readonly item: Item,
    /** max price; when quant <= .25 range */
    public readonly max: number,
    /** min price; when quant >= .75 range */
    public readonly min: number,
    /** max quant in stock, quant in range [0..lim] */
    public readonly lim: number,
    /** color displayed on Planet where PC is prod/cons */
    public readonly color: string,
    /** amount in stock, determines current price */
    public quant: number = Math.floor(lim / 2),
    /** change in quant when clock ticks */
    public readonly rate: number = 1, // turns to produce or consume 1 unit (modify to do per-planet)
  ) { }

  /**
   * Calculate price ramp between [max...min] for quant in range [qlow...qhigh]
   * @param quant amount currently in stock [0..lim]
   * @return unit price assuming given quant in stock
   */
  price(quant = this.quant) {
    const qlow = this.lim * .25;  // when stock is qlow, price is max
    const qhigh = this.lim * .75; // when stock is qhigh, price is min
    const q = Math.min(Math.max(qlow, quant), qhigh) - qlow;
    const p = q * (this.max - this.min) / (qhigh - qlow) + this.min;
    return p;
  }

  /** inject 'rate' for production on Planet */
  clone(rate = this.rate, quant = this.quant) {
    return new PC(this.item, this.max, this.min, this.lim, this.color, quant, rate)
  }
}

export class Planet extends MapTile {

  gShape = new Shape();  // Rings to indicate PC of Planet
  public prodPCs: PC[]
  public consPCs: PC[]

  constructor(
    Aname: string,
    prod: PCdef,
    cons: PCdef,
  ) {
    super(Aname)
    this.gShape.name = 'planetRings';
    this.setNameText(Aname);
    this.setPCs(prod, cons);
    this.addChild(this.gShape, this.nameText)
    // placePlanet moves infoText to counterCont
    this.rightClickable()
    // this.paint()
  }

  override onRightClick(evt: MouseEvent) {
    this.showPlanetPC()
  }

  infoText = new InfoText(`Planet`, undefined, { fontSize: TP.hexRad * .3, active: true, visible: false });

  showPlanetPC (vis = !this.infoText.visible) {
    this.infoText.updateText(vis, () => {
      const src = this.prodPCs
      let infoLine = `${this.Aname}`;
      Object.entries(src).forEach(([key, value]) => {
        infoLine = `${infoLine}\n${value.item}: ${value.quant} @ ${value.price()}`;
      })
      return infoLine;
    })
    if (this.cacheID) this.setCache()
  }

  setPCs(prod: PCdef, cons: PCdef,) {
    this.prodPCs = this.pcary(prod)
    this.consPCs = this.pcary(cons)
  }

  // extract the PCs from PCdef and return clone(rate, quant)
  pcary(pcdef: PCdef) {
    const refs = PC.reference
    const items = Object.keys(pcdef) as Item[];
    return items.map(key => {
      const refPC = refs[key] as PC;
      const [quant, rate] = pcdef[key]
      return refPC.clone(rate, quant)
    })
  }

  override isLegalTarget(toHex: Hex1, ctx?: DragContext): boolean {
    return false;
  }

  override paint() {
    let r3 = TP.hexRad - 9, r2 = r3 - 2, r0 = r2 / 3, r1 = (r2 + r0) / 2
    let g = this.gShape.graphics.c(), pi2 = Math.PI * 2

    // ring with colored sector for each PC:
    let paintRing = (pca: PC[], r = 20, alt = 'lightgrey') => {
      let angle = pca.length == 0 ? pi2 : pi2 / pca.length;
      g.f(alt).dc(0, 0, r);  // fill(alt) in case pca is empty
      pca.forEach((pc, i) => {
        g.f(pc.color).mt(0, 0)
        g.a(0, 0, r, i * angle, (i + 1) * angle, false);
      })
    }
    g.f(C.BLACK).dc(0, 0, r3)
    paintRing(this.prodPCs, r2, 'darkgrey')
    paintRing(this.consPCs, r1, 'grey')
    g.f('lightgrey').dc(0, 0, r0)
    // this.cache(-r3, -r3, 2 * r3, 2 * r3); // Container of Shape & Text
  }

  consPC(item: Item) { return this.consPCs.find(pc => pc.item === item) }
  prodPC(item: Item) { return this.prodPCs.find(pc => pc.item === item) }

  /** price for Planet to buy consumable (quant) */
  buy_price(item: Item, quant: number, commit = false) {
    let cons = this.consPC(item), cost = 0;
    if (!cons) return cost // not consumed by this Planet
    // pricing each unit, incrementally:
    let n = 0, q = quant   // n = number bought so far; q = number still to buy
    while(n + cons.quant < cons.lim && q-- > 0) {
      cost += cons.price(cons.quant + n++)
    }
    if (commit) {
      cons.quant += n
    }
    return cost
  }
  /** price for Planet to sell production (quant) */
  sell_price(item: Item, quant: number, commit = false) {
    let prod = this.prodPC(item), cost = 0
    if (!prod) return cost // not for sale
    let n = 0, q = quant   // n = number sold so far; q = number still to sell
    while(n < prod.quant && q-- > 0) {
      cost += prod.price(prod.quant - n++)
    }
    if (commit) {
      prod.quant -= n
    }
    return cost;
  }

  /** item -> Planet, coins -> Ship */
  buy(item: Item, quant: number) {
    return this.buy_price(item, quant, true)
  }
  /** item -> Ship, coins -> Planet */
  sell(item: Item, quant: number) {
    return this.sell_price(item, quant, true)
  }

}

/** Helper class to manage placement of Planets on a HexMap. */
export class PlanetPlacer {
  constructor(public hexMap: HexMap) {
    // If we *really* cared, we could get hexMap: MktHex2
  }
  makePlanets() {
    // TODO: refactor to pass actual PC.clone(rate) into planet
    // TODO: planet will consume L1/L2 if consumables are 'full'
    // TODO: planet will produce X1/X1 if Lux is 'full'
    // So: provide consumables *and* Lux so can buy exotics
    // TODO: rework to use clock-action to advance prod/cons by rate.
    // TODO: option to permute order of planets around hexMap

    // at this time, nobody *produces* exotics! (X1, X2)
    // at this time, nobody *consumes* luxuries! (L1, L2)
    // TODO: include planet0 produces Ships for each Player

    const q5r1 = [5, 1] as [number, number];
    const nonExotic = Items.filter(item => !item.startsWith('X'));
    const planet0Prod: PCdef = nonExotic.map(key => {
      const v = {};
      v[key] = q5r1;
      return v as PCdef;
    }).reduce((pv, cv) => { return { ...pv, ...cv } }, {})

    const initialPCs: { [key in PlanetDir]: [p: PlanetPC, c: PlanetPC] } = {
       C: [planet0Prod, { X1: q5r1, X2: q5r1 }],
      NE: [{ F1: q5r1, F2: q5r1 }, { O1: q5r1, O3: q5r1 }],
       E: [{ O1: q5r1 }, { F3: q5r1 }],
      SE: [{ O2: q5r1 }, { F2: q5r1 }],
      SW: [{ O1: q5r1, O3: q5r1 }, { F1: q5r1 }],
       W: [{ F3: q5r1, F2: q5r1 }, { O2: q5r1 }],
      NW: [{ F3: q5r1 }, { O1: q5r1, O2: q5r1 }],
    }

    this.planetByDir.clear();
    Object.keys(initialPCs).forEach((key: PlanetDir) => {
      const [pp, pc] = initialPCs[key] as [PCdef, PCdef];
      const planet = new Planet(key, pp, pc);
      this.planetByDir.set(key, planet);
      planet.paint()
    })
  }
  /**
   * Planets are identified by the canonical EwDir of their placement.
   *
   * Initially, the planets have specific PCs,
   * and arranged so Producer and Consumer are not adjacent.
   *
   * Some extension my allow to permute Planets to other points in the rotation.
   *
   * PlanetDir --> Planet
   */
  planetByDir = new Map<PlanetDir, Planet>();

  /** from parseScenario(PlanetElt); re-place an existing planet */
  resetPlanet(pElt: PlanetElt) {
    const { id, row, col, prod, cons } = pElt; // PCp: PCstat[]
    const planet = this.placePlanet(id, this.hexMap[row][col])
    planet.setPCs(prod, cons);
    return planet;
  }

  /** place all the planets at randomHex */
  placePlanets(coff = TP.dbp, offP = TP.offP, opd = 1) {
    const cHex = this.hexMap.centerHex, TPval = TP, TPlib=TPLib;

    // offset pHex from cHex by random distance, jitter by dop=1
    const randomHex = (ds: EwDir, doff = Math.min(TP.nHexes - 1, coff + 1)) => {
      const pHex = cHex.nextHex(ds, doff); // extends on line
      const odir = H.ewDirs[Math.floor(Math.random() * H.ewDirs.length)] // offset some dir
      // do not offset directly towards center
      // assert(nHexes > dbp+1+dop)
      // return offP && (odir != H.dirRev[ds]) ? pHex.nextHex(odir, opd) : pHex;
      const off = !offP || (odir == H.dirRev[ds]) ? 0 : opd;
      return pHex.nextHex(odir, off) ?? randomHex(ds);
    }
    this.placePlanet(H.C, cHex);
    H.ewDirs.forEach ((ds, ndx) => {
      const oHex = randomHex(ds);
      if (oHex) this.placePlanet(ds, oHex)
    })
  }

  placePlanet(id: PlanetDir, hex: MktHex) {
    const planet = this.planetByDir.get(id);
    hex.rmAfHex()
    hex.planet = planet;
    if (hex instanceof MktHex2) {
      const color = (id == H.C) ? 'lightblue' : 'lightgreen';
      const ndx = [H.C, ...H.ewDirs].indexOf(id);
      hex.setHexColor(color, ndx)   // colorPlanets: district = 0,1..6
      planet.paint();
      // put infoText on foreCont so other Tiles do not cover it:
      const foreCont = hex.mapCont.counterCont, { parent, x, y, infoText } = planet;
      foreCont.addChild(infoText)
      parent.localToLocal(x, y, foreCont, infoText)
      rightClickable(infoText, (evt) => planet.onRightClick(evt))
    }
    return planet
  }
}
