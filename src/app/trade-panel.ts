import { C, F, type XYWH } from "@thegraid/common-lib";
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
      if (false) {
        // pad or trim the rectShape to fit Cell
        // true, but generally w == width && h == height; b/c: same content in each row
        const { x, y, width, height } = button.getBounds();
        const [dx0, dx1, dy0, dy1] = button.borders;
        button.dx = (w - width) / 2;
        button.dy = (h - height) / 2;
        button.setBounds(undefined, 0, 0, 0);
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
    const qText = new EditNumber(qText0, { fontSize: fs, bgColor, dx: .1, maxLen });
    qText.repaint()                     // position cursor
    return qText;
  }

  /** rowBuilder: make one row of a TradePanel; a TableRow: TableCell[]
   * @param item the type of product to buy/sell from/to planet
   * @param quant number of items to buy/sell
   * @param planet calculate prices from planet
   * @returns TableRow
   */
  makeTradeRow(item: Item, quant: number, planet: Planet, sell = true) {
    const color = sell ? C.GREEN : C.PURPLE;
    const cells = new TableRow();
    const fs = TP.hexRad / 3, fspec = F.fontSpec(fs);
    const itemColor = PC.reference[item].color, fsi = fs * .7;
    // item Icon: CenterText in Rect(corners)
    const nText = new CenterText(item, F.fontSpec(fsi), C.BLACK);
    const nCell = new TextInRect(nText, { bgColor: itemColor, border: .3, corner: 1.0 });
    const name = nCell.asTableCellAnd<TextInRect>(({ x: x0, y: y0, w, h }) => {
      const { x, y, w: width, h: height } = nCell.calcBounds(); // y00 = 0

      // from ['center', 'top'] to ['center', 'center']
      nCell.x = x0 + w / 2;
      nCell.y = y0 - y + (height - h) / 2;
      // no descenders: use this oppty to tweak text position in circle.
      nCell.y += (nCell.disp.y = .1 * fsi) / 2;
      nCell.setBounds(-w / 2, -height / 2, w, height);
    });
    // space
    const spt = new Text(' ', fspec); spt.textBaseline = 'middle';
    const sp = spt.asTableCell();
    // minus:
    const minus = this.makeButton(' - ', fs, color);
    // qText: show/edit quantity to Trade:
    const qText = this.makeQuantEdit(quant, fs);
    // plus:
    const plus = this.makeButton(' + ', fs, color);
    // price:
    const pricef = () => planet.price(item, Number.parseInt(qText.innerText), !sell);
    const pText = new Text(` $${pricef()}`, fspec);
    pText.textAlign = 'right';
    pText.textBaseline = 'middle';
    const price = pText.asTableCell();
    cells.push(name, sp, minus, qText, plus, price);
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
      return this.makeTradeRow(item, quant, planet, true);
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
      return this.makeTradeRow(prod.item, Math.min(1, prod.quant), planet, false);
    };
    const tc = new TableCont(rowBuilder, x, y);
    tc.colWidths = colw; // sync with sellTable if provided
    const buyable = Object.values(planet.prodPCs);
    tc.tableize(buyable);
    // const r0 = tc.children[0]; r0.parent.addChild(r0);// row0 on top for analysis
    return tc;

  }
}
