import { Params } from "@angular/router";
import { C, Constructor, CycleChoice, DropdownStyle, ParamGUI, ParamItem, S, stime } from "@thegraid/easeljs-lib";
import { Container } from "@thegraid/easeljs-module";
import { GameSetup as GameSetupLib, Meeple, Tile, MapCont } from "@thegraid/hexlib";
import { AfHex } from "./AfHex";
import { EBC, PidChoice } from "./choosers";
import { GamePlay } from "./game-play";
import { MktHex as Hex, MktHex2 as Hex2, HexMap } from "./hex";
import { Cargo } from "./planet";
import { Player } from "./player";
import { Table } from "./table";
import { TP } from "./table-params";
import { SetupElt } from "./scenario-parser";

/** show " R" for " N" */
stime.anno = (obj: string | { constructor: { name: string; }; }) => {
  let stage = obj?.['stage'] || obj?.['table']?.['stage']
  return !!stage ? (!!stage.canvas ? " C" : " R") : " -" as string
}

/** initialize & reset & startup the application. */
export class GameSetup extends GameSetupLib {
  paramGUIs: ParamGUI[]
  netGUI: ParamGUI // paramGUIs[2]
  override gamePlay: GamePlay;

  /**
   * ngAfterViewInit --> start here!
   *
   * - initialize(canvasId, qParams) -> initTP(qParams)
   * - loadImagesThenStartup(qParams)
   * @param canvasId supply undefined for 'headless' Stage
   */
  constructor(canvasId: string, qParams: Params = []) {
    super(canvasId, qParams);
  }

  /** override to inject each Player.pathCont */
  override makeHexMap(hexC: Constructor<Hex> = Hex) {
    const hexMap = new HexMap(TP.hexRad, true, hexC);
    const cNames = MapCont.cNames.concat() as string[];
    for (let ndx = 0; ndx < this.nPlayers; ndx++) {
      const p = this.makePlayer(ndx, this.gamePlay); // pushes to allPlayers
      cNames.push(p.pathCname)
    }
    HexMap.distColor[0] = 'Black';
    hexMap.addToMapCont(Hex2, cNames);       // addToMapCont(hexC, cNames)
    hexMap.makeAllDistricts();               // determines size for this.bgRect
    return hexMap;
  }
  /**
   * Make new Table/layout & gamePlay/hexMap & Players.
   * @param ext Extensions from URL
   */
  override startup(qParams: Params = this.qParams) {
    // super.startup(qParams); // hexmap, table, scenario, gamePlay
    Tile.allTiles = [];
    Meeple.allMeeples = [];
    Player.allPlayers = [];
    AfHex.makeAllAfHex()

    const n = qParams?.['n'] ? Number.parseInt(qParams['n']) : 2;
    this.nPlayers = Math.min(TP.maxPlayers, n);
    this.hexMap = this.makeHexMap();         // only reference is in GamePlay constructor!
    this.table = new Table(this.stage)       // EventDispatcher, ScaleCont, GUI-Player
    const scenario = this.initialScenario(); // could specify planet locations & cargo & seed?
    const gamePlay = new GamePlay(this, scenario);
    this.gamePlay = gamePlay
    gamePlay.hexMap[S.Aname] = `mainMap`
    this.startScenario(scenario);
    // makeNPlayers(); layoutTable(); parseScenario(); p.newGame(); makeGUIs(); table.startGame();
  }

  override makePlayer(ndx: number, gamePlay: GamePlay) {
    return new Player(ndx, gamePlay);
  }

  override parseScenario(scenario: SetupElt): void {
    (this.table.hexMap as any as HexMap).placePlanets()
  }

  residual(table: Table) {
    const gamePlay = table.gamePlay;
    const statsx = -300, statsy = 30;
    if (this.stage.canvas) {
      console.groupCollapsed('initParamGUI')
      this.paramGUIs = this.makeParamGUI(table, table.scaleCont, statsx, 30) // modify TP.params...
      let [gui, gui2] = this.paramGUIs
      // table.miniMap.mapCont.y = Math.max(gui.ymax, gui2.ymax) + gui.y + table.miniMap.wh.height / 2
      console.groupEnd()
    }
    return gamePlay
  }

  /** affects the rules of the game & board
   *
   * ParamGUI   --> board & rules [under stats panel]
   * ParamGUI2  --> AI Player     [left of ParamGUI]
   * NetworkGUI --> network       [below ParamGUI2]
   */
  makeParamGUI(table: Table, parent: Container, x: number, y: number) {
    let restart = false, infName = "inf:sac"
    const gui = new ParamGUI(TP, { textAlign: 'right'})
    const schemeAry = TP.schemeNames.map(n => { return { text: n, value: TP[n] } })
    let setSize = (dpb: number, dop: number) => { restart && this.restart.call(this, dpb, dop) }
    gui.makeParamSpec("dbp", [3, 4, 5, 6], { fontColor: "green" })
    gui.makeParamSpec("dop", [0, 1, 2, 3], { fontColor: "green" })
    gui.makeParamSpec("offP", [true, false], { fontColor: "green" })
    gui.makeParamSpec("load", [0, 5, 10, 15, 20], { fontColor: "green" })
    gui.makeParamSpec("colorScheme", schemeAry, { chooser: CycleChoice, style: { textAlign: 'center' } })

    gui.spec("dbp").onChange = (item: ParamItem) => { setSize(item.value, TP.dop) }
    gui.spec("dop").onChange = (item: ParamItem) => { setSize(TP.dbp, item.value) }
    gui.spec("offP").onChange = (item: ParamItem) => { gui.setValue(item); setSize(TP.dbp, TP.dop) }
    gui.spec('load').onChange = (item: ParamItem) => {
      gui.setValue(item)
      restart && Player.allPlayers.forEach(p => p.ships[0].cargo = [new Cargo('F1', item.value)]); // ParamItem, not (PC) Item
    }
    gui.spec("colorScheme").onChange = (item: ParamItem) => {
      gui.setValue(item)
      let hexMap = table.hexMap
      hexMap.update()
    }
    parent.addChild(gui)
    gui.x = x // (3*cw+1*ch+6*m) + max(line.width) - (max(choser.width) + 20)
    gui.y = y
    gui.makeLines()
    const gui2 = this.makeParamGUI2(table, parent, x - 320, y)
    const gui3 = this.makeNetworkGUI(table, parent, x - 320, y + gui.ymax + 200 )
    gui.parent.addChild(gui) // bring to top
    gui.stage.update()
    restart = true // *after* makeLines has stablilized selectValue
    return [gui, gui2, gui3]
  }
  /** configures the AI player */
  makeParamGUI2(table: Table, parent: Container, x: number, y: number) {
    let gui = new ParamGUI(TP, { textAlign: 'center' })
    gui.makeParamSpec("log", [-1, 0, 1, 2], { style: { textAlign: 'right' } }); TP.log
    gui.makeParamSpec("maxPlys", [1, 2, 3, 4, 5, 6, 7, 8], { fontColor: "blue" }); TP.maxPlys
    gui.makeParamSpec("maxBreadth", [5, 6, 7, 8, 9, 10], { fontColor: "blue" }); TP.maxBreadth
    // gui.makeParamSpec("nPerDist", [2, 3, 4, 5, 6, 8, 11, 15, 19], { fontColor: "blue" }); TP.nPerDist
    // gui.makeParamSpec("pWeight", [1, .99, .97, .95, .9]) ; TP.pWeight
    // gui.makeParamSpec("pWorker", [true, false], { chooser: BC }); TP.pWorker
    // gui.makeParamSpec("pPlaner", [true, false], { chooser: BC, name: "parallel" }); TP.pPlaner
    // gui.makeParamSpec("pBoards", [true, false], { chooser: BC }); TP.pBoards
    // gui.makeParamSpec("pMoves",  [true, false], { chooser: BC }); TP.pMoves
    // gui.makeParamSpec("pGCM",    [true, false], { chooser: BC }); TP.pGCM
    parent.addChild(gui)
    gui.x = x; gui.y = y
    gui.makeLines()
    gui.stage.update()
    return gui
  }
  netColor: string = "rgba(160,160,160, .8)"
  netStyle: DropdownStyle = { textAlign: 'right' };
  /** controls multiplayer network participation */
  makeNetworkGUI (table: Table, parent: Container, x: number, y: number) {
    let gui = this.netGUI = new ParamGUI(TP, this.netStyle)
    gui.makeParamSpec("Network", [" ", "new", "join", "no", "ref", "cnx"], { fontColor: "red" })
    gui.makeParamSpec("PlayerId", ["     ", 0, 1, 2, 3, "ref"], { chooser: PidChoice, fontColor: "red" })
    gui.makeParamSpec("networkGroup", [TP.networkGroup], { chooser: EBC, name: 'gid', fontColor: C.GREEN, style: { textColor: C.BLACK } }); TP.networkGroup

    gui.spec("Network").onChange = (item: ParamItem) => {
      if (['new', 'join', 'ref'].includes(item.value)) {
        let group = (gui.findLine('networkGroup').chooser as EBC).editBox.innerText
        // this.gamePlay.closeNetwork()
        // this.gamePlay.network(item.value, gui, group)
      }
      // if (item.value == "no") this.gamePlay.closeNetwork()     // provoked by ckey
    }
    (this.stage.canvas as HTMLCanvasElement).parentElement.addEventListener('paste', (ev) => {
      let text = ev.clipboardData.getData('Text')
      ;(gui.findLine('networkGroup').chooser as EBC).setValue(text)
    });
    this.showNetworkGroup()
    parent.addChild(gui)
    gui.makeLines()
    gui.x = x; gui.y = y
    parent.stage.update()
    return gui
  }
  showNetworkGroup(group_name = TP.networkGroup) {
    document.getElementById('group_name').innerText = group_name
    let line = this.netGUI.findLine("networkGroup"), chooser = line?.chooser
    chooser?.setValue(group_name, chooser.items[0], undefined)
  }
}
