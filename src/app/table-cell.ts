import { NamedContainer } from "@thegraid/easeljs-lib";
import { DisplayObject, Text } from "@thegraid/easeljs-module";

declare module "@thegraid/easeljs-module" {
  interface DisplayObject {
    asTableCell(setWidth?: (n: number) => void): TableCell;
    asTableCellAnd<T extends DisplayObject>(setWidth?: (n: number) => void): TableCell & T;
  }
}
DisplayObject.prototype.asTableCell = function (setWidth: (n: number) => void) {
  return asTableCell(this, setWidth)
};
DisplayObject.prototype.asTableCellAnd = function<T extends DisplayObject> (setWidth: (n: number) => void) {
  return asTableCellAnd<T>(this as T, setWidth)
};
export interface TableCell extends DisplayObject {
  setWidth(w: number): void;
}

export function asTableCellAnd<T extends DisplayObject>(dObj: T, setWidth?: (n: number) => void) {
  return asTableCell(dObj, setWidth) as TableCell & T;
}

// DisplayObject: [Shape, Container, Text, Bitmap, Sprite]
// EditBox, RectWithText
export function asTableCell(dObj: DisplayObject, setWidth?: (n: number) => void) {
  const disp = (w: number) => {
    const { x, y, width, height } = dObj.getBounds()
    dObj.setBounds(x, y, w, height);
  }
  const text = (w: number) => { // text.align = 'left'
    const { x, y, width, height } = dObj.getBounds()
    const align = (dObj as Text).textAlign;
    const [nx, dx] = ((align === 'center') ? [-w / 2, w / 2] : ((align === 'left') ? [x, 0] : [-w, w]))
    dObj.x += dx;
    dObj.setBounds(nx, y, w, height);
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
  tc.setWidth = setWidth ?? ((dObj instanceof Text) ? text : disp);
  return tc;
}

export class TableRow extends Array<TableCell> {
  /** max of height of cells in row */
  height = 0;
  /** sum of width of cells in row */
  width = 0;
  /** width of each cell in row */
  get widths() { return this.map(tc => tc.getBounds().width) }
  get newWidth() { return this.widths.reduce((pw, cw) => pw + cw, 0) }
}
/** typically: Array<any> OR Record<string, any> */
type CellData = any;

/**
 *
 * @param tableRows prior TableRow[], typically tableRows.push(myTableRow(cellData))
 * @param cellData arguments to construct next TableCell
 * @returns tableRows (with additional TableCell) or undefined when done.
 */
export type RowBuilder = (cellData: CellData) => TableRow;

/** contains an Array of TableRow.
 *
 * With the max column width of each col across all rows
 */
export class TableCont extends NamedContainer {
  // A disp for a RectWithDisp; addChild(...TableRow[])
  // this class manages the y offset, and row creation/membership
  /** Array of TableRow */
  tableRows: TableRow[] = [];
  /** max width of each column across all rows of this TableCont */
  colWidths: number[] = [];

  constructor(public rowBuilder: RowBuilder, x = 0, y = 0) {
    super('table', x, y);
  }
  get width() { return this.tableRows.reduce((pw, tr) => Math.max(pw, tr.width), 0)}
  get height() { return this.tableRows.reduce((ph, tr) => (ph + tr.height), 0)}

  /** create table from array of CellData items */
  tableize(sourceData: CellData[]) {
    sourceData.forEach((cellData) => {
      this.addRow(cellData)
    })
    this.tableRows.forEach((tableRow) => {
      let w = 0;
      tableRow.forEach((tc, col) => {
        const { x, y, width, height } = tc.getBounds()
        tc.x = w;
        const colWidth = this.colWidths[col]
        tc.setWidth(colWidth)
        w += colWidth;
      })
    })
    return this;
  }

  /** put TableCells into a RowCont and stack in this TableCont */
  addRow(cellData: CellData) {
    const n = this.tableRows.length;
    const rowCont = new NamedContainer(`row${n}`, 0, this.height)
    const tableRow = this.rowBuilder(cellData);
    let w = 0, h = 0; // total width & max height of this row
    tableRow.forEach((tc, col) => {
      rowCont.addChild(tc);
      // tc.x = w;
      const { width, height } = tc.getBounds()
      w += width;
      h = Math.max(h, height);
      this.colWidths[col] = Math.max(this.colWidths[col] ?? 0, width);
    })
    tableRow.height = h;
    tableRow.width = w;
    this.tableRows.push(tableRow)
    this.addChild(rowCont)
    return tableRow
  }
}
