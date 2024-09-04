import { C, S } from "@thegraid/easeljs-lib";
import { Container, Graphics } from "@thegraid/easeljs-module";
import { GameState as GameStateLib, NamedContainer, Phase, RectWithDisp, UtilButton } from "@thegraid/hexlib";
import { ActionIdent } from "./scenario-parser";
import { Table } from "./table";
import { TP } from "./table-params";

/** expect to make 2 of these */
class ButtonLine extends RectWithDisp {
  /**
   * make a Container with a col/row of buttons
   * @param name
   * @param actions
   * @param bf [(b)=>{}] a function to invoke on each button after it is created
   * @param fSize [TP.hexRad/2]
   * @param col [true] set false to arrange buttons as rows
   */
  constructor(name: string, actions: string[], bf: (b: UtilButton) => void, fSize = TP.hexRad / 2, col = true) {
    const cont = new NamedContainer(name);
    cont.setBounds(0, 0, 100, 100); // calcBounds() needs something to start with.
    super(cont, C.WHITE, 5, 0)
    // make a stack of UtilButton:
    this.addButtons(cont, actions, fSize, bf, col)
    cont.setBounds(undefined, 0, 0, 0)
    this.setBounds(undefined, 0, 0, 0)
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
      // Note: highlight = undefined;
      const gap = button.border * 1;
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
  activate(activate = true) {
    this.buttons.forEach(button => activate ? button.activate() : button.deactivate())
  }
}

class SelectorPanel extends NamedContainer {
  /** An array of ActionSelector */
  constructor(
    specs: { name: string, actions: string[], dir: number }[],
    bf: (b: UtilButton) => void,
    opts?: { col?: boolean, cx?: number, cy?: number }
  ) {
    super('SelectorPanel');
    const { col } = { col: true, ...opts }
    const { cx, cy } = { cx: (col ? 0 : -200), cy: 0, ...opts }
    // TODO: find maxwidth to align-left rows
    const makeSelector = (name: string, acts: string[], dir = -1) => {
      const acts2 = acts.map(n => n.replace(/-/g, '-\n'))
      const sel = new ButtonLine(name, col ? acts2 : acts, bf, undefined, col)
      const { width: w, height: h } = sel.getBounds(), gap = TP.hexRad / 10
      sel.x += cx; sel.y += cy;
      if (col) {
        sel.x += (w + gap) * dir * .5;
      } else {
        sel.y += (h + gap) * dir * .5 + h / 2;
      }
      sel.activate(false)
      return sel;
    }
    this.lines = specs.map(({name, actions, dir}) => {
      const as = makeSelector(name, actions, dir)
      return as;
    })
    this.addChild(...this.lines);
  }
  lines: ButtonLine[]
  activate(activate = true, button?: UtilButton) {
    const nth = button ? this.lines.findIndex(line=> line.contains(button)) : undefined;
    this.lines.forEach((line, n) => (!nth || n === nth) && line.activate(activate))
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
  selPanel: SelectorPanel;
  /** invoked from layoutTable2() */
  makeActionSelectors(parent: Container, row = 4, col = -4) {
    const setClick = (button: UtilButton) => {
      button.on(S.click, () => {
        this.selPanel.activate(false, button)   // deactivate(line(button))
        const act = button.label_text.replace(/\n/g, '') as ActionIdent;
        this.selectedAction = act;
        this.selectedActions.push(act)
        this.phase(act);
      })
    };
    this.selPanel = new SelectorPanel([
      { name: 'mActions', actions: this.moveActions, dir: -1 },
      { name: 'tActions', actions: this.tradeActions, dir: 1 }
    ], setClick, { col: true });
    parent.addChild(this.selPanel);
    // this.table.setToRowCol(this.twoSels, row, col);
  }
  get panel() { return this.curPlayer.panel; }

  override start(): void {
    super.start()
  }

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
        this.selPanel.activate();
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
