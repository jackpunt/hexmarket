import { Container } from "@thegraid/easeljs-module";
import { TP } from "./table-params";
import { CircleShape, RectShape } from "@thegraid/easeljs-lib";

// replaced by: https://michaelbach.de/ot/col-colorPhi/
export class BetaMotion extends Container {
  isi = 50;
  ont = 150;
  n = 2;
  bgc = 'grey';
  cn: string[] = []
  constructor(opts: {
    ont?: number, isi?: number, r0?: number, r1?: number, cn?: string[], n?: number, bgc?: string,
  }) {
    super()
    const { isi, ont, r0: r0, r1, cn, n, bgc } = {
      n: this.n, ont: this.ont, isi: this.isi, bgc: this.bgc,
      r0: TP.hexRad, cn: ['red', 'green'],
      ...opts
    };
    this.n = n;
    this.isi = isi;
    this.ont = ont;
    this.cn = cn;
    const r1d = r1 ?? r0 * 5, rsize = (r1d + r0) * 8;
    const bg = new RectShape({ x: -rsize / 2, y: -rsize / 2, w: rsize, h: rsize }, bgc, '');
    this.addChild(bg);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * (2 * Math.PI)
      const x = r1d * Math.cos(a), y = r1d * Math.sin(a);
      const cir = new CircleShape(cn[i], r0, '');
      cir.x = x; cir.y = y;
      this.addChild(cir);
    }
  }

  paint(n = 0, c = this.bgc) {
    const cir = this.getChildAt(n+1) as CircleShape;
    cir.paint(c, true);
    this.stage?.update();
  }
  /** turnon(n) for ont; turnoff(n) for isi; ... run(n+1) */
  run(n = 0, ont = this.ont, isi = this.isi, ) {
    if (!this.stage) return;   // stop presentation
    this.paint(n, this.cn[n]); // turn on [n]
    setTimeout(() => {
      this.paint(n); // turn off [n]
      setTimeout(() => {
        this.run((n + 1) % this.n); // start[n+1]
      }, isi);
    }, ont);
  }
}
