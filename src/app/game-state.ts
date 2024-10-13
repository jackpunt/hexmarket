import { C, S, stime } from "@thegraid/common-lib";
import { CenterText, NamedContainer, RectWithDisp, UtilButton } from "@thegraid/easeljs-lib";
import { Container } from "@thegraid/easeljs-module";
import { GameState as GameStateLib, Phase } from "@thegraid/hexlib";
import type { GamePlay } from "./game-play";
import { Player } from "./player";
import { Table } from "./table";
import { TP } from "./table-params";

export type ActionIdent = 'Move' | 'Move-Attack' | 'Clock' | 'Trade' | 'Attack';

class ActionButton extends UtilButton {
  get actionIdent() { return this.label_text?.replace(/\n/g, '') as ActionIdent }
}
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
  constructor(name: string, actions: string[], bf: (b: ActionButton) => void, fSize = TP.hexRad / 2, col = true) {
    const bgColor = C.lightgrey;
    super(new NamedContainer(name), { bgColor: '', border: 5 })
    // make a stack of UtilButton:
    this.addButtons(this.disp as Container, actions, fSize, bf, col)
    this.paint(undefined, true)
  }
  buttons: ActionButton[] = []
  /** add a stack of UtilButtons to the given Container */
  addButtons(cont: Container, actions: string[], fSize: number, bf: (b: ActionButton) => void, col = true) {
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
      const opts = {
        fontSize: tSize, border: rb, visible: true,
        rollover: (mi: boolean) => {
          button.paint(mi ? 'pink' : 'grey')
          button.stage?.update();
        }
      }
      const button = new ActionButton(text, { bgColor: 'grey', ...opts });
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
    this.buttons.forEach(button => {
      activate && button.paint('grey')
      button.activate(activate, true)
    })
  }
}

class SelectorPanel extends NamedContainer {
  /** An array of ActionSelector */
  constructor(
    specs: { name: string, actions: string[], dir: number }[],
    bf: (b: ActionButton) => void,
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
  /**
   * ActionButton and the ButtonLine that contains it
   * @param act names the ActionButton
   * @returns [undefined, undefined] if act is not legitimate
   */
  actionButtonLine(act?: ActionIdent) {
    let actButton!: ActionButton;
    const line = this.lines
      .find(line => line.buttons
        .find(button => (button.actionIdent === act)
          && (button.isActive)
          && (actButton = button, true)));
    return [actButton, line] as [ActionButton, ButtonLine];
  }
  activate(activate = true, act?: ActionIdent) {
    // activate/deactivate particular ButtonLine
    const [abut, aline] = this.actionButtonLine(act);
    !activate && abut && abut.paint('deeppink');
    this.lines.forEach(line => (!aline || (line === aline)) && line.activate(activate))
  }
}

export class GameState extends GameStateLib {
  declare gamePlay: GamePlay;
  override get curPlayer(): Player {
    return super.curPlayer as Player; // this.gamePlay.curPlayer
  }

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
  /** true if currently in the named state */
  isPhase(name: string) { return this.state === this.states[name]; }

  selectedAction?: ActionIdent; // set when click on action panel or whatever. read by ActionPhase;
  readonly selectedActions: ActionIdent[] = [];
  get actionsDone() { return this.selectedActions.length};

  moveActions =['Move', 'Move-Attack', 'Clock', ] as ActionIdent[];
  tradeActions = ['Trade', 'Attack', 'Clock', ] as ActionIdent[];
  selPanel?: SelectorPanel;

  /** invoked by button click OR keystroke */
  selectAction(act: ActionIdent) {
    const [abut, aline] = this.selPanel?.actionButtonLine(act) ?? []
    if (!abut || !abut.isActive) return;
    if (!this.isPhase('ChooseAction')) {
      this.done();   // finish selectedAction, expect --> ChooseAction
    }
    if (this.isPhase('ChooseAction')) {
      this.selPanel?.activate(false, act)   // deactivate(line(button(act)))
      this.selectedAction = act;
      this.selectedActions.push(act)
      this.phase(act);
    } else {
      console.log(stime(this, `.selectAction: state "${this.state.Aname}" is not ChooseAction, ignoring "${act}"`))
    }
  }

  /** invoked from layoutTable2() */
  makeActionSelectors(parent: Container, col = true) {
    const onClick = (button: ActionButton) => {
      button.on(S.click, () => {
        this.selectAction(button.actionIdent);
      })
    };
    this.selPanel = new SelectorPanel([
      { name: 'mActions', actions: this.moveActions, dir: -1 },
      { name: 'tActions', actions: this.tradeActions, dir: 1 }
    ], onClick, { col });
    parent.addChild(this.selPanel);
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
        this.selPanel?.activate(true); // BeginTurn
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
        const n = this.selectedActions.length + 1;
        this.selectedAction = undefined;
        this.doneButton(`Choice ${n} Done`); // ???
      },
      done: (ok?: boolean) => {
        const action = this.selectedAction; // set by dropFunc() --> state.done()
        if (!ok && !action) {
          this.panel.areYouSure('You have an unused action.', () => {
            setTimeout(() => this.done(true), 50);
          }, () => {
            setTimeout(() => this.state.start(), 50);
          });
          return;
        }
        this.selectedActions.unshift(action as ActionIdent); // may unshift(undefined)
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
      nextPhase: 'EndAction',
      // refuel & faceUp curPlayer Ships; show paths if defined
      // Drag/Drop to create or extend path; 'm' to move ship
      // continue to move other Ships.
      // click "Done"
      start: (shipMoved?: boolean) => {
        if (shipMoved === undefined) {
          // first 'start' of this 'Move' action: refuel & faceUp curPlayer Ships.
          this.curPlayer.enableMove();
        }
        // wait for shipMoved or doneButton; either will call this.state.done(true/false)
        this.doneButton('Move done')
      },
      // mouse-disable curPlayer ships, do 'm' for each ship to complete moves for this turn
      done: (shipMoved = false) => {
        // if (shipMoved && unmovedShip) this.phase.start(shipMoved)
        this.phase(this.state.nextPhase as string);
      },
    },
    'Move-Attack': {
      // refuel & mouse-enable curPlayer Ships; show paths if defined
      // Drag/Drop to create or extend path; 'm' to move ship
      //
      start: () => {
        this.phase('Move', 'Attack')
      },
    },
    Trade: {
      // Highlight each Ship adjacent to a Planet.
      // popup tradePanel(Ship, Planet) on curPlayer.panel
      // Ship.onClick -> populate panel with Ship & adjacent Planet
      // tradePanel Choice(s) with 'name: - [______] + $price' (an EditBox, two buttons, $text)
      // and a 'Trade' (commit) button
      // continue to select Ship(s) until "Trade Done"
      start: () => {
        this.curPlayer.ships.forEach(s => s.showTradePanel(true))
        this.doneButton('Trade Done')
      },
      done: () => {
        this.curPlayer.ships.forEach(s => s.showTradePanel(false))
        this.phase('EndAction')
      }
    },
    // activate curPlayer Ships with Cargo & fuel & adjacent to opponent Ship.
    // select 1 Ship as attacker, drop it on [adjacent] target.
    Attack: {
      start: () => {
        this.doneButton('Attack done');
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
