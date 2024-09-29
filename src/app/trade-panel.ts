import { C, F, S, type XYWH } from "@thegraid/common-lib";
import { CenterText, Dispatcher, NamedContainer, RectShape, RectWithDisp, TextInRect, ValueEvent } from "@thegraid/easeljs-lib";
import { Text } from "@thegraid/easeljs-module";
import { UtilButton, UtilButtonOptions } from "@thegraid/hexlib";
import { EditNumber } from "./edit-number";
import { Item, PC, Planet } from "./planet";
import { Ship } from "./ship";
import { TableCont, TableRow, type RowBuilder } from "./table-cell";
import { TP } from "./table-params";

class TradeRow extends TableRow {
  get quant() {
    return Number.parseInt(this.qText.innerText)
  }
  set quant(q) { this.qText.setText(`${q}`) };
  costf(value = this.quant) {
    return this.planet.price(this.item, value, this.sell);
  }
  icon;
  sp;
  minus;
  qText;
  plus;
  pText;

  /** rowBuilder: make one row of a TradePanel; a TableRow: TableCell[]
   * @param planet calculate prices from planet
   * @param item the type of product to buy/sell from/to planet
   * @param qMax max value for number (of items to buy/sell)
   * @param initVal [qMax] initial value
   * @param sell [true] true if planet is selling, false if planet is buying.
   * @returns TableRow
   */
  constructor(public planet: Planet, public item: Item, qMax: number, initVal = qMax, public sell = true) {
    const bgColor = sell ? C.PURPLE : C.GREEN;
    super();  // an empty Array
    const cells = this;
    this.item = item;
    const fs = TP.hexRad / 3, fspec = F.fontSpec(fs); const refi = PC.reference[item];
    const itemColor = PC.reference[item].color, fsi = fs * .7;
    const clickToInc = (editNum: EditNumber, pText: Text, incr = 1, lowLimit = 0, highLimit = qMax) => {
      const incValue = () => {
        const v0 = Math.max(lowLimit, Math.min(highLimit, editNum.value + incr));
        const value = Number.isNaN(v0) ? 0 : v0;
        pText.text = `$${this.costf(value)}`
        editNum.setText(`${value}`); // editNum dispatches S.splice
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
    const icon = this.icon = iCell.asTableCellAnd<TextInRect>(iCellSetInCell);
    // qText: show/edit quantity to Trade:
    const qText = this.qText = this.makeQuantEdit(initVal, fs);
    // space
    const spt = new Text(' ', fspec); spt.textBaseline = 'middle';
    const sp = this.sp = spt.asTableCell();
    // price:
    const pText0 = new Text(`$${this.costf()}`.padStart(6), fspec); // 6 b/c narrow spaces...
    const pText = this.pText = pText0.asTableCellAnd<Text>();
    pText.textAlign = 'right';
    pText.textBaseline = 'middle';
    // minus:
    const minus = this.minus = this.makeButton(' - ', fs, bgColor);
    minus.on(S.click, clickToInc(qText, pText, -1))
    // plus:
    const plus = this.plus = this.makeButton(' + ', fs, bgColor);
    plus.on(S.click, clickToInc(qText, pText, 1))
    qText.on(S.splice, () => {
      Dispatcher.dispatcher.dispatchEvent(new ValueEvent('updateTotal', sell ? 'sell' : 'buy'))
    })

    cells.push(icon, sp, minus, qText, plus, pText);
    // A debug line from (0,0) -> (0,130) to show location of each tableRow:
    {
      const w = 145, transb = 'rgba(0,0,0,.1)';
      const line = new RectShape({ x: 0, y: -1., w: w, h: 2.1, s: 0 }, transb, '').asTableCell();
      line.setBounds(0, 0, 0, 0);
      cells.unshift(line);
    }
  }

  makeQuantEdit(maxQuant = 1, fs = F.defaultSize) {
    // qText: show/edit quantity to Trade:
    const bgColor = 'rgba(250,250,250,.9)';
    const qText0 = `${maxQuant}`;
    const qText = new EditNumber(qText0, { integer: true, fontSize: fs, bgColor, dx: .1, bufLen: 2 });
    qText.repaint()                     // position cursor
    return qText;
  }
  // To coerce ALL UtilButton to support TableCell:
  // UtilButton.prototype.asTableCellAnd<UtilButton>(setInCell)
  /** make a UtilButton.asTableCellAnd<UtilButton>()
   *
   * @param label text in the button
   * @param fs [hexRad/2] fontSize of label
   * @param bgColor [WHITE] background color
   * @returns
   */
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
}

export class TradePanel extends RectWithDisp {
  declare disp: NamedContainer;
  constructor(public ship: Ship, x = 0, y = 0) {
    // super(`trade-${ship.Aname}`, x, y)
    super(new NamedContainer(`tradeDisp`), 'rgb(180,180,180)', 5);
  }
  sellTable!: TableCont<TradeRow>;
  buyTable!: TableCont<TradeRow>;

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

  // Each Choice: 'icon: - [______] + $price' (icon, -button, EditBox, +buttons, $number)
  /** cargo this Ship is selling, with price planet will pay to buy. */
  makeSellTable(planet: Planet, x = 0, y = 0, colw: number[] = []) {
    const rowBuilder: RowBuilder<TradeRow> = (cargo: PC) => {
      return new TradeRow(planet, cargo.item, cargo.quant, cargo.quant, false);
    };
    const tc = new TableCont(rowBuilder, x, y);
    tc.colWidths = colw; // sync with buyTable if provided
    const sellable = Object.entries(this.ship.cargo).filter(([item, quant]) => planet.consPCs.find(pc => pc.item === item));
    tc.tableize(sellable); // tc.addChild(...tableRows)
    return tc;
  }

  // Each Choice: 'icon: - [______] + $price' (icon, -button, EditBox, +buttons, $number)
  /** production that planet will sell, with price at which ship can buy */
  makeBuyTable(planet: Planet, x = 0, y = 0, colw: number[] = []) {
    const rowBuilder: RowBuilder<TradeRow> = (prod: PC) => {
      return new TradeRow(planet, prod.item, prod.quant, Math.min(1, prod.quant), true);
    };
    const tc = new TableCont(rowBuilder, x, y);
    tc.colWidths = colw; // sync with sellTable if provided
    const buyable = Object.values(planet.prodPCs);
    tc.tableize(buyable);
    // const r0 = tc.children[0]; r0.parent.addChild(r0);// row0 on top for analysis
    const buyButton = this.addBuyButton(tc);
    const totalText = this.showTotalCost(tc, buyButton.y);
    Dispatcher.dispatcher.namedOn('buyTotal', 'updateTotal', (evt: ValueEvent) => {
      if (evt.value == 'sell') {
        totalText.text = `$${this.totalCost(tc)}`
      }
      return true;
    })
    return tc;
  }

  addBuyButton(tc: TableCont<TradeRow>) {
    const lastRow = tc.tableRows[tc.tableRows.length - 1]
    const rowWidth = lastRow.width;
    const planet = lastRow.planet;
    const fontSize = F.fontSize(lastRow.pText.font);
    /** commit the purchase */
    const buyItems = () => {
      tc.tableRows.forEach(trow => {
        const { item, quant } = trow;
        const cost = planet.sell_price(item, quant, false); // commit purchase
        this.ship.player.coins -= cost;
        const cargo = this.ship.cargo, q = cargo[item] ?? 0;
        cargo[item] = q + quant;  // TODO: constrain max cargo
        trow.pText.text = `${trow.costf(trow.quant = 0)}`
      })
      tc.stage?.update();
    };

    const buyOpts = { bgColor: 'pink', visible: true, active: true, border: .1, fontSize } as UtilButtonOptions;
    const button = new UtilButton('Buy', buyOpts); // center, middle
    button.on(S.click, (evt) => buyItems())
    const { width, height } = button.getBounds()
    button.y = height / 2 + lastRow.bottom;
    button.x = (rowWidth - width) / 2;
    tc.addChild(button)
    return button;
  }

  // TODO: tweak so tradeRow.clickToInc() will update the TradePanel.tText
  showTotalCost(tc: TableCont<TradeRow>, y = 0) {
    const lastRow = tc.tableRows[tc.tableRows.length - 1]
    const pText = lastRow.pText;

    const tText = new Text(`$${this.totalCost(tc)}`, pText.font, pText.color)
    tText.textAlign = 'right';
    tText.textBaseline = 'middle';

    tc.localToLocal(pText.x, pText.y, tc, tText); // align total with price column
    tText.y = y;      // align with buy button...
    tc.addChild(tText)
    return tText;
  }

  totalCost(tc: TableCont<TradeRow>) {
    return tc.tableRows.reduce((pv, cv) => (pv + cv.costf()), 0);
  }
}
