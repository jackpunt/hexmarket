import { C } from "@thegraid/common-lib";
import { MouseEvent, Shape, Text } from "@thegraid/easeljs-module";
import { CGF, DragContext, EwDir, H, Hex1, MapTile, NamedContainer, rightClickable, TP as TPLib, UtilButtonOptions } from "@thegraid/hexlib";
import { HexMap, MktHex, MktHex2 } from "./hex";
import { InfoText } from "./info-text";
import { Random } from "./random";
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
  /** Market definition: [min$, max$, limQuant, color] for each resource. */
  static readonly refspec: {[key in Item]: [max: n, min: n, lim: n, color: string]} = {
    F1: [30, 10, 20, 'darkgreen'],
    F2: [30, 10, 20, 'yellow'],
    F3: [45, 15, 16, 'springgreen'],
    O1: [20, 10, 32, 'red'],
    O2: [30, 20, 40, 'GoldenRod'],
    O3: [20, 10, 32, 'orange'],
    L1: [50, 30,  4, 'lightblue'],       // luxury (produced in center)
    L2: [80, 40,  4, 'violet'], // luxury
    X1: [50, 30,  4, 'blue'],  // exotic (consumed in center)
    X2: [80, 40,  4, 'darkviolet'],     // exotic
  }
  /** canonical reference PCs, clone to add (rate, quant) from PCdef */
  static readonly reference = Object.keys(PC.refspec)
    .map((key) => {
      const [max, min, lim, color] = PC.refspec[key];
      return new PC(key as Item, max, min, lim, color)
    }) // all PC[]
    .reduce((pv, cv) => {
      pv[cv.item] = cv;
      return pv;
    }, {} as { [key in Item]?: PC });

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
  price(quant = this.quant, dd = .1) {
    const qlow = this.lim * dd;  // when stock is qlow, price is max
    const qhigh = this.lim * (1-dd); // when stock is qhigh, price is min
    const q = Math.min(Math.max(qlow, quant), qhigh) - qlow; // q: [0...(high-low)]
    const p =  this.max + q * (this.min - this.max) / (qhigh - qlow);
    return Math.round(p);
  }

  clone([quant, rate]: [number, number] = [this.quant, this.rate]) {
  /** inject 'rate' for production on Planet */
  // clone(rate = this.rate, quant = this.quant) {
    return new PC(this.item, this.max, this.min, this.lim, this.color, quant, rate)
  }
}
/** InfoText with PC[] for prod or cons. */
class PCInfo extends InfoText {
  constructor(pcary: PC[], label: Text | string, color?: string, options?: UtilButtonOptions, cgf?: CGF) {
    super(label, color, options, cgf)
    this.pcary = pcary;
  }
  pcary: PC[]
}

export class Planet extends MapTile {

  gShape = new Shape();  // Rings to indicate PC of Planet

  constructor(
    Aname: string,
    public prodDef: PCdef, // initial prod for this planet
    public consDef: PCdef, // initial prod for this planet
  ) {
    super(Aname)
    this.gShape.name = 'planetRings';
    this.setNameText(Aname);
    this.setPCs(prodDef, consDef); // initial constructor
    this.addChild(this.gShape, this.nameText)
    this.addInfoText(this.infoCont, this.prodText, this.consText)
    this.infoCont.visible = false;
    // placePlanet moves infoText to counterCont
    this.rightClickable()
    // this.paint()
  }

  override onRightClick(evt: MouseEvent) {
    this.showPlanetPC(!this.infoCont.visible) // toggle visible
  }

  public readonly prodPCs: PC[] = [];
  public readonly consPCs: PC[] = [];

  prodText = new PCInfo(this.prodPCs, `prod`, undefined, { fontSize: TP.hexRad * .3, textColor: C.GREEN, active: true, visible: false });
  consText = new PCInfo(this.consPCs, `cons`, undefined, { fontSize: TP.hexRad * .3, textColor: C.PURPLE, active: true, visible: false });
  infoCont = new NamedContainer(`${this.Aname}info`)

  addInfoText(cont = this.infoCont, ...pciary: PCInfo[]) {
    let y = 0;
    cont.addChild(...pciary);
    pciary.forEach(pci => {
      pci.visible = true;
      pci.rectShape.setBounds(undefined, 0, 0, 0)
      pci.setBounds(undefined, 0, 0, 0)
      const { y: y0, height: h } = pci.getBounds()
      pci.y = y - y0;
      y += h
    })
  }

  updateInfoText(cont = this.infoCont, vis = true) {
    if (vis) {
      const itary = cont.children as PCInfo[];
      let y = 0;
      itary.forEach((itc, ndx) => {
        const pc = itc.pcary;
        itc.label_text = Object.entries(pc)
          .map(([key, value]) => {
            const {item, min, max, lim, quant, rate} = value, sign = rate > 0 ? '+' : ''
            return `${item}: ${quant}/${lim} $${value.price()} ${sign}${rate}`
          })
          .reduce((pv, cv) => `${pv}${pv.length > 0 ? '\n' : ''}${cv}`, '')
        const { y: y0, height: h } = itc.rectShape.getBounds();
        itc.y = (y - y0);
        y += h
        return
      })
    }
    cont.visible = vis;
    cont.stage?.update()
  }

  showPlanetPC(vis = this.infoCont.visible) {
    this.updateInfoText(this.infoCont, vis);
    if (this.cacheID) this.setCache()
      this.infoCont.stage?.update()
  }

  /** set [quant, rate] for each Resource produced & consumed by this Planet. */
  setPCs(prod: PCdef, cons: PCdef,) {
    this.prodPCs.length = this.consPCs.length = 0;
    this.pcary(prod).forEach(pc => this.prodPCs.push(pc))
    this.pcary(cons).forEach(pc => this.consPCs.push(pc))
  }

  /**
   * extract the PCs from PCdef and return clone(rate, quant)
   * @param pcdef \{key: [quant, rate]} of resources for this Planet
   * @returns initial PC[] for a Planet
   */
  pcary(pcdef: PCdef) {
    const refs = PC.reference
    const items = Object.keys(pcdef) as Item[];
    return items.map(key => refs[key].clone(pcdef[key]))
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

  getPC(item: Item, pcary: PC[]) { return pcary.find(pc => pc.item === item) }

  /** price for Planet to buy consumable (quant) */
  buy_price(item: Item, quant: number, commit = false) {
    let cons = this.getPC(item, this.consPCs), cost = 0;
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
    let prod = this.getPC(item, this.prodPCs), cost = 0
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
    // TODO: option to permute order of planets around hexMap

    // TODO: design L - X protocol:
    // Non-center planets will cons L* and export X*. (L1->X1, L2->X2)
    // price/demand for L* set by system-wide quant of L on planets
    // planet will buy L* if consumables are 'full' (ie: until next tick)
    // planet will consume {1-L, 1ea-C, 1ea-P} to produce an X (when cons is 'full')
    // 1. trade(sell cons->full, sell L+)
    // 2. tick(while C is full & has L) -> L--, C*--, P*-- ==> X++ (so only 1-X per tick)
    // TODO: planet will produce X1/X1 if has a Lux & Cons is full
    // So: trade[sell consumables & Lux], tick, trade[buy X]

    // TODO: include planet0 produces Ships for each Player

    const pMidR1 = [undefined, +1] as [number, number];
    const cMidR1 = [undefined, -1] as [number, number];
    const nonExotic = Items.filter(item => !item.startsWith('X'));
    const planet0Prod: PCdef = nonExotic.map(key => {
      const v = {};
      v[key] = pMidR1;
      return v as PCdef;
    }).reduce((pv, cv) => { return { ...pv, ...cv } }, {})

    const setMid = (pcdef: PCdef) => {
      const rv = { } as PCdef;
      Object.entries(pcdef).forEach(([key, [quant, rate]]) => {
        if (quant === undefined) {
          const ref = PC.refspec[key] as [max: n, min: n, lim: n, color: string]
          const [max, min, lim] = ref
          quant = Math.floor(lim / 2)
        }
        rv[key] = [quant, rate]
      })
      return rv;
    }

    const initialPCs: { [key in PlanetDir]: [p: PlanetPC, c: PlanetPC] } = {
       C: [planet0Prod, { X1: [0, 0], X2: [0, 0] }],
      NE: [{ F1: pMidR1, F2: pMidR1 }, { O1: cMidR1, O3: cMidR1 }],
       E: [{ O1: pMidR1 }, { F3: cMidR1 }],
      SE: [{ O2: pMidR1 }, { F2: cMidR1 }],
      SW: [{ O1: pMidR1, O3: pMidR1 }, { F1: cMidR1 }],
       W: [{ F3: pMidR1, F2: pMidR1 }, { O2: cMidR1 }],
      NW: [{ F3: pMidR1 }, { O1: cMidR1, O2: cMidR1 }],
    }

    this.planetByDir.clear();
    Object.keys(initialPCs).forEach((key: PlanetDir) => {
      const [pp0, pc0] = initialPCs[key] as [PCdef, PCdef]; // [quant, rate]
      const pp = setMid(pp0), pc = setMid(pc0);
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
    planet.setPCs(prod, cons);   // restore from PlanetElt
    return planet;
  }

  /** place all the planets at randomHex */
  placePlanets(coff = TP.dbp, offP = TP.offP, opd = 1) {
    const cHex = this.hexMap.centerHex, TPval = TP, TPlib=TPLib;

    // offset pHex from cHex by random distance, jitter by dop=1
    const randomHex = (ds: EwDir, doff = Math.min(TP.nHexes - 1, coff + 1)) => {
      const pHex = cHex.nextHex(ds, doff); // extends on line
      const odir = H.ewDirs[Math.floor(Random.random() * H.ewDirs.length)] // offset some dir
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
      const foreCont = hex.mapCont.counterCont, { parent, x, y, infoCont } = planet;
      foreCont.addChild(infoCont)
      parent.localToLocal(x, y, foreCont, infoCont)
      rightClickable(infoCont, (evt) => planet.onRightClick(evt))
    }
    return planet
  }
}
