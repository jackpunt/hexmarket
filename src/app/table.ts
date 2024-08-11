import { AT, ParamGUI, ParamItem, stime, XY } from "@thegraid/easeljs-lib";
import { Container, Stage } from "@thegraid/easeljs-module";
import { IdHex, IHex2, Scenario, Table as TableLib, HexMap as HexMapLib } from "@thegraid/hexlib";
import { GamePlay } from "./game-play";
import { Player } from "./player";
import { Ship } from "./ship";
import { PlayerColor, TP } from "./table-params";
import { HexMap } from "./hex";


/** to own file... */
class TablePlanner {
  constructor(gamePlay: GamePlay) {}
}

/** layout display components, setup callbacks to GamePlay.
 *
 * + dragShip: Ship;
 */
export class Table extends TableLib {
  override hexMap: HexMap & HexMapLib<IHex2>;

  constructor(stage: Stage) {
    super(stage);
  }
  override gamePlay: GamePlay;
  /** method invokes closure defined in enableHexInspector. */
  override toggleText(vis?: boolean) { return undefined; }

  override layoutTable(gamePlay: GamePlay): void {
      super.layoutTable(gamePlay);
  }

  override layoutTable2() {
    const k = 0;
    return;
  }

  override makeNetworkGUI(parent: Container, x = 0, y = 0): ParamGUI {
    const gui = this.netGUI = new ParamGUI(TP, this.netStyle)
    return gui;
  }

  override makeParamGUI(parent: Container, x?: number, y?: number): ParamGUI {
    // TP.setParams({});
    const TP0 = TP;
    const gui = new ParamGUI(TP, { textAlign: 'right' });
    const gamePlay = this.gamePlay.gameSetup;
    gui.makeParamSpec('hexRad', [30, 60, 90, 120], { fontColor: 'red'}); TP.hexRad;
    gui.makeParamSpec('nHexes', [2, 3, 4, 5, 6, 7, 8, 9, 10, 11], { fontColor: 'red' }); TP.nHexes;
    gui.makeParamSpec('mHexes', [1, 2, 3], { fontColor: 'red' }); TP.mHexes;
    gui.spec("hexRad").onChange = (item: ParamItem) => { gamePlay.restart({ hexRad: item.value }) }
    gui.spec("nHexes").onChange = (item: ParamItem) => { gamePlay.restart({ nh: item.value }) }
    gui.spec("mHexes").onChange = (item: ParamItem) => { gamePlay.restart({ mh: item.value }) }

    parent.addChild(gui)
    gui.x = x // (3*cw+1*ch+6*m) + max(line.width) - (max(choser.width) + 20)
    gui.y = y
    gui.makeLines();
    return gui;
  }

  dragShip: Ship; // last ship to be dragged [debug & dragAgain('.') & dragBack(',')]
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
  override moveStoneToHex(ihex: IdHex, sc: PlayerColor) {
    super.moveStoneToHex(ihex, sc); // no-op
    // let hex = Hex.ofMap(ihex, this.hexMap)
    // this.hexMap.showMark(hex)
    // this.dispatchEvent(new HexEvent(S.add, hex, sc)) // -> GamePlay.playerMoveEvent(hex, sc)
  }

  /** @return the DisplayObject [Tile] to be dragged (becomes this.dragShip) */
  get defaultDrag() {
    return this.gamePlay.curPlayer.shipToMove();
  }
  /** Toggle dragging: dragTarget(target) OR stopDragging(targetHex)
   * - attach supplied target to mouse-drag (default is eventHex.tile)
   * @param target the DisplayObject being dragged
   * @param xy offset from target to mouse pointer
   */
  toggleDrag(xy: XY = { x: TP.hexRad / 2, y: TP.hexRad / 2 }) {
    const dragging = this.dragger.dragCont.getChildAt(0);
    if (!!dragging) {
      this.stopDragging(this.hexUnderObj(dragging)) // drop and set dropTarget make move
    } else {
      this.dragger.dragTarget(this.defaultDrag, xy);
    }
  }

}
