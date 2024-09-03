import { C, S, XYWH } from "@thegraid/easeljs-lib";
import { Container, Graphics } from "@thegraid/easeljs-module";
import { GameState as GameStateLib, NamedContainer, Phase, RectShape, RectWithDisp, UtilButton } from "@thegraid/hexlib";
import { ActionIdent } from "./scenario-parser";
import { Table } from "./table";
import { TP } from "./table-params";

/** expect to make 2 of these */
class ActionSelector extends RectWithDisp {
// class ActionSelector extends Container {
  bgRect({ x, y, w, h }: XYWH, b = 5) {
    return { x: x - b, y: y - b, w: w + 2 * b, h: h + 2 * b }
  }

  /**
   * make a Container with a stack of buttons
   * @param name
   * @param actions
   * @param bf [(b)=>{}] a function to invoke on each button after it is created
   * @param fSize [TP.hexRad/2]
   */
  constructor(name: string, actions: string[], bf: (b: UtilButton) => {}, fSize = TP.hexRad / 2, col = true) {
    const cont = new NamedContainer(name);
    cont.setBounds(-300, -300, 100, 100); // calcBounds() needs something to start with.
    super(cont, C.WHITE, 5, 0)
    // make a stack of UtilButton:
    this.addButtons(cont, actions, fSize, bf, col)
    cont.setBounds(undefined, 0, 0, 0)
    this.setBounds(undefined, 0, 0, 0)
    console.log(`ActionSelector: cont.bounds=`, cont.getBounds(), `this.bounds=`, this.getBounds())
    this.rectShape._g0 = new Graphics().ss(4);
    this.paint(C.WHITE, true)
  }
  buttons: UtilButton[] = []
  /** add a stack of UtilButtons to the given Container */
  addButtons(cont: Container, actions: string[], fSize: number, bf: (b: UtilButton) => void, col = true) {
    this.buttons.length = 0;
    let x = 0, y = 0;
    actions.forEach(actn => {
      const button = new UtilButton(actn, 'grey', fSize);
      const gap = TP.hexRad * button.border / 2;
      // Note: highlight = undefined;
      this.buttons.push(button);
      const rect = button.rectShape._rect
      button.x = x, button.y = y
      if (col) {
        y += rect.h + gap;
      } else {
        x += rect.w + gap;
        button.x += rect.w / 2
      }
      cont.addChild(button)
      bf(button);
    })
  }
  activate() {
    this.buttons.forEach(button => button.activate())
  }
}
export class GameState extends GameStateLib {
  override get table(): Table {
    return super.table as Table;
  }

  override parseState(gameState: any[]): void {
    return;
  }

  selectedAction: ActionIdent; // set when click on action panel or whatever. read by ActionPhase;
  readonly selectedActions: ActionIdent[] = [];
  get actionsDone() { return this.selectedActions.length};
  moveActions =['Clock', 'Move', 'Move-Attack']
  tradeActions = ['Clock', 'Trade', 'Attack']
  as1: ActionSelector;
  as2: ActionSelector;
  makeActionSelectors(parent: Container) {
    const col = false;
    const setClick = (button: UtilButton) =>
      button.on(S.click, () => {
        button.deactivate()   // TODO
        const act = button.label_text.replace('/\n/g', '-') as ActionIdent;
        this.selectedAction = act;
        this.selectedActions.push(act)
        this.phase(act);
      });
    const makeSelector = (name: string, acts: string[], dir = -1, dx = col ? 50 : -150, dy = 250) => {
      const sel = new ActionSelector(name, acts, setClick, undefined, col)
      const { width: w, height: h } = sel.getBounds(), gap = TP.hexRad / 10
      if (col) {
        sel.x += (dx + (w + gap) * .5 * dir);
        sel.y += dy;
      } else {
        sel.x += dx // - w / 2
        sel.y += (dy + h / 2 + (h + gap) * .5 * dir);
      }
      return sel;
    }
    this.as1 = makeSelector('mActions', this.moveActions, -1)
    this.as2 = makeSelector('tActions', this.tradeActions, 1)
    // this.table.dragger.makeDragable(as1)
    // this.table.dragger.makeDragable(as2)
    parent.addChild(this.as1, this.as2);
  }
  get panel() { return this.curPlayer.panel; }


  override readonly states: { [index: string]: Phase } = {
    BeginTurn: {
      start: () => {
        this.selectedAction = undefined;
        this.selectedActions.length = 0;
        this.saveGame();
        this.phase('ChooseAction');
      },
      done: () => {
        this.phase('ChooseAction');
      }
    },
    // ChooseAction:
    // if (2 action done) phase(EndTurn)
    // else { place AnkhMarker, phase(actionName) }
    ChooseAction: {
      start: () => {
        const maxActs = 2;
        if (this.actionsDone >= maxActs) this.phase('EndTurn');
        // enable and highlight buttons on ActionSelectors
        this.as1.activate()
        this.as2.activate()
        const active = true;
        if (!active) {
          this.phase('EndTurn');  // assert: selectedActions[0] === 'Ankh'
        } else {
          const n = this.selectedActions.length + 1;
          this.selectedAction = undefined;
          this.doneButton(`Choice ${n} Done`); // ???
         }
      },
      done: (ok?: boolean) => {
        const action = this.selectedAction; // set by dropFunc() --> state.done()
        if (!ok && !action) {
          this.panel.areYouSure('You have an unused action.', () => {
            setTimeout(() => this.state.done(true), 50);
          }, () => {
            setTimeout(() => this.state.start(), 50);
          });
          return;
        }
        this.selectedActions.unshift(action); // may unshift(undefined)
        this.phase(action ?? 'EndTurn');
      }
    },
    Action1: {
      start: () => {
        console.log('Action1')
      },
    },
    Action2: {
      start: () => {
        console.log('Action2')
      },
    },
    Clock: {
      start: () => {

      },
    },
    Move: {
      start: () => {

      },
    },
    Trade: {
      start: () => {

      },
    },
    Attack: {
      start: () => {

      },
    },
    'Move-Attack': {
      start: () => {

      },
    },
    EndTurn: {
      start: () => {
        this.selectedAction = undefined;
        this.selectedActions.length = 0;
        this.gamePlay.endTurn();
        this.phase('BeginTurn');
      },
    },
  }
}
