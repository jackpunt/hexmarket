import { TP as TPLib, playerColorRecord } from "@thegraid/hexlib";
import type { Cargo } from "./ship";
export { PlayerColor, PlayerColorRecord, otherColor, playerColor0, playerColor1, playerColorRecord, playerColorRecordF, playerColors } from "@thegraid/hexlib";

declare type Params = Record<string, any>;

export class TP extends TPLib {

  static override setParams(qParams?: Params, force?: boolean, target?: Params) {
    const TP0 = TP, TPlib = TPLib; // inspectable in debugger
    const rv = TPLib.setParams(qParams, force, target); // also set in local 'override' copy.
    // console.log(`TP.setParams:`, { qParams, TP0, TPlib, ghost: TP.ghost, gport: TP.gport, networkURL: TP.networkUrl });
    return rv;
  }
  static override useEwTopo = true;
  static override maxPlayers = 3;
  static override numPlayers = 2;
  static override cacheTiles = 0; // scale for cache (0 -> do not cache)

  static Black_White = playerColorRecord<'BLACK' | 'WHITE'>('BLACK', 'WHITE')
  static Blue_Red = playerColorRecord<'BLUE' | 'RED'>('BLUE', 'RED')
  static Red_Blue = playerColorRecord<'RED' | 'BLUE'>('RED', 'BLUE')
  /** ColorScheme names allowed in choice selector */
  static schemeNames = ['Red_Blue']

  static shipCounter = 0;
  /** initial Ship load for testing */
  static initialCargo = [{  }, {  }] as Cargo[];
  static initialCargo1 = [{ F1: 2, O2: 3 }, { F2: 2, O2: 2 }] as Cargo[];
  static initialCargo2 = [{ F1: 5, F2: 3, O1: 2, O2: 3 }, { F2: 5, F3: 3, O2: 2, O3: 3 }] as Cargo[];

  /** offset planets  */
  static offP = true;
  /** distance between planets */
  static dbp = 4; // nCows = nCols = 3*dbp+3
  /** distance outside planets */
  static dop = 1; // nh = dbp + 1 + dop + (offP ? 1 : 0) (length of outer edge)
  /** Order [number of rings] of metaHexes */
  static override mHexes = 1   // number hexes on side of Meta-Hex
  /** Order [number of Hexs on side] of District [# rings of Hexes in each metaHex] */
  static override nHexes = 7    // number of Hexes on side of District

  // timeout: see also 'autoEvent'
  static stepDwell:  number = 150
  /** force draw during ship.drag */
  static drawPath = true;

  static override bgColor: string = 'tan' //'wheat'// C.BROWN
  static borderColor: string = 'peru'//TP.bgColor; //'burlywood'
  static override meepleY0 = 0;

  static initialCoins = 100;
}
