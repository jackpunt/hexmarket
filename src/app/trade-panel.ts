import { C, F, S, type XYWH } from "@thegraid/common-lib";
import { CenterText, NamedContainer, RectShape, RectWithDisp, TextInRect } from "@thegraid/easeljs-lib";
import { Text } from "@thegraid/easeljs-module";
import { UtilButton, UtilButtonOptions } from "@thegraid/hexlib";
import { EditNumber } from "./edit-number";
import { Item, PC, Planet } from "./planet";
import { Ship } from "./ship";
import { TableCont, TableRow, type RowBuilder } from "./table-cell";
import { TP } from "./table-params";


export class TradePanel extends RectWithDisp {
  declare disp: NamedContainer;
  constructor(public ship: Ship, x = 0, y = 0) {
    // super(`trade-${ship.Aname}`, x, y)
    super(new NamedContainer(`tradeDisp`), 'rgb(180,180,180)', 5);
  }
  sellTable!: TableCont;
  buyTable!: TableCont;

  // item for each Cargo (to Sell)
  // item for each planet.prod
  showPanel(planet: Planet) {
    if (planet) {
      this.disp.removeAllChildren();
      this.buyTable = this.makeBuyTable(planet);
      const x = this.buyTable.x, y = this.buyTable.height + 2;
      this.sellTable = this.makeSellTable(planet, x, y, this.buyTable.colWidths);
      this.buyTable.alignCols(this.sellTable.colWidths);
      this.disp.addChild(this.buyTable);
      this.disp.addChild(this.sellTable);
      this.disp.setBounds(undefined as any as number, 0, 0, 0);
      // TODO: add any buttons to this
      this.setBounds(undefined, 0, 0, 0);
      this.visible = true;
      this.paint(undefined, true);
      this.ship.addChild(this);
    } else {
      this.ship.removeChild(this);
    }
  }
  // To coerce ALL UtilButton to support TableCell:
  // UtilButton.prototype.asTableCellAnd<UtilButton>(setInCell)
  /** make a UtilButton.asTableCellAnd<UtilButton>() */
  makeButton(label: string, fs: number, bgColor: string) {
    const opts: UtilButtonOptions = { bgColor, border: 0, fontSize: fs, visible: true, active: true };
    const button = new UtilButton(label, opts); // as UtilButton & TableCell;

    // align = 'center', basel = 'center'
    const setInCell = ({ x: x0, y: y0, w, h }: XYWH) => {
      if (true) {
        // pad or trim the rectShape to fit Cell
        // true, but generally w == width && h == height; b/c: same content in each row
        const lh = button.disp.getMeasuredLineHeight(), tweak = .05
        const { x, y, width, height } = button.disp.getBounds();
        // const [dx0, dx1, dy0, dy1] = button.borders;
        button.dx = (w - width) / 2 / lh;
        button.dy = (h - height) / 2 / lh;
        button.dy0 += tweak; button.dy1 -= tweak;
        button.setBounds(undefined, 0, 0, 0);
        button.rectShape.paint(undefined, true);
      }
      // ['center', 'center'] formula, inspired by name-Icon
      const { x, y, width, height } = button.getBounds();
      button.x = x0 + w / 2;
      button.y = y0 - y + (height - h) / 2;
      button.setBounds(x, y, w, h);
    };
    return button.asTableCellAnd<UtilButton>(setInCell);
  }
  makeQuantEdit(maxQuant = 1, fs = F.defaultSize) {
    // qText: show/edit quantity to Trade:
    const bgColor = 'rgba(250,250,250,.9)';
    const qText0 = `${maxQuant}`, maxLen = Math.random() > .5 ? 4 : 3;
    // const qText = new EditNumber('', { fontSize: fs, bgColor, dx: .1, maxLen });
    // qText.setText(qText0, { fontName: qText.fontName, fontSize: qText.fontSize });
    const qText = new EditNumber(qText0, { fontSize: fs, bgColor, dx: .1, maxLen: 2 });
    qText.repaint()                     // position cursor
    return qText;
  }

  /** rowBuilder: make one row of a TradePanel; a TableRow: TableCell[]
   * @param planet calculate prices from planet
   * @param item the type of product to buy/sell from/to planet
   * @param quant number of items to buy/sell
   * @returns TableRow
   */
  makeTradeRow(planet: Planet, item: Item, quant: number, initVal = quant, sell = true) {
    const bgColor = sell ? C.GREEN : C.PURPLE;
    const cells = new TableRow();
    const fs = TP.hexRad / 3, fspec = F.fontSpec(fs);
    const itemColor = PC.reference[item].color, fsi = fs * .7;
    const pricef = (value = Number.parseInt(qText.innerText)) => planet.price(item, value, !sell);
    const clickToInc = (editNum: EditNumber, price: Text, incr = 1, lowLimit = 0, highLimit = quant) => {
      const incValue = () => {
        const value = Math.max(lowLimit, Math.min(highLimit, editNum.value + incr));
        price.text = `$${pricef(value)}`
        editNum.setText(`${value}`);
      }
      return incValue;
    }
    // item Icon: CenterText in Rect(corners)
    const iText = new CenterText(item, F.fontSpec(fsi), C.BLACK);
    const iCell = new TextInRect(iText, { bgColor: itemColor, border: .3, corner: 1.0 });
    const iCellSetInCell: (xywh: XYWH) => void = ({ x: x0, y: y0, w, h }) => {
      { // no descenders: tweak the position of circle behind text
        const tweak = .07; iCell.dy0 += tweak; iCell.dy1 -= tweak;
        iCell.setBounds(undefined, 0, 0, 0);
        iCell.rectShape.paint(undefined, true);
      }
      const { x, y, w: width, h: height } = iCell.calcBounds(); // y00 = 0
      // from ['center', 'top'] to ['center', 'center']
      iCell.x = x0 + w / 2;
      iCell.y = y0 - y + (height - h) / 2;
      iCell.setBounds(-w / 2, -height / 2, w, height);
    }
    const icon = iCell.asTableCellAnd<TextInRect>(iCellSetInCell);
    // qText: show/edit quantity to Trade:
    const qText = this.makeQuantEdit(initVal, fs);
    // space
    const spt = new Text(' ', fspec); spt.textBaseline = 'middle';
    const sp = spt.asTableCell();
    // price:
    const pText = new Text(`$${pricef()}`.padStart(6), fspec); // 6 b/c narrow spaces...
    pText.textAlign = 'right';
    pText.textBaseline = 'middle';
    const price = pText.asTableCell();
    // minus:
    const minus = this.makeButton(' - ', fs, bgColor);
    minus.on(S.click, clickToInc(qText, pText, -1))
    // plus:
    const plus = this.makeButton(' + ', fs, bgColor);
    plus.on(S.click, clickToInc(qText, pText, 1))

    cells.push(icon, sp, minus, qText, plus, price);
    // Debug line from (0,0) -> (0,130)
    {
      const w = 145, transb = 'rgba(0,0,0,.1)';
      const line = new RectShape({ x: 0, y: -1., w: w, h: 2.1, s: 0 }, transb, '').asTableCell();
      line.setBounds(0, 0, 0, 0);
      cells.unshift(line);
    }
    return cells;
  }

  // Each Choice: 'name: - [______] + $price' (name, -button, EditBox, +buttons, $number)
  /** cargo this Ship is selling, with price planet will pay. */
  makeSellTable(planet: Planet, x = 0, y = 0, colw: number[] = []) {
    const rowBuilder: RowBuilder = (cargoEntry: [Item, number]) => {
      const [item, quant] = cargoEntry;
      return this.makeTradeRow(planet, item, quant, quant, true);
    };
    const tc = new TableCont(rowBuilder, x, y);
    tc.colWidths = colw; // sync with buyTable if provided
    const sellable = Object.entries(this.ship.cargo).filter(([item, quant]) => planet.consPCs.find(pc => pc.item === item));
    tc.tableize(sellable); // tc.addChild(...tableRows)
    return tc;
  }
  // Each Choice: 'name: - [______] + $price' (name, -button, EditBox, +buttons, $number)
  makeBuyTable(planet: Planet, x = 0, y = 0, colw: number[] = []) {
    const rowBuilder: RowBuilder = (prod: PC) => {
      return this.makeTradeRow(planet, prod.item, prod.quant, Math.min(1, prod.quant), false);
    };
    const tc = new TableCont(rowBuilder, x, y);
    tc.colWidths = colw; // sync with sellTable if provided
    const buyable = Object.values(planet.prodPCs);
    tc.tableize(buyable);
    // const r0 = tc.children[0]; r0.parent.addChild(r0);// row0 on top for analysis
    return tc;

  }
}
