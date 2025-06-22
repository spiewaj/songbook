import {findAncestor, nbsp} from "./utils.js";
import {SideChordsInit} from "./sidechords.js";
import {pushRowChords} from "./songbody.js";

export class SongVerse extends HTMLElement {
  constructor() {
    super();

    const template = document.createElement('template');
    template.innerHTML = `
<link rel="stylesheet" href="./verse.css"/>
<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
<div class="verse">
  <div class="verse_meta">
    <span id="nr"></span>
    <div>
      <label><input id="blocklink" name="blocklink" type="checkbox"/>już było</label>
      
      <label for="bt_verse"><input type="radio" id="bt_verse" value="verse" name="block_type"/>zwrotka</label>
      <label for="bt_chorus"><input type="radio" id="bt_chorus" value="chorus" name="block_type"/>refren</label>
      <label for="bt_other"><input type="radio" id="bt_other" value="other" name="block_type"/>wstawka</label>
      
      <button id="delete" class="material-icons">delete</button>
    </div>
  </div>
  <div id="verse_link" class="verse_link">
      <select id="verse_link_sel">
        <option>Foo</option>
        <option>Bar</option>
      </select>
  </div>
  <div id="verse_sidechords"></div>
  <div id="verse_main" class="verse_main">
    <slot id="slot0"/>
  </div>
</div>
  `;

    const shadow = this.attachShadow({ mode: "closed" });
    shadow.appendChild(template.content.cloneNode(true));
    this.nr=shadow.getElementById("nr");
    this.slot0 = shadow.getElementById("slot0");
    this.blocklink=shadow.getElementById("blocklink");
    this.main=shadow.getElementById("verse_main");
    this.link=shadow.getElementById("verse_link");
    this.sidechords=shadow.getElementById("verse_sidechords");
    this.linkSel=shadow.getElementById("verse_link_sel");
    this.buttonDelete=shadow.getElementById("delete");
    this.blocklink.addEventListener("input", (e) => this.blocklinkoninput(e, this));
    this.linkSel.addEventListener("input", (e) => this.inputLinkVerse(e, this));
    this.buttonDelete.addEventListener("click", (e) => this.remove());
    this.btRadios={}
    for (const bt_radio of shadow.querySelectorAll('input[name="block_type"]')) {
      bt_radio.addEventListener("input", (e) => this.refoninput(e, this));
      this.btRadios[bt_radio.value]=bt_radio;
    }
    const observer = new MutationObserver(()=> {this.refreshSidechords();});
    observer.observe(this, { attributes: false, childList: true, subtree: true, characterData:false });

    this.resizeObserver = new ResizeObserver( (entries) => {
      for (const e of entries) {
        if (e.target.siblingSide) {
          e.target.siblingSide.style.height = e.borderBoxSize[0].blockSize + "px";
        }
      }
    });
  }

  onChangedChord() {
    this.refreshSidechords()
  }

  refreshSidechords() {
    this.resizeObserver.disconnect();

    // Trick to not jump too much
    this.sidechords.style.width = this.sidechords.getBoundingClientRect().width + "px";

    let newsc = document.createDocumentFragment()
    if (!this.getAttribute("blocknb")) {
      let rows = this.getElementsByTagName("song-row");
      for (let r of rows) {
        const ed = document.createElement("song-side-chords")
        ed.setRow(r);
        newsc.appendChild(ed);
        r.siblingSide = ed;
        this.resizeObserver.observe(r);
      }
    }

    this.sidechords.replaceChildren(newsc)
    this.sidechords.style.removeProperty("width");
  }

  refoninput(e, verse) {
    if (this.btRadios.chorus.checked) {
      verse.setAttribute("type", "chorus");
    }
    if (this.btRadios.verse.checked) {
      verse.setAttribute("type", "verse");
    }
    if (this.btRadios.other.checked) {
      verse.setAttribute("type", "other");
    }

    verse.refresh();
  }

  refresh() {
    this.updateClass()
    this.updateVisibility();
    this.refreshSidechords();
  }


  blocklinkoninput(e, verse) {
    if (verse.blocklink.checked) {
      verse.setAttribute("blocknb", "?");
    } else {
      const referred = this.getReferred();
      verse.removeAttribute("blocknb");
      if (referred) {
        verse.innerHTML=referred.innerHTML;
      }
    }

    verse.refresh();
  }


  inputLinkVerse(e, verse) {
    let r = document.getElementById(verse.linkSel.value);
    if (r) {
      verse.setAttribute("blocknb", r.id);
      verse.setRadioToType(r.getAttribute('type'));
    } else {
      verse.setAttribute("blocknb", "?");
      verse.setRadioToType('?');
    }

    this.refoninput(e, verse);
  }

  updateClass() {
    if (this.isChorus()) {
      this.main.classList.add("chorus");
      this.link.classList.add("chorus");
    } else {
      this.main.classList.remove("chorus");
      this.link.classList.remove("chorus");
    }
  }

  updateVisibility() {
    if (this.getAttribute("blocknb")) {
      this.main.hidden = true;
      this.link.hidden = false;
      this.btRadios.chorus.disabled = true;
      this.btRadios.verse.disabled = true;
      this.btRadios.other.disabled = true;
    } else {
      this.main.hidden = false;
      this.link.hidden = true;
      this.btRadios.chorus.disabled = false;
      this.btRadios.verse.disabled = false;
      this.btRadios.other.disabled = false;
    }
  }

  connectedCallback() {
    if (this.getAttribute("blocknb") &&
        !isNaN(this.getAttribute("blocknb"))) {
      let offset=parseInt(this.getAttribute("blocknb"));
      if (offset && !isNaN(offset)) {
        let j=0;
        let toSet='?';
        for (let i=0; i < this.parentNode.childNodes.length; ++i) {
          let v=this.parentNode.childNodes[i];
          if (v.nodeName==='SONG-VERSE' && !v.getAttribute('blocknb')) {
            j++;
          }
          if (j==offset) {
            toSet=v.id;
            break;
          }
        }
        this.setAttribute("blocknb", toSet);
      }
    }

    this.observer = new MutationObserver((mutations) => this.refreshPosition(this, mutations));
    console.log("Observing:", this.parentNode);
    this.refreshPosition(this)
    this.observer.observe(this.parentNode, { attributes: true, childList: true, subtree: true });
  }

  disconnectedCallback() {
    this.observer.disconnect();
  }

  refreshPosition(verse, mutations) {
    if (!verse.parentNode) {
      console.warn("refresh-position disconnected");
      return;
    }
    verse.blocklink.disabled=!verse.previousSibling;

    if (verse.isVerse()) {
      let j=0;
      for (let i=0; i < verse.parentNode.childNodes.length; ++i) {
        let v =verse.parentNode.childNodes[i];
        if (v.nodeName!=='SONG-VERSE') {
          continue;
        }
        if (v.isVerse()) {
          j=j+1;
        }
        if (v===this) {
          verse.nr.innerText = j+".";
          break;
        }
      }
    } else if (verse.isChorus()) {
      verse.nr.innerText='Ref:';
    } else {
      verse.nr.innerText='';
    }

    while(verse.linkSel.options.length>0) {
      verse.linkSel.options.remove(0);
    }

    verse.linkSel.add(new Option("[ wybierz zwrotkę ]", "?"));

    for (let i=0; i < verse.parentNode.childNodes.length; ++i) {
      let v = verse.parentNode.childNodes[i];
      if (v == this) {
        break;
      }
      if (v.nodeName==='SONG-VERSE'&& !v.getAttribute("blocknb")) {
        verse.linkSel.add(new Option(v.shortRep(), v.id, false, v.id===verse.getAttribute("blocknb")));
        if (v.id===verse.getAttribute("blocknb")) {
          verse.setRadioToType(v.getAttribute('type'));
        }
      }
    }

  }

  isChorus() {
    let r=this.getReferred();
    if (r) {
      return r.isChorus();
    } else {
      return this.getAttribute("type") == 'chorus';;
    }
  }

  isVerse() {
    let r=this.getReferred();
    if (r) {
      return r.isVerse();
    } else {
      return this.getAttribute("type") == 'verse';;
    }
  }

  getReferred() {
    if (this.getAttribute("blocknb")) {
      return document.getElementById(this.getAttribute("blocknb"));
    } else {
      return null;
    }
  }

  shortRep() {
    if (this.childNodes.length<1) {
      return null;
    }

    let rows = this.getElementsByTagName("song-row");
    return rows.length>0? rows[0].innerText : null;
  }

  static get observedAttributes() {
    return ["blocknb", "type"]
  }

  attributeChangedCallback(attr) {
    console.log("Attribute changed...", attr)
    if (attr=='type') {
      this.refreshAttributes();
    }
    if (attr=="blocknb") {
      this.blocklink.checked = this.getAttribute("blocknb");
    }
    this.updateClass();
    this.updateVisibility();
  }

  refreshAttributes() {
    this.setRadioToType(this.getAttribute("type"));
  }

  setRadioToType(t) {
    this.btRadios.chorus.checked = t=='chorus';
    this.btRadios.verse.checked = t=='verse' || t=='';
    this.btRadios.other.checked = t=='other';
  }
}


export class SongBis extends HTMLElement {
  constructor() {
    super();

    const template = document.createElement('template');
    template.innerHTML = `
<link rel="stylesheet" href="verse.css"/>
<div class="bis">
  <div class="bis_main"><slot/></div>
  <div class="bis_meta"><label id='xl' for="x">x</label><input type="number" id="x" min="1" max="99"/></div>
</div>
  `;

    const shadow = this.attachShadow({ mode: "closed" });
    shadow.appendChild(template.content.cloneNode(true));
    this.x=shadow.getElementById("x");
    this.x.addEventListener("input", (e) => {this.input(e, this)});
  }

  input(e, songbis) {
    songbis.setAttribute("x", e.target.value);
  }

  connectedCallback() {
    this.attributeChangedCallback();
  }

  attributeChangedCallback() {
    this.x.value = this.getAttribute("x");
  }

  static get observedAttributes() {
    return ["x"]
  }

  focus() {
    this.x.focus();
  }
}

export function getChordsFromRow(row) {
  let text="";
  for (let i=0; i < row.childNodes.length; ++i) {
    let n = row.childNodes[i];
    if (n.nodeName==='SONG-CH') {
      text+=n.getAttribute("a") + " ";
    }
  }
  return text.trim().replaceAll(nbsp, " ")
}

export function setSideChordsForRow(row, ch) {
  const chr=getChordsFromRow(row);
  if (row.getAttribute('type')=='instr') {
    pushRowChords(row, ch)
  }
  if (chr===ch.trim()) {
    console.log("Side and main back in sync")
    row.removeAttribute("sidechords");
  } else {
    console.log(`Side and main not in sync: '${chr}'!='${ch.trim()}'`)
    row.setAttribute("sidechords", ch.trim());
  }
}

export function getSideChordsForRow(row) {
  let sch = row.getAttribute("sidechords");
  if (sch) { // Even empty sch - means explicitly no children in the subtree.
    return sch.trim();
  } else {
    return getChordsFromRow(row);
  }
}

export function SongVerseBisInit() {
  SideChordsInit();
  customElements.define("song-verse", SongVerse);
  customElements.define("song-bis", SongBis);
}

export function getNextRow(row) {
  if (row.nextSibling && row.nextSibling.nodeName=='SONG-ROW') {
    return row.nextSibling;
  }
  let songbody = findAncestor(row, "SONG-BODY");
  let rows = songbody.getElementsByTagName("song-row");
  for (let i=0; i < rows.length; ++i) {
    if (rows[i]==row) {
      return i<rows.length-1 ? rows[i+1] : null;
    }
  }
}

export function getPrevRow(row) {
  if (row.previousSibling && row.previousSibling.nodeName=='SONG-ROW') {
    return row.previousSibling;
  }
  let songbody = findAncestor(row, "SONG-BODY");
  let rows = songbody.getElementsByTagName("song-row");
  for (let i=rows.length-1; i>=0; --i) {
    if (rows[i]==row) {
      return i>1 ? rows[i-1] : null;
    }
  }
}