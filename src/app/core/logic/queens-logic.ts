import { CellCoord } from '../models/queens.model';

/** Display names for region ids; must match the --region-N colors in styles.css. */
export const REGION_NAMES = ['green', 'yellow', 'blue', 'red', 'purple', 'teal', 'orange', 'gray', 'tan', 'pink'] as const;

export interface Deduction {
  title: string;
  message: string;
  place?: CellCoord;
  eliminate: CellCoord[];
  focus: CellCoord[];
}

type UnitKind = 'row' | 'col' | 'region';

interface Layout {
  n: number;
  regionOf: number[];
  /** Units 0..n-1 are rows, n..2n-1 columns, 2n..3n-1 regions. */
  units: number[][];
  unitsOf: number[][];
}

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
/** How many forced queens to follow when looking for a dead end. */
const LOOKAHEAD_DEPTH = 4;

function buildLayout(regions: number[][]): Layout {
  const n = regions.length;
  const regionOf: number[] = [];
  const units: number[][] = Array.from({ length: 3 * n }, () => []);
  const unitsOf: number[][] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const i = r * n + c;
      const g = regions[r][c];
      regionOf.push(g);
      units[r].push(i);
      units[n + c].push(i);
      units[2 * n + g].push(i);
      unitsOf.push([r, n + c, 2 * n + g]);
    }
  }
  return { n, regionOf, units, unitsOf };
}

function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function popcount(x: number): number {
  let count = 0;
  for (let v = x; v; v &= v - 1) count++;
  return count;
}

export function cellName(cell: CellCoord): string {
  return `row ${cell.row + 1} col ${cell.col + 1}`;
}

/**
 * Candidate-tracking board used for human-style deductions.
 * A cell is "open" while it could still hold a queen.
 */
export class LogicBoard {
  readonly n: number;

  private constructor(
    private readonly layout: Layout,
    private readonly open: Uint8Array,
    private readonly done: Uint8Array,
    readonly queens: number[]
  ) {
    this.n = layout.n;
  }

  static create(regions: number[][], queens: CellCoord[] = [], ruledOut: CellCoord[] = []): LogicBoard {
    const layout = buildLayout(regions);
    const n = layout.n;
    const board = new LogicBoard(layout, new Uint8Array(n * n).fill(1), new Uint8Array(3 * n), []);
    for (const cell of ruledOut) board.open[board.index(cell)] = 0;
    for (const queen of queens) board.place(board.index(queen));
    return board;
  }

  clone(): LogicBoard {
    return new LogicBoard(this.layout, this.open.slice(), this.done.slice(), [...this.queens]);
  }

  get solved(): boolean {
    return this.queens.length === this.n;
  }

  index(cell: CellCoord): number {
    return cell.row * this.n + cell.col;
  }

  coord(i: number): CellCoord {
    return { row: Math.floor(i / this.n), col: i % this.n };
  }

  place(i: number): void {
    const { n, units, unitsOf } = this.layout;
    this.queens.push(i);
    for (const u of unitsOf[i]) {
      this.done[u] = 1;
      for (const j of units[u]) this.open[j] = 0;
    }
    const r = Math.floor(i / n);
    const c = i % n;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < n && nc >= 0 && nc < n) this.open[nr * n + nc] = 0;
      }
    }
  }

  ruleOut(cells: number[]): void {
    for (const i of cells) this.open[i] = 0;
  }

  apply(d: Deduction): void {
    if (d.place) {
      this.place(this.index(d.place));
    } else {
      this.ruleOut(d.eliminate.map((c) => this.index(c)));
    }
  }

  isOpen(i: number): boolean {
    return this.open[i] === 1;
  }

  isDone(u: number): boolean {
    return this.done[u] === 1;
  }

  openCells(u: number): number[] {
    return this.layout.units[u].filter((i) => this.open[i]);
  }

  allOpen(): number[] {
    const cells: number[] = [];
    for (let i = 0; i < this.open.length; i++) if (this.open[i]) cells.push(i);
    return cells;
  }

  unitCells(u: number): number[] {
    return this.layout.units[u];
  }

  unitsOf(i: number): number[] {
    return this.layout.unitsOf[i];
  }

  unitCount(): number {
    return this.layout.units.length;
  }

  kind(u: number): UnitKind {
    if (u < this.n) return 'row';
    return u < 2 * this.n ? 'col' : 'region';
  }

  label(u: number): number {
    return u % this.n;
  }

  /** Same row, column or region, or touching. Symmetric. */
  attacks(a: number, b: number): boolean {
    if (a === b) return false;
    const { n, regionOf } = this.layout;
    const ra = Math.floor(a / n);
    const ca = a % n;
    const rb = Math.floor(b / n);
    const cb = b % n;
    return ra === rb || ca === cb || regionOf[a] === regionOf[b] || (Math.abs(ra - rb) <= 1 && Math.abs(ca - cb) <= 1);
  }

  /** First unit that still needs a queen but has no open cells, or -1. */
  emptyUnit(): number {
    for (let u = 0; u < this.layout.units.length; u++) {
      if (!this.done[u] && this.openCells(u).length === 0) return u;
    }
    return -1;
  }

  /** A cell that is the only open cell of some unfinished unit, or -1. */
  forcedCell(): number {
    for (const u of this.unitOrder()) {
      if (this.done[u]) continue;
      const cells = this.openCells(u);
      if (cells.length === 1) return cells[0];
    }
    return -1;
  }

  /** Regions first: they are what players look at. */
  unitOrder(): number[] {
    const n = this.n;
    return [...Array.from({ length: n }, (_, i) => 2 * n + i), ...Array.from({ length: 2 * n }, (_, i) => i)];
  }

  unitName(u: number): string {
    const kind = this.kind(u);
    const i = this.label(u);
    if (kind === 'region') return `the ${REGION_NAMES[i] ?? `color ${i + 1}`} region`;
    return kind === 'row' ? `row ${i + 1}` : `column ${i + 1}`;
  }

  queenOf(u: number): string {
    if (this.kind(u) === 'region') return `the ${REGION_NAMES[this.label(u)]} queen`;
    return `the queen for ${this.unitName(u)}`;
  }

  coords(cells: number[]): CellCoord[] {
    return cells.map((i) => this.coord(i));
  }
}

/** Next human-style deduction, easiest technique first. Null when stuck. */
export function findDeduction(board: LogicBoard): Deduction | null {
  return findSingle(board) ?? findConfinement(board) ?? findSharedReach(board) ?? findDeadEnd(board);
}

/** True when the puzzle can be solved from scratch without guessing. */
export function solveWithLogic(regions: number[][]): boolean {
  const board = LogicBoard.create(regions);
  while (!board.solved) {
    const d = findDeduction(board);
    if (!d) return false;
    board.apply(d);
  }
  return true;
}

/** Explains why a queen that is not in the solution leads nowhere. */
export function explainDeadEnd(regions: number[][], queens: CellCoord[], suspect: CellCoord): { message: string; focus: CellCoord[] } {
  const board = LogicBoard.create(regions, queens);
  const spot = cellName(suspect);
  let empty = board.emptyUnit();
  if (empty >= 0) {
    return {
      message: `With a queen at ${spot}, ${board.unitName(empty)} has no open squares left, but it still needs a queen. Remove it and try another spot.`,
      focus: board.coords(board.unitCells(empty))
    };
  }

  const chain: number[] = [];
  for (let step = 0; step < 6; step++) {
    const forced = board.forcedCell();
    if (forced < 0) break;
    board.place(forced);
    chain.push(forced);
    empty = board.emptyUnit();
    if (empty >= 0) {
      return {
        message: `A queen at ${spot} forces ${listJoin(chain.map((i) => cellName(board.coord(i))))}, and then ${board.unitName(empty)} has nowhere left for its queen. Remove it and try another spot.`,
        focus: [...board.coords(chain), ...board.coords(board.unitCells(empty))]
      };
    }
  }

  return {
    message: `The queen at ${spot} isn't part of the solution. It runs into a dead end a few moves later, so remove it and look for a different spot.`,
    focus: []
  };
}

function findSingle(board: LogicBoard): Deduction | null {
  for (const u of board.unitOrder()) {
    if (board.isDone(u)) continue;
    const cells = board.openCells(u);
    if (cells.length !== 1) continue;
    const spot = board.coord(cells[0]);
    const kind = board.kind(u);
    const message =
      kind === 'region'
        ? `${capitalize(board.unitName(u))} has one square left that isn't ruled out, so its queen goes at ${cellName(spot)}.`
        : `${capitalize(board.unitName(u))} has only one open square left, so its queen goes at ${cellName(spot)}.`;
    return {
      title: 'Only one spot left',
      message,
      place: spot,
      eliminate: [],
      focus: board.coords(board.unitCells(u))
    };
  }
  return null;
}

interface ConfineDirection {
  a: UnitKind;
  b: UnitKind;
}

const CONFINE_DIRECTIONS: ConfineDirection[] = [
  { a: 'region', b: 'row' },
  { a: 'region', b: 'col' },
  { a: 'row', b: 'region' },
  { a: 'col', b: 'region' },
  { a: 'row', b: 'col' },
  { a: 'col', b: 'row' }
];

/**
 * Pigeonhole: if k unfinished units of one kind only have open cells inside
 * k units of another kind, those k units are used up by them.
 */
function findConfinement(board: LogicBoard): Deduction | null {
  let best: { k: number; dir: ConfineDirection; aUnits: number[]; bUnits: number[]; eliminate: number[] } | null = null;

  for (const dir of CONFINE_DIRECTIONS) {
    const aUnits = unitsOfKind(board, dir.a).filter((u) => !board.isDone(u));
    const m = aUnits.length;
    if (m < 2) continue;

    const kindIndex = { row: 0, col: 1, region: 2 } as const;
    const bOf = (i: number) => board.unitsOf(i)[kindIndex[dir.b]];
    const aOf = (i: number) => board.unitsOf(i)[kindIndex[dir.a]];
    const bUnitsAll = unitsOfKind(board, dir.b);
    const bBit = new Map(bUnitsAll.map((u, idx) => [u, idx]));
    const aBit = new Map(aUnits.map((u, idx) => [u, idx]));

    const masks = aUnits.map((u) => board.openCells(u).reduce((acc, i) => acc | (1 << (bBit.get(bOf(i)) ?? 0)), 0));
    const union = new Array<number>(1 << m).fill(0);
    for (let s = 1; s < 1 << m; s++) {
      const low = s & -s;
      union[s] = union[s ^ low] | masks[31 - Math.clz32(low)];
    }

    for (let s = 1; s < (1 << m) - 1; s++) {
      const k = popcount(s);
      if (best && k >= best.k) continue;
      if (popcount(union[s]) !== k) continue;
      const bUnits = bUnitsAll.filter((_, idx) => union[s] & (1 << idx));
      const eliminate = bUnits.flatMap((bu) =>
        board.openCells(bu).filter((i) => {
          const bit = aBit.get(aOf(i));
          return bit === undefined || !(s & (1 << bit));
        })
      );
      if (eliminate.length === 0) continue;
      best = { k, dir, aUnits: aUnits.filter((_, idx) => s & (1 << idx)), bUnits, eliminate };
    }
  }

  if (!best) return null;
  const { k, dir, aUnits, bUnits, eliminate } = best;
  return {
    ...confinementText(board, dir, k, aUnits, bUnits),
    eliminate: board.coords(eliminate),
    focus: board.coords(aUnits.flatMap((u) => board.openCells(u)))
  };
}

function unitsOfKind(board: LogicBoard, kind: UnitKind): number[] {
  const n = board.n;
  const offset = kind === 'row' ? 0 : kind === 'col' ? n : 2 * n;
  return Array.from({ length: n }, (_, i) => offset + i);
}

function groupPhrase(board: LogicBoard, kind: UnitKind, units: number[]): string {
  const labels = units.map((u) => board.label(u));
  if (kind === 'region') {
    const names = labels.map((i) => REGION_NAMES[i] ?? `color ${i + 1}`);
    return `the ${listJoin(names)} region${names.length > 1 ? 's' : ''}`;
  }
  const word = kind === 'row' ? 'row' : 'column';
  return `${word}${labels.length > 1 ? 's' : ''} ${listJoin(labels.map((i) => String(i + 1)))}`;
}

function confinementText(
  board: LogicBoard,
  dir: ConfineDirection,
  k: number,
  aUnits: number[],
  bUnits: number[]
): { title: string; message: string } {
  const a = groupPhrase(board, dir.a, aUnits);
  const b = groupPhrase(board, dir.b, bUnits);
  const count = NUMBER_WORDS[k] ?? String(k);
  const bWord = dir.b === 'row' ? 'rows' : dir.b === 'col' ? 'columns' : 'colors';

  if (dir.a === 'region') {
    if (k === 1) {
      return {
        title: `One color, one ${dir.b === 'row' ? 'row' : 'column'}`,
        message: `Every open square of ${a} is in ${b}. Its queen has to go there, so the rest of ${b} can't hold a queen.`
      };
    }
    return {
      title: `Colors packed into ${bWord}`,
      message: `${capitalize(a)} only fit in ${b}. ${capitalize(count)} colors need ${count} queens from those ${count} ${bWord}, so nothing else there can be a queen.`
    };
  }

  if (dir.b === 'region') {
    if (k === 1) {
      return {
        title: `One ${dir.a === 'row' ? 'row' : 'column'}, one color`,
        message: `All open squares in ${a} belong to ${b}. That queen must sit in ${a}, so the rest of ${b} is ruled out.`
      };
    }
    return {
      title: `${dir.a === 'row' ? 'Rows' : 'Columns'} packed into colors`,
      message: `${capitalize(a)} only have open squares in ${b}. Those ${count} queens come from these lines, so the rest of those colors is ruled out.`
    };
  }

  return {
    title: `${dir.a === 'row' ? 'Rows' : 'Columns'} packed into ${bWord}`,
    message: `${capitalize(a)} can only use ${b}. Those ${count} ${bWord} are spoken for, so their other squares are ruled out.`
  };
}

/** Cells ruled out by every possible queen of some unit. */
function findSharedReach(board: LogicBoard): Deduction | null {
  const units = [...board.unitOrder()]
    .filter((u) => !board.isDone(u))
    .map((u) => ({ u, cells: board.openCells(u) }))
    .filter((x) => x.cells.length > 1)
    .sort((x, y) => x.cells.length - y.cells.length);

  const open = board.allOpen();
  for (const { u, cells } of units) {
    const unitSet = new Set(board.unitCells(u));
    const targets = open.filter((x) => !unitSet.has(x) && cells.every((c) => board.attacks(c, x)));
    if (targets.length === 0) continue;
    const plural = targets.length > 1;
    return {
      title: 'Ruled out either way',
      message: `${capitalize(board.queenOf(u))} has ${NUMBER_WORDS[cells.length] ?? cells.length} possible spots, and ${cells.length === 2 ? 'both' : 'every one'} of them rule${cells.length === 2 ? '' : 's'} out the highlighted square${plural ? 's' : ''}: same row, column or color, or touching. So ${plural ? 'they' : 'it'} can't be a queen.`,
      eliminate: board.coords(targets),
      focus: board.coords(cells)
    };
  }
  return null;
}

/** Suppose a queen; follow forced moves; report a contradiction. */
function findDeadEnd(board: LogicBoard): Deduction | null {
  const tightness = (i: number) => Math.min(...board.unitsOf(i).map((u) => board.openCells(u).length));
  const candidates = board.allOpen().sort((a, b) => tightness(a) - tightness(b));

  for (const x of candidates) {
    const trial = board.clone();
    trial.place(x);
    const chain: number[] = [];
    for (let step = 0; step <= LOOKAHEAD_DEPTH; step++) {
      const empty = trial.emptyUnit();
      if (empty >= 0) {
        const spot = cellName(board.coord(x));
        const forced = chain.length
          ? ` That forces ${listJoin(chain.map((i) => cellName(board.coord(i))))}, and then`
          : ' Then';
        return {
          title: 'Dead end ahead',
          message: `Suppose ${spot} held a queen.${forced} ${board.unitName(empty)} has nowhere left for its queen. So ${spot} is ruled out.`,
          eliminate: [board.coord(x)],
          focus: [...board.coords(chain), ...board.coords(board.unitCells(empty))]
        };
      }
      if (step === LOOKAHEAD_DEPTH) break;
      const next = trial.forcedCell();
      if (next < 0) break;
      trial.place(next);
      chain.push(next);
    }
  }
  return null;
}
