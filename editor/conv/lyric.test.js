import { JSDOM}  from 'jsdom';
import { interpretationContent2lyric } from './conv.js';

function ic2l(html) {
    const dom = new JSDOM();
    let parser = new dom.window.DOMParser();
    let docHtml = parser.parseFromString(html, 'text/html');
    let docXml = dom.window.document.implementation.createDocument('http://21wdh.staszic.waw.pl', '', null);
    interpretationContent2lyric(docHtml, docXml)
    return new dom.window.XMLSerializer().serializeToString(docXml);
}

describe('interpretationContent2lyric tests', () => {

    test('simple', () => {
        const html = `
<div class="interpretation-content">
  <span class='annotated-lyrics'><code  class='an' data-chord='E' data-suffix='m' data-local='e'>e</code>Pod górkę m<code  class='an' data-chord='G' data-suffix='' data-local='G'>G</code>am</span><br>
  <span class='annotated-lyrics'>Ale <code  class='an' data-chord='C' data-suffix='' data-local='C'>C</code>na to się pis<code  class='an' data-chord='A' data-suffix='m' data-local='a'>a</code>ałam, tak czy siak</span><br>
  <br/>
  <span class='annotated-lyrics'>Czy na m<code  class='an' data-chord='C' data-suffix='' data-local='C'>C</code>oje łzy ja z<code  class='an' data-chord='A' data-suffix='m' data-local='a'>a</code>najdę jeszcze c<code  class='an' data-chord='E' data-suffix='m' data-local='e'>e</code>zas?&nbsp;&nbsp;&nbsp;&nbsp;<code  class='an' data-chord='G' data-suffix='' data-local='G'>G</code>&nbsp;</span><br>
  <span class='annotated-lyrics'>Czy na ł<code  class='an' data-chord='C' data-suffix='' data-local='C'>C</code>zy ja znajdę c<code  class='an' data-chord='A' data-suffix='m' data-local='a'>a</code>zas?</span><br>
</div>`;
        const expectedXml = `<lyric xmlns="http://21wdh.staszic.waw.pl">
  <block type="verse">
      <row important_over="false"><ch a="e"/>Pod górkę m<ch a="G"/>am</row>
      <row important_over="false">Ale <ch a="C"/>na to się pis<ch a="a"/>ałam, tak czy siak</row></block>
  <block type="verse">
      <row important_over="false">Czy na m<ch a="C"/>oje łzy ja z<ch a="a"/>najdę jeszcze c<ch a="e"/>zas? <ch a="G"/> </row>
      <row important_over="false">Czy na ł<ch a="C"/>zy ja znajdę c<ch a="a"/>zas?</row></block></lyric>
`.trim();
        expect(ic2l(html).trim()).toBe(expectedXml);
    });

    test('szampan', () => {
        const html = `<div class="interpretation-content"><code  data-chord='E' data-suffix='m' data-local='e'>e</code> <code  data-chord='G' data-suffix='' data-local='G'>G</code> <code  data-chord='C' data-suffix='' data-local='C'>C</code> <code  data-chord='A' data-suffix='m' data-local='a'>a</code><br>
<br>
<span class='annotated-lyrics'><code  class='an' data-chord='E' data-suffix='m' data-local='e'>e</code>Pod górkę m<code  class='an' data-chord='G' data-suffix='' data-local='G'>G</code>am</span><br>
<span class='annotated-lyrics'>Ale <code  class='an' data-chord='C' data-suffix='' data-local='C'>C</code>na to się pis<code  class='an' data-chord='A' data-suffix='m' data-local='a'>a</code>ałam, tak czy siak</span><br>
<span class='annotated-lyrics'><code  class='an' data-chord='E' data-suffix='m' data-local='e'>e</code>Do biegu, st<code  class='an' data-chord='G' data-suffix='' data-local='G'>G</code>art</span><br>
<span class='annotated-lyrics'>Sama dr<code  class='an' data-chord='C' data-suffix='' data-local='C'>C</code>ogę tę wyb<code  class='an' data-chord='A' data-suffix='m' data-local='a'>a</code>rałam, chciałam t<code  class='an' data-chord='E' data-suffix='m' data-local='e'>e</code>ak&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<code  class='an' data-chord='G' data-suffix='' data-local='G'>G</code>&nbsp;</span><br>
<br>
<span class='annotated-lyrics'>Czy na m<code  class='an' data-chord='C' data-suffix='' data-local='C'>C</code>oje łzy ja z<code  class='an' data-chord='A' data-suffix='m' data-local='a'>a</code>najdę jeszcze c<code  class='an' data-chord='E' data-suffix='m' data-local='e'>e</code>zas?&nbsp;&nbsp;&nbsp;&nbsp;<code  class='an' data-chord='G' data-suffix='' data-local='G'>G</code>&nbsp;</span><br>
<span class='annotated-lyrics'>Czy na ł<code  class='an' data-chord='C' data-suffix='' data-local='C'>C</code>zy ja znajdę c<code  class='an' data-chord='A' data-suffix='m' data-local='a'>a</code>zas?</span><br>
<br>
<br>
<span class='annotated-lyrics'><span class='text-muted'>ref:</span><code  class='an' data-chord='A' data-suffix='m' data-local='a'>a</code>Szampan wylewa się, t<code  class='an' data-chord='C' data-suffix='' data-local='C'>C</code>oast mogę wznieść</span><br>
<span class='annotated-lyrics'>A ten g<code  class='an' data-chord='E' data-suffix='m' data-local='e'>e</code>ość mówi coś - o<code  class='an' data-chord='D' data-suffix='' data-local='D'>D</code> co mu chodzi?</span><br>
<span class='annotated-lyrics'><code  class='an' data-chord='A' data-suffix='m' data-local='a'>a</code>Ktoś tu disuje mnie, <code  class='an' data-chord='C' data-suffix='' data-local='C'>C</code>niech gada co chce</span><br>
<span class='annotated-lyrics'>A ten g<code  class='an' data-chord='E' data-suffix='m' data-local='e'>e</code>ość mówi coś - s<code  class='an' data-chord='D' data-suffix='' data-local='D'>D</code>poko nie szkodzi</span><br>
<br>
<br>
<span class='annotated-lyrics'><code  class='an' data-chord='A' data-suffix='m' data-local='a'>a</code>Zamykam oczy,<code  class='an' data-chord='C' data-suffix='' data-local='C'>C</code> byłeś uroczy</span><br>
<span class='annotated-lyrics'><code  class='an' data-chord='E' data-suffix='m' data-local='e'>e</code>Będę udawać, ż<code  class='an' data-chord='D' data-suffix='' data-local='D'>D</code>e już nie boli</span><br>
<span class='annotated-lyrics'><code  class='an' data-chord='A' data-suffix='m' data-local='a'>a</code>Szampan wylewa się, t<code  class='an' data-chord='C' data-suffix='' data-local='C'>C</code>oast mogę wznieść</span><br>
<span class='annotated-lyrics'>A ten g<code  class='an' data-chord='E' data-suffix='m' data-local='e'>e</code>ość mówi coś - o <code  class='an' data-chord='D' data-suffix='' data-local='D'>D</code>co mu chodzi?</span><br>
<br>
<code  data-chord='A' data-suffix='m' data-local='a'>a</code> <code  data-chord='C' data-suffix='' data-local='C'>C</code> <code  data-chord='E' data-suffix='m' data-local='e'>e</code><br>
<br>
<span class='annotated-lyrics'><code  class='an' data-chord='D' data-suffix='' data-local='D'>D</code>O co mu chodzi?</span><br>
<br>
<code  data-chord='A' data-suffix='m' data-local='a'>a</code> <code  data-chord='C' data-suffix='' data-local='C'>C</code> <code  data-chord='E' data-suffix='m' data-local='e'>e</code> <code  data-chord='D' data-suffix='' data-local='D'>D</code><br>
<br>
<br>
<span class='annotated-lyrics'><code  class='an' data-chord='E' data-suffix='m' data-local='e'>e</code>I znów ten <code  class='an' data-chord='G' data-suffix='' data-local='G'>G</code>typ</span><br>
<span class='annotated-lyrics'>On szep<code  class='an' data-chord='C' data-suffix='' data-local='C'>C</code>cze pronto pron<code  class='an' data-chord='A' data-suffix='m' data-local='a'>a</code>to, musisz iść&nbsp;<code  class='an' data-chord='E' data-suffix='m' data-local='e'>e</code>&nbsp;</span><br>
<span class='annotated-lyrics'>A &nbsp;brak mi s<code  class='an' data-chord='G' data-suffix='' data-local='G'>G</code>ił</span><br>
<span class='annotated-lyrics'>Ten sz<code  class='an' data-chord='C' data-suffix='' data-local='C'>C</code>ampan coś za ł<code  class='an' data-chord='A' data-suffix='m' data-local='a'>a</code>atwo wchodził <code  class='an' data-chord='E' data-suffix='m' data-local='e'>e</code>mi&nbsp;&nbsp;&nbsp;&nbsp;<code  class='an' data-chord='G' data-suffix='' data-local='G'>G</code>&nbsp;</span><br>
<span class='annotated-lyrics'>Czy na p<code  class='an' data-chord='C' data-suffix='' data-local='C'>C</code>ożegnanie zn<code  class='an' data-chord='A' data-suffix='m' data-local='a'>a</code>ajdę jeszcze cz<code  class='an' data-chord='E' data-suffix='m' data-local='e'>e</code>as?&nbsp;&nbsp;&nbsp;&nbsp;<code  class='an' data-chord='G' data-suffix='' data-local='G'>G</code>&nbsp;</span><br>
<span class='annotated-lyrics'>Spojrzę s<code  class='an' data-chord='C' data-suffix='' data-local='C'>C</code>ię ostatni r<code  class='an' data-chord='A' data-suffix='m' data-local='a'>a</code>az</span><br>
<br>
<br>
<br>
<span class='text-muted'>ref:</span><br>
<br>
<span class='annotated-lyrics'>S<code  class='an' data-chord='A' data-suffix='m' data-local='a'>a</code>zampan wylewa się, to<code  class='an' data-chord='C' data-suffix='' data-local='C'>C</code>ast mogę wznieść</span><br>
<span class='annotated-lyrics'>A ten g<code  class='an' data-chord='E' data-suffix='m' data-local='e'>e</code>ość mówi coś - o<code  class='an' data-chord='D' data-suffix='' data-local='D'>D</code> co mu chodzi?</span><br>
<span class='annotated-lyrics'><code  class='an' data-chord='A' data-suffix='m' data-local='a'>a</code>Ktoś tu disuje mnie, <code  class='an' data-chord='C' data-suffix='' data-local='C'>C</code>niech gada co chce</span><br>
<span class='annotated-lyrics'>A ten g<code  class='an' data-chord='E' data-suffix='m' data-local='e'>e</code>ość mówi coś - s<code  class='an' data-chord='D' data-suffix='' data-local='D'>D</code>poko nie szkodzi</span><br>
<br>
<br>
<span class='annotated-lyrics'><code  class='an' data-chord='A' data-suffix='m' data-local='a'>a</code>Zamykam oczy,<code  class='an' data-chord='C' data-suffix='' data-local='C'>C</code> byłeś uroczy</span><br>
<span class='annotated-lyrics'><code  class='an' data-chord='E' data-suffix='m' data-local='e'>e</code>Będę udawać, ż<code  class='an' data-chord='D' data-suffix='' data-local='D'>D</code>e już nie boli</span><br>
<span class='annotated-lyrics'><code  class='an' data-chord='A' data-suffix='m' data-local='a'>a</code>Szampan wylewa się, t<code  class='an' data-chord='C' data-suffix='' data-local='C'>C</code>oast mogę wznieść</span><br>
<span class='annotated-lyrics'>A ten g<code  class='an' data-chord='E' data-suffix='m' data-local='e'>e</code>ość mówi coś - o <code  class='an' data-chord='D' data-suffix='' data-local='D'>D</code>co mu chodzi?</span><br>
<br>
<code  data-chord='A' data-suffix='m' data-local='a'>a</code> <code  data-chord='C' data-suffix='' data-local='C'>C</code> <code  data-chord='E' data-suffix='m' data-local='e'>e</code><br>
<br>
<span class='annotated-lyrics'><code  class='an' data-chord='D' data-suffix='' data-local='D'>D</code>O co mu chodzi?</span><br>
<br>
<code  data-chord='A' data-suffix='m' data-local='a'>a</code> <code  data-chord='C' data-suffix='' data-local='C'>C</code> <code  data-chord='E' data-suffix='m' data-local='e'>e</code> <code  data-chord='D' data-suffix='' data-local='D'>D</code><br>
<br>
<br>
<br>
<br>
</div>`;
        const expectedXml = `<lyric xmlns="http://21wdh.staszic.waw.pl">
  <block type="other">
      <row important_over="false" style="instr"><ch a="e"/> <ch a="G"/> <ch a="C"/> <ch a="a"/></row></block>
  <block type="verse">
      <row important_over="false"><ch a="e"/>Pod górkę m<ch a="G"/>am</row>
      <row important_over="false">Ale <ch a="C"/>na to się pis<ch a="a"/>ałam, tak czy siak</row>
      <row important_over="false"><ch a="e"/>Do biegu, st<ch a="G"/>art</row>
      <row important_over="false">Sama dr<ch a="C"/>ogę tę wyb<ch a="a"/>rałam, chciałam t<ch a="e"/>ak <ch a="G"/> </row></block>
  <block type="verse">
      <row important_over="false">Czy na m<ch a="C"/>oje łzy ja z<ch a="a"/>najdę jeszcze c<ch a="e"/>zas? <ch a="G"/> </row>
      <row important_over="false">Czy na ł<ch a="C"/>zy ja znajdę c<ch a="a"/>zas?</row></block>
  <block type="chorus">
      <row important_over="false"><ch a="a"/>Szampan wylewa się, t<ch a="C"/>oast mogę wznieść</row>
      <row important_over="false">A ten g<ch a="e"/>ość mówi coś - o<ch a="D"/> co mu chodzi?</row>
      <row important_over="false"><ch a="a"/>Ktoś tu disuje mnie, <ch a="C"/>niech gada co chce</row>
      <row important_over="false">A ten g<ch a="e"/>ość mówi coś - s<ch a="D"/>poko nie szkodzi</row></block>
  <block type="verse">
      <row important_over="false"><ch a="a"/>Zamykam oczy,<ch a="C"/> byłeś uroczy</row>
      <row important_over="false"><ch a="e"/>Będę udawać, ż<ch a="D"/>e już nie boli</row>
      <row important_over="false"><ch a="a"/>Szampan wylewa się, t<ch a="C"/>oast mogę wznieść</row>
      <row important_over="false">A ten g<ch a="e"/>ość mówi coś - o <ch a="D"/>co mu chodzi?</row></block>
  <block type="other">
      <row important_over="false" style="instr"><ch a="a"/> <ch a="C"/> <ch a="e"/></row></block>
  <block type="verse">
      <row important_over="false"><ch a="D"/>O co mu chodzi?</row></block>
  <block type="other">
      <row important_over="false" style="instr"><ch a="a"/> <ch a="C"/> <ch a="e"/> <ch a="D"/></row></block>
  <block type="verse">
      <row important_over="false"><ch a="e"/>I znów ten <ch a="G"/>typ</row>
      <row important_over="false">On szep<ch a="C"/>cze pronto pron<ch a="a"/>to, musisz iść <ch a="e"/> </row>
      <row important_over="false">A brak mi s<ch a="G"/>ił</row>
      <row important_over="false">Ten sz<ch a="C"/>ampan coś za ł<ch a="a"/>atwo wchodził <ch a="e"/>mi <ch a="G"/> </row>
      <row important_over="false">Czy na p<ch a="C"/>ożegnanie zn<ch a="a"/>ajdę jeszcze cz<ch a="e"/>as? <ch a="G"/> </row>
      <row important_over="false">Spojrzę s<ch a="C"/>ię ostatni r<ch a="a"/>az</row></block>
  <block type="chorus">
      <row important_over="false">S<ch a="a"/>zampan wylewa się, to<ch a="C"/>ast mogę wznieść</row>
      <row important_over="false">A ten g<ch a="e"/>ość mówi coś - o<ch a="D"/> co mu chodzi?</row>
      <row important_over="false"><ch a="a"/>Ktoś tu disuje mnie, <ch a="C"/>niech gada co chce</row>
      <row important_over="false">A ten g<ch a="e"/>ość mówi coś - s<ch a="D"/>poko nie szkodzi</row></block>
  <block type="verse">
      <row important_over="false"><ch a="a"/>Zamykam oczy,<ch a="C"/> byłeś uroczy</row>
      <row important_over="false"><ch a="e"/>Będę udawać, ż<ch a="D"/>e już nie boli</row>
      <row important_over="false"><ch a="a"/>Szampan wylewa się, t<ch a="C"/>oast mogę wznieść</row>
      <row important_over="false">A ten g<ch a="e"/>ość mówi coś - o <ch a="D"/>co mu chodzi?</row></block>
  <block type="other">
      <row important_over="false" style="instr"><ch a="a"/> <ch a="C"/> <ch a="e"/></row></block>
  <block type="verse">
      <row important_over="false"><ch a="D"/>O co mu chodzi?</row></block>
  <block type="other">
      <row important_over="false" style="instr"><ch a="a"/> <ch a="C"/> <ch a="e"/> <ch a="D"/></row></block></lyric>`.trim();
        expect(ic2l(html).trim()).toBe(expectedXml);
    });


    test('Samodzielny wiersz z oznaczeniem powtórzeń "/x4"', () => {
        const html = `
            <div class="interpretation-content">
                <span class='annotated-lyrics'>Tam gdzie kończy się świat jest ogromne morze<span class='text-muted'> /x4</span></span>
            </div>`;

        const expectedXml = `<lyric xmlns="http://21wdh.staszic.waw.pl">
  <block type="verse">
    <bis times="4"><row important_over="false">Tam gdzie kończy się świat jest ogromne morze</row></bis></block></lyric>
        `.trim();

        expect(ic2l(html).trim()).toBe(expectedXml);
    });

    test('Samodzielny wiersz z oznaczeniem powtórzeń "2x"', () => {
        const html = `
            <div class="interpretation-content">
                <span class='annotated-lyrics'>Tam gdzie kończy się świat jest ogromne morze<span class='text-muted'> 2x</span></span>
            </div>`;

        const expectedXml = `<lyric xmlns="http://21wdh.staszic.waw.pl">
  <block type="verse">
    <bis times="2"><row important_over="false">Tam gdzie kończy się świat jest ogromne morze</row></bis></block></lyric>
        `.trim();

        expect(ic2l(html).trim()).toBe(expectedXml);
    });

    test('Sosenka - bis', () => {
        const html = `<div class="interpretation-content">Płynie łódka w morskiej toni,&nbsp;&nbsp; <code  data-chord='A' data-suffix='m' data-local='a'>a</code> <code  data-chord='D' data-suffix='m' data-local='d'>d</code><br>
Księżyc z dala blask swój śle,&nbsp; <code  data-chord='E' data-suffix='7' data-local='E7'>E7</code> <code  data-chord='A' data-suffix='m' data-local='a'>a</code><br>
Kiedy czule mi mówiła:<br>
Mój Jasieńku, kocham cię.<br>
<br>
    Hej, las, mówię wam,&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <code  data-chord='D' data-suffix='m' data-local='d'>d</code><br>
    Szumi las, mówię wam,&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <code  data-chord='A' data-suffix='m' data-local='a'>a</code><br>
    A w lesie tym sosenka,&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <code  data-chord='E' data-suffix='7' data-local='E7'>E7</code> <code  data-chord='A' data-suffix='m' data-local='a'>a</code><br>
    Podobała mi się<br>
    pełna kras<br>
    Marysia ma mileńka.<br>
    <span class='text-muted'>x2</span><br>
<br>
Czarne oczy mej dziewczyny<br>
Słodko do mnie śmiały się,<br>
Kiedy czule mi mówiła:<br>
Mój Jasieńku, całuj mnie.<br>
<br>
    Hej, las...<br>
<br>
Całuj mocno, całuj szczerze,<br>
Tysiąc razy, raz po raz.<br>
Może wtedy ci uwierzę,<br>
Że prawdziwa miłość w nas.<br>
<br>
    Hej, las...<br>
<br>
<br>
</div>`;
        const expectedXml = `<lyric xmlns="http://21wdh.staszic.waw.pl">
  <block type="verse">
      <row important_over="false">Płynie łódka w morskiej toni, <ch a="a"/> <ch a="d"/></row>
      <row important_over="false">Księżyc z dala blask swój śle, <ch a="E7"/> <ch a="a"/></row>
      <row important_over="false">Kiedy czule mi mówiła:</row>
      <row important_over="false">Mój Jasieńku, kocham cię.</row></block>
  <block type="verse">
    <bis times="2">
      <row important_over="false"> Hej, las, mówię wam, <ch a="d"/></row>
      <row important_over="false"> Szumi las, mówię wam, <ch a="a"/></row>
      <row important_over="false"> A w lesie tym sosenka, <ch a="E7"/> <ch a="a"/></row>
      <row important_over="false"> Podobała mi się</row>
      <row important_over="false"> pełna kras</row>
      <row important_over="false"> Marysia ma mileńka.</row></bis></block>
  <block type="verse">
      <row important_over="false">Czarne oczy mej dziewczyny</row>
      <row important_over="false">Słodko do mnie śmiały się,</row>
      <row important_over="false">Kiedy czule mi mówiła:</row>
      <row important_over="false">Mój Jasieńku, całuj mnie.</row></block>
  <block type="verse">
      <row important_over="false"> Hej, las...</row></block>
  <block type="verse">
      <row important_over="false">Całuj mocno, całuj szczerze,</row>
      <row important_over="false">Tysiąc razy, raz po raz.</row>
      <row important_over="false">Może wtedy ci uwierzę,</row>
      <row important_over="false">Że prawdziwa miłość w nas.</row></block>
  <block type="verse">
      <row important_over="false"> Hej, las...</row></block></lyric>`.trim();

        expect(ic2l(html).trim()).toBe(expectedXml);

    })


    test('Grupa wierszy po oznaczeniu powtórzeń "x2"', () => {
        const html = `
            <div class="interpretation-content">
                <span class='annotated-lyrics'>Zerowy wiersz</span><br/>
                <br/>
                <span class='text-muted'>x2</span>
                <span class='annotated-lyrics'>Pierwszy wiersz</span>
                <span class='annotated-lyrics'>Drugi wiersz</span>
            </div>`;

        const expectedXml = `<lyric xmlns="http://21wdh.staszic.waw.pl">
  <block type="verse">
      <row important_over="false">Zerowy wiersz</row></block>
  <block type="verse">
    <bis times="2">
      <row important_over="false">Pierwszy wiersz</row>
      <row important_over="false">Drugi wiersz</row></bis></block></lyric>
        `.trim();

        expect(ic2l(html).trim()).toBe(expectedXml);
    });

    test('Blok bez oznaczeń powtórzeń, bez tagu <bis>', () => {
        const html = `
            <div class="interpretation-content">
                <span class='annotated-lyrics'>Jeden wiersz bez powtórzeń</span>
                <span class='annotated-lyrics'>Drugi wiersz bez powtórzeń</span>
            </div>`;

        const expectedXml = `<lyric xmlns="http://21wdh.staszic.waw.pl">
  <block type="verse">
      <row important_over="false">Jeden wiersz bez powtórzeń</row>
      <row important_over="false">Drugi wiersz bez powtórzeń</row></block></lyric>`.trim();

        expect(ic2l(html).trim()).toBe(expectedXml);
    });

    test('Blok zawierający tylko wiersze instrumentalne, oznaczony jako type="other"', () => {
        const html = `
            <div class="interpretation-content">
                <span class='annotated-lyrics'><code class='an' data-local='G'>G</code> <code class='an' data-local='fis'>fis</code></span>
                <span class='annotated-lyrics'><code class='an' data-local='li'>li</code></span>
            </div>`;

        const expectedXml = `<lyric xmlns="http://21wdh.staszic.waw.pl">
  <block type="other">
      <row important_over="false" style="instr"><ch a="G"/> <ch a="fis"/></row>
      <row important_over="false" style="instr"><ch a="li"/></row></block></lyric>`.trim();

        expect(ic2l(html).trim()).toBe(expectedXml);
    });

    test('Skin', () => {
        const html = `<div class="interpretation-content"><code  data-chord='A' data-suffix='' data-local='A'>A</code>                <code  data-chord='A' data-suffix='sus4' data-local='Asus4'>Asus4</code>     <code  data-chord='D' data-suffix='sus2' data-local='Dsus2'>Dsus2</code>            <code  data-chord='A' data-suffix='' data-local='A'>A</code><br>
                                Skin jest całkiem łysy, włosków on nie nosi<br>
                                Glaca w słońcu błyszczy jakby kombajn kosił<br>
                                Pejsów nie ma skin, kitek nienawidzi<br>
                                Boją się go Arabi, Murzyni i Żydzi<br>
                                Najgorsza dla skina jest co roku zima<br>
                                Jak on ją przetrzyma, przecież włosków nima<br>
                                <br>
                                <code  data-chord='E' data-suffix='' data-local='E'>E</code>             <code  data-chord='A' data-suffix='' data-local='A'>A</code>       <code  data-chord='F#' data-suffix='m' data-local='fis'>fis</code>          <code  data-chord='E' data-suffix='' data-local='E'>E</code><br>
                                <span class='text-muted'>Ref:</span> Nałóż czapkę skinie, skinie nałóż czapkę<br>
                                Kiedy wicher wieje, gdy pogoda w kratkę<br>
                                <code  data-chord='D' data-suffix='' data-local='D'>D</code>               <code  data-chord='E' data-suffix='' data-local='E'>E</code>      <code  data-chord='A' data-suffix='' data-local='A'>A</code><br>
                                Uszka się przeziębią, kark zlodowacieje<br>
                                Resztki myśli z mózgu wiaterek przewieje<br>
                                <br>
                                Mamusia na drutach czapkę z wełny robi<br>
                                Nałożysz ją skinie gdy się chłodniej zrobi<br>
                                Wełna w główkę grzeje, ciepło jest pod czaszką<br>
                                I komórki szare wówczas nie zamarzną<br>
                                <br>
                                Nasz skin był odważny, czapki nie nałożył<br>
                                Całą zimę biegał łysy, wiosny już nie dożył<br>
                                Główka mu zsiniała, uszka odmroziły<br>
                                Czaszka na pół pękła, szwy wewnątrz puściły<br>
                                <br>
                                <span class='text-muted'>Ref.</span>..<br>
                                <br>
                                <br>
                            </div>`;
        const expectedXml = ` <lyric xmlns="http://21wdh.staszic.waw.pl">
  <block type="verse">
      <row important_over="false" style="instr"><ch a="A"/> <ch a="Asus4"/> <ch a="Dsus2"/> <ch a="A"/></row>
      <row important_over="false"> Skin jest całkiem łysy, włosków on nie nosi</row>
      <row important_over="false"> Glaca w słońcu błyszczy jakby kombajn kosił</row>
      <row important_over="false"> Pejsów nie ma skin, kitek nienawidzi</row>
      <row important_over="false"> Boją się go Arabi, Murzyni i Żydzi</row>
      <row important_over="false"> Najgorsza dla skina jest co roku zima</row>
      <row important_over="false"> Jak on ją przetrzyma, przecież włosków nima</row></block>
  <block type="chorus">
      <row important_over="false" style="instr"> <ch a="E"/> <ch a="A"/> <ch a="fis"/> <ch a="E"/></row>
      <row important_over="false">  Nałóż czapkę skinie, skinie nałóż czapkę</row>
      <row important_over="false"> Kiedy wicher wieje, gdy pogoda w kratkę</row>
      <row important_over="false" style="instr"> <ch a="D"/> <ch a="E"/> <ch a="A"/></row>
      <row important_over="false"> Uszka się przeziębią, kark zlodowacieje</row>
      <row important_over="false"> Resztki myśli z mózgu wiaterek przewieje</row></block>
  <block type="verse">
      <row important_over="false"> Mamusia na drutach czapkę z wełny robi</row>
      <row important_over="false"> Nałożysz ją skinie gdy się chłodniej zrobi</row>
      <row important_over="false"> Wełna w główkę grzeje, ciepło jest pod czaszką</row>
      <row important_over="false"> I komórki szare wówczas nie zamarzną</row></block>
  <block type="verse">
      <row important_over="false"> Nasz skin był odważny, czapki nie nałożył</row>
      <row important_over="false"> Całą zimę biegał łysy, wiosny już nie dożył</row>
      <row important_over="false"> Główka mu zsiniała, uszka odmroziły</row>
      <row important_over="false"> Czaszka na pół pękła, szwy wewnątrz puściły</row></block>
  <block type="chorus">
      <row important_over="false"> ..</row></block></lyric>
`.trim();

        expect(ic2l(html).trim()).toBe(expectedXml);
    });

    test('Naked', () => {
        const html = `<div class="interpretation-content">La, la, la, la... <code  data-chord='G' data-suffix='' data-local='G'>G</code> <code  data-chord='C' data-suffix='' data-local='C'>C</code> <code  data-chord='G' data-suffix='' data-local='G'>G</code> <code  data-chord='C' data-suffix='' data-local='C'>C</code><br>
        <br>
            Po białym winie, mój Boże,  <code  data-chord='C' data-suffix='' data-local='C'>C</code><br>
            Czerwone miałam oczy, <code  data-chord='G' data-suffix='' data-local='G'>G</code><br>
            On mnie prowadził nad morze <code  data-chord='G' data-suffix='' data-local='G'>G</code><br>
            I mierzwił mi warkoczyk. <code  data-chord='C' data-suffix='' data-local='C'>C</code><br>
            Splot był słoneczny, słoneczny był Split, <code  data-chord='F' data-suffix='' data-local='F'>F</code> <code  data-chord='C' data-suffix='' data-local='C'>C</code><br>
            Nie był niegrzeczny i grzeczny nie był zbyt, <code  data-chord='F' data-suffix='' data-local='F'>F</code> <code  data-chord='C' data-suffix='' data-local='C'>C</code><br>
            Mierzwił, czarował, całował <code  data-chord='G' data-suffix='' data-local='G'>G</code><br>
            I śpiewał aż po świt: <code  data-chord='C' data-suffix='' data-local='C'>C</code><br>
            <br>
                Diri diri din, di diri din donda, <code  data-chord='C' data-suffix='' data-local='C'>C</code><br></div>`
        expect(ic2l(html).trim()).toBe(`<lyric xmlns="http://21wdh.staszic.waw.pl">
  <block type="verse">
      <row important_over="false">La, la, la, la... <ch a="G"/> <ch a="C"/> <ch a="G"/> <ch a="C"/></row></block>
  <block type="verse">
      <row important_over="false"> Po białym winie, mój Boże, <ch a="C"/></row>
      <row important_over="false"> Czerwone miałam oczy, <ch a="G"/></row>
      <row important_over="false"> On mnie prowadził nad morze <ch a="G"/></row>
      <row important_over="false"> I mierzwił mi warkoczyk. <ch a="C"/></row>
      <row important_over="false"> Splot był słoneczny, słoneczny był Split, <ch a="F"/> <ch a="C"/></row>
      <row important_over="false"> Nie był niegrzeczny i grzeczny nie był zbyt, <ch a="F"/> <ch a="C"/></row>
      <row important_over="false"> Mierzwił, czarował, całował <ch a="G"/></row>
      <row important_over="false"> I śpiewał aż po świt: <ch a="C"/></row></block>
  <block type="verse">
      <row important_over="false"> Diri diri din, di diri din donda, <ch a="C"/></row></block></lyric>`);
    })
})