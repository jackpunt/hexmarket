import type { XYWH } from "@thegraid/common-lib";
import { EditBox, type TextStyle, type TextInRectOptions, textWidth } from "@thegraid/easeljs-lib";
import type { TableCell } from "./table-cell";

/** specifically: an Editor for short numeric strings */
export class EditNumber extends EditBox implements TableCell {
  constructor(text?: string, options: TextStyle & TextInRectOptions & EditNumberOptions = {}) {
    super(text, options);
    this.disp.textAlign = 'right'; // baseLine = 'center'
    const { dx, dy, maxLen, minWidth } = { dx: 0, dy: 0, maxLen: 4, ...options };
    this.dx = dx; this.dy = dy;
    this.maxLen = maxLen;
    this.minWidth = minWidth ?? maxLen;
    this.point = this.buf.length - 1;
    this.cmark.visible = false;
    this.setBounds(undefined, 0, 0, 0); // bounds with (dx, dy) & minWidth
    this.paint(undefined, true); // paint bgColor
  }
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

  override alignCmark(text = this.disp.text, pt = this.point): void {
    let lines = text.split('\n'), bol = 0;
    // scan to find line containing cursor (pt)
    lines.forEach((line, n) => {
      // if cursor on this line, show it in the correct place: assume textAlign='left'
      if (pt >= bol && pt <= bol + line.length) {
        const seg = line.slice(pt);
        this.cmark.x = this.disp.x - textWidth(seg, this.fontSize, this.fontName);
        this.cmark.y = n * this.fontSize; // or measuredLineHeight()?
      }
      bol += (line.length + 1);
    });
  }

  maxLen = 2;
  // repaint as right-justified line:
  override repaint(text?: string) {
    // at most maxLen chars
    const kil = Math.max(0, this.buf.length - this.maxLen);
    this.buf.splice(0, kil); // remove or insert from front.
    this.point -= kil;
    this.bordersToWH({});
    return super.repaint(text);
  }

  fillCell = false;
  bordersToWH({ w = this.textWidth, h = this.fontSize }: Partial<XYWH>) {
    if (!this.fillCell) return;
    const tw = this.textWidth, lh = this.fontSize; // or getMeasuredLineHeight()
    this.dx = (w - tw) / 2 / lh;
    this.dy = (h - lh) / 2 / lh;
    this.rectShape.paint(undefined, true);
  }

  /** override for 'right' alignment */
  override calcBounds(): XYWH {
    const { x, y, w, h } = super.calcBounds();  // bounds around current .disp Text
    return { x, y, w: Math.max(w, this.minWidth), h }; // enlarge for minWidth
  }

  // alignCols: tc.x = w; setInCell(colWidth[n])
  /** when placed as a TableCell: */
  setInCell({ x: x0, y: y0, w, h }: XYWH) {
    // debug: shrink cell size:
    const s = 0; x0 += s; y0 += s; w -= 2 * s; h -= 2 * s;
    // maybe expand rectShape to given cell<w,h>
    this.bordersToWH({ w, h });

    this.rectShape.setRectRad({ x: x0, y: y0, w, h });
    this.setBounds(undefined, 0, 0, 0);

    // RectWithDisp: align ~= 'left', basel = 'top'
    const { x, y, width, height } = this.disp.getBounds();
    const [dx0, dx1, dy0, dy1] = this.borders;
    this.x = x0; this.y = y0;
    this.disp.x = width + dx0;
    this.disp.y = dy0;
    this.repaint();
  }

}
export type EditNumberOptions = {
  dx?: number; dy?: number; maxLen?: number; minWidth?: number;
};

