import { C, F, stime } from "@thegraid/common-lib";
import { Container, MouseEvent, Shape, Text } from "@thegraid/easeljs-module";
import { TP } from "./table-params";

const Items = ['F0', 'F1', 'F2', 'O1', 'O2', 'O3', 'L1', 'L2', 'X1', 'X2'] as const;
type Item = typeof Items[number];

/** production/commodity; in quantity-determied price, changes at rate. */
export class PC {
  constructor(
    public readonly max: number,  // price when quant < .25 range
    public readonly min: number,  // price when quant > .75 range
    public readonly lim: number,  // max quant in store
    public readonly item: Item,   // identify the type of item
    public readonly color: string,
    public readonly quant: number = lim/2,
    public readonly rate: number = 1, // turns to produce or consume 1 unit (no: do this per-planet!)
  ) { }

  price(quant = this.quant) {
    let qlow = this.lim * .25;
    let qhigh = this.lim * .75;
    return quant <= qlow ? this.max : quant >= qhigh ? this.min :
      this.min + (qhigh - quant)/(this.lim * .5) * (this.max - this.min)
  }

  /** canonical reference PCs, clone and modify... */
  static readonly reference = [
    new PC(30, 10, 20, 'F0', 'darkgreen'),
    new PC(30, 10, 20, 'F1', 'yellow'),
    new PC(45, 15, 16, 'F2', 'green'),
    new PC(20, 10, 32, 'O1', 'orange'),
    new PC(30, 20, 40, 'O2', 'gold'),
    new PC(20, 10, 32, 'O3', 'red'),
    new PC(50, 30,  4, 'L1', 'blue'),   // luxury (produced in center)
    new PC(80, 40,  4, 'L2', 'darkviolet'), // luxury
    new PC(80, 40,  4, 'X1', 'violet'), // exotic
    new PC(50, 30,  4, 'X2', 'lightblue'),   // exotic (consumed in center)
  ]
  // ASSERT: reference[i].name == PCs[i]
  static I(index: number) { return PC.reference[index].clone(); }
  static N(item: Item) { return PC.I(Items.indexOf(item)) }

  clone(rate = this.rate) {
    return new PC(this.max, this.min, this.lim, this.item, this.color, this.quant, rate)
  }

}

export class Cargo {
  constructor(
    public item: Item,
    public quant: number,
  ) {}

}

export class Planet extends Container {

  gShape = new Shape()

  public prod: PC[]
  public cons: PC[]
  pcary(s: Item | Item[]) {
    return ((typeof s == 'string') ? [s] : s).map(str => PC.N(str))

  }
  constructor(
    public Aname: string,
    prod: Item | Item[],
    cons: Item | Item[],
  ) {
    super()
    this.prod = this.pcary(prod)
    this.cons = this.pcary(cons)

    this.addChild(this.gShape)
    let textSize = 16, nameText = new Text(this.Aname, F.fontSpec(textSize))
    nameText.textAlign = 'center'
    nameText.y = -textSize/2;
    this.addChild(nameText)
    this.paint()
  }

  paint() {
    let r3 = TP.hexRad - 9, r2 = r3 - 2, r0 = r2 / 3, r1 = (r2 + r0) / 2
    let g = this.gShape.graphics.c(), pi2 = Math.PI * 2

    let paintRing = (pca: PC[], r = 20, alt = 'lightgrey') => {
      let angle = pca.length == 0 ? pi2 : pi2 / pca.length;
      g.f(alt).dc(0, 0, r);  // fill(alt) in case pca is empty
      pca.forEach((pc, i) => {
        g.f(pc.color).mt(0, 0)
        g.a(0, 0, r, i * angle, (i + 1) * angle, false);
      })
    }
    g.f(C.BLACK).dc(0, 0, r3)
    paintRing(this.prod, r2, 'darkgrey')
    paintRing(this.cons, r1, 'grey')
    g.f('lightgrey').dc(0, 0, r0)
    this.cache(-r3, -r3, 2 * r3, 2 * r3); // Container of Shape & Text
  }

  buy_price(item: Item) {
    return this.cons.find(pc => pc.item === item)?.price() // undefined if in market
  }
  sell_price(item: Item) {
    return this.prod.find(pc => pc.item === item)?.price() // undefined if in market
  }
  buy(item: Item) {
    let price = this.buy_price(item)
    if (!price) return  // not for sale

  }

  onRightClick(evt: MouseEvent) {
    console.log(stime(this, `.rightclick:`), this.Aname, evt)

  }
  static planets: Planet[]
  static remake() {
    Planet.planets = [
      new Planet('p0', Items.filter(item => !item.startsWith('X')), ['X1', 'X2']),
      new Planet('p1', ['F1', 'F0'], ['O1','O2', 'O3']),
      new Planet('p2', 'O1', 'F2'),
      new Planet('p3', 'O2', 'F1'),
      new Planet('p4', 'O1', 'F2'),
      new Planet('p5', ['F1', 'F2'], 'O2'),
      new Planet('p6', 'F2', ['O1', 'O2']),
    ]
  }
}
