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
  <button id="buttonNew">Nowy</button>
  <input style="display: none"  id="open" type="file" accept=".xml,.html"/>
  <input type="button" id="openCustom" value="Importuj plik"/>  
  <input type="button" id="openUrl" value="Importuj z sieci"/>  
  <button id="buttonSave">Eksportuj plik</button>
</div>

<div class="gitToolbar">
  <button class="buttonCommit">Zapisz zmiany</button>
  <button class="buttonCommitAndPublish">Zapisz zmiany i zgłoś do recenzji</button>
</div>
  
  <h3>Metryka</h3>
  
  <div class="metadata">
    <label for="title">Tytuł</label>              <input type="text" id="title"/>
    <label for="text_author">Autor tekstu</label> <input type="text" id="text_author"/> 
    
    <select inlist="creatortype" id="text_author_type">
      <option value=""></option>
      <option value="band">Zespół</option>
      <option value="solo">Osoba</option>  
    </select>
    
    <label for="artist">Wykonawca</label> <input id="artist" type="text"/> 
    <select inlist="creatortype" id="artist_type">
      <option value=""></option>
      <option value="band">Zespół</option>
      <option value="solo">Osoba</option>  
    </select>
  </div>
     
  <h3>Treść<i id="helpbody-icon" class="material-icons">help</i></h3>
  <div id="help-body" class="help">
    <p>Kilka trików, które warto znać: 
     <ul>
      <li>Klawisz \` (przeważnie lewy górny róg klawiatury) pozwala na dodanie akordu w bieżącym miejscu.</li>
      <li>Akordy możesz przeciągać lub edytować poprzez drukrotne kliknięcie.</li>
      <li>Zwrotkę możesz rozbić na dwie poprzez wstawienie dwóch pustych wierszy.</li>
      <li>"Cofnij" działa tylko trochę (edycja tekstu, ale nie akordów).</li>
      <li>Gotową piosenkę możesz zapisać do pliku lub zgłosić do recenzji przed publikacją w githubie</li>
     </ul> 
    </p> 
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
    
    <label for="alias">Tytuł alternatywny</label> <input type="text" id="alias"/>
    <label for="original_title">Tytuł oryginału</label> <input type="text" id="original_title"/>
    <label for="translator">Tłumacz</label> <input type="text" id="translator"/>
    <label for="album">Album</label> <input type="text" id="album"/>
        
    <label for="composer">Kompozytor</label> <input type="text" id="composer"/> 
    <select inlist="creatortype" id="composer_type">
      <option value=""></option>
      <option value="band">Zespół</option>
      <option value="solo">Osoba</option>  
    </select>
    <label for="music_source">Źródło muzyki</label> <input type="text" id="music_source"/>
    <label for="metre">Metrum</label> <input type="text" id="metre" list="metres"/>
    <label for="guitar_barre">Kapodaster</label> <input type="text" id="guitar_barre"/>

    <label for="genre">Gatunek</label> <input type="text" list="genres" id="genre"/>    
    
    <label for="keywords">Słowa kluczowe</label> <textarea id="keywords"></textarea>
    <label for="comment">Komentarz</label> <textarea id="comment"></textarea>
  </div>
  
  <h3>Status:</h3>
  <div class="metadata status">
     <label for="done_text">Sprawdzono tekst</label> <input type="checkbox" id="done_text"/>
     <label for="done_chords">Sprawdzono akordy</label> <input type="checkbox" id="done_chords"/>
       <select id="done_chords_value">
         <option value=""></option>
         <option value="chords">akordy</option>
         <option value="chord positioning">rozmieszczenie akordów</option>
       </select>
     <label for="done_authors">Sprawdzono twórców</label> <input type="checkbox" id="done_authors"/>
     <label for="verificators">Sprawdzający</label> <textarea id="verificators"></textarea>
     <label for="to_do">Do zrobienia</label> <textarea id="to_do"></textarea>
  </div>
</div>
<div class="gitToolbar">
  <button class="buttonCommit">Zapisz zmiany</button>
  <button class="buttonCommitAndPublish">Zapisz zmiany i zgłoś do recenzji</button>
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
    this.open=shadow.getElementById("open");
    this.openCustom=shadow.getElementById("openCustom");
    this.openUrl=shadow.getElementById("openUrl");

    this.helpbody = shadow.getElementById("help-body");
    this.helpbody.addEventListener("click", (e) => {this.helpbody.hidden = true; });
    this.helpbody.hidden=true;
    shadow.getElementById("helpbody-icon").addEventListener("click", (e) => {this.helpbody.hidden ^= true;})

    this.openCustom.addEventListener("click", () => this.open.click());
    this.openUrl.addEventListener("click", () => this.OpenUrl());
    this.buttonSave.addEventListener("click", () => Save(this));
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
