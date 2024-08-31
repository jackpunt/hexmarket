import { Text } from "@thegraid/easeljs-module";
import { CGF, TextInRect } from "@thegraid/hexlib";

/**
 * Text with a bounding box
 */
export class InfoBox extends TextInRect {

  constructor(color: string, text: Text, cgf?: CGF) {
    // RectShape.rectText = InfoBox.rectText;
    super(color, text, undefined, undefined, cgf);
    // this.paint(C.WHITE)
    this.name = 'InfoBox'
  }
}
