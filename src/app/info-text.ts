import { Text } from "@thegraid/easeljs-module";
import { CGF, UtilButton, UtilButtonOptions } from "@thegraid/hexlib";

/**
 * UtilButton with translucent background
 */
export class InfoText extends UtilButton {
  constructor(label: Text | string, color = 'rgba(250,250,250,.8)', options?: UtilButtonOptions, cgf?: CGF) {
    super(label, color, options, cgf)
    this.name = 'InfoText'
    this.paint()
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
