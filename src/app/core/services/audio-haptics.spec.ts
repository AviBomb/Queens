import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { AudioHapticsService } from './audio-haptics.service';

describe('AudioHapticsService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [AudioHapticsService] });
  });

  it('gives the audio session back when sound and music are off', () => {
    localStorage.setItem('queens_sound', 'false');
    localStorage.setItem('queens_music', 'false');
    const session = { type: 'playback' };
    Object.defineProperty(navigator, 'audioSession', { configurable: true, value: session });

    const audio = TestBed.inject(AudioHapticsService);
    audio.unlock();

    expect(session.type).toBe('ambient');
  });
});
