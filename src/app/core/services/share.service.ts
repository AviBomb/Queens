import { Injectable } from '@angular/core';

export interface ShareCardInput {
  /** e.g. "Today's daily" or "7×7 puzzle". */
  headline: string;
  time: string;
  /** e.g. "6 day streak" or "New best time". */
  detail: string;
}

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

const W = 1080;
const H = 1350;
const CROWN =
  'M11.56 3.27a.5.5 0 0 1 .88 0l2.95 5.6a1 1 0 0 0 1.52.3l4.27-3.67a.5.5 0 0 1 .8.52l-2.83 10.25a1 1 0 0 1-.96.73H5.81a1 1 0 0 1-.96-.73L2.02 6.02a.5.5 0 0 1 .8-.52l4.27 3.67a1 1 0 0 0 1.52-.3z';

/**
 * Builds a branded result card and hands it to the native share sheet.
 * The card carries the app mark, time and an invite, never the board, so it spoils nothing.
 */
@Injectable({
  providedIn: 'root'
})
export class ShareService {
  get appUrl(): string {
    return typeof location === 'undefined' ? '' : `${location.origin}${location.pathname}`;
  }

  /** Renders the card. Returns null where canvas is unavailable. */
  renderCard(input: ShareCardInput): HTMLCanvasElement | null {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const css = getComputedStyle(document.documentElement);
    const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
    const sans = "'Geist', system-ui, sans-serif";
    const mono = "'Geist Mono', ui-monospace, monospace";
    const text = v('--text', '#18181b');
    const muted = v('--muted', '#6b6b74');

    ctx.fillStyle = v('--bg', '#f4f4f5');
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = v('--surface', '#ffffff');
    this.roundRect(ctx, 60, 60, W - 120, H - 120, 56);
    ctx.fill();

    this.drawMark(ctx, W / 2 - 150, 170, 300, v);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = text;
    ctx.font = `700 76px ${sans}`;
    ctx.fillText('Queens', W / 2, 590);

    ctx.fillStyle = muted;
    ctx.font = `500 40px ${sans}`;
    ctx.fillText(`${input.headline}, solved in`, W / 2, 690);

    ctx.fillStyle = text;
    ctx.font = `700 190px ${mono}`;
    ctx.fillText(input.time, W / 2, 890);

    ctx.fillStyle = v('--accent-strong', '#b45309');
    ctx.font = `600 42px ${sans}`;
    ctx.fillText(input.detail, W / 2, 980);

    ctx.fillStyle = text;
    ctx.font = `650 44px ${sans}`;
    ctx.fillText('Can you beat it?', W / 2, 1140);
    ctx.fillStyle = muted;
    ctx.font = `500 32px ${sans}`;
    ctx.fillText(this.appUrl.replace(/^https?:\/\//, '').replace(/\/$/, ''), W / 2, 1200);

    return canvas;
  }

  toFile(canvas: HTMLCanvasElement): Promise<File | null> {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob ? new File([blob], 'queens-result.png', { type: 'image/png' }) : null), 'image/png');
    });
  }

  /**
   * Native share sheet with the card where the device supports files, then plain text, then the clipboard.
   * Call it straight from a tap: Safari only opens the share sheet inside a user gesture.
   */
  async share(text: string, file: File | null): Promise<ShareOutcome> {
    const url = this.appUrl;
    try {
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Queens', text: `${text}\n${url}` });
        return 'shared';
      }
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: 'Queens', text, url });
        return 'shared';
      }
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      return 'copied';
    } catch {
      return 'failed';
    }
  }

  /** The app icon: a 2x2 grid of region colours with the gold crown. */
  private drawMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, v: (n: string, f: string) => string): void {
    const ink = v('--board-divider', '#18181b');
    ctx.fillStyle = ink;
    this.roundRect(ctx, x, y, size, size, size * 0.22);
    ctx.fill();

    const inset = size * 0.11;
    const inner = size - inset * 2;
    const half = inner / 2;
    ctx.save();
    this.roundRect(ctx, x + inset, y + inset, inner, inner, size * 0.12);
    ctx.clip();
    const colors = [v('--region-0', '#86efac'), v('--region-2', '#93c5fd'), v('--region-3', '#fca5a5'), v('--region-4', '#d8b4fe')];
    colors.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.fillRect(x + inset + (i % 2) * half, y + inset + Math.floor(i / 2) * half, half, half);
    });
    ctx.restore();
    ctx.strokeStyle = ink;
    ctx.lineWidth = size * 0.028;
    ctx.beginPath();
    ctx.moveTo(x + size / 2, y + inset);
    ctx.lineTo(x + size / 2, y + size - inset);
    ctx.moveTo(x + inset, y + size / 2);
    ctx.lineTo(x + size - inset, y + size / 2);
    ctx.stroke();

    const scale = (size * 0.6) / 20;
    ctx.save();
    ctx.translate(x + size / 2 - 12 * scale, y + size / 2 - 11 * scale);
    ctx.scale(scale, scale);
    const crown = new Path2D(CROWN);
    ctx.fillStyle = '#f59e0b';
    ctx.fill(crown);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#78350f';
    ctx.stroke(crown);
    ctx.restore();
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
