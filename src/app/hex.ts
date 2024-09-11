import { Hex1 as Hex1Lib, Hex2 as Hex2Lib, Hex2Mixin, HexDir, Hex as HexLib, HexM, HexMap as HexMapLib, HexM as HexMLib } from "@thegraid/hexlib";
import { AfHex } from "./AfHex";
import { Planet } from "./planet";
import { Random } from "./random";
import { Ship } from "./ship";

/** Base Hex, has no connection to graphics.
 *
 * each Hex may contain a Planet [and?] or a Ship.
 *
 * non-Planet Hex is unexplored or contains a AfHex.
 */
export class MktHex extends Hex1Lib {
  // constructor(map: HexMapLib<HexLib>, row: number, col: number, name?: string) {
  //   super(map, row, col, name);
  // }

  // override nextHex(dir: HexDir, ns?: number) {
  //   return super.nextHex(dir, ns) as this | undefined;
  // }

  override get tile() { return super.tile as Planet; }
  override set tile(planet: Planet) { super.tile = planet; }

  override get meep() { return super.meep as Ship; }
  override set meep(ship: Ship) { super.meep = ship; }

  get planet() { return this.tile; }
  set planet(planet: Planet) { this.tile = planet; }

  get ship() { return this.meep; }
  set ship(ship: Ship) { this.meep = ship; }

  afhex: AfHex;

  addAfHex(affn = Math.floor(Random.random() * AfHex.allAfHex.length)) {
    if (this.district !== undefined) return
    const afhex2 = AfHex.allAfHex[affn].clone();
    const spin = Math.floor(Random.random() * 6);
    afhex2.spin = spin;
    afhex2.rotation = 60 * spin; // degrees, not radians
    afhex2.aColors = AfHex.rotateAf(afhex2.aColors, spin)
    afhex2.aShapes = AfHex.rotateAf(afhex2.aShapes, spin)
    afhex2.aFill = AfHex.rotateAf(afhex2.aFill, spin)
    this.afhex = afhex2;
  }
  /** remove AfHex from planet Hex */
  rmAfHex() {
    this.afhex = undefined;
  }

}

export class MktHex2Lib extends Hex2Mixin(MktHex) { }

/** One Hex cell in the game, shown as a polyStar Shape */
export class MktHex2 extends MktHex2Lib {
  isMktHex2 = true;
  /** Hex2 cell with graphics; shown as a polyStar Shape of radius @ (XY=0,0) */
  constructor(map: HexMLib<HexLib>, row: number, col: number, name?: string) {
    // MktHex2() { super(); }
    // MktHex2.super(...) == MatHex2Lib(...) -> Hex2Impl()
    // Hex2Impl() { super() == MktHex() -> Hex1(); Hex2Impl.consCode(...) }
    // Hex2Impl.consCode() == override MktHex2.consCode() { super.consCode() == Hex2Imp.consCode(); ... }
    super(map, row, col, name);
  }

  // Mixin idiom compiles type 'this' into type 'any'; so must redeclare proper signatures:
  // because: new(...args: any[]) {...} is not a class, has no instances, so no 'this' value/type.

  override forEachLinkHex(func: (hex: this | undefined, dir: HexDir | undefined, hex0: this) => unknown, inclCenter = false) {
    super.forEachLinkHex(func)
  }
  override findLinkHex(pred: (hex: this | undefined, dir: HexDir, hex0: this) => boolean) {
    return super.findLinkHex(pred)
  }
  override findInDir(dir: HexDir, pred: (hex: this, dir: HexDir, hex0: this) => boolean): this | undefined {
    return super.findInDir(dir, pred)
  }
  override hexesInDir(dir: HexDir, rv: this[] = []): this[] {
    return super.hexesInDir(dir, rv)
  }
  override forEachHexDir(func: (hex: this, dir: HexDir, hex0: this) => unknown) {
    super.forEachHexDir(func);
  }
  override nextHex(dir: HexDir, ns: number = 1): this | undefined {
    return super.nextHex(dir, ns) as this | undefined;
  }
  override lastHex(ds: HexDir): this {
    return super.lastHex(ds)
  }

  override constructorCode(map: HexMLib<Hex2Lib>, row: number, col: number, name?: string) {
    super.constructorCode(map, row, col, name);        // Hex2Impl.constructorCode()
    if (row === undefined || col === undefined) return // nextHex? recycleHex?
    this.addAfHex()           // even when (name == 'nextHex')
  }

  override addAfHex(affn = Math.floor(Random.random() * AfHex.allAfHex.length)) {
    super.addAfHex(affn)
    this.cont.addChild(this.afhex)
    this.cont.updateCache()
  }
  /** remove AfHex from planet Hex */
  override rmAfHex() {
    this.cont.removeChild(this.afhex)
    super.rmAfHex()
    this.cont.updateCache()
  }
}

export class HexMap extends HexMapLib<MktHex> implements HexM<HexLib> {

}
/** Marker class for HexMap used by GamePlayD */
export class HexMapD extends HexMap {

}
