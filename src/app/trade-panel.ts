import { C, F, S, type XYWH } from "@thegraid/common-lib";
import { Dispatcher, NamedContainer, RectShape, RectWithDisp, ValueEvent } from "@thegraid/easeljs-lib";
import { Text } from "@thegraid/easeljs-module";
import { UtilButton, UtilButtonOptions } from "@thegraid/hexlib";
import { EditNumber } from "./edit-number";
import { iconForItem, Item, PC, Planet } from "./planet";
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
    const clickToInc = (editNum: EditNumber, pText: Text, incr = 1, lowLimit = 0, highLimit = qMax) => {
      const incValue = () => {
        const value = Math.max(lowLimit, Math.min(highLimit, editNum.value + incr));
        editNum.setText(`${value}`); // editNum dispatches S.splice
      }
      return incValue;
    }
    const icon = this.icon = iconForItem(item, fs);
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
      pText.text = `$${this.costf(qText.value)}`
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
  /** tradeDisp: holding buyTable & sellTable */
  declare disp: NamedContainer;
  constructor(public ship: Ship, x = 0, y = 0) {
    // super(`trade-${ship.Aname}`, x, y)
    super(new NamedContainer(`tradeDisp`), { bgColor: 'rgb(180,180,180)', border: 5 });
  }
  sellTable!: TableCont<TradeRow>;
  buyTable!: TableCont<TradeRow>;

  // item for each Cargo (to Sell)
  // item for each planet.prod
  showPanel(planet: Planet) {
    if (planet) {
      this.disp.removeAllChildren();
      this.buyTable = this.makeBuyTable(planet);
      const x0 = this.buyTable.x, y0 = this.buyTable.y;
      const bh = this.buyTable.getBounds().height + 2;
      this.sellTable = this.makeSellTable(planet, x0, y0 + bh, this.buyTable.colWidths);
      this.buyTable.alignCols(this.sellTable.colWidths);
      this.disp.addChild(this.buyTable);
      this.disp.addChild(this.sellTable);
      this.setBounds(undefined, 0, 0, 0);
      const info = this.ship.infoText
      const { x, y, width, height } = info.getBounds()
      this.x += (x + width + this.dx1); this.y = y + this.dy0;
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
    const rowBuilder: RowBuilder<TradeRow> = ([item, quant]: [Item, number]) => {
      return new TradeRow(planet, item, quant, quant, false);
    };
    const tc = new TableCont(rowBuilder, x, y);
    tc.colWidths = colw; // sync with buyTable if provided
    const sellable = Object.entries(this.ship.cargo)
      .filter(([item, quant]) => planet.consPCs.find(pc => pc.item === item))
    tc.tableize(sellable); // tc.addChild(...tableRows)
    if (sellable.length > 0) this.addCommitButton(tc, false);
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
    if (buyable.length > 0) this.addCommitButton(tc, true);
    return tc;
  }

  // player-buy == planet-sell
  addCommitButton(tc: TableCont<TradeRow>, sell = true) {
    const lastRow = tc.tableRows[tc.tableRows.length - 1]
    const rowWidth = lastRow.width;
    const planet = lastRow.planet;
    const fontSize = F.fontSize(lastRow.pText.font);
    /** commit the purchase */
    const tradeItems = () => {
      tc.tableRows.forEach(trow => {
        const { item, quant } = trow;
        const cost = planet.price(item, quant, sell, true); // commit purchase
        this.ship.player.coins += (sell ? -cost : cost);
        const cargo = this.ship.cargo, q = cargo[item] ?? 0;
        cargo[item] = q + (sell ? quant : -quant);  // TODO: constrain max cargo
        trow.pText.text = `${trow.costf(trow.quant = 0)}`
      })
      tc.stage?.update();
    };

    const buyOpts = { bgColor: sell ? 'pink' : 'lightgreen', visible: true, active: true, border: .1, fontSize } as UtilButtonOptions;
    const button = new UtilButton(sell ? 'Buy' : 'Sell', buyOpts); // center, middle
    button.on(S.click, (evt) => tradeItems())
    const { width, height } = button.getBounds()
    button.y = height / 2 + lastRow.bottom;
    button.x = (rowWidth - width) / 2;
    tc.addChild(button)

    const totalText = this.showTotalCost(tc, button.y);
    Dispatcher.dispatcher.namedOn('updateTotal', 'updateTotal', (evt: ValueEvent) => {
      totalText.text = `$${this.totalCost(tc)}`
      return true;
    })
    return button;
  }

  // TODO: tweak so tradeRow.clickToInc() will update the TradePanel.tText
  /** put a total cost string on bottom row, to the right side */
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
