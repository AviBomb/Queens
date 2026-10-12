import { describe, it, expect } from 'vitest';
import { mainScriptOf } from './update.service';

const page = (src: string) => new DOMParser().parseFromString(`<html><body><script src="${src}" type="module"></script></body></html>`, 'text/html');

describe('mainScriptOf', () => {
  it('reads the hashed production bundle name, so a new deploy is detectable', () => {
    expect(mainScriptOf(page('main-FMIVEJV5.js'))).toBe('main-FMIVEJV5.js');
    expect(mainScriptOf(page('main-FMIVEJV5.js'))).not.toBe(mainScriptOf(page('main-Q2W8KD3L.js')));
  });

  it('ignores the unhashed dev server bundle', () => {
    expect(mainScriptOf(page('main.js'))).toBeNull();
  });
});
