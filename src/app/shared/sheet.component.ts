import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  inject,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';
import { UiService } from '../core/services/ui.service';

/** Drag distance or flick speed (px/ms) that closes a bottom sheet. */
const CLOSE_DISTANCE = 96;
const CLOSE_VELOCITY = 0.6;
const CLOSE_MS = 220;

/**
 * Bottom sheet on phones, centred dialog from 640px. Counts as an open overlay
 * (pauses the timer) and closes on Escape, a backdrop tap, or a downward swipe on phones.
 */
@Component({
  selector: 'app-sheet',
  standalone: true,
  template: `
    <div class="sheet-backdrop" [class.is-closing]="closing()" (click)="dismiss()">
      <div
        #panel
        class="sheet {{ panelClass() }}"
        [class.is-dragging]="dragOffset() > 0 && !closing()"
        [style.transform]="dragOffset() > 0 && !closing() ? 'translateY(' + dragOffset() + 'px)' : null"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="labelledBy()"
        (click)="$event.stopPropagation()"
      >
        <div class="sheet-grabber" aria-hidden="true"></div>
        <ng-content />
      </div>
    </div>
  `
})
export class SheetComponent implements AfterViewInit, OnDestroy {
  private readonly ui = inject(UiService);

  readonly labelledBy = input<string>();
  readonly panelClass = input('');
  readonly closed = output<void>();

  readonly dragOffset = signal(0);
  readonly closing = signal(false);

  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');
  private startY = 0;
  private startTime = 0;
  private fromHandle = false;
  private tracking = false;
  private dragging = false;

  constructor() {
    this.ui.openOverlay();
  }

  ngAfterViewInit(): void {
    const el = this.panel().nativeElement;
    el.addEventListener('touchstart', this.onTouchStart, { passive: true });
    el.addEventListener('touchmove', this.onTouchMove, { passive: false });
    el.addEventListener('touchend', this.onTouchEnd);
    el.addEventListener('touchcancel', this.onTouchEnd);
  }

  ngOnDestroy(): void {
    const el = this.panel().nativeElement;
    el.removeEventListener('touchstart', this.onTouchStart);
    el.removeEventListener('touchmove', this.onTouchMove);
    el.removeEventListener('touchend', this.onTouchEnd);
    el.removeEventListener('touchcancel', this.onTouchEnd);
    this.ui.closeOverlay();
  }

  @HostListener('document:keydown.escape')
  dismiss(): void {
    if (this.closing()) return;
    this.closing.set(true);
    setTimeout(() => this.closed.emit(), CLOSE_MS);
  }

  private isBottomSheet(): boolean {
    return typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches;
  }

  private readonly onTouchStart = (e: TouchEvent): void => {
    if (!this.isBottomSheet() || e.touches.length !== 1 || this.closing()) return;
    const target = e.target as Element | null;
    this.fromHandle = !!target?.closest('.sheet-grabber, .sheet-head, [data-sheet-handle]');
    this.tracking = this.fromHandle || this.panel().nativeElement.scrollTop <= 0;
    this.dragging = false;
    this.startY = e.touches[0].clientY;
    this.startTime = performance.now();
  };

  private readonly onTouchMove = (e: TouchEvent): void => {
    if (!this.tracking) return;
    const dy = e.touches[0].clientY - this.startY;
    if (!this.dragging) {
      if (dy < -8 || (!this.fromHandle && this.panel().nativeElement.scrollTop > 0)) {
        this.tracking = false;
        return;
      }
      if (dy < 8) return;
      this.dragging = true;
    }
    e.preventDefault();
    this.dragOffset.set(Math.max(0, dy));
  };

  private readonly onTouchEnd = (): void => {
    if (!this.dragging) {
      this.tracking = false;
      return;
    }
    const distance = this.dragOffset();
    const velocity = distance / Math.max(1, performance.now() - this.startTime);
    this.tracking = false;
    this.dragging = false;
    if (distance > CLOSE_DISTANCE || velocity > CLOSE_VELOCITY) {
      this.dismiss();
    } else {
      this.dragOffset.set(0);
    }
  };
}
