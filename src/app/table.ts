import { ParamGUI, ParamItem, XY } from "@thegraid/easeljs-lib";
import { Container, Stage } from "@thegraid/easeljs-module";
import { IdHex, Scenario, Table as TableLib, Tile } from "@thegraid/hexlib";
import { GamePlay } from "./game-play";
import { TP } from "./table-params";


/** to own file... */
class TablePlanner {
  constructor(gamePlay: GamePlay) {}
}

/** layout display components, setup callbacks to GamePlay.
 *
 */
export class Table extends TableLib {
  // override hexMap: HexMap & HexMapLib<IHex2>;

  constructor(stage: Stage) {
    super(stage);
  }
  override gamePlay: GamePlay;
  /** method invokes closure defined in enableHexInspector. */
  override toggleText(vis?: boolean) {
    const v = super.toggleText(vis)
    return v;
  }

  override layoutTable(gamePlay: GamePlay): void {
      super.layoutTable(gamePlay);
  }

  override layoutTable2() {
    const k = 0;
    return;
  }

  override makeParamGUI(parent: Container, x?: number, y?: number): ParamGUI {
    const gui = new ParamGUI(TP, { textAlign: 'right' });
    const gameSetup = this.gamePlay.gameSetup;
    const setStateValue = (item: ParamItem) => {
      gui.setValue(item); // set in TP-local and GUI-Chooser
      TP.setParams(TP);   // move nHexes, hexRad into TP-lib
      // compute allowable values for nHexes vs dbp:
      const name = item.fieldName, nh1 = 1 + Math.max(TP.dop, (TP.offP ? 2 : 1));
      const nh = (name === 'nHexes') ? TP.nHexes : Math.max(TP.nHexes, TP.dbp + nh1);
      const dbp = (name === 'nHexes') ? Math.min(TP.dbp, TP.nHexes - nh1) : TP.dbp;
      // make game (and GUI) with new values:
      const state = { name: item.value, nh, nHexes: nh, dbp }
      gameSetup.restart(state); gameSetup.resetState; // if(restart) NOT required!?
      return;
    }

    gui.makeParamSpec('hexRad', [30, 60, 90, 120], { fontColor: 'red' })
    gui.makeParamSpec('nHexes', [6, 7, 8, 9], { fontColor: 'red' })
    gui.spec("hexRad").onChange = setStateValue; TP.hexRad;
    gui.spec("nHexes").onChange = setStateValue; TP.nHexes;

    gui.makeParamSpec("dbp", [3, 4, 5, 6], { fontColor: "red" })
    gui.makeParamSpec("dop", [0, 1, 2, 3], { fontColor: "red" })
    gui.makeParamSpec("offP", [true, false], { fontColor: "red" })
    gui.makeParamSpec("load", [0, 5, 10, 15, 20], { fontColor: "green", name: 'F1' })

    gui.spec("dbp").onChange = setStateValue; TP.dbp;
    gui.spec("dop").onChange = setStateValue; TP.dop;
    gui.spec("offP").onChange = setStateValue; TP.offP;
    gui.spec('load').onChange = (item: ParamItem) => {
      gui.setValue(item); TP.load
      this.gamePlay.allPlayers.forEach(p => p.ships[0].cargo = {...p.ships[0].cargo, F1: item.value }); // ParamItem, not (PC) Item
    }

    parent.addChild(gui)
    gui.makeLines();
    gui.stage.update();

    return gui;
  }

  override startGame(scenario: Scenario) {
    super.startGame(scenario); // allTiles.makeDragable()
  }
  // see also: ScenarioParser.saveState()
  // override logCurPlayer(curPlayer: Player) {
  //   const tn = this.gamePlay.turnNumber
  //   const robo = curPlayer.useRobo ? AT.ansiText(['red','bold'],"robo") : "----";
  //   const info = { turn: `#${tn}`, plyr: curPlayer.name, gamePlay: this.gamePlay }
  //   console.log(stime(this, `.logCurPlayer --${robo}--`), info);
  // }

  /**
   * All manual moves feed through this (drop & redo)
   * TablePlanner.logMove(); then dispatchEvent() --> gamePlay.doPlayerMove()
   *
   * New: let Ship (Drag & Drop) do this.
   */
  override doTableMove(ihex: IdHex) {
    super.doTableMove(ihex); // no-op
  }
  /** All moves (GUI & player) feed through this: */
  override moveTileToHex(tile: Tile, ihex: IdHex) {
    super.moveTileToHex(tile, ihex); // no-op
    // let hex = Hex.ofMap(ihex, this.hexMap)
    // this.hexMap.showMark(hex)
    // this.dispatchEvent(new HexEvent(S.add, hex, sc)) // -> GamePlay.playerMoveEvent(hex, sc)
  }

  /** @return the DisplayObject [Ship] to be dragged by toggleDrag() */
  get defaultDrag() {
    return this.gamePlay.curPlayer.shipToMove();
  }
  /** invoked from keybinder.setKey, with no args. */
  override dragTarget(dragObj = this.defaultDrag, xy: XY = { x: TP.hexRad * .2, y: TP.hexRad * .2 }): void {
    super.dragTarget(dragObj, xy)
  }

  override reCacheTiles() {
    this.cacheScale = Math.max(1, this.scaleCont.scaleX); // If zoomed in, use that higher scale
    TP.cacheTiles = this.cacheScale; //
    // console.log(stime('GamePlay', `.reCacheTiles: TP.cacheTiles=`), TP.cacheTiles, this.scaleCont.scaleX);
    Tile.allTiles.forEach(tile => {
      const rad = tile.radius
      tile.setBounds(null as any as number, 0, 0, 0)
      if (tile.cacheID) {
        tile.uncache();
        const b = tile.getBounds() ?? { x: -rad, y: -rad, width: 2 * rad, height: 2 * rad };
        tile.setBounds(b.x, b.y, b.width, b.height)
      } else {
        const scale = TP.cacheTiles
        const b = tile.getBounds() ?? { x: -rad, y: -rad, width: 2 * rad, height: 2 * rad };
        tile.cache(b.x, b.y, b.width, b.height, scale);
      }
    });
    this.hexMap.update();
  }
}
