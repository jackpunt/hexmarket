import { C, F } from "@thegraid/common-lib";
import { Container, Shape, Text } from "@thegraid/easeljs-module";
import { TP } from "./table-params";

/** production/commodity */
class PC {
  static F1 = { max: 30, min: 10, lim: 20, color: 'yellow' }
  static F2 = { max: 45, min: 15, lim: 16, color: 'green' }
  static O1 = { max: 20, min: 10, lim: 32, color: 'orange' }
  static O2 = { max: 30, min: 20, lim: 40, color: 'red' }
  static L1 = { max: 50, min: 30, lim:  4, color: 'blue' }
  static L2 = { max: 80, min: 40, lim:  4, color: 'purple' }
}
export class Planet extends Container {

  gShape = new Shape()
  readonly outr = 10;
  readonly radius = TP.hexRad - 2 * (this.outr + 2);

  constructor(
    public Aname: string,
    public prod,
    public cons,
  ) {
    super()
    let nameText = new Text(this.Aname, F.fontSpec(16))
    nameText.textAlign = 'center'
    nameText.y = - 8
    this.addChild(this.gShape)
    this.addChild(nameText)
    this.paint()
  }
  bgc() {
    return this.Aname = 'p0' ? C.GREEN : C.BLACK
  }
  paint() {
    let r1 = this.radius, r2 = r1 + this.outr + 2, g = this.gShape.graphics.c()
    g.f(C.BLACK).dc(0, 0, r2)
    g.f(this.prod.color).dc(0, 0, r2 - 2);
    g.f(this.cons.color).dc(0, 0, r1)
    this.cache(-r2, -r2, 2 * r2, 2 * r2); // Container of Shape & Text
  }

  static planets = [
    new Planet('p0', PC.L1, PC.L2),

    new Planet('p1', PC.F1, PC.O2),
    new Planet('p2', PC.O1, PC.F2),
    new Planet('p3', PC.O2, PC.F1),
    new Planet('p4', PC.O1, PC.F2),
    new Planet('p5', PC.F1, PC.O2),
    new Planet('p6', PC.F2, PC.O1),
  ]
}
