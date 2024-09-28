import { M, type XYWH } from "@thegraid/common-lib";
import { NamedContainer } from "@thegraid/easeljs-lib";
import { DisplayObject, Text } from "@thegraid/easeljs-module";
import { EditNumber } from "./edit-number";

declare module "@thegraid/easeljs-module" {
  interface DisplayObject {
    asTableCell(setInCell?: (xywh: XYWH) => void): TableCell;
    asTableCellAnd<T extends DisplayObject>(setInCell?: (xywh: XYWH) => void): TableCell & T;
  }
}
DisplayObject.prototype.asTableCell = function (setInCell: (xywh: XYWH) => void) {
  return asTableCell(this, setInCell)
};
DisplayObject.prototype.asTableCellAnd = function<T extends DisplayObject> (setInCell: (xywh: XYWH) => void) {
  return asTableCellAnd<T>(this as T, setInCell)
};
export interface TableCell extends DisplayObject {
  setInCell(xywh: XYWH): void;
}

export function asTableCellAnd<T extends DisplayObject>(dObj: T, setInCell?: (xywh: XYWH) => void) {
  return asTableCell(dObj, setInCell) as TableCell & T;
}

// DisplayObject: [Shape, Container, Text, Bitmap, Sprite]
// EditBox, RectWithText
export function asTableCell(dObj: DisplayObject, setInCell?: (xywh: XYWH) => void) {
  // if dObj is like Rectangle, extending WH from upper left XY
  // this is approx correct, altho it does not actually extend the WH of the Rectangle.
  const disp = ({ x: x0, y: y0, w, h }: XYWH) => {
    const { x, y, width, height } = dObj.getBounds()
    dObj.x = x0;
    dObj.y = y0;
    dObj.setBounds(x, y, w, h);
  }
  const text = ({ x: x0, y: y0, w, h }: XYWH) => { // text.align = 'left'
    const { x, y, width, height } = dObj.getBounds(), text = (dObj as Text);
    const align = text.textAlign, basel = text.textBaseline;
    const [nx, dx] = ((align === 'center') ? [-w / 2, w / 2] : ((align === 'left') ? [x, 0] : [x, w])) /* right */
    // 'middle', 'top', 'bottom'
    const [ny, dy] = ((basel === 'middle') ? [-h / 2, h / 2] : ((basel === 'top') ? [y, 0] : [y, h])) /* bottom */
    dObj.x = x0 + dx;
    dObj.y = y0 + dy;
    dObj.setBounds(nx, ny, w, h);
    return;
  }
  const shape = (w: number) => { // text.align = 'left'
    const { x, y, width, height } = dObj.getBounds()
    dObj.setBounds(x, y, w, height);
  }
  const cont = (w: number) => { // text.align = 'left'
    const { x, y, width, height } = dObj.getBounds()
    dObj.setBounds(x, y, w, height);
  }
  const tc = (dObj as any as TableCell)
  tc.setInCell = setInCell ?? ((dObj instanceof Text) ? text : disp);
  return tc;
}

export class TableRow extends Array<TableCell> {
  /** max of height of cells in row */
  _height?: number;
  /** sum of width of cells in row */
  _width?: number;
  /** width of each cell in row */
  get widths() { return this.map(tc => tc.getBounds().width) }
  get heights() { return this.map(tc => tc.getBounds().height) }
  /** total width of cells in this TableRow */
  get width() { return this._width ?? this.widths.reduce((pw, cw) => pw + cw, 0) }
  /** max height of cells in this TableRow */
  get height() { return this._height ?? this.heights.reduce((ph, ch) => Math.max(ph, ch), 0) }
  set width(w: number) { this._width = w }
  set height(h: number) { this._height = h }
  get bottom() { return this.height + (this[0].parent?.y ?? 0) }
}
/** typically: Array<any> OR Record<string, any> */
type CellData = any;

/**
 *
 * @param tableRows prior TableRow[], typically tableRows.push(myTableRow(cellData))
 * @param cellData arguments to construct next TableCell
 * @returns tableRows (with additional TableCell) or undefined when done.
 */
export type RowBuilder<TR extends TableRow> = (cellData: CellData) => TR;

/** contains an Array of TableRow.
 *
 * With the max column width of each col across all rows
 */
export class TableCont<TR extends TableRow> extends NamedContainer {
  // A disp for a RectWithDisp; addChild(...TableRow[])
  // this class manages the y offset, and row creation/membership
  /** Array of TableRow */
  tableRows: TR[] = [];
  /** max width of each column across all rows of this TableCont */
  colWidths: number[] = [];

  constructor(public rowBuilder: RowBuilder<TR>, x = 0, y = 0) {
    super('table', x, y);
  }
  get width() { return this.tableRows.reduce((pw, tr) => Math.max(pw, tr.width), 0)}
  get height() { return this.tableRows.reduce((ph, tr) => (ph + tr.height), 0)}

  /** create table from array of CellData items */
  tableize(sourceData: CellData[]) {
    sourceData.forEach((cellData) => {
      this.addRow(cellData); // TableCell[], colWidths[], tc.x = 0;
    })
    this.alignCols(this.colWidths)
    // check alignment: TODO: remove this. dels: [xDel, b.width, yDel, cell.y, b.y]
    this.checkAlignment();
  }

  checkAlignment() { // for debug analysis
    let x0 = 0, y0 = 0;
    const label = [ 'line', 'name', 'sp', 'minus', 'qText', 'plus', 'pText',]
    const dels: any[] = []; // (TradeRow).map(...) tries to construct a TradeRow
    this.tableRows[0]?.forEach((cell, ndx) => {
      const { x, y, width, height } = cell.getBounds()
      const xa = cell.x + x; // the 'apparent' left edge, esp of EditNumber
      const ya = cell.y + y; // the 'apparent' top edge, esp of EditNumber
      const xDel = xa - x0;
      const yDel = ya - y0;
      const cw = this.colWidths[ndx];
      x0 += cw;
      const rv: any[] = [xDel, width, yDel, cell.y, y].map(v => M.decimalRound(v, 3))
      rv.push(label[ndx])
      dels.push(rv); //       return rv; // when using .map(...)
    })
    console.log(`tableize:`, dels, this.colWidths, this.tableRows[0], this.tableRows)
  }

  /** set each cell to the left-top corner of its column */
  alignCols(colWidths = this.colWidths) {
    this.tableRows.forEach((tableRow) => {
      let x0 = 0, y0 = 0, hr = tableRow.height;
      tableRow.forEach((tc, col) => {
        if (tc instanceof EditNumber) tc.parent?.addChild(tc); // bring to top: debug
        const colWidth = colWidths[col]
        tc.setInCell({ x: x0, y: y0, w: colWidth, h: hr })
        x0 += colWidth;
      })
    })
    return this;
  }
  rowConts: NamedContainer[] = []; // access the RowCont children
  /** put TableCells into a RowCont and stack in this TableCont */
  addRow(cellData: CellData) {
    const n = this.tableRows.length;
    const rowCont = new NamedContainer(`row${n}`, 0, this.height)
    const tableRow = this.rowBuilder(cellData);
    // compute w=sumWidth, h=maxHeight, max(colWidth)
    let w = 0, h = 0; // total width & max height of this row
    tableRow.forEach((tc, col) => {
      rowCont.addChild(tc);
      const { width, height } = tc.getBounds()
      w += width;
      h = Math.max(h, height);
      this.colWidths[col] = Math.max(this.colWidths[col] ?? 0, width);
    })
    tableRow.height = h;   // = tableRow.maxHeight
    tableRow.width = w;    // = tableRow.sumWidth
    this.tableRows.push(tableRow)
    this.addChild(rowCont); this.rowConts.push(rowCont);
    rowCont.y += n * 1;    // space between rows
    return tableRow
  }
}
