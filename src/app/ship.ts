import { C, F } from "@thegraid/common-lib";
import { Container, Shape, Text } from "@thegraid/easeljs-module";
import { AF, Zcolor } from "./AfHex";
import { Hex } from "./hex";
import { Player } from "./player";
import { PlayerColor, TP } from "./table-params";

export class Ship extends Container {
  static step1 = 1
  static idCounter = 0

  static fpers = 0
  get maxLoad() { return this.maxFuel - this.z0 - Ship.step1 }
  get radius() { return this.maxFuel + 2 + this.outr }
  get color() { return this.player.color }

  readonly outr = 8;
  gShape: Shape = new Shape();
  Aname: string = `S${Ship.idCounter++}`

  /** current location of this Ship. */
  hex: Hex;

  zshape = null;
  zcolor: Zcolor = AF.zcolor[AF.G]
  zfill = AF.fill[AF.F]

  //initially: expect maxFuel = (10 + z0*5) = {15, 20, 25}
  constructor(
    public readonly player?: Player,
    public readonly z0 = 2,
    public readonly maxFuel = 20,
  ) {
    super()
    this.addChild(this.gShape)
    let textSize = 16, nameText = new Text(this.Aname, F.fontSpec(textSize))
    nameText.textAlign = 'center'
    nameText.y = -textSize/2;
    this.addChild(nameText)
    this.paint()  // TODO: makeDraggable/Dropable on hexMap
  }

  paint(pcolor = this.player?.color) {
    this.paint1(undefined, pcolor)  // TODO: define source/type of Zcolor
  }

  /** repaint with new Zcolor or TP.colorScheme */
  paint1(zcolor: Zcolor = this.zcolor, pColor: PlayerColor = 'b') {
    let pcolor = TP.colorScheme[pColor]
    let r2 = this.radius, r1 = this.maxFuel, g = this.gShape.graphics
    g.c().f(zcolor).dc(0, 0, r2);
    g.f(C.BLACK).dc(0, 0, r1 + 2)
    g.f(pcolor).dc(0, 0, r1)
    this.cache(-r2, -r2, 2 * r2, 2 * r2); // Container of Shape & Text
  }

  paint2(zcolor: Zcolor) {
    this.paint1(zcolor)
    this.gShape.graphics.c().f(C.BLACK).dc(0, 0, this.radius/2) // put a hole in it!
    this.updateCache("destination-out") // clear center of Ship!
  }
}
