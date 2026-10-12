import { Component, HostListener, OnInit, effect, inject, signal, untracked } from '@angular/core';
import { GameEngineService } from './core/services/game-engine.service';
import { Toast, UiService } from './core/services/ui.service';
import { UpdateService } from './core/services/update.service';
import { HeaderComponent } from './features/header/header.component';
import { BoardComponent } from './features/board/board.component';
import { ToolbarComponent } from './features/toolbar/toolbar.component';
import { HomeComponent } from './features/home/home.component';
import { DemoComponent } from './features/demo/demo.component';
import { StreakCalendarComponent } from './features/streak-calendar/streak-calendar.component';
import { VictoryModalComponent } from './features/modals/victory-modal.component';
import { HowToPlayModalComponent } from './features/modals/how-to-play-modal.component';
import { StatsModalComponent } from './features/modals/stats-modal.component';
import { IconComponent } from './shared/icon.component';
import { SheetComponent } from './shared/sheet.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    IconComponent,
    SheetComponent,
    HeaderComponent,
    BoardComponent,
    ToolbarComponent,
    HomeComponent,
    DemoComponent,
    StreakCalendarComponent,
    VictoryModalComponent,
    HowToPlayModalComponent,
    StatsModalComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  readonly game = inject(GameEngineService);
  readonly ui = inject(UiService);
  private readonly updates = inject(UpdateService);

  readonly showVictory = signal<boolean>(false);
  private readonly pageActive = signal<boolean>(true);

  constructor() {
    effect(() => {
      if (this.game.winCount() > 0) untracked(() => this.showVictory.set(true));
    });

    // The clock only runs while a board is on screen, nothing covers it, and the player is here.
    effect(() => {
      this.game.puzzle();
      const paused = !this.pageActive() || this.ui.overlayCount() > 0 || this.ui.screen() === 'home';
      untracked(() => this.game.setTimerPaused(paused));
    });

    effect(() => {
      if (!this.game.hintNudge() || this.ui.screen() !== 'game') return;
      untracked(() => {
        if (!window.matchMedia('(max-width: 767px)').matches) return;
        this.ui.showToast('Stuck? Try a hint', { label: 'Hint', run: () => this.game.requestHint() });
      });
    });

    // A new version reloads right away on the home screen; mid-game it waits for a tap or the next time the app is hidden.
    effect(() => {
      if (!this.updates.updateReady()) return;
      untracked(() => {
        if (this.ui.screen() === 'home' || document.hidden) {
          this.applyUpdate();
        } else {
          this.ui.showToast('A new version is ready', { label: 'Update', run: () => this.applyUpdate() }, 15_000);
        }
      });
    });
  }

  ngOnInit(): void {
    history.replaceState({ screen: 'home' }, '');
    this.syncPresence();
    this.updates.start();
  }

  @HostListener('document:visibilitychange')
  @HostListener('window:blur')
  @HostListener('window:focus')
  syncPresence(): void {
    this.pageActive.set(!document.hidden && document.hasFocus());
    if (document.hidden && this.updates.updateReady()) this.applyUpdate();
  }

  /** Progress is saved first; the unfinished board and its time are waiting on the home screen after the reload. */
  private applyUpdate(): void {
    this.game.setTimerPaused(true);
    location.reload();
  }

  @HostListener('window:popstate', ['$event'])
  onPopState(event: PopStateEvent): void {
    const wantsGame = (event.state as { screen?: string } | null)?.screen === 'game' && !!this.game.puzzle();
    this.ui.screen.set(wantsGame ? 'game' : 'home');
    if (!wantsGame) this.showVictory.set(false);
  }

  runToastAction(toast: Toast): void {
    toast.action?.run();
    this.ui.dismissToast();
  }

  playDailyFromDemo(): void {
    this.ui.showDemo.set(false);
    this.game.openDaily();
    this.ui.enterGame();
  }
}
