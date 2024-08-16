import {TP as TPLib} from "@thegraid/hexlib"

export const playerColors = ['b', 'w'] as const // Player Colors!
export const playerColorsC = ['b', 'w', 'c'] as const // Player Colors + Criminal!
export const playerColor0 = playerColors[0]
export const playerColor1 = playerColors[1]
export const playerColor2 = playerColorsC[2]
//type playerColorTuple = typeof playerColors
export type PlayerColor = typeof playerColorsC[number];
export function otherColor(color: PlayerColor): PlayerColor { return color === playerColor0 ? playerColor1 : playerColor0 }

export type PlayerColorRecord<T> = Record<PlayerColor, T>
export function playerColorRecord<T>(b: T, w: T, c?: T): PlayerColorRecord<T> { return { b, w, c: c ?? playerColor2 as any as T } };
export function playerColorRecordF<T>(f: (sc: PlayerColor) => T) { return playerColorRecord(f(playerColor0), f(playerColor1), f(playerColor2)) }

// export function buildURL(scheme = 'wss', host = TP.ghost, domain = TP.gdomain, port = TP.gport, path = ''): string {
//   // const TP0 = TP, ng = TP.networkGroup;
//   return `${scheme}://${host}.${domain}:${port}${path}`
// }
declare type Params = Record<string, any>;

export class TP extends TPLib {

  static override setParams(qParams?: { [x: string]: any; }, add?: boolean): void {
    const TP0 = TP, TPlib = TPLib; // inspectable in debugger
    TPLib.setParams(qParams);
    TPLib.setParams(qParams, false, TP); // also set in local 'override' copy.
    console.log(`TP.setParams:`, { qParams, TP0, TPlib, ghost: TP.ghost, gport: TP.gport, networkURL: TP.networkUrl });
    return;
  }
  static override useEwTopo = true;
  static override maxPlayers = 2;
  // Planner params elided...

  static Black_White = playerColorRecord<'BLACK' | 'WHITE'>('BLACK', 'WHITE')
  static Blue_Red = playerColorRecord<'BLUE' | 'RED'>('BLUE', 'RED')
  static Red_Blue = playerColorRecord<'RED' | 'BLUE'>('RED', 'BLUE')
  /** ColorScheme names allowed in choice selector */
  static schemeNames = ['Red_Blue']
  // static override colorScheme = TP.Blue_Red as PlayerColorRecord<string> // as AfColor !?
  // static override colorScheme = playerColorRecordF(n => n);
  static kkk = TP.colorScheme;

  static override numPlayers = 2;
  static load = 5;  // initial Ship load for manual testing
  /** offset planets  */
  static offP = true;
  /** distance between planets */
  static dbp = 4; // nCows = nCols = 3*dbp+3
  /** distance outside planets */
  static dop = 1; // nh = dbp + 1 + dop (length of outer edge)
  /** Order [number of rings] of metaHexes */
  static override mHexes = 1   // number hexes on side of Meta-Hex
  /** Order [number of Hexs on side] of District [# rings of Hexes in each metaHex] */
  static override nHexes = 7    // number of Hexes on side of District
  static nDistricts = 1
  static nVictory = 3  // number of Colony to win

  // timeout: see also 'autoEvent'
  static stepDwell:  number = 150

  static override bgColor: string = 'tan' //'wheat'// C.BROWN
  static borderColor: string = 'peru'//TP.bgColor; //'burlywood'

  static override ghost: string = 'cgserver'   // game-setup.network()
  static override gdomain: string = 'thegraid.com'
  static override gport: number = 8447
  static override networkUrl = TP.buildURL();  // URL to cgserver (wspbserver)
  static override networkGroup: string = "hexmarket";
}
