// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import htmlSource from '../../index.html?raw';
import introSource from './intro.js?raw';
import { renderIntroHtml } from '../../vite-plugins/introInline';

/**
 * Стартовая заставка (src/intro/intro.js) работает до бандла, поэтому тест гоняет
 * настоящий инлайн-скрипт из собранного index.html в jsdom: canvas подменён
 * заглушкой, кадры прокручиваются вручную через requestAnimationFrame.
 */

const SCRIPT = (() => {
  const html = renderIntroHtml(htmlSource, introSource);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const script = [...doc.querySelectorAll('script:not([src])')]
    .map((s) => s.textContent ?? '')
    .find((s) => s.includes("root.classList.add('bc-intro')"));
  if (!script) throw new Error('в index.html нет инлайн-скрипта заставки');
  return script;
})();

type Posted = { type: string; data: Record<string, unknown> };

let rafQueue: FrameRequestCallback[] = [];
let now = 0;
let posted: Posted[] = [];

function fakeContext(): CanvasRenderingContext2D {
  const target: Record<string | symbol, unknown> = {
    measureText: (s: string) => ({
      width: s.length * 55,
      actualBoundingBoxAscent: s === 'i' ? 72 : 50,
    }),
  };
  return new Proxy(target, {
    get: (t, k) => (k in t ? t[k] : () => {}),
    set: (t, k, v) => {
      t[k] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

function enterTelegram(): void {
  (window as unknown as Record<string, unknown>).TelegramWebviewProxy = {
    postEvent: (type: string, data: string) => posted.push({ type, data: JSON.parse(data) }),
  };
  history.replaceState(null, '', '/#tgWebAppData=x&tgWebAppVersion=8.0');
}

async function run(): Promise<void> {
  new Function(SCRIPT)();
  // шрифтов в jsdom нет — start() уходит в микрозадачу
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/** Прокручивает кадры по 16 мс; возвращает, сколько секунд прошло до конца заставки. */
function frames(seconds: number): number {
  const startAt = now;
  while (now - startAt < seconds * 1000 && rafQueue.length) {
    const queue = rafQueue;
    rafQueue = [];
    now += 16;
    for (const cb of queue) cb(now);
  }
  return (now - startAt) / 1000;
}

function overlay(): Element | null {
  return document.getElementById('bc-intro');
}

function renderApp(withNav: boolean): void {
  const app = document.getElementById('root') as HTMLElement;
  app.innerHTML = withNav
    ? '<nav><a href="/" data-intro-nav aria-current="page"><svg></svg>Главная</a><a href="/balance" data-intro-nav>Баланс</a></nav>'
    : '<main>Вход</main>';
  const rect = {
    left: 100,
    top: 700,
    width: 60,
    height: 50,
    right: 160,
    bottom: 750,
    x: 100,
    y: 700,
  };
  for (const el of app.querySelectorAll('[data-intro-nav], svg')) {
    el.getBoundingClientRect = () => ({ ...rect, toJSON: () => rect }) as DOMRect;
  }
}

beforeEach(() => {
  rafQueue = [];
  now = 1000;
  posted = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafQueue.push(cb);
    return rafQueue.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => fakeContext() as never,
  );
  document.body.innerHTML = '<div id="root"></div>';
  document.documentElement.className = '';
  document.documentElement.removeAttribute('data-intro');
  localStorage.clear();
  sessionStorage.clear();
  history.replaceState(null, '', '/');
});

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).TelegramWebviewProxy;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('стартовая заставка', () => {
  it('в Telegram: разворачивает окно, красит шапку под заставку и сразу шлёт web_app_ready', async () => {
    enterTelegram();
    await run();
    const types = posted.map((p) => p.type);
    expect(types.slice(0, 5)).toEqual([
      'web_app_expand',
      'web_app_set_header_color',
      'web_app_set_background_color',
      'web_app_set_bottom_bar_color',
      'web_app_ready',
    ]);
    expect(posted[1].data).toEqual({ color: '#06070c' });
    expect(types.filter((t) => t === 'web_app_ready')).toHaveLength(1);
    expect(overlay()).not.toBeNull();
  });

  it('цвета, которые SDK ставит во время заставки, придерживаются и отдаются в конце', async () => {
    enterTelegram();
    localStorage.setItem('bc-intro-full-seen', '1');
    renderApp(true);
    const order: string[] = [];
    document.addEventListener('intro:done', () => order.push('intro:done'), { once: true });
    await run();
    const proxy = (
      window as unknown as { TelegramWebviewProxy: { postEvent: (t: string, d: string) => void } }
    ).TelegramWebviewProxy;
    // так SDK при mountMiniApp красит шапку и нижнюю панель в цвета Telegram
    proxy.postEvent('web_app_set_header_color', JSON.stringify({ color_key: 'bg_color' }));
    proxy.postEvent('web_app_set_bottom_bar_color', JSON.stringify({ color: '#ffffff' }));
    proxy.postEvent('web_app_request_theme', '""');
    expect(posted.filter((p) => p.data.color_key === 'bg_color')).toHaveLength(0);
    expect(posted.some((p) => p.type === 'web_app_request_theme')).toBe(true);

    const before = posted.length;
    frames(4);
    expect(overlay()).toBeNull();
    const released = posted.slice(before).filter((p) => p.type.startsWith('web_app_set_'));
    expect(released.map((p) => p.data)).toEqual([{ color_key: 'bg_color' }, { color: '#ffffff' }]);
    expect(order).toEqual(['intro:done']);
    // после заставки — снова напрямую
    (
      window as unknown as { TelegramWebviewProxy: { postEvent: (t: string, d: string) => void } }
    ).TelegramWebviewProxy.postEvent(
      'web_app_set_header_color',
      JSON.stringify({ color: '#111111' }),
    );
    expect(posted[posted.length - 1].data).toEqual({ color: '#111111' });
  });

  it('первый запуск — полная, следующие — короткая', async () => {
    enterTelegram();
    await run();
    expect(document.documentElement.getAttribute('data-intro')).toBe('full');
    document.body.innerHTML = '<div id="root"></div>';
    await run();
    expect(document.documentElement.getAttribute('data-intro')).toBe('short');
  });

  it('ждёт отрисовки приложения, садится в пункт, вибрирует и убирает себя', async () => {
    enterTelegram();
    localStorage.setItem('bc-intro-full-seen', '1');
    const done = vi.fn();
    document.addEventListener('intro:done', done);
    await run();

    frames(3); // короткая длится ~2.3 с, но приложения ещё нет — ждём
    expect(overlay()).not.toBeNull();
    expect(done).not.toHaveBeenCalled();

    renderApp(true);
    frames(3);
    expect(overlay()).toBeNull();
    expect(document.getElementById('bc-intro-skip')).toBeNull();
    expect(document.documentElement.classList.contains('bc-intro')).toBe(false);
    expect(done).toHaveBeenCalledTimes(1);

    const haptics = posted.filter((p) => p.type === 'web_app_trigger_haptic_feedback');
    expect(haptics.map((p) => p.data.type)).toEqual(['impact', 'notification']);
    expect(haptics[1].data).toEqual({ type: 'notification', notification_type: 'success' });
    document.removeEventListener('intro:done', done);
  });

  it('полная: вибрация на каждом ключевом моменте, в конце — success', async () => {
    enterTelegram();
    renderApp(true);
    await run();
    frames(12);
    expect(overlay()).toBeNull();
    const haptics = posted.filter((p) => p.type === 'web_app_trigger_haptic_feedback');
    expect(haptics).toHaveLength(7);
    expect(haptics[haptics.length - 1].data.notification_type).toBe('success');
  });

  it('приложение так и не отрисовалось — через 8 с заставка всё равно уходит', async () => {
    enterTelegram();
    localStorage.setItem('bc-intro-full-seen', '1');
    await run();
    const took = frames(20);
    expect(overlay()).toBeNull();
    expect(took).toBeGreaterThan(8);
    expect(took).toBeLessThan(12);
  });

  it('пункта навигации нет (вход) — точка просто садится, заставка исчезает', async () => {
    enterTelegram();
    localStorage.setItem('bc-intro-full-seen', '1');
    renderApp(false);
    await run();
    frames(4);
    expect(overlay()).toBeNull();
  });

  it('«Пропустить» сразу ведёт к раскрытию приложения', async () => {
    enterTelegram();
    renderApp(true);
    await run();
    frames(0.5);
    (document.getElementById('bc-intro-skip') as HTMLButtonElement).click();
    expect(document.getElementById('bc-intro-skip')).toBeNull();
    const took = frames(5);
    expect(overlay()).toBeNull();
    expect(took).toBeLessThan(1.6);
  });

  it('по ссылке со startapp — без заставки', async () => {
    enterTelegram();
    history.replaceState(null, '', '/#tgWebAppData=x&tgWebAppStartParam=renew');
    await run();
    expect(overlay()).toBeNull();
    expect(posted).toHaveLength(0);
  });

  it.each(['/balance/top-up/result', '/auth/telegram/callback', '/buy/success/abc', '/privacy'])(
    'на странице возврата %s — без заставки',
    async (path) => {
      history.replaceState(null, '', path);
      await run();
      expect(overlay()).toBeNull();
    },
  );

  it('при «уменьшении движения» — без заставки', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce') }));
    await run();
    expect(overlay()).toBeNull();
  });

  it('в браузере — раз за сессию вкладки', async () => {
    await run();
    expect(overlay()).not.toBeNull();
    document.body.innerHTML = '<div id="root"></div>';
    await run();
    expect(overlay()).toBeNull();
  });

  it('без canvas — приложение открывается как обычно', async () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockImplementation(() => null);
    await run();
    expect(overlay()).toBeNull();
    expect(document.documentElement.classList.contains('bc-intro')).toBe(false);
  });

  it('?intro=short:t:1 — замирает на кадре и даёт двигать его', async () => {
    history.replaceState(null, '', '/?intro=short:t:1');
    await run();
    expect(document.documentElement.getAttribute('data-intro')).toBe('short');
    const seek = (window as unknown as { __introSeek?: (t: number) => void }).__introSeek;
    expect(typeof seek).toBe('function');
    for (let t = 0; t <= 2.4; t += 0.05) expect(() => seek?.(t)).not.toThrow();
  });

  it('все кадры полной заставки рисуются без исключений', async () => {
    history.replaceState(null, '', '/?intro=full:t:0');
    renderApp(true);
    await run();
    const seek = (window as unknown as { __introSeek?: (t: number) => void }).__introSeek;
    for (let t = 0; t <= 8.4; t += 1 / 60) expect(() => seek?.(t)).not.toThrow();
  });
});
