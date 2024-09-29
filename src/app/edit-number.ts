import { type XYWH } from "@thegraid/common-lib";
import { EditBox, KeyBinder, textWidth, type TextInRectOptions, type TextStyle } from "@thegraid/easeljs-lib";
import type { TableCell } from "./table-cell";

/**
 * @param dx border around text, fraction of fontSize
 * @param dy border around text, fraction of fontSize
 * @param bufLen number of chars?
 * @param integer [false] true to prevent decimal point
 */
export type EditNumberOptions = {
  dx?: number; dy?: number; bufLen?: number, integer?: boolean;
};
type kFunc = ((...args: any[]) => any);

/** specifically: an EditBox for short numeric strings */
export class EditNumber extends EditBox implements TableCell {
  constructor(text?: string, options: TextStyle & TextInRectOptions & EditNumberOptions = {}) {
    super(text, options);
    this.numKeys(options.integer);
    this.disp.textAlign = 'right'; // baseLine = 'center'
    const { dx, dy, bufLen } = { dx: 0, dy: 0, bufLen: 4, ...options };
    this.dx = dx; this.dy = dy;    // initial dx1 as if center aligned margin
    this.bufLen = bufLen;   // write: number of chars, read number of chars
    this.pxWidth = bufLen;  // write: number of chars, read pixel width
    this.setInCell({ x: 0, y: 0, w: this.pxWidth, h: this.fontSize * (1 + dy * 2)});
    this.point = this.buf.length - 1;
    this.cmark.visible = false;
    this.setBounds(undefined, 0, 0, 0); // bounds with (dx, dy) & minWidth
    this.paint(undefined, true); // paint bgColor
  }
  get value() {
    return Number.parseFloat(this.label_text ?? '0');
  }

  /** constrain to integer or decimal numbers.  */
   numKeys(integer = false): void {
    const numKeys = integer ? /^[-\+0-9]$/ : /^[-\+\.0-9]$/;
    const kb = KeyBinder.keyBinder, scope = this.keyScope;
    kb.setKey(/^\S$/, () => { }, scope); // override as NO-OP
    kb.setKey(numKeys, (arg, estr) => this.selfInsert(estr, estr), scope); // no argVal -> use estr
  }

  get align() { return this.disp.textAlign }
  override onFocus(f: boolean): void {
    super.onFocus(f); // TODO: cmark.paint() to fade or blink cmark
  }

  /** max number of chars in edit buffer */
  bufLen = 4;
  _pxWidth = 50;
  /** read returns pixel width */
  get pxWidth() { return this._pxWidth; }
  /** set with number of chars (of fontSize) */
  set pxWidth(n) {
    const [dx0, dx1] = this.borders;
    const tw = textWidth('4'.repeat(n), this.fontSize, this.fontName);
    this._pxWidth = dx0 + tw + dx1;
  }

  // repaint as right-justified line:
  override repaint(text?: string) {
    // if more than bufLen chars: kill from left
    const kil = Math.max(0, this.buf.length - this.bufLen);
    if (kil > 0) {
      this.point -= kil;
      this.splice(0, kil); // remove or insert from front. (dispatch 'splice')
    }
    if (this.fillCell) {
      this.setInCell({ x: this.x, y: this.y, w: this.cellWide, h: this.cellHigh }, false)
    }
    return super.repaint();
  }

  fillCell = true;
  cellWide = 0;
  cellHigh = 0;
  bordersToWH({ w = this.cellWide, h = this.fontSize }: Partial<XYWH>) {
    if (!this.fillCell) return;
    this.cellWide = w;
    this.cellHigh = h;
    // hold dx1 constant (right justified margin)
    // adjust dx0 to fill cell with rectShape.
    // rectShape.[x,y] = [0,0]
    const tw = this.textWidth, lh = this.fontSize; // or getMeasuredLineHeight()
    const [dx0, dx1, dy0, dy1] = this.borders;
    this.dx0 = (w - tw - dx1) / lh;     // align-right margin
    this.dy = (h - lh) / 2 / lh;        // align-middle margins
    this.cmark.y = dy0;
    this.rectShape.setRectRad({ w, h }); //{ w: dx0 + tw + dx1, h: dy0 + lh + dy1 }
    this.rectShape.paint(undefined, true);
  }

  /** override for minWidth and to correct for textAlign == 'right' */
  override calcBounds(): XYWH {
    const [dx0, dx1, dy0, dy1] = this.borders;
    const align = this.align == 'left'; // vs 'right'; vertical is always 'middle'
    const { x: xx, y, width: ww, height: hh } = this.disp.getBounds() ?? { x: 0, y: 0, width: 0, height: 0 };
    if (Math.abs(align ? xx : (xx + ww)) > .01) debugger;
    const dmx = Math.max(0, this.pxWidth - (dx0 + ww + dx1))
    const x = align ? xx : xx - dmx, w = ww + dmx, h = Math.max(hh, this.fontSize);
    if (Math.abs(align ? x : (x + w)) > .01) debugger;
    // disp.bounds is wrt its own origin, translate to this.origin
    const { x: x0, y: y0 } = this.disp;
    const b = { x: x0 + x - dx0, y: y0 + y - dy0, w: w + dx0 + dx1, h: h + dy0 + dy1 };
    return b;
  }

  // alignCols: tc.x = w; setInCell(colWidth[n])
  /** when placed as a TableCell; or when tracking continuous resize? */
  setInCell({ x: x0, y: y0, w, h }: XYWH, repaint = true) {
    w = Math.max(w, this.pxWidth)
    // maybe expand rectShape to given cell<w,h>
    this.bordersToWH({ w, h });

    // set upper-left corner: align ~= 'left', basel = 'top'
    this.x = x0; this.y = y0;
    // adjust disp for new width, dx0, dx1, dy0
    const [dx0, dx1, dy0, dy1] = this.borders;
    this.disp.x = (this.disp.textAlign === 'left') ? dx0 : (w - dx1);
    this.disp.y = dy0;

    // calcBounds() and setRectRad()
    this.setBounds(undefined, 0, 0, 0);
    this.rectShape.paint(undefined, true);
    repaint && this.repaint(); // no repaint when called from repaint!
  }

}
