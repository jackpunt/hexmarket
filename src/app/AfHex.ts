import { C, S, stime } from "@thegraid/common-lib"
import { Shape, Container } from "@thegraid/easeljs-module"
import { HexDir, H } from "./hex-intfs"
import { TP } from "./table-params"

namespace AF {
  export const A = 'a' // Arc (was C for circle...)
  export const T = 't'
  export const S = 's'
  export const R = 'r'
  export const G = 'g'
  export const B = 'b'
  export const L = 'l'
  export const F = 'f'
  export const color = { r: C.RED, g: C.GREEN, b: C.BLUE }
  export const fill = { l: 'line', f: 'fill'}
}
const ATSa = [AF.A, AF.T, AF.S] as const
type ATS = typeof ATSa[number];

const RGBa = [AF.R, AF.G, AF.B] as const
type afColor = typeof RGBa[number];

const LSa = [AF.L, AF.F] as const
type afFill = typeof LSa[number];

/** a Mark (one of six) on the edge of Hex2 to indicate affinity */
class AfMark extends Shape {

  drawAfMark(afType: ATS, afc: afColor, aff: afFill) {
    let color = AF.color[afc]
    let k = 8, wl = 2, y0 = TP.hexRad - k, wm = (TP.hexRad * .4), w2 = wm / 2;
    let arc0 = 0 * (Math.PI / 2), arclen = Math.PI
    let g = this.graphics
    // ss(wl) = setStrokeStyle(width, caps, joints, miterlimit, ignoreScale)
    // g.s(afc) == beginStroke; g.f(afc) == beginFill
    if (aff == AF.L) { g.ss(wl).s(color) } else { g.f(color) }
    g.mt(-w2, 0 - y0);
    (afType == AF.A) ?
      //g.at(0, w2 - y0, w2, 0 - y0, w2) : // one Arc
      g.arc(0, 0 - y0, w2, arc0, arc0 + arclen, false) :
      (afType == AF.T) ?
        g.lt(0, w2 - y0).lt(w2, 0 - y0) : // two Lines
        (afType == AF.S) ?
          g.lt(-w2, w2 - y0).lt(w2, w2 - y0).lt(w2, 0 - y0) : // three Lines
          undefined;
          // endStroke() or endFill()
    if (aff == AF.L) { g.es() } else { g.ef() }
    return g
  }
  // draw in N orientation
  constructor(shape: ATS, color: afColor, fill: afFill, ds: HexDir) {
    super()
    this.drawAfMark(shape, color, fill)
    this.mouseEnabled = false
    this.rotation = H.dirRot[ds]
    this[S.Aname] = `AfMark:${shape},${color},${fill}`  // for debug, not production
  }
}

/** Container of AfMark Shapes */
export class AfHex extends Container {
  Aname: string
  /** return a cached Container with hex and AfMark[6] */
  constructor(public aShapes: ATS[], public aColors: afColor[], public aFill: afFill[] = [AF.L, AF.F, AF.L, AF.F, AF.L, AF.F]) {
    super()
    for (let ndx in aShapes) {
      let ats = aShapes[ndx], afc = aColors[ndx], aff = aFill[ndx], ds = H.ewDirs[ndx]
      let afm = new AfMark(ats, afc, aff, ds)
      this.addChild(afm)
    }
    let w = TP.hexRad * H.sqrt3, h = TP.hexRad * 2 // see also: Hex2.cache()
    this.cache(-w/2, -h/2, w, h)
  }

  static allAfHexMap: Map<string, AfHex> = new Map();
  static allAfHex: AfHex[] = [];

  /**
   * make all the allAfHex.
   *
   * affinity defined by (2x3x2) permutation of each of shape[c,s,t] & color[r,g,b] & fill[line|solid]
   *
   * each "AfHex" is a [cached] Container of 6 AfMark Shapes (on each edge of Hex)
   * annotated with shape[6]: [a,s,t] and color[6]: [r,g,b] and fill[6]: [l,f]
   * each annotation rotated to align with ewDirs
   */
  static makeAllAfHex() {
    let aShapes: ATS[] = [AF.A, AF.T, AF.S]
    let aColors: afColor[] = [AF.R, AF.G, AF.B]
    let aFill: afFill[] = [AF.L, AF.F]
    // TODO synthesize all permutations
    // let atsPerm = AfHex.findPermutations([AF.A, AF.A, AF.T, AF.T, AF.S, AF.S]) // for ATS & afColor [16]
    let sixOfThreePerms = AfHex.findPermutations([0, 0, 1, 1, 2, 2]) // for ATS & afColor [16]
    let sixOfTwoPerms = AfHex.findPermutations([0, 0, 0, 1, 1, 1])   // for afFill  [4]
    let sixOfZero = AfHex.findPermutations([0, 0, 0, 0, 0, ,0])   // for initial view [1]
    let sixOfOne = AfHex.findPermutations([1, 1, 1, 1, 1, 1])   // for initial view [1]
    let sixOfTwo = AfHex.findPermutations([2, 2, 2, 2, 2, 2])   // for initial view [1]
    console.log(stime(`AfHex`, `.makeAllAfHex`), sixOfThreePerms, sixOfTwoPerms)
    let atsp = sixOfTwo, afcp = sixOfThreePerms, affp = sixOfTwo

    // pick a random rotation of each factor:
    // expect 16 x 16 x 4 = 1024 generated.
    for (let atsn in atsp) {
      // let atsr = AfHex.rotateAf(atsn, Math.round(Math.random() * atsn.length))
      // rotated when placed on Hex2
      let ats = atsp[atsn].map(n => aShapes[n])
      let atss = ats.join('');
      for (let afcn in afcp) {
        let afcr = AfHex.rotateAf(afcp[afcn], Math.round(Math.random() * afcp.length))
        let afc = afcr.map(n => aColors[n])
        let afcs = afc.join('')
        for (let affn in affp) {
          let affr = AfHex.rotateAf(affp[affn], Math.round(Math.random() * affp.length))
          let aff = affr.map(n => aFill[n])
          let affs = aff.join('')
          let afhex = new AfHex(ats, afc, aff);
          afhex.Aname = `${atss}:${afcs}:${affs}`;
          AfHex.allAfHexMap.set(afhex.Aname, afhex);
          AfHex.allAfHex.push(afhex);
        }
      }
    }
  }
  static findPermutations(ary: number[]) {
    return AfHex.chooseNext(ary)
  }
  /**
   * choose next item (when distinct from previous choice) append to choosen
   * when all items have been chosen, push 'chosen' to found.
   *
   * @param items items to choose (sorted)
   * @param found permutations already found (push new perms to this array)
   * @param chosen items already chosen (in order)
   * @returns
   */
  static chooseNext(items: number[], found: number[][] = [], chosen: number[] = []) {
    // assert: left is sorted
    // done: 0012 left: 12 --> 001212, 001221
    // append lowest(left) to done, then chooseNext
    for (let ndx = 0; ndx < items.length; ndx++) {
      let next = items[ndx]
      if (next === items[ndx - 1]) continue // because 'sorted': skip all identical elements
      let ritems = items.slice() // copy of remaining items
      ritems.splice(ndx, 1)      // remove 'next' item from remaining items
      let nchosen = chosen.slice()
      nchosen.push(next)         // append 'next' item to chosen
      if (ritems.length === 0) {
        if (AfHex.newFound(nchosen, found)) found.push(nchosen);
        return found
      }
      AfHex.chooseNext(ritems, found, nchosen)
    }
    return found
  }
  static newFound(target: number[], exists: number[][]) {
    let rt0 = AfHex.rotateAf(target, 0);
    let rt1 = AfHex.rotateAf(target, 1);
    let rt2 = AfHex.rotateAf(target, 2);
    let rt = target.slice()
    for (let r = 0; r < rt.length; r++) {
      if (exists.find(exary => !exary.find((v, ndx) => rt[ndx] !== v))) return false;
      rt = AfHex.rotateAf(rt, 1)
    }
    return true // no rotation of target matches an existing array element.
  }

  /** rotate elements of array by n positions. */
  static rotateAf(str: number[], n = 1) {
    let head = str.slice(0, n)
    let tail = str.slice(n)
    tail.push(...head)
    return tail
  }
}
