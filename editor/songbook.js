import {SongChInit} from './ch.js'
import {SongVerseBisInit, SongVerse} from './verse.js'
import {SongBodyInit} from './songbody.js';
import {createSongBody} from './songbody.js';
import {Sanitize} from './sanitize.js';
import {Save, Serialize} from './save.js';
import {removeAllChildren} from './utils.js';
import {html2xmlstr} from './conv/conv.js'

const attrs=["title", "alias","text_author", "text_author_type","comment",
  "composer", "composer_type","artist", "artist_type",
  "translator" , "original_title",
  "album",
  "music_source", "metre", "guitar_barre", "genre",
  "keywords",  "done_text", "done_authors", "done_chords",
  "verificators", "to_do"];

export class SongEditor extends HTMLElement {
  constructor() {
    super();

    const template = document.createElement('template');
    template.innerHTML = `
<link rel="stylesheet" href="song.css"/>
<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet"/>
<div class="song-editor">
  
<div id="fileToolbar">
  <button id="buttonNew" data-tooltip="Wyczyść edytor i rozpocznij tworzenie nowej piosenki od szablonu.">Nowy</button>
  <input style="display: none"  id="open" type="file" accept=".xml,.html"/>
  <span class="tooltip-wrap" data-tooltip="Wczytaj piosenkę z pliku na dysku (format .xml śpiewnika lub .html ze Śpiewnika Wywroty)."><input type="button" id="openCustom" value="Importuj plik"/></span>
  <span class="tooltip-wrap" data-tooltip="Zaimportuj tekst i akordy bezpośrednio z adresu URL (np. ze Śpiewnika Wywroty)."><input type="button" id="openUrl" value="Importuj z sieci"/></span>
  <button id="buttonSave" data-tooltip="Pobierz plik XML piosenki na swój komputer.">Eksportuj plik</button>
  <button id="buttonRenderPdf" type="button" data-tooltip="Wygeneruj podgląd wydruku PDF tej piosenki (skład w LaTeX), aby sprawdzić układ tekstu i akordów.">Podgląd PDF</button>
  <span class="tooltip-wrap" data-tooltip="Wybierz format strony generowanego podglądu PDF (A5 – zeszytowy śpiewnik, A4 – pełna strona).">
    <select id="pdfPapersize" style="margin-left: 5px;">
      <option value="a5" selected>A5</option>
      <option value="a4">A4</option>
    </select>
  </span>
  <span id="pdfRenderStatus" style="margin-left: 10px; font-weight: bold; font-size: 0.9em;"></span>
</div>

<div class="gitToolbar">
  <button class="buttonCommit" data-tooltip="Zapisz bieżące zmiany na swoim koncie roboczym (bez wysyłania do recenzji).">Zapisz zmiany</button>
  <button class="buttonCommitAndPublish" data-tooltip="Zapisz zmiany i przejdź do zgłoszenia ich do recenzji (Pull Request na GitHubie), aby opublikować piosenkę w śpiewniku.">Zapisz zmiany i zgłoś do recenzji</button>
</div>
  
  <h3>Metryka</h3>
  
  <div class="metadata">
    <label for="title" data-tooltip-pos="right" data-tooltip="Główny tytuł piosenki.">Tytuł</label>              <input type="text" id="title" title="Główny tytuł piosenki."/>
    <label for="text_author" data-tooltip-pos="right" data-tooltip="Autor słów piosenki (przy pseudonimie np. Mirosław Jezierski (ps. „Karnisz”)). Obok wybierz czy to Osoba czy Zespół.">Autor tekstu</label> <input type="text" id="text_author" title="Autor słów piosenki."/> 
    
    <select inlist="creatortype" id="text_author_type" title="Typ autora tekstu: Osoba lub Zespół.">
      <option value=""></option>
      <option value="band">Zespół</option>
      <option value="solo">Osoba</option>  
    </select>
    
    <label for="artist" data-tooltip-pos="right" data-tooltip="Główny wykonawca lub zespół kojarzony z tym utworem. Obok wybierz czy to Osoba czy Zespół.">Wykonawca</label> <input id="artist" type="text" title="Główny wykonawca lub zespół."/> 
    <select inlist="creatortype" id="artist_type" title="Typ wykonawcy: Osoba lub Zespół.">
      <option value=""></option>
      <option value="band">Zespół</option>
      <option value="solo">Osoba</option>  
    </select>
  </div>
     
  <h3>Treść<i id="helpbody-icon" class="material-icons" title="Najedź lub kliknij, aby zobaczyć wskazówki dotyczące edycji">help</i></h3>
  <div id="help-body" class="help">
    <p>Wskazówki dotyczące edycji tekstu i akordów:</p>
    <ul>
      <li><strong>Wstawianie akordów:</strong> ustaw kursor w tekście i naciśnij klawisz <code>\`</code> (tylda w lewym górnym rogu klawiatury), kliknij dwukrotnie w słowo lub użyj przycisku „Wstaw akord”.</li>
      <li><strong>Edycja i przesuwanie akordów:</strong> przeciągnij akord myszką w inne miejsce (z klawiszem Alt/Option, aby skopiować) albo kliknij go dwukrotnie, aby zmienić nazwę (wyczyszczenie pola usuwa akord).</li>
      <li><strong>Kolumna akordów z boku:</strong> zielone tło oznacza zgodność z akordami nad tekstem, a czerwone – różnicę (np. gdy dodasz nawiasy <code>(a H7)</code> lub użyjesz przycisków <code>«</code> / <code>»</code> do synchronizacji).</li>
      <li><strong>Dzielenie zwrotek i powtórzenia:</strong> naciśnij dwukrotnie Enter (lub przycisk „Podziel zwrotkę”), aby rozdzielić zwrotkę. Jeśli refren powtarza się bez zmian, w kolejnym bloku zaznacz „już było”.</li>
      <li><strong>Skróty klawiszowe:</strong> <code>Ctrl+Z</code> / <code>Cmd+Z</code> (Cofnij), <code>Ctrl+Y</code> (Ponów), <code>Ctrl+B</code> (powtórzenie BIS).</li>
    </ul>
  </div>
  <slot id="song-body"></slot>
  
  <h3>Szczegóły:</h3>
  <div class="metadata">
    <datalist id="genres">
      <option>Kolęda</option>
      <option>Piosenka harcerska</option>
      <option>Piosenka harcerska - parodia</option>
      <option>Piosenka kabaretowa</option>
      <option>Piosenka turystyczna</option>
      <option>Piosenka turystyczna górska</option>
      <option>Pieśń ludowa</option>
      <option>Poezja śpiewana</option>
      <option>Pop</option>
      <option>Rock</option>
      <option>Szanta</option>
      <option>Inna</option>
    </datalist> 
    
    <datalist id="metres">
      <option>2/2</option>
      <option>3/3</option>
      <option>2/4</option>
      <option>3/4</option>
      <option>4/4</option>
      <option>6/8</option>
      <option>8/8</option>
      <option>12/8</option>
    </datalist>
    
    <label for="alias" data-tooltip-pos="right" data-tooltip="Inny popularny tytuł lub pierwsze słowa (incipit), pod którymi piosenka bywa szukana.">Tytuł alternatywny</label> <input type="text" id="alias" title="Inny popularny tytuł piosenki."/>
    <label for="original_title" data-tooltip-pos="right" data-tooltip="Tytuł utworu w języku oryginalnym, jeśli piosenka jest tłumaczeniem lub adaptacją.">Tytuł oryginału</label> <input type="text" id="original_title" title="Tytuł oryginału (dla tłumaczeń)."/>
    <label for="translator" data-tooltip-pos="right" data-tooltip="Autor polskiego przekładu tekstu piosenki.">Tłumacz</label> <input type="text" id="translator" title="Autor polskiego przekładu tekstu."/>
    <label for="album" data-tooltip-pos="right" data-tooltip="Nazwa płyty lub wydawnictwa, z którego pochodzi utwór.">Album</label> <input type="text" id="album" title="Nazwa albumu / płyty."/>
        
    <label for="composer" data-tooltip-pos="right" data-tooltip="Twórca muzyki (kilku kompozytorów oddziel przecinkiem). Obok wybierz czy to Osoba czy Zespół.">Kompozytor</label> <input type="text" id="composer" title="Twórca muzyki."/> 
    <select inlist="creatortype" id="composer_type" title="Typ kompozytora: Osoba lub Zespół.">
      <option value=""></option>
      <option value="band">Zespół</option>
      <option value="solo">Osoba</option>  
    </select>
    <label for="music_source" data-tooltip-pos="right" data-tooltip="Tradycyjna melodia lub utwór pierwotny, z którego zaczerpnięto melodię (np. gdy nowy tekst powstał do znanej melodii).">Źródło muzyki</label> <input type="text" id="music_source" title="Tradycyjna melodia lub utwór, z którego pochodzi linia melodyczna."/>
    <label for="metre" data-tooltip-pos="right" data-tooltip="Metrum muzyczne utworu (np. 4/4, 3/4, 6/8).">Metrum</label> <input type="text" id="metre" list="metres" title="Metrum utworu, np. 4/4, 3/4, 6/8."/>
    <label for="guitar_barre" data-tooltip-pos="right" data-tooltip="Próg, na którym należy założyć kapodaster (np. 2, 3, II, III), aby grać podanymi chwytami w oryginalnej tonacji.">Kapodaster</label> <input type="text" id="guitar_barre" title="Próg kapodastra (np. 2, 3)."/>

    <label for="genre" data-tooltip-pos="right" data-tooltip="Gatunek lub kategoria piosenki (wybierz z podpowiedzi lub wpisz własny, np. Piosenka harcerska, Szanta, Poezja śpiewana).">Gatunek</label> <input type="text" list="genres" id="genre" title="Gatunek piosenki."/>    
    
    <label for="keywords" data-tooltip-pos="right" data-tooltip="Dodatkowe słowa kluczowe ułatwiające wyszukanie piosenki (po jednym w każdym wierszu).">Słowa kluczowe</label> <textarea id="keywords" title="Dodatkowe słowa kluczowe (po jednym w wierszu)."></textarea>
    <label for="comment" data-tooltip-pos="right" data-tooltip="Komentarz dla czytelników widoczny pod piosenką: historia utworu, kontekst kulturowy lub wskazówki wykonawcze. (Uwagi robocze dla redaktorów wpisuj niżej w polu „Do zrobienia”).">Komentarz</label> <textarea id="comment" title="Komentarz dla czytelników: historia powstania, kontekst lub wskazówki wykonawcze."></textarea>
  </div>
  
  <h3>Status:</h3>
  <div class="metadata status">
     <label for="done_text" data-tooltip-pos="right" data-tooltip="Zaznacz, gdy tekst piosenki został w pełni zweryfikowany z wiarygodnym źródłem (nagraniem lub oficjalnym śpiewnikiem).">Sprawdzono tekst</label> <input type="checkbox" id="done_text" title="Zaznacz, gdy tekst został zweryfikowany."/>
     <label for="done_chords" data-tooltip-pos="right" data-tooltip="Zaznacz po zweryfikowaniu chwytów i wybierz z listy obok poziom sprawdzenia („akordy” lub „rozmieszczenie akordów” nad sylabami).">Sprawdzono akordy</label> <input type="checkbox" id="done_chords" title="Zaznacz, gdy akordy zostały zweryfikowane."/>
       <select id="done_chords_value" title="Poziom weryfikacji akordów: same akordy lub dokładne rozmieszczenie akordów nad sylabami.">
         <option value=""></option>
         <option value="chords">akordy</option>
         <option value="chord positioning">rozmieszczenie akordów</option>
       </select>
     <label for="done_authors" data-tooltip-pos="right" data-tooltip="Zaznacz, gdy autor tekstu, kompozytor i wykonawca zostali potwierdzeni w wiarygodnych źródłach.">Sprawdzono twórców</label> <input type="checkbox" id="done_authors" title="Zaznacz, gdy twórcy zostali zweryfikowani."/>
     <label for="verificators" data-tooltip-pos="right" data-tooltip="Źródła weryfikacji (linki URL do nagrań, oficjalnych śpiewników itp.) lub osoby sprawdzające – po jednym wpisie w wierszu.">Sprawdzający</label> <textarea id="verificators" title="Źródła weryfikacji (linki URL) lub osoby sprawdzające (po jednym w wierszu)."></textarea>
     <label for="to_do" data-tooltip-pos="right" data-tooltip="Wewnętrzne notatki redakcyjne: co wymaga jeszcze dopracowania lub sprawdzenia (np. brakujące zwrotki, niepewne chwyty).">Do zrobienia</label> <textarea id="to_do" title="Wewnętrzne notatki redakcyjne (co pozostało do sprawdzenia lub poprawienia)."></textarea>
  </div>
</div>
<div class="gitToolbar">
  <button class="buttonCommit" data-tooltip="Zapisz bieżące zmiany na swoim koncie roboczym (bez wysyłania do recenzji).">Zapisz zmiany</button>
  <button class="buttonCommitAndPublish" data-tooltip="Zapisz zmiany i przejdź do zgłoszenia ich do recenzji (Pull Request na GitHubie), aby opublikować piosenkę w śpiewniku.">Zapisz zmiany i zgłoś do recenzji</button>
</div>
<details>
  <summary>Ostatni zapisany/wyesportowany:</summary>
  <pre id="lastSerialized"></pre>
</details>
  `;

    const shadow = this.attachShadow({ mode: "closed" });
    shadow.appendChild(template.content.cloneNode(true));
    this.shadow = shadow;

    this.buttonNew=shadow.getElementById("buttonNew");
    this.buttonSave=shadow.getElementById("buttonSave");
    this.buttonRenderPdf=shadow.getElementById("buttonRenderPdf");
    this.open=shadow.getElementById("open");
    this.openCustom=shadow.getElementById("openCustom");
    this.openUrl=shadow.getElementById("openUrl");

    this.helpbody = shadow.getElementById("help-body");
    const helpbodyIcon = shadow.getElementById("helpbody-icon");
    this.helpbody.hidden = true;
    let helpHideTimeout = null;
    const showHelpBody = () => {
      if (helpHideTimeout) { clearTimeout(helpHideTimeout); helpHideTimeout = null; }
      this.helpbody.hidden = false;
    };
    const scheduleHideHelpBody = () => {
      if (this.helpbody.dataset.pinned === "true") return;
      helpHideTimeout = setTimeout(() => {
        if (this.helpbody.dataset.pinned !== "true") {
          this.helpbody.hidden = true;
        }
      }, 180);
    };
    helpbodyIcon.addEventListener("mouseenter", showHelpBody);
    helpbodyIcon.addEventListener("mouseleave", scheduleHideHelpBody);
    this.helpbody.addEventListener("mouseenter", showHelpBody);
    this.helpbody.addEventListener("mouseleave", scheduleHideHelpBody);
    this.helpbody.addEventListener("click", () => {
      delete this.helpbody.dataset.pinned;
      this.helpbody.hidden = true;
    });
    helpbodyIcon.addEventListener("click", () => {
      if (this.helpbody.dataset.pinned === "true") {
        delete this.helpbody.dataset.pinned;
        this.helpbody.hidden = true;
      } else {
        this.helpbody.dataset.pinned = "true";
        this.helpbody.hidden = false;
      }
    });

    this.openCustom.addEventListener("click", () => this.open.click());
    this.openUrl.addEventListener("click", () => this.OpenUrl());
    this.buttonSave.addEventListener("click", () => Save(this));
    this.buttonRenderPdf.addEventListener("click", () => {
      const papersize = this.shadow.getElementById("pdfPapersize").value;
      const renderEvent = new CustomEvent("pdf:render", {
        bubbles: true,
        cancelable: true,
        composed: true,
        detail: { papersize: papersize }
      });
      this.dispatchEvent(renderEvent);
    });
    this.open.addEventListener("change", (e) => this.LoadFile(e));
    this.buttonNew.addEventListener("click", (e) => {
      if (confirm("Czy chcesz przywrócić wartości początkowe we wszystkich polach ?")) {
        this.New(e) }});

    for (let attr of attrs) {
      this.mapAttribute(attr);
    }

    const title = this.shadow.getElementById("title");
    title.addEventListener("change", () => { document.title = title.value; });

    for (let button of shadow.querySelectorAll(".buttonCommit")) {
      console.log("registering button", button);
      const doubleClickEvent = new CustomEvent("git:commit", {
        bubbles: true,
        cancelable: true,
        composed: true,
      });
      button.addEventListener("click", () => {this.dispatchEvent(doubleClickEvent)});
    }

    for (let button of shadow.querySelectorAll(".buttonCommitAndPublish")) {
      const doubleClickEvent = new CustomEvent("git:commitAndPublish", {
        bubbles: true,
        cancelable: true,
        composed: true,
      });
      button.addEventListener("click", () => this.dispatchEvent(doubleClickEvent));
    }

    this.attributeChangedCallback("git");
    
    // Clear PDF "Gotowe" status if the user edits anything
    const clearPdfStatus = () => {
      const statusSpan = this.shadow.getElementById("pdfRenderStatus");
      if (statusSpan && statusSpan.innerHTML.includes("Gotowe")) {
        statusSpan.innerHTML = "";
      }
    };
    this.shadow.addEventListener("input", clearPdfStatus);
    this.shadow.addEventListener("change", clearPdfStatus);
  }

  mapAttribute(attr) {
    let a = this.shadow.getElementById(attr);
    if (a.id === "done_chords") {
      let av = this.shadow.getElementById("done_chords_value");
      let fun = (e) => {
         if (a.checked) {
           this.setAttribute("done_chords", av.value);
         } else {
           this.removeAttribute("done_chords");
         }
      }
      a.addEventListener("change", fun);
      av.addEventListener("change", fun);
    } else if (a.nodeName=='INPUT' && a.type==='checkbox') {
      a.addEventListener("change",
          (e) => this.setAttribute(attr, e.target.checked));

    } else {
      a.addEventListener("change",
          (e) => this.setAttribute(attr, e.target.value));
    }
  }

  attributeChangedCallback(attr) {
    if (attr=='git') {
      for (let d of this.shadow.querySelectorAll(".gitToolbar")) {
        d.hidden = this.getAttribute('git') != 'true';
      }
      return
    }

    let a = this.shadow.getElementById(attr);
    if (a && a.id === "done_chords") {
      a.checked = this.hasAttribute("done_chords");
      this.shadow.getElementById("done_chords_value").value = a.checked
          ? this.getAttribute("done_chords") : "";
    } else if (a && a.nodeName=='INPUT' && a.type==='checkbox') {
      a.checked=this.getAttribute(attr)==="true";
    } else if (a) {
      a.value=this.getAttribute(attr);
    }
  }

  OpenUrl() {
    let url=prompt("Proszę podaj adres do strony z piosenką (np. wywrota):", "https://...");

    let request = new XMLHttpRequest();
    request.open("GET", "https://ghe.spiewaj.com/pr0xy?url=" + url, true);
    request.onload = () => {
      console.log(request.responseText)
      let converted = html2xmlstr(request.responseText, window)
      this.Load(converted);
      // Loaded file should be committable.
      this.serialized="";
    }
    request.send();

  }

  body() {
    return this.getElementsByTagName("song-body")[0];
  }

  openFileClick() {
    return this.shadowRoot.getElementById('open').click();
  }

  New() {
    this.Load(`
  <song title=""><lyric>
  <block type="verse">
    <row important_over="true"><ch a="D"></ch>Herbata stygn<ch a="G"/>ie zapa<ch a="A"/>da mrok</row>
    <row important_over="true">A p<ch a="D"/>od piór<ch a="G"/>em ciąg<ch a="A"/>le nic</row>
    <row important_over="false">Ob<ch a="D"/>owiązek ob<ch a="G"/>owiązkie<ch a="A"/>m jest</row>
    <row important_over="false">Piosenka musi p<ch a="D"/>osiadać teks<ch a="A"/>t <ch a="G"/></row>
  </block>
</lyric></song>`);
    this.body().selectAll();
  }

  Load(xmlContent) {
    let parser = new DOMParser();
    let xmlDoc = parser.parseFromString(xmlContent.replaceAll(" style=", " type="), "text/xml");
    let z=xmlDoc.getElementsByTagName("lyric");
    if (z.length!=1) {
      return false;
    }
    removeAllChildren(this);
    let tmp= document.createElement("div");
    tmp.appendChild(z[0]);
    Sanitize(tmp);
    this.appendChild(tmp.childNodes[0]);
    this.body().reset();
    this.body().changePostprocess();

    let song=xmlDoc.getElementsByTagName("song")[0];

    this.setAttribute("title", song.getAttribute("title"));
    this.readAttribute(song, "text_author", "text_author");
    this.readAttribute(song, "text_author_type", "text_author", "type");
    this.readAttribute(song, "artist", "artist");
    this.readAttribute(song, "artist_type", "artist", "type");

    this.readAttribute(song, "alias", "alias");
    this.readAttribute(song, "original_title", "original_title");
    this.readAttribute(song, "translator", "translator");
    this.readAttribute(song, "album", "album");
    this.readAttribute(song, "composer", "composer");
    this.readAttribute(song, "composer_type", "composer", "type");
    this.readAttribute(song, "music_source", "music_source");

    this.readAttribute(song, "metre", "music","metre");
    this.readAttribute(song, "guitar_barre", "guitar", "barre");
    this.readAttribute(song, "genre", "genre");
    this.readAttribute(song, "comment", "comment");

    this.readAttributeDone(song, "done_text", "text");
    this.readAttributeDone(song, "done_authors", "authors");
    this.readAttributeDone(song, "done_chords", "chords");

    this.readAttributeList(song, "keywords", "keyword");
    this.readAttributeList(song, "verificators", "verificator");

    this.readAttribute(song, "to_do", "to_do");

    this.tabs = xmlContent.includes("\t");
    this.serialized = xmlContent;

    const title = this.shadow.getElementById("title");
    document.title = title.value;
    return true;
  }

  Serialize() {
    return Serialize(this);
  }

  SerializeWithChange() {
    const prev = this.serialized;
    const newP = this.Serialize();
    return {
      serialized: newP,
      changed: newP != prev,
      title: this.getAttribute("title"),
    }
  }

  MarkAsCommitted(serialized) {
    this.serialized = serialized;
  }

  LoadFile(e) {
    console.log("LOADING", e);

    // setting up the reader
    let filePath = (this.open.files[0]);
    var reader = new FileReader();
    reader.addEventListener('load', (event) => {
      if (filePath.name.endsWith(".html")) {
        let converted = html2xmlstr(event.target.result, window)
        this.Load(converted);
        // Loaded file should be committable.
        this.serialized="";
      } else {
        this.Load(event.target.result);
        // Loaded file should be committable.
        this.serialized = "";
      }
    });
    reader.readAsText(filePath);
  }

  readAttribute(song, targetAttr, sourceTagName, sourceAttr=null) {
    let nodes = song.getElementsByTagName(sourceTagName);
    let node = nodes.length > 0 ? nodes[0] : null;
    let txt=null;
    if (node && !sourceAttr) {
      txt = node.textContent;
    } else if (node) {
      txt = node.getAttribute(sourceAttr);
    }
    if (!txt || txt.trim()=='') {
      this.removeAttribute(targetAttr);
    } else {
      this.setAttribute(targetAttr, txt);
    }
  }

  readAttributeDone(song, targetAttr, sourceTagName) {
    let nodes = song.getElementsByTagName(sourceTagName);
    let node = nodes.length > 0 ? nodes[0] : null;
    if (node) {
      this.setAttribute(targetAttr, node.textContent.trim()==''?'true':node.textContent);
    } else {
      this.removeAttribute(targetAttr);
    }
  }

  readAttributeList(song, targetAttr, sourceTagName) {
    let nodes = song.getElementsByTagName(sourceTagName);
    let txt='';
    for (let i=0; i < nodes.length; ++i) {
      txt+=nodes[i].textContent + '\n';
    };
    if (txt && txt.trim()!='') {
      this.setAttribute(targetAttr, txt);
    }
  }

  connectedCallback() {
    // if (!this.body()) {
    //   this.New();
    // }
  }

  static get observedAttributes() {
    return attrs.concat(["git"]);
  }
}

function songEditorInit() {
  customElements.define("song-editor", SongEditor);
}

function init() {
  SongChInit();
  SongVerseBisInit();
  SongBodyInit();
  songEditorInit();
}

init();
