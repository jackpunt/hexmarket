import { type XYWH } from "@thegraid/common-lib";
import { EditBox, textWidth, type TextInRectOptions, type TextStyle } from "@thegraid/easeljs-lib";
import type { TableCell } from "./table-cell";

export type EditNumberOptions = {
  dx?: number; dy?: number; maxLen?: number; minWidth?: number;
};

/** specifically: an Editor for short numeric strings */
export class EditNumber extends EditBox implements TableCell {
  constructor(text?: string, options: TextStyle & TextInRectOptions & EditNumberOptions = {}) {
    super(text, options);
    this.disp.textAlign = 'right'; // baseLine = 'center'
    const { dx, dy, maxLen, minWidth } = { dx: 0, dy: 0, maxLen: 4, ...options };
    this.dx = dx; this.dy = dy;    // initial dx1 as if center aligned margin
    this.maxLen = maxLen;
    this.minWidth = minWidth ?? maxLen; // write: number of chars
    this.setInCell({ x: 0, y: 0, w: this.minWidth, h: this.fontSize * (1 + dy * 2)});
    this.point = this.buf.length - 1;
    this.cmark.visible = false;
    this.setBounds(undefined, 0, 0, 0); // bounds with (dx, dy) & minWidth
    this.paint(undefined, true); // paint bgColor
  }
  get value() {
    return Number.parseInt(this.label_text ?? '0')
  }

  get align() { return this.disp.textAlign }
  override onFocus(f: boolean): void {
    super.onFocus(f); // TODO: cmark.paint() to fade or blink cmark
  }
  _minWidth = 50;
  get minWidth() { return this._minWidth; }
  set minWidth(n) {
    const [dx0, dx1] = this.borders;
    const tw = textWidth('4'.repeat(n), this.fontSize, this.fontName);
    this._minWidth = dx0 + tw + dx1;
  }

  maxLen = 2;
  // repaint as right-justified line:
  override repaint(text?: string) {
    // at most maxLen chars
    const kil = Math.max(0, this.buf.length - this.maxLen);
    this.buf.splice(0, kil); // remove or insert from front.
    this.point -= kil;
    this.disp.text = this.buf.join('')
    if (this.fillCell) {
      this.setInCell({ x: this.x, y: this.y, w: this.cellWide, h: this.cellHigh }, false)
    }
    return super.repaint(text);
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
    const dmx = Math.max(0, this.minWidth - (dx0 + ww + dx1))
    const x = align ? xx : xx - dmx, w = ww + dmx, h = Math.max(hh, this.fontSize);
    if (Math.abs(align ? x : (x + w)) > .01) debugger;
    // disp.bounds is wrt its own origin, translate to this.origin
    const { x: x0, y: y0 } = this.disp;
    const b = { x: x0 + x - dx0, y: y0 + y - dy0, w: w + dx0 + dx1, h: h + dy0 + dy1 };
    return b;
  }
  // TODO: simplify the whole thing: use maxLen --> editLen
  // and keep that 'constant' (also: 'w' is wider than '4'; so fix keybinder to be numeric)
  // reject any key that breaks Number.parseInt(text)

  // alignCols: tc.x = w; setInCell(colWidth[n])
  /** when placed as a TableCell; or when tracking continuous resize? */
  setInCell({ x: x0, y: y0, w, h }: XYWH, repaint = true) {
    w = Math.max(w, this.minWidth)
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
