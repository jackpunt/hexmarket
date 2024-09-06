import { C, CenterText, S } from "@thegraid/easeljs-lib";
import { Container } from "@thegraid/easeljs-module";
import { GameState as GameStateLib, NamedContainer, Phase, RectWithDisp, UtilButton } from "@thegraid/hexlib";
import type { GamePlay } from "./game-play";
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
    const color = C.lightgrey, colort = 'rgba(0,0,0,0)';
    super(new NamedContainer(name), color, 5, 0)
    // make a stack of UtilButton:
    this.addButtons(this.disp as Container, actions, fSize, bf, col)
    this.paint(undefined, true)
  }
  buttons: UtilButton[] = []
  /** add a stack of UtilButtons to the given Container */
  addButtons(cont: Container, actions: string[], fSize: number, bf: (b: UtilButton) => void, col = true) {
    this.buttons.length = 0;
    const rb = .3, gap = fSize * rb; // UtilButton._border = .3, gap between buttons
    let x = 0, y = 0, maxw = 0, maxh = 0;
    actions.forEach(actn => {
      // fSize =~= measuredLineHeight; rb = .3
      // fb = rb * fSize, tb = rb * tSize
      // H = (2 * tSize + 2 * tb) == (fSize + 2 * fb);
      // 2 * tSize = fSize + 2 * (rb * fSize) - 2 * (rb * tSize);
      // 2 * tSize = fSize + 2 * rb * fSize - 2 * rb * tSize
      // tSize * 2 * (1 + rb) = fSize * (1 + 2 * rb)
      // tSize = fSize * (1+2*rb)/(2+2*rb) = fSize * (.5 + rb)/(1 + rb)
      const tSize = actn.includes('\n') ? fSize * (rb + .5) / (rb + 1) : fSize;
      const text = new CenterText(actn, tSize); text.textBaseline = 'top';
      text.y = rb * tSize;     // offset - THEN put in UtilButton; rect.y == 0
      const button = new UtilButton(text, 'grey', { fontSize: tSize, border: rb, visible: true });
      // Note: highlight = undefined;
      this.buttons.push(button);

      const rect = button.rectShape._rect
      maxw = Math.max(maxw, rect.w)
      maxh = Math.max(maxh, rect.h)
      button.x = x, button.y = y
      if (col) {
        y += rect.h + gap;
      } else {
        x += rect.w + gap;
        button.x += rect.w / 2; // align center->left
      }
      cont.addChild(button)
      bf(button);
    })
    // make all buttons the same size:
    this.buttons.forEach(b => {
      b.rectShape.setRectRad({ x: -maxw / 2, y: 0, w: maxw, h: maxh })
      b.rectShape.setBounds(undefined, 0, 0, 0)
      b.rectShape.paint(undefined, true)
    })
    this.setBounds(undefined, 0, 0, 0)
  }
  activate(activate = true) {
    this.buttons.forEach(button => button.activate(activate, true))
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
    const aline = button ? this.lines.find(line=> line.contains(button)) : undefined;
    this.lines.forEach(line => (!aline || (line === aline)) && line.activate(activate))
  }
}

export class GameState extends GameStateLib {
  declare gamePlay: GamePlay;
  constructor(gamePlay: GamePlay) {
    super(gamePlay)
    this.defineStates(this.states, false);
  }
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
  makeActionSelectors(parent: Container, col = true) {
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
    ], setClick, { col });
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
        // enable and highlight buttons on ActionSelectors
        this.selPanel.activate(true); // BeginTurn
        this.table.doneButton.activate()
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
    Clock: {
      start: () => {
        this.gamePlay.advanceClock()
        this.done();
      },
    },
    Move: {
      start: () => {
        this.done();
      },
    },
    Trade: {
      start: () => {
        this.done();
      },
    },
    Attack: {
      start: () => {
        this.done();
      },
    },
    'Move-Attack': {
      start: () => {
        this.done();
      },
    },
    EndAction: {
      nextPhase: 'ChooseAction',
      start: () => {
        const nextPhase = this.state.nextPhase = (this.actionsDone >= 2) ? 'EndTurn' : 'ChooseAction';
        this.phase(nextPhase);     // directly -> nextPhase
      },
      done: () => {
        this.phase(this.state.nextPhase ?? 'Start'); // TS want defined...
      }
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
