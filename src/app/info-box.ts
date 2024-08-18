import { CenterText, XYWH } from "@thegraid/easeljs-lib";
import { Graphics, Text } from "@thegraid/easeljs-module";
import { CGF, PaintableShape, RectShape, TP, UtilButton } from "@thegraid/hexlib";

export class InfoBox extends UtilButton {
  /**
   * paint a background RectShape for given Text.
   * @param t Text (or simple string using fs & align)
   * @param fs fontSize for measuring text [TP.hexRad / 2]
   * @param b border size around text [fs * .1]
   * @param align textAlign ['center']
   * @param g0 append to Graphics [new Graphics()]
   * @returns
   */
  static rectText(t: Text , fs?: number, b0?: number, align = (t instanceof Text) ? t.textAlign : 'center', g0 = new Graphics()) {
    const { x, y, width, height } = t.getBounds();
    if (fs === undefined) fs = t.getMeasuredLineHeight();
    const b = b0 ?? fs * .1
    return RectShape.rectWHXY(width+2*b, height+2*b, x-b, y-b, g0);
  }
  static calcBounds(t: Text | string, fs?: number, b?: number, align = (t instanceof Text) ? t.textAlign : 'center') {
    const textMeasure = (line: string, mm = { w: 0, h: 0 }) => {
      const text = new Text(line);
      const w = text.getMeasuredWidth(), h = text.getMeasuredLineHeight();
      return { w: Math.max(w, mm.w), h: (h + mm.h) }
    }
    const textBounds = (t: string, align = 'center') => {
      const lines = t.split('\n');
      let mm = { w: 0, h: 0 };
      lines.forEach(line => (mm = textMeasure(line, mm)))
      const { w, h } = mm;
      return { x: -w / 2, y: -h / 2, w, h, nl: lines.length }
    }
    const txt = (t instanceof Text) ? t : new CenterText(t, fs ?? TP.hexRad / 2);
    txt.textAlign = align;
    if (!txt.text) return { x: 0, y: 0, width: 0, height: 0 }; // or RectShape.rectWHXY(0,0,0,0); ??
    if (fs === undefined) fs = txt.getMeasuredHeight();
    if (b === undefined) b = fs * .1;
    const { w: txtw, h: txth, nl } = textBounds(txt.text, align)
    const w = b + txtw + b, h = b + txth + b;
    const x = (align == 'right') ? b - w : (align === 'left') ? b : - w / 2;
    const y = ((nl - 1) * fs - h) / 2;
    return { x, y, width: w, height: h }
  }

  constructor(color: string, text: string, fontSize?: number, textColor?: string, cgf?: CGF) {
    // RectShape.rectText = InfoBox.rectText;
    super(color, text, fontSize, textColor, cgf);
    this.name = 'InfoBox'
    this.shape.cgf = (cgf ?? ((c) => this.ibcsf(c)));
  }
  ibcsf(color: string, g = new Graphics()) {
    return InfoBox.rectText(this.label, this.fontSize, this.fontSize * .5, this.label.textAlign, g.f(color))
  }
  override get label_text() { return super.label_text; }
  override set label_text(t: string | undefined) {
    // this.label.textAlign = 'center';
    // this.y = -18
    // const b1 = InfoBox.calcBounds(this.label, this.fontSize)
    super.label_text = t; // set value and paint.
    this.label.setBounds(null, 0, 0, 0); // remove prior bounds
    const b0 = this.label.getBounds()
    const { x, y, width, height } = b0;
    this.label.setBounds(x, y, width, height);
    const b2 = this.getBounds();
    return
  }
  // override ubcsf(color: string, g?: Graphics): Graphics {
  //   return super.ubcsf(color, g)
  //   // return RectShape.rectText(this.label.text, this.fontSize, this.fontSize * .3, this.label.textAlign, g.f(color))
  // }
}
