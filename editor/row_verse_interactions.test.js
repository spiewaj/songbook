import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

function startStaticServer() {
  return new Promise((resolve) => {
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.xml': 'text/xml; charset=utf-8',
      '.xslt': 'text/xml; charset=utf-8',
      '.png': 'image/png',
    };
    const server = http.createServer((req, res) => {
      const urlPath = new URL(req.url, 'http://127.0.0.1').pathname;
      const filePath = path.join(ROOT_DIR, urlPath === '/editor/' ? '/editor/index.html' : urlPath);
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain; charset=utf-8' });
      res.end(fs.readFileSync(filePath));
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

function findChromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return 'google-chrome';
}

function launchChrome() {
  return new Promise((resolve, reject) => {
    const userDataDir = `/tmp/chrome-songbook-jest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const chromePath = findChromePath();
    const chrome = spawn(chromePath, [
      '--headless=new',
      '--disable-gpu',
      '--remote-debugging-port=0',
      '--no-first-run',
      '--no-default-browser-check',
      `--user-data-dir=${userDataDir}`,
      'about:blank',
    ]);
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        chrome.kill();
        reject(new Error('Timeout launching Chrome'));
      }
    }, 8000);
    chrome.stderr.on('data', (d) => {
      const m = d.toString().match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (m && !resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve({ chrome, wsUrl: m[1], userDataDir });
      }
    });
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 0;
    this.pending = new Map();
  }
  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) reject(new Error(JSON.stringify(msg.error)));
          else resolve(msg.result);
        }
      };
    });
  }
  send(method, params = {}, sessionId = undefined) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const payload = { id, method, params };
      if (sessionId) payload.sessionId = sessionId;
      this.ws.send(JSON.stringify(payload));
    });
  }
  close() {
    this.ws.close();
  }
}

const sampleXml = `<song xmlns="http://21wdh.staszic.waw.pl" title="Test">
  <lyric>
    <block type="verse">
      <row important_over="true">Pierwszy wers</row>
      <row important_over="false">Drugi wers</row>
    </block>
    <block type="verse">
      <row important_over="false">Trzeci wers</row>
      <row important_over="false">Czwarty wers</row>
    </block>
  </lyric>
</song>`;

const chordXml = `<song xmlns="http://21wdh.staszic.waw.pl" title="Test">
  <lyric>
    <block type="verse">
      <row important_over="true"><ch a="D"/>Herbata stygn<ch a="G"/>ie zapa<ch a="A"/>da mrok</row>
      <row important_over="false"><ch a="h"/>Drugi wers</row>
    </block>
  </lyric>
</song>`;

const bisXml = `<song xmlns="http://21wdh.staszic.waw.pl" title="Test">
  <lyric>
    <block type="verse">
      <row important_over="true">Wers przed bis</row>
      <bis times="2">
        <row important_over="false">Wers w bis 1</row>
        <row important_over="false">Wers w bis 2</row>
      </bis>
      <row important_over="false">Wers po bis</row>
    </block>
  </lyric>
</song>`;

describe('Song editor row and verse boundary interactions', () => {
  let server;
  let port;
  let chrome;
  let userDataDir;
  let cdp;
  let sessionId;

  const evalInPage = async (expr) => {
    const res = await cdp.send(
      'Runtime.evaluate',
      {
        expression: expr,
        returnByValue: true,
        awaitPromise: true,
      },
      sessionId
    );
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.text + ': ' + (res.exceptionDetails.exception?.description || ''));
    }
    return res.result.value;
  };

  const pressKey = async (key, code, keyCode, modifiers = 0, text = undefined) => {
    await cdp.send(
      'Input.dispatchKeyEvent',
      {
        type: text ? 'keyDown' : 'rawKeyDown',
        key,
        code,
        windowsVirtualKeyCode: keyCode,
        nativeVirtualKeyCode: keyCode,
        modifiers,
        text,
      },
      sessionId
    );
    await cdp.send(
      'Input.dispatchKeyEvent',
      {
        type: 'keyUp',
        key,
        code,
        windowsVirtualKeyCode: keyCode,
        nativeVirtualKeyCode: keyCode,
        modifiers,
      },
      sessionId
    );
  };

  const loadSong = async (xml) => {
    await evalInPage(`(() => {
      const ed = document.querySelector('song-editor');
      ed.Load(${JSON.stringify(xml)});
    })()`);
  };

  const getState = async () => {
    return await evalInPage(`(() => {
      const ed = document.querySelector('song-editor');
      const body = ed.body();
      const sel = window.getSelection();
      let selInfo = null;
      if (sel.rangeCount > 0) {
        const r = sel.getRangeAt(0);
        selInfo = {
          collapsed: r.collapsed,
          startNode: r.startContainer.nodeName,
          startText: r.startContainer.nodeValue,
          startOffset: r.startOffset,
          parentTag: r.startContainer.parentNode?.nodeName,
        };
      }
      const verses = [...body.querySelectorAll('song-verse')].map(v => ({
        id: v.id,
        type: v.getAttribute('type'),
        blocknb: v.getAttribute('blocknb'),
        rows: [...v.querySelectorAll('song-row')].map(r => ({
          text: r.textContent,
          html: r.innerHTML,
          parent: r.parentNode?.parentNode?.nodeName
        }))
      }));
      return { verses, selInfo, bodyHtml: body.innerHTML };
    })()`);
  };

  beforeAll(async () => {
    ({ server, port } = await startStaticServer());
    ({ chrome, wsUrl: cdp, userDataDir } = await launchChrome());
    const wsUrl = cdp;
    cdp = new CDPClient(wsUrl);
    await cdp.connect();

    const { targetInfos } = await cdp.send('Target.getTargets');
    const pageTarget = targetInfos.find((t) => t.type === 'page');
    ({ sessionId } = await cdp.send('Target.attachToTarget', {
      targetId: pageTarget.targetId,
      flatten: true,
    }));

    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/editor/` }, sessionId);
    await new Promise((r) => setTimeout(r, 400));
  });

  afterAll(async () => {
    if (cdp) cdp.close();
    if (chrome) {
      await new Promise((resolve) => {
        chrome.once('exit', resolve);
        chrome.kill();
      });
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (userDataDir) fs.rmSync(userDataDir, { recursive: true, force: true });
  });

  test('Backspace at start of Row 2 (offset 1 and offset 0) merges rows cleanly without extra nbsp', async () => {
    for (const startOffset of [1, 0]) {
      await loadSong(sampleXml);
      await evalInPage(`(() => {
        const body = document.querySelector('song-editor').body();
        body.focus();
        const row2 = body.querySelectorAll('song-row')[1];
        const r = document.createRange();
        r.setStart(row2.firstChild, ${startOffset});
        r.collapse(true);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(r);
      })()`);
      await pressKey('Backspace', 'Backspace', 8);
      const state = await getState();
      expect(state.verses.length).toBe(2);
      expect(state.verses[0].rows.length).toBe(1);
      expect(state.verses[0].rows[0].text).toBe('\u00a0Pierwszy\u00a0wersDrugi\u00a0wers');
      expect(state.selInfo.startNode).toBe('#text');
      expect(state.selInfo.startOffset).toBe(14);
    }
  });

  test('Backspace at start of Verse 2 Row 1 joins verses on 1st press and merges rows on 2nd press', async () => {
    await loadSong(sampleXml);
    await evalInPage(`(() => {
      const body = document.querySelector('song-editor').body();
      body.focus();
      const row3 = body.querySelectorAll('song-row')[2];
      const r = document.createRange();
      r.setStart(row3.firstChild, 1);
      r.collapse(true);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(r);
    })()`);

    // 1st Backspace: joins Verse 2 into Verse 1, no empty verse left behind
    await pressKey('Backspace', 'Backspace', 8);
    let state = await getState();
    expect(state.verses.length).toBe(1);
    expect(state.verses[0].rows.map((r) => r.text)).toEqual([
      '\u00a0Pierwszy\u00a0wers',
      '\u00a0Drugi\u00a0wers',
      '\u00a0Trzeci\u00a0wers',
      '\u00a0Czwarty\u00a0wers',
    ]);
    expect(state.selInfo.startNode).toBe('#text');
    expect(state.selInfo.startText).toBe('\u00a0Trzeci\u00a0wers');
    expect(state.selInfo.startOffset).toBe(1);

    // 2nd Backspace: merges Row 3 into Row 2
    await pressKey('Backspace', 'Backspace', 8);
    state = await getState();
    expect(state.verses.length).toBe(1);
    expect(state.verses[0].rows.map((r) => r.text)).toEqual([
      '\u00a0Pierwszy\u00a0wers',
      '\u00a0Drugi\u00a0wersTrzeci\u00a0wers',
      '\u00a0Czwarty\u00a0wers',
    ]);
    expect(state.selInfo.startNode).toBe('#text');
    expect(state.selInfo.startOffset).toBe(11);
  });

  test('Backspace at start of Verse 1 Row 1 preserves leading nbsp', async () => {
    await loadSong(sampleXml);
    await evalInPage(`(() => {
      const body = document.querySelector('song-editor').body();
      body.focus();
      const row1 = body.querySelectorAll('song-row')[0];
      const r = document.createRange();
      r.setStart(row1.firstChild, 1);
      r.collapse(true);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(r);
    })()`);
    await pressKey('Backspace', 'Backspace', 8);
    const state = await getState();
    expect(state.verses[0].rows[0].text).toBe('\u00a0Pierwszy\u00a0wers');
    expect(state.selInfo.startNode).toBe('#text');
    expect(state.selInfo.startOffset).toBe(1);
  });

  test('Backspace right after leading chord in Row 2 merges Row 2 with chord into Row 1', async () => {
    await loadSong(chordXml);
    await evalInPage(`(() => {
      const body = document.querySelector('song-editor').body();
      body.focus();
      const row2 = body.querySelectorAll('song-row')[1];
      const textNode = row2.childNodes[2]; // "Drugi wers" after <song-ch a="h">
      const r = document.createRange();
      r.setStart(textNode, 0);
      r.collapse(true);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(r);
    })()`);
    await pressKey('Backspace', 'Backspace', 8);
    const state = await getState();
    expect(state.verses[0].rows.length).toBe(1);
    expect(state.verses[0].rows[0].html).toBe(
      '&nbsp;<song-ch a="D"></song-ch>Herbata&nbsp;stygn<song-ch a="G"></song-ch>ie&nbsp;zapa<song-ch a="A"></song-ch>da&nbsp;mrok<song-ch a="h"></song-ch>Drugi&nbsp;wers'
    );
    expect(state.selInfo.startNode).toBe('#text');
    expect(state.selInfo.startText).toBe('da\u00a0mrok');
    expect(state.selInfo.startOffset).toBe(7);
  });

  test('Backspace right after inline chord skips chord and deletes preceding character', async () => {
    await loadSong(chordXml);
    await evalInPage(`(() => {
      const body = document.querySelector('song-editor').body();
      body.focus();
      const row1 = body.querySelectorAll('song-row')[0];
      // childNodes: [0]=nbsp, [1]=ch(D), [2]="Herbata stygn", [3]=ch(G), [4]="ie zapa"
      const textAfterG = row1.childNodes[4];
      const r = document.createRange();
      r.setStart(textAfterG, 0);
      r.collapse(true);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(r);
    })()`);
    await pressKey('Backspace', 'Backspace', 8);
    const state = await getState();
    expect(state.verses[0].rows[0].html).toBe(
      '&nbsp;<song-ch a="D"></song-ch>Herbata&nbsp;styg<song-ch a="G"></song-ch>ie&nbsp;zapa<song-ch a="A"></song-ch>da&nbsp;mrok'
    );
    expect(state.selInfo.startText).toBe('Herbata\u00a0styg');
    expect(state.selInfo.startOffset).toBe(12);
  });

  test('Delete (forward) at end of Row 1 merges Row 2 into Row 1', async () => {
    await loadSong(sampleXml);
    await evalInPage(`(() => {
      const body = document.querySelector('song-editor').body();
      body.focus();
      const row1 = body.querySelectorAll('song-row')[0];
      const r = document.createRange();
      r.setStart(row1.firstChild, row1.firstChild.nodeValue.length);
      r.collapse(true);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(r);
    })()`);
    await pressKey('Delete', 'Delete', 46);
    const state = await getState();
    expect(state.verses.length).toBe(2);
    expect(state.verses[0].rows.length).toBe(1);
    expect(state.verses[0].rows[0].text).toBe('\u00a0Pierwszy\u00a0wersDrugi\u00a0wers');
    expect(state.selInfo.startNode).toBe('#text');
    expect(state.selInfo.startOffset).toBe(14);
  });

  test('Delete (forward) at end of Verse 1 joins Verse 2 on 1st press and merges rows on 2nd press', async () => {
    await loadSong(sampleXml);
    await evalInPage(`(() => {
      const body = document.querySelector('song-editor').body();
      body.focus();
      const row2 = body.querySelectorAll('song-row')[1];
      const r = document.createRange();
      r.setStart(row2.firstChild, row2.firstChild.nodeValue.length);
      r.collapse(true);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(r);
    })()`);
    await pressKey('Delete', 'Delete', 46);
    let state = await getState();
    expect(state.verses.length).toBe(1);
    expect(state.verses[0].rows.length).toBe(4);

    await pressKey('Delete', 'Delete', 46);
    state = await getState();
    expect(state.verses.length).toBe(1);
    expect(state.verses[0].rows.map((r) => r.text)).toEqual([
      '\u00a0Pierwszy\u00a0wers',
      '\u00a0Drugi\u00a0wersTrzeci\u00a0wers',
      '\u00a0Czwarty\u00a0wers',
    ]);
  });

  test('Enter at end of Row 1 and typing creates new row without trailing nbsp; Backspace deletes empty row cleanly', async () => {
    await loadSong(sampleXml);
    await evalInPage(`(() => {
      const body = document.querySelector('song-editor').body();
      body.focus();
      const row1 = body.querySelectorAll('song-row')[0];
      const r = document.createRange();
      r.setStart(row1.firstChild, row1.firstChild.nodeValue.length);
      r.collapse(true);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(r);
    })()`);
    await pressKey('Enter', 'Enter', 13, 0, '\r');
    let state = await getState();
    expect(state.verses[0].rows.length).toBe(3);
    expect(state.verses[0].rows[1].text).toBe('\u00a0');
    expect(state.selInfo.startOffset).toBe(1);

    // Backspace immediately removes the empty row without adding trailing nbsp to Row 1
    await pressKey('Backspace', 'Backspace', 8);
    state = await getState();
    expect(state.verses[0].rows.length).toBe(2);
    expect(state.verses[0].rows[0].text).toBe('\u00a0Pierwszy\u00a0wers');
    expect(state.selInfo.startOffset).toBe(14);

    // Press Enter again and type "No"
    await pressKey('Enter', 'Enter', 13, 0, '\r');
    await pressKey('N', 'KeyN', 78, 0, 'N');
    await pressKey('o', 'KeyO', 79, 0, 'o');
    state = await getState();
    expect(state.verses[0].rows[1].text).toBe('\u00a0No');
  });

  test('Double Enter in middle and at end of verse splits verse and places cursor at start of new verse', async () => {
    // Middle of verse
    await loadSong(sampleXml);
    await evalInPage(`(() => {
      const body = document.querySelector('song-editor').body();
      body.focus();
      const row1 = body.querySelectorAll('song-row')[0];
      const r = document.createRange();
      r.setStart(row1.firstChild, row1.firstChild.nodeValue.length);
      r.collapse(true);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(r);
    })()`);
    await pressKey('Enter', 'Enter', 13, 0, '\r');
    await pressKey('Enter', 'Enter', 13, 0, '\r');
    let state = await getState();
    expect(state.verses.length).toBe(3);
    expect(state.verses[0].rows.map((r) => r.text)).toEqual(['\u00a0Pierwszy\u00a0wers']);
    expect(state.verses[1].rows.map((r) => r.text)).toEqual(['\u00a0Drugi\u00a0wers']);
    expect(state.selInfo.startNode).toBe('#text');
    expect(state.selInfo.startText).toBe('\u00a0Drugi\u00a0wers');
    expect(state.selInfo.startOffset).toBe(1);

    // End of verse
    await loadSong(sampleXml);
    await evalInPage(`(() => {
      const body = document.querySelector('song-editor').body();
      body.focus();
      const row2 = body.querySelectorAll('song-row')[1];
      const r = document.createRange();
      r.setStart(row2.firstChild, row2.firstChild.nodeValue.length);
      r.collapse(true);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(r);
    })()`);
    await pressKey('Enter', 'Enter', 13, 0, '\r');
    await pressKey('Enter', 'Enter', 13, 0, '\r');
    state = await getState();
    expect(state.verses.length).toBe(3);
    expect(state.verses[1].rows.map((r) => r.text)).toEqual(['\u00a0']);
    expect(state.selInfo.startNode).toBe('#text');
    expect(state.selInfo.startOffset).toBe(1);

    // Typing into the newly split empty verse works cleanly
    await pressKey('N', 'KeyN', 78, 0, 'N');
    state = await getState();
    expect(state.verses[1].rows[0].text).toBe('\u00a0N');
  });

  test('Selection across rows and across verses merges properly on Backspace and on typing', async () => {
    // Across Row 1 and Row 2 -> Backspace
    await loadSong(sampleXml);
    await evalInPage(`(() => {
      const body = document.querySelector('song-editor').body();
      body.focus();
      const rows = body.querySelectorAll('song-row');
      const r = document.createRange();
      r.setStart(rows[0].firstChild, 9); // " Pierwszy" | " wers"
      r.setEnd(rows[1].firstChild, 6);   // " Drugi" | " wers"
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(r);
    })()`);
    await pressKey('Backspace', 'Backspace', 8);
    let state = await getState();
    expect(state.verses[0].rows.map((r) => r.text)).toEqual(['\u00a0Pierwszy\u00a0wers']);
    expect(state.selInfo.startOffset).toBe(9);

    // Across Verse 1 Row 2 and Verse 2 Row 1 -> type "X"
    await loadSong(sampleXml);
    await evalInPage(`(() => {
      const body = document.querySelector('song-editor').body();
      body.focus();
      const rows = body.querySelectorAll('song-row');
      const r = document.createRange();
      r.setStart(rows[1].firstChild, 6); // " Drugi" | " wers"
      r.setEnd(rows[2].firstChild, 7);   // " Trzeci" | " wers"
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(r);
    })()`);
    await pressKey('X', 'KeyX', 88, 0, 'X');
    state = await getState();
    expect(state.verses.length).toBe(1);
    expect(state.verses[0].rows.map((r) => r.text)).toEqual([
      '\u00a0Pierwszy\u00a0wers',
      '\u00a0DrugiX\u00a0wers',
      '\u00a0Czwarty\u00a0wers',
    ]);
    expect(state.selInfo.startOffset).toBe(7);
  });

  test('ArrowLeft and ArrowRight cross row boundaries in a single keypress', async () => {
    await loadSong(sampleXml);
    await evalInPage(`(() => {
      const body = document.querySelector('song-editor').body();
      body.focus();
      const row2 = body.querySelectorAll('song-row')[1];
      const r = document.createRange();
      r.setStart(row2.firstChild, 1);
      r.collapse(true);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(r);
    })()`);

    // 1st ArrowLeft jumps to end of Row 1
    await pressKey('ArrowLeft', 'ArrowLeft', 37);
    let state = await getState();
    expect(state.selInfo.startText).toBe('\u00a0Pierwszy\u00a0wers');
    expect(state.selInfo.startOffset).toBe(14);

    // 1st ArrowRight jumps back to start (offset 1) of Row 2
    await pressKey('ArrowRight', 'ArrowRight', 39);
    state = await getState();
    expect(state.selInfo.startText).toBe('\u00a0Drugi\u00a0wers');
    expect(state.selInfo.startOffset).toBe(1);
  });

  test('BIS boundary Backspace merges rows cleanly without corrupting <song-bis>', async () => {
    await loadSong(bisXml);
    await evalInPage(`(() => {
      const body = document.querySelector('song-editor').body();
      body.focus();
      const rows = body.querySelectorAll('song-row');
      const r = document.createRange();
      r.setStart(rows[1].firstChild, 1); // first row inside BIS
      r.collapse(true);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(r);
    })()`);
    await pressKey('Backspace', 'Backspace', 8);
    let state = await getState();
    expect(state.verses[0].rows.map((r) => ({ text: r.text, parent: r.parent }))).toEqual([
      { text: '\u00a0Wers\u00a0przed\u00a0bisWers\u00a0w\u00a0bis\u00a01', parent: 'SONG-VERSE' },
      { text: '\u00a0Wers\u00a0w\u00a0bis\u00a02', parent: 'SONG-BIS' },
      { text: '\u00a0Wers\u00a0po\u00a0bis', parent: 'SONG-VERSE' },
    ]);

    await loadSong(bisXml);
    await evalInPage(`(() => {
      const body = document.querySelector('song-editor').body();
      body.focus();
      const rows = body.querySelectorAll('song-row');
      const r = document.createRange();
      r.setStart(rows[3].firstChild, 1); // row right after BIS
      r.collapse(true);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(r);
    })()`);
    await pressKey('Backspace', 'Backspace', 8);
    state = await getState();
    expect(state.verses[0].rows.map((r) => ({ text: r.text, parent: r.parent }))).toEqual([
      { text: '\u00a0Wers\u00a0przed\u00a0bis', parent: 'SONG-VERSE' },
      { text: '\u00a0Wers\u00a0w\u00a0bis\u00a01', parent: 'SONG-BIS' },
      { text: '\u00a0Wers\u00a0w\u00a0bis\u00a02Wers\u00a0po\u00a0bis', parent: 'SONG-BIS' },
    ]);
  });

  test('Chord insertion (`) and completion (Enter / Escape) restores collapsed caret inside row without extra nbsp', async () => {
    await loadSong(sampleXml);
    await evalInPage(`(() => {
      const body = document.querySelector('song-editor').body();
      body.focus();
      const row1 = body.querySelectorAll('song-row')[0];
      const r = document.createRange();
      r.setStart(row1.firstChild, 0); // even at offset 0 before leading nbsp!
      r.collapse(true);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(r);
    })()`);

    // Press backtick to insert chord at row start
    await pressKey('`', 'Backquote', 192, 0, '`');
    await pressKey('a', 'KeyA', 65, 0, 'a');
    await pressKey('Enter', 'Enter', 13, 0, '\r');

    let state = await getState();
    expect(state.verses[0].rows[0].html).toBe('&nbsp;<song-ch a="a" editing="false"></song-ch>Pierwszy&nbsp;wers');
    expect(state.selInfo.collapsed).toBe(true);
    expect(state.selInfo.startNode).toBe('#text');
    expect(state.selInfo.startText).toBe('Pierwszy\u00a0wers');
    expect(state.selInfo.startOffset).toBe(0);

    // Press backtick again immediately after the chord, then Escape to cancel empty chord
    await pressKey('`', 'Backquote', 192, 0, '`');
    await pressKey('Escape', 'Escape', 27);
    state = await getState();
    expect(state.verses[0].rows[0].html).toBe('&nbsp;<song-ch a="a" editing="false"></song-ch>Pierwszy&nbsp;wers');
    expect(state.selInfo.collapsed).toBe(true);
    expect(state.selInfo.startNode).toBe('#text');
    expect(state.selInfo.startText).toBe('Pierwszy\u00a0wers');
    expect(state.selInfo.startOffset).toBe(0);

    // Insert chord at the very end of the row and press Enter: no extra trailing nbsp should be added
    await evalInPage(`(() => {
      const body = document.querySelector('song-editor').body();
      const row1 = body.querySelectorAll('song-row')[0];
      const r = document.createRange();
      r.setStart(row1.lastChild, row1.lastChild.nodeValue.length);
      r.collapse(true);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(r);
    })()`);
    await pressKey('`', 'Backquote', 192, 0, '`');
    await pressKey('G', 'KeyG', 71, 0, 'G');
    await pressKey('Enter', 'Enter', 13, 0, '\r');

    state = await getState();
    expect(state.verses[0].rows[0].html).toBe(
      '&nbsp;<song-ch a="a" editing="false"></song-ch>Pierwszy&nbsp;wers<song-ch a="G" editing="false"></song-ch>'
    );
    expect(state.selInfo.collapsed).toBe(true);
  });

  test('ArrowLeft and ArrowRight work when selection container is SONG-ROW (element-level boundary around chords)', async () => {
    await loadSong(chordXml);
    // Place element-level cursor on SONG-ROW before the first <song-ch a="D"/> (offset 1, after leading nbsp)
    await evalInPage(`(() => {
      const body = document.querySelector('song-editor').body();
      body.focus();
      const row1 = body.querySelectorAll('song-row')[0];
      const r = document.createRange();
      r.setStart(row1, 1);
      r.collapse(true);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(r);
    })()`);

    await pressKey('ArrowRight', 'ArrowRight', 39);
    let state = await getState();
    expect(state.selInfo.startNode).toBe('#text');
    expect(state.selInfo.startText).toBe('Herbata\u00a0stygn');
    expect(state.selInfo.startOffset).toBe(0);

    await pressKey('ArrowLeft', 'ArrowLeft', 37);
    state = await getState();
    expect(state.selInfo.startNode).toBe('#text');
    expect(state.selInfo.startText).toBe('\u00a0');
    expect(state.selInfo.startOffset).toBe(1);
  });
});
