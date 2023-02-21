import { C, F } from "@thegraid/common-lib";
import { Container, Shape, Text } from "@thegraid/easeljs-module";
import { TP } from "./table-params";

/** production/commodity */
export class PC {
  constructor(
    public readonly max: number,
    public readonly min: number,
    public readonly lim: number,
    public readonly color: string,
    public readonly rate: number = 1,
  ) { }

  static F1 = new PC(30, 10, 20, 'yellow');
  static F2 = new PC(45, 15, 16, 'green' );
  static O1 = new PC(20, 10, 32, 'orange');
  static O2 = new PC(30, 20, 40, 'red'   );
  static L1 = new PC(50, 30,  4, 'blue'  );
  static L2 = new PC(80, 40,  4, 'purple');

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
    this.addChild(this.gShape)
    let textSize = 16, nameText = new Text(this.Aname, F.fontSpec(textSize))
    nameText.textAlign = 'center'
    nameText.y = -textSize/2;
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
