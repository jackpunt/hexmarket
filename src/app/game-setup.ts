import { Params } from "@angular/router";
import { Random, stime } from "@thegraid/common-lib";
import { ParamGUI } from "@thegraid/easeljs-lib";
import { GameSetup as GameSetupLib, MapCont, Scenario } from "@thegraid/hexlib";
import { AfHex } from "./AfHex";
import { GamePlay } from "./game-play";
import { MktHex2 as Hex2, HexMap } from "./hex";
import { Player } from "./player";
import { ScenarioParser } from "./scenario-parser";
import { Table } from "./table";
import { TP } from "./table-params";

/** show " R" for " N" */
stime.anno = (obj: string | { constructor: { name: string; }; }) => {
  const objs = (obj as Record<'stage' | 'table', any>)
  const stage = objs?.['stage'] ?? objs?.['table']?.['stage']
  return !!stage ? (!!stage.canvas ? " C" : " R") : " -" as string
}

/** initialize & reset & startup the application. */
export class GameSetup extends GameSetupLib {
  static random_seed = '';
  get seed() { return GameSetup.random_seed; }

  override get pageLabel() {
    const { rand } = this.qParams;
    const nfile = super.pageLabel;
    return rand ? `${nfile} rand=${rand}` : nfile;
  }

  paramGUIs!: ParamGUI[]
  netGUI!: ParamGUI // paramGUIs[2]
  declare gamePlay: GamePlay;

  override initialize(canvasId: string, qParams: Params = this.qParams): void {
    window.addEventListener('contextmenu', (evt: MouseEvent) => evt.preventDefault())
    // useEwTopo, size 7.
    const { title, host, port, file, nH, rand } = qParams;
    const rseed = `${Math.random()}`.slice(2);
    const seed = `${GameSetup.random_seed = rand ?? rseed}`;
    console.log(stime(this, `.initialize: rand=${seed}&`))
    Random.random = Random.mulberry32(seed);
    TP.shipCounter = 0;
    TP.useEwTopo = true;
    TP.nHexes = nH ?? TP.nHexes; // [5,6,7,8]
    const tp = TP; {
      tp.ghost = host ?? tp.ghost
      tp.gport = (port !== undefined) ? Number.parseInt(port) : tp.gport;
      tp.networkGroup = `${title}:game1`;
      tp.setParams(tp);   // set host,port in TPLib so TP.buildURL can find them
      tp.networkUrl = tp.buildURL(undefined);
    }
    const rfn = document.getElementById('readFileName') as HTMLInputElement;
    rfn.value = file ?? 'setup@0';

    super.initialize(canvasId);
    return;
  }

  /** override to inject each Player.pathCont */
  override makeHexMap() {
    HexMap.distColor[0] = 'Black';
    const cNames = MapCont.cNames.concat() as string[];
    // add Container/field name for each Player's path lines:
    for (let ndx = 0; ndx < this.nPlayers; ndx++) {
      cNames.push(Player.pathCName(ndx))
    }
    return super.makeHexMap(HexMap, Hex2, cNames);
  }

  override makeTable(): Table {
    return new Table(this.stage);
  }
  /**
   * Make new Table/layout & gamePlay/hexMap & Players.
   * @param ext Extensions from URL
   */
  override startup(qParams: Params = this.qParams) {
    AfHex.makeAllAfHex();
    super.startup(qParams);
    return;
  }
  override makeGamePlay(scenario: Scenario): GamePlay {
    return new GamePlay(this, scenario);
  }

  override makePlayer(ndx: number, gamePlay: GamePlay) {
    return new Player(ndx, gamePlay);
  }

  override initialScenario(qParams?: { [x: string]: any; }): Scenario {
    // lookup Scenario from qParams.name, or whatever...
    const gameState = { ships: 1 }; // some non-null gameState
    const initialScenario = { turn: 0, Aname: 'defaultScenario', gameState }
    return initialScenario;
  }

  override makeScenarioParser(hexMap: HexMap, gamePlay =this.gamePlay): ScenarioParser {
    return new ScenarioParser(hexMap, gamePlay);
  }
  // override parseScenario(scenario: SetupElt): void {
  //   (this.table.hexMap as any as HexMap).placePlanets()
  // }
  /**
   * Invoked from super.restart(stateInfo)
   * @param stateInfo { dbp, dop, offP } & { nh, hexRad }
   */
  override resetState(stateInfo: Record<string, any>): void {
    const tpvals = { dbp: TP.dbp, dop: TP.dop, offP: TP.offP };
    const { dbp, dop, offP } = { ...tpvals, ...stateInfo } as
      { dbp: number, dop: number, offP: boolean, nHexes: number };
    TP.setParams({ dbp, dop, offP }, false, TP); // set these in TP, TPLib
    delete stateInfo['mh'];      // prevent changing mHexes
    super.resetState(stateInfo); // resetState({nh, mh, hexRad}) -> TP.nHexes, TP.hexRad
  }
}
