import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Mobile swipe gestures on song pages', () => {
    let listeners = {};
    let currentPathname = '/songs_html/bieszczadzki_trakt.html';
    let navigatedUrl = null;
    let historyBacked = false;

    beforeEach(() => {
        listeners = {};
        navigatedUrl = null;
        historyBacked = false;
        currentPathname = '/songs_html/bieszczadzki_trakt.html';

        global.document = {
            readyState: 'complete',
            documentElement: {
                setAttribute: () => {},
                getAttribute: () => 'light',
            },
            body: {
                classList: {
                    contains: (cls) => cls === 'song'
                },
                appendChild: () => {},
                style: {}
            },
            addEventListener: (event, handler, options) => {
                listeners[event] = listeners[event] || [];
                listeners[event].push(handler);
            },
            querySelector: (selector) => {
                if (selector.includes('a.nav-return')) {
                    return {
                        getAttribute: (attr) => (attr === 'href' ? '/#21wdw-2023' : null),
                        textContent: 'Powrót do śpiewnika',
                        innerHTML: '',
                        classList: { contains: (c) => c === 'nav-return' }
                    };
                }
                if (selector.includes('.song')) return global.document.body;
                return null;
            },
            querySelectorAll: () => [],
            createElement: (tag) => ({
                setAttribute: () => {},
                appendChild: () => {},
                classList: { add: () => {}, remove: () => {} },
                style: {},
                innerHTML: ''
            })
        };

        global.window = {
            location: {
                pathname: currentPathname,
                origin: 'https://spiewaj.com',
                search: '',
                hash: '',
                set href(val) { navigatedUrl = val; },
                get href() { return navigatedUrl || 'https://spiewaj.com' + currentPathname; }
            },
            history: {
                length: 2,
                back: () => { historyBacked = true; }
            },
            getSelection: () => ({ isCollapsed: true }),
            addEventListener: (event, handler) => {
                listeners[event] = listeners[event] || [];
                listeners[event].push(handler);
            }
        };

        global.localStorage = { getItem: () => null, setItem: () => {} };
        global.sessionStorage = { getItem: () => null, setItem: () => {} };
        global.navigator = { vibrate: () => true };

        const commonJsPath = path.resolve(__dirname, '../src/html/templates/common.js');
        const code = fs.readFileSync(commonJsPath, 'utf8');
        eval(code);
    });

    function simulateSwipe(startX, startY, endX, endY, duration = 200, touchesCount = 1) {
        navigatedUrl = null;
        historyBacked = false;

        const startTouches = Array(touchesCount).fill(0).map(() => ({ clientX: startX, clientY: startY }));
        (listeners['touchstart'] || []).forEach(fn => fn({
            touches: startTouches,
            target: { closest: () => null }
        }));

        const moveTouches = Array(touchesCount).fill(0).map(() => ({ clientX: endX, clientY: endY }));
        (listeners['touchmove'] || []).forEach(fn => fn({
            touches: moveTouches,
            target: { closest: () => null }
        }));

        const origNow = Date.now;
        Date.now = () => origNow() + duration;

        (listeners['touchend'] || []).forEach(fn => fn({
            changedTouches: [{ clientX: endX, clientY: endY }],
            target: { closest: () => null }
        }));

        Date.now = origNow;
    }

    test('Swipe left triggers history.back() when referrer is from same origin', () => {
        global.document.referrer = 'https://spiewaj.com/#21wdw-2023';
        simulateSwipe(300, 200, 150, 210, 200);
        expect(historyBacked).toBe(true);
    });

    test('Swipe left navigates to return link target on direct visit without referrer', async () => {
        global.document.referrer = '';
        simulateSwipe(300, 200, 150, 205, 200);
        await new Promise(r => setTimeout(r, 120));
        expect(navigatedUrl).toBe('/#21wdw-2023');
    });

    test('Swipe right (starting inside page) triggers return navigation', async () => {
        global.document.referrer = '';
        simulateSwipe(80, 200, 220, 205, 200);
        await new Promise(r => setTimeout(r, 120));
        expect(navigatedUrl).toBe('/#21wdw-2023');
    });

    test('Vertical scroll (up/down) does NOT trigger navigation', () => {
        global.document.referrer = 'https://spiewaj.com/#21wdw-2023';
        simulateSwipe(200, 150, 195, 350, 250);
        expect(historyBacked).toBe(false);
        expect(navigatedUrl).toBeNull();
    });

    test('Small jitter / tap does NOT trigger navigation', () => {
        global.document.referrer = 'https://spiewaj.com/#21wdw-2023';
        simulateSwipe(200, 200, 215, 205, 100);
        expect(historyBacked).toBe(false);
        expect(navigatedUrl).toBeNull();
    });

    test('Pinch-to-zoom (multi-touch) does NOT trigger navigation', () => {
        global.document.referrer = 'https://spiewaj.com/#21wdw-2023';
        simulateSwipe(200, 200, 100, 200, 200, 2);
        expect(historyBacked).toBe(false);
        expect(navigatedUrl).toBeNull();
    });

    test('Slow drag exceeding 600ms does NOT trigger navigation', () => {
        global.document.referrer = 'https://spiewaj.com/#21wdw-2023';
        simulateSwipe(300, 200, 150, 200, 750);
        expect(historyBacked).toBe(false);
        expect(navigatedUrl).toBeNull();
    });
});
