import { type CGF, TextInRect, type TextInRectOptions } from "@thegraid/easeljs-lib";
import { Text } from "@thegraid/easeljs-module";
import { UtilButtonOptions } from "@thegraid/hexlib";

/**
 * UtilButton with translucent background
 */
export class InfoText extends TextInRect {
  constructor(label: Text | string, options?: UtilButtonOptions & TextInRectOptions, cgf?: CGF) {
    super(label, { bgColor: 'rgba(250,250,250,.8)', ...options }, cgf)
    this.name = 'InfoText'
    this.visible = false;
    this.paint(undefined, true)
  }
  updateText(vis: boolean, generate: () => string, cache = false) {
    const v0 = this.visible;
    if (vis) {
      this.label_text = generate()
      this.parent?.addChild(this);  // bring to top
    }
    this.visible = vis;
    if (vis || vis !== v0) {
      if (cache) {
        this.cacheID ? this.uncache() : this.setBounds(null, 0, 0, 0);
        this.setCacheID()
      }
      this.stage?.update();
    }
  }
}
