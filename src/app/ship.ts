import { C } from "@thegraid/common-lib";
import { Container, Shape } from "@thegraid/easeljs-module";
import { Player } from "./player";

export class Ship extends Container {
  static step1 = 1

  static fpers = 0
  get maxLoad() { return this.maxFuel - this.z0 - Ship.step1}
  readonly outr = 8;

  //initially: expect maxFuel = (10 + z0*5) = {15, 20, 25}
  constructor(public readonly player: Player, public readonly z0 = 2, public readonly maxFuel = 20) {
    super()
    this.makeShape()  // TODO: makeDraggable/Dropable on hexMap
  }

  makeShape(color1 = C.BLUE, r1 = this.maxFuel) {
    let shape = new Shape(), g = shape.graphics, r2 = r1 + this.outr + 2
    g.beginFill(color1).drawCircle(0, 0, r2)
    g.beginFill(C.BLACK).drawCircle(0, 0, r1 + 2)
    g.beginFill(this.player.color).drawCircle(0, 0, r1)
    this.addChild(shape)
    this.cache(-r2, -r2, 2 * r2, 2 * r2)
  }
}
