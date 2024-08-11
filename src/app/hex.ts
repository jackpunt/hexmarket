import { MouseEvent, Shape } from "@thegraid/easeljs-module";
import { H, HexM as HexMLib, Hex1 as Hex1Lib, Hex2Mixin, Hex2 as Hex2Lib, HexDir, Hex as HexLib, HexMap as HexMapLib, MapCont as MapContLib, HexM, EwDir } from "@thegraid/hexlib";
import { AfHex } from "./AfHex";
import { Planet, PlanetLocs } from "./planet";
import { Ship } from "./ship";
import { TP } from "./table-params";

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

  override nextHex(dir: HexDir, ns?: number): MktHex | undefined {
    return super.nextHex(dir, ns) as MktHex;
  }

  override get tile() { return super.tile as Planet; }
  override set tile(planet: Planet) { super.tile = planet; }

  override set meep(ship: Ship) { super.meep = ship; }
  override get meep() { return super.meep as Ship; }

  afhex: AfHex;

  addAfHex(affn = Math.floor(Math.random() * AfHex.allAfHex.length)) {
    if (this.district !== undefined) return
    const afhex2 = AfHex.allAfHex[affn].clone();
    const spin = Math.floor(Math.random() * 6);
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

// export class MktHex2 extends MktHex2Lib {
//   planet: Planet;
// }

/** One Hex cell in the game, shown as a polyStar Shape */
export class MktHex2 extends MktHex2Lib {

  get ship() { return super.meep as Ship; }
  set ship(ship: Ship) { super.meep = ship; }

  get planet() { return super.tile as Planet; }
  set planet(planet: Planet) { super.tile = planet; }

  /** Hex2 cell with graphics; shown as a polyStar Shape of radius @ (XY=0,0) */
  constructor(map: HexMLib<HexLib>, row: number, col: number, name?: string) {
    // MktHex2() { super(); }
    // MktHex2.super(...) == MatHex2Lib(...) -> Hex2Impl()
    // Hex2Impl() { super() == MktHex() -> Hex1(); Hex2Impl.consCode(...) }
    // Hex2Impl.consCode() == override MktHex2.consCode() { super.consCode() == Hex2Imp.consCode(); ... }
    super(map, row, col, name);
  }

  override constructorCode(map: HexMLib<Hex2Lib>, row: number, col: number, name?: string) {
    super.constructorCode(map, row, col, name);        // Hex2Impl.constructorCode()
    if (row === undefined || col === undefined) return // nextHex? recycleHex?
    this.addAfHex()           // even when (name == 'nextHex')
  }

  override addAfHex(affn = Math.floor(Math.random() * AfHex.allAfHex.length)) {
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

// /** subset of HexMap, typed to HexLib (used for stats for hexline) */
// export interface HexM {
//   readonly district: HexLib[][]      // all the Hex in a given district
//   readonly mapCont: MapContLib
//   rcLinear(row: number, col: number): number
//   forEachHex<K extends MktHex>(fn: (hex: K) => void): void // stats forEachHex(incCounters(hex))
//   update(): void
//   showMark(hex: MktHex): void

// }


export class HexMap extends HexMapLib<HexLib> implements HexM<HexLib> {
  hexDirPlanets = new Map<HexDir | typeof H.C, MktHex2>();
  get planet0Hex() {
    return this.hexDirPlanets.get(H.C)
  };

  /** color center and 6 planets, dist = 1 ... 7 */ // TODO: move to Planet.ts
  placePlanets(pLocs: PlanetLocs = {}, coff = TP.dbp, offP = TP.offP) {
    Planet.remake();
    const cHex = this.centerHex as MktHex2;
    const placePlanet = (key: HexDir | typeof H.C, color: string, hex: MktHex2) => {
      this.hexDirPlanets.set(key, hex)    // find planet in the given direction
      hex.rmAfHex()
      const ndx = 1 + (H.ewDirs.indexOf(key as EwDir) ?? -1 ); // planet number
      hex.planet = Planet.planets[ndx];
      hex.planet.on('mousedown', (evt: MouseEvent) => {
        if (evt.nativeEvent.buttons === 2) hex.planet.onRightClick(evt)
      })
      hex.setHexColor(color, ndx)   // colorPlanets: district = 1..7
      hex.planet.paint();
    }
    // offset pHex from cHex by random distance, jitter by 1
    const randomHex = (ds: EwDir) => {
      const pHex = cHex.nextHex(ds, coff + 1) as MktHex2;
      const odir = H.ewDirs[Math.floor(Math.random() * H.ewDirs.length)]
      // do not offset directly towards center
      return offP && (odir != H.dirRev[ds]) ? pHex.nextHex(odir, 1) as MktHex2 : pHex;
    }
    placePlanet(H.C, 'lightblue', cHex);
    for (let ds of H.ewDirs) {
      const oHex = pLocs[ds] ?? randomHex(ds);
      placePlanet(ds, 'lightgreen', oHex)
    }
  }

}
/** Marker class for HexMap used by GamePlayD */
export class HexMapD extends HexMap {

}
