import { type CGF, TextInRect, type TextInRectOptions, type UtilButtonOptions } from "@thegraid/easeljs-lib";
import { Text } from "@thegraid/easeljs-module";
import { iconForItem, type Item, type PC } from "./planet";

/**
 * RectWithDisp(PCInfo) with translucent background
 *
 * updateInfo(vis, gen: ()->void)
 */
export class InfoText extends TextInRect {
  constructor(label: Text | string, options?: TextInRectOptions, cgf?: CGF) {
    super(label, { bgColor: 'rgba(250,250,250,.8)', ...options }, cgf)
    this.name = 'InfoText'
    this.visible = false;
    this.paint(undefined, true)
  }
  updateText(vis: boolean, generate: () => string, cache = false) {
    const v0 = this.visible;
    this.label_text = generate()
    this.parent?.addChild(this);  // bring to top
    this.visible = vis;
    if (vis || vis !== v0) {
      if (cache) {
        this.cacheID ? this.uncache() : this.setBounds(null, 0, 0, 0);
        this.setCacheID()
      }
      this.stage?.update();
    }
  }
  /** Hack to overlay icon on text: */
  addIcons(infoLine: string = this.disp.text) {
    const fs = this.fontSize * .86;
    const text = this.disp; text.text = infoLine; //text.textAlign = 'left';
    this.removeChildType(TextInRect)
    const { x, y } = text.getBounds();
    const h = text.getMeasuredLineHeight();
    const lines = infoLine.split('\n'), rel = /^([A-Z0-9]+):/;
    lines.forEach((line, n) => {
      const matches = line.match(rel)
      if (matches) {
        const item = matches[1] as Item;
        const icon = iconForItem(item, fs);
        const { width: w, height } = icon.getBounds();
        icon.setInCell({ x, y: y - 3 + (n) * h, w, h: h - 2 })
        this.addChild(icon);
      }
    })
  }
}

/** InfoText with PC[] for prod or cons. */
export class PCInfo extends InfoText {
  constructor(public pcary: PC[], label: Text | string, options?: UtilButtonOptions & TextInRectOptions, cgf?: CGF) {
    super(label, options, cgf)
    this.pcary = pcary;
  }
}

