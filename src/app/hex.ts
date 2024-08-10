import { MouseEvent, Shape } from "@thegraid/easeljs-module";
import { H, Hex1 as Hex1Lib, Hex2 as Hex2Lib, HexDir, Hex as HexLib, HexM as HexMLib, HexMap as HexMapLib, MapCont as MapContLib } from "@thegraid/hexlib";
import { AfHex } from "./AfHex";
import { Planet } from "./planet";
import { Ship } from "./ship";
import { TP } from "./table-params";

/** Base Hex, has no connection to graphics.
 *
 * each Hex may contain a Planet [and?] or a Ship.
 *
 * non-Planet Hex is unexplored or contains a AfHex.
 */
export class Hex extends Hex1Lib {
  constructor(map: HexMapLib<HexLib>, row: number, col: number, name?: string) {
    super(map, row, col, name);
  }

  override nextHex(dir: HexDir, ns?: number): Hex | undefined {
    return super.nextHex(dir, ns) as Hex;
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

class MktHex2Lib extends Hex {

}

/** One Hex cell in the game, shown as a polyStar Shape */
export class Hex2 extends Hex2Lib {
  get ship() { return super.meep as Ship; }
  set ship(ship: Ship) { super.meep = ship; }

  get planet() { return super.tile as Planet; }
  set planet(planet: Planet) { super.tile = planet; }

  /** Hex2 cell with graphics; shown as a polyStar Shape of radius @ (XY=0,0) */
  constructor(map: HexMapLib<Hex>, row: number, col: number, name?: string) {
    super(map as any as HexMLib<Hex2Lib>, row, col, name); // as any as HexMLib<Hex2Lib>
    // includes this.initCont() which caches this.cont;

    this.setHexColor("grey")  // new Hex2: until setHexColor(by district)
    this.hexShape.name = this.Aname

    if (row === undefined || col === undefined) return // args not supplied: nextHex
    this.addAfHex()           // even when (name == 'nextHex')
    let { x, y, w, h } = this.xywh(this.radius)
    this.x += x
    this.y += y
    this.cont.setBounds(-w/2, -h/2, w, h)
  }
  asuper: Hex;
   addAfHex(affn = Math.floor(Math.random() * AfHex.allAfHex.length)) {
    this.asuper.addAfHex(affn)
    this.cont.addChild(this.asuper.afhex)
    this.cont.updateCache()
  }
  /** remove AfHex from planet Hex */
   rmAfHex() {
    this.cont.removeChild(this.asuper.afhex)
    this.asuper.rmAfHex()
    this.cont.updateCache()
  }
}
const mktHex2Lib = new MktHex2Lib(undefined, 0, 0, 'mktHex2Lib-0-0');
const mktHex2 = new Hex2(undefined, 0, 0, 'mktHex2-0-0');
console.log( {mktHex2Lib, mktHex2});

/** the colored Shape that fills a Hex. */
export class HexShape extends Shape {
  constructor(
    readonly radius = TP.hexRad,
    readonly tiltDir: HexDir = 'NE',
  ) {
    super()
  }

  paint(color: string) {
    let tilt = H.dirRot[this.tiltDir];
    //this.graphics.s(TP.borderColor).dp(0, 0, rad+1, 6, 0, tilt)  // s = beginStroke(color) dp:drawPolyStar
    this.graphics.f(color).dp(0, 0, this.radius - 1, 6, 0, tilt)             // f = beginFill(color)
  }
}

/** subset of HexMap, typed to HexLib (used for stats for hexline) */
export interface HexM {
  readonly district: HexLib[][]      // all the Hex in a given district
  readonly mapCont: MapContLib
  rcLinear(row: number, col: number): number
  forEachHex<K extends Hex>(fn: (hex: K) => void): void // stats forEachHex(incCounters(hex))
  update(): void
  showMark(hex: Hex): void

}


export class HexMap extends HexMapLib<HexLib> implements HexM {
  hexDirPlanets = new Map<HexDir | typeof H.C, Hex2>();
  get planet0Hex() {
    return this.hexDirPlanets.get(H.C)
  };

  /** color center and 6 planets, dist = 1 ... 7 */  // TODO: random location (1-step)
  placePlanets(coff = TP.dbp) {
    Planet.remake();
    let cHex = this.centerHex as Hex2;
    let district = 0;               // planet number...
    let placePlanet = (key: HexDir | typeof H.C, color: string, hex: Hex2) => {
      this.hexDirPlanets.set(key, hex)    // find planet in the given direction
      hex.rmAfHex()
      hex.planet = Planet.planets[district++]
      hex.planet.on('mousedown', (evt: MouseEvent) => {
        if (evt.nativeEvent.buttons === 2) hex.planet.onRightClick(evt)
      })
      hex.setHexColor(color, district)   // colorPlanets: district = 1..7
      hex.planet.paint();
    }
    placePlanet(H.C, 'lightblue', cHex)
    for (let ds of H.ewDirs) {
      let pHex = cHex.nextHex(ds, coff + 1) as Hex2;
      // offset pHex in random direction (or not)
      let odir = H.ewDirs[Math.floor(Math.random() * H.ewDirs.length)]
      let oHex = TP.offP && (odir != H.dirRev[ds]) ? pHex.nextHex(odir, 1) as Hex2 : pHex;
      placePlanet(ds, 'lightgreen', oHex)
    }
  }

}
/** Marker class for HexMap used by GamePlayD */
export class HexMapD extends HexMap {

}
