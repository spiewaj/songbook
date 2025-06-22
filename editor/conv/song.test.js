import { html2xmlstr } from './conv.js';
import {JSDOM} from "jsdom";

describe('html2xmlstr tests', () => {

    test('simple', () => {
        let html = `
<!DOCTYPE html>
<html lang="pl">
<head>
    <title>Ballada o smutnym skinie - Big Cyc, Chwyty na gitarę</title>
    <link rel="canonical" href="ballada-o-smutnym-skinie.html">
    <meta property="og:url" content="http://teksty.wywrota.pl/39_big_cyc_ballada_o_smutnym_skinie.html">
    <link rel="alternate" href="https://wikisongbook.com/big-cyc/ballada-o-smutnym-skinie" hreflang="en" />
</head>
<body  class="lang-pl">



<section class="content">
    <div class="container">

    </div>

    <div class="container">
        <div class="my-2">
            <div class="row">
                <div class="col-lg-9 ">
                        <h1>
                            <strong>Ballada o smutnym skinie</strong>
                            
                            Big Cyc
                        </h1>

                    <div class="song-metadata mb-3 text-muted">
                        Kapodaster:       Trzeci Próg <br/>
                    </div>

                    <div class="song-metadata mb-3 text-muted">
                        Trudność: Średni <br/>
                        Strojenie:     klasyczne (E A D G H e) <br/>
                        Tonacja:     F <br/>
                    </div>

                        <div  class="interpretation-content-wrapper" >
                        <div class="interpretation-content">
  <span class='annotated-lyrics'><code  class='an' data-chord='E' data-suffix='m' data-local='e'>e</code>Pod górkę m<code  class='an' data-chord='G' data-suffix='' data-local='G'>G</code>am</span><br>
  <span class='annotated-lyrics'>Ale <code  class='an' data-chord='C' data-suffix='' data-local='C'>C</code>na to się pis<code  class='an' data-chord='A' data-suffix='m' data-local='a'>a</code>ałam, tak czy siak</span><br>
  <br/>
  <span class='annotated-lyrics'>Czy na m<code  class='an' data-chord='C' data-suffix='' data-local='C'>C</code>oje łzy ja z<code  class='an' data-chord='A' data-suffix='m' data-local='a'>a</code>najdę jeszcze c<code  class='an' data-chord='E' data-suffix='m' data-local='e'>e</code>zas?&nbsp;&nbsp;&nbsp;&nbsp;<code  class='an' data-chord='G' data-suffix='' data-local='G'>G</code>&nbsp;</span><br>
  <span class='annotated-lyrics'>Czy na ł<code  class='an' data-chord='C' data-suffix='' data-local='C'>C</code>zy ja znajdę c<code  class='an' data-chord='A' data-suffix='m' data-local='a'>a</code>zas?</span><br>
</div></div></div></div></div></div></section></body></html>`;

        expect(html2xmlstr(html, new JSDOM().window).trim()).toBe( `<song xmlns="http://21wdh.staszic.waw.pl" title="Ballada o smutnym skinie"><artist type="solo">Big Cyc</artist><comment>Kapodaster:       Trzeci Próg
Trudność: Średni
Strojenie:     klasyczne (E A D G H e)
Tonacja:     F
</comment><lyric>
  <block type=\"verse\">
      <row important_over=\"false\"><ch a=\"e\"/>Pod górkę m<ch a=\"G\"/>am</row>
      <row important_over=\"false\">Ale <ch a=\"C\"/>na to się pis<ch a=\"a\"/>ałam, tak czy siak</row></block>
  <block type=\"verse\">
      <row important_over=\"false\">Czy na m<ch a=\"C\"/>oje łzy ja z<ch a=\"a\"/>najdę jeszcze c<ch a=\"e\"/>zas? <ch a=\"G\"/> </row>
      <row important_over=\"false\">Czy na ł<ch a=\"C\"/>zy ja znajdę c<ch a=\"a\"/>zas?</row></block></lyric></song>`
    );
    })

})