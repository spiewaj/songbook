import {findAncestor, nbsp} from "./utils.js";

const predefinedChords = ["A", "A2", "A4", "A7", "A7+", "A7/4", "A7/6", "Ais",
  "B", "C", "C0", "C7", "C7+", "C9", "C9/5", "Cis", "Cis0", "D", "D2", "D4",
  "D7", "D7+", "Dis", "E", "E0", "E5+", "E7", "E7/4", "F", "F0", "F7", "F7+",
  "Fis", "Fis0", "Fis7", "G", "G0", "G6", "G7", "GC", "Gis", "H", "H6/7", "H7",
  "a", "a6", "a7", "a7+", "a7/9", "ais", "b", "c", "cis", "cis7", "d", "d2",
  "d6", "e", "e7", "e9", "f", "fis", "fis7", "g", "gis", "gis7", "h", "h0",
  "h7", "h7/5-"];

const chtemplate = document.createElement('template');

export default class SongCh extends HTMLElement {
  constructor() {
    super();

    const shadow = this.attachShadow({ mode: "closed" });
    shadow.appendChild(chtemplate.content.cloneNode(true));
    shadow.appendChild(predefinedChordsList());

    this.ch = shadow.getElementById("ch");
    this.che = shadow.getElementById("che");
    this.cho = shadow.getElementById("cho");

    this.ch.ondblclick = (event) => {
      console.log("CH-double-click");
      this.setAttribute("editing", "true");
      this.updateEditing();
    };
    this.che.onchange = (event) => {
      this.setAttribute("a", this.che.value);
      this.verse.onChangedChord();
    };
    this.che.onblur = (event) => {
      let storedParent = this.parentNode;
      const nextSibling = this.nextSibling;
      this.setAttribute("editing", "false");
      this.updateEditing();

      this.select(storedParent, nextSibling);
      //this.selectParent(storedParent);
    }
    this.ch.onmousedown = (event) => {
      // We need to prevent the parent to catch the double click
      // and intepret as chord creation.
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
    this.cho.ondragstart = (event) => {
      event.target.opacity = "0.2";
      event.dataTransfer.effectAllowed = "copyMove";
      event.dataTransfer.dropEffect = "move";
      event.dataTransfer.setData("songbook/chord", this.getAttribute("a"));
      this.getSongBody().dropped = false;
    }

    this.cho.ondragend = (event) => {
      console.log("dragend", event.dataTransfer.dropEffect, event);
      event.target.opacity = '1.0';
      if (/*this.getSongBody().dropped &&*/ event.dataTransfer.dropEffect == 'move') {
        this.remove();
      }
    }

    this.onkeydown = (e) => {
      if (e.key == 'Enter' || e.key == 'Escape' || e.key == 'Tab') {
        if (this.che.value.trim() == '' && this.parentNode) {
          this.remove();
          return;
        }
      }
      if (e.key == 'Enter') {
        this.selectParent(this.parentNode);
        e.preventDefault();
      }
    }
    this.updateEditing();
  }

  getSongBody() {
    return this.closest('song-body');
  }

  isEditing() {
    return this.getAttribute("editing")==="true";
  }

  select(row, toSelect) {
    row.focus();
    let r = document.createRange();
    if (!toSelect) {
      let t=document.createTextNode(nbsp);
      row.appendChild(t);
      r.selectNodeContents(t);
    } else {
      r.setStartBefore(toSelect);
    }
    document.getSelection().removeAllRanges();
    document.getSelection().addRange(r);
  }

  selectParent(storedParent) {
    this.select(storedParent, this.nextSibling);
  }

  connectedCallback() {
    const songBody = findAncestor(this, "SONG-BODY");
    this.row = findAncestor(this, "SONG-ROW");
    this.verse = findAncestor(this, "SONG-VERSE");
    new ResizeObserver(() => songBody.recomputeChordsOffsets()).observe(this.ch);
  }

  recomputeOffset() {
    if (this.offset) {
      return this.offset;
    }
    if (this.previousSibling && this.previousSibling.nodeName==='SONG-CH') {
      this.offset = this.previousSibling.recomputeOffset() + this.previousSibling.ch.getBoundingClientRect().width + 1;
    } else {
      this.offset = 0;
    }
    this.cho.style.left = this.offset + "px";
    return this.offset;
  }

  resetOffset() {
    this.offset=null;
  }

  updateEditing() {
    this.che.hidden=!this.isEditing();
    this.che.style.display = this.isEditing() ? 'inline' : 'none';
    this.ch.hidden=this.isEditing();
    this.ch.style.display = !this.isEditing() ? 'inline' : 'none';
    if (this.isEditing()) {
      this.che.value = this.getAttribute("a");
  //    this.che.select();
      this.che.focus();
    }
  }

  focus(options) {
    //super.focus(options);
    if (this.isEditing()) {
      this.che.focus();
    }
  }

  static get observedAttributes() {
    return ['a', "editing"];
  }

  attributeChangedCallback() {
    this.updateChord();
    this.updateEditing();
  }

  updateChord() {
    this.ch.innerText=this.getAttribute("a");
    this.che.value=this.getAttribute("a");
  }
}

function predefinedChordsList() {
  let dl = document.createElement("datalist");
  dl.id = "predefinedChords";
  predefinedChords.forEach(
      (ch) => {
        let opt = document.createElement("option");
        opt.value = ch;
        dl.appendChild(opt);
      }
  );
  return dl;
}

export function SongChInit() {
  chtemplate.innerHTML =
      `<link rel="stylesheet" href="./ch.css"/>` +
      `<span class="cho" id="cho" draggable="true" contenteditable="false">`+
      `<span class="ch" id="ch" draggable="false" contenteditable="false"></span>` +
      `<input type="text" class="ch" id="che" list="predefinedChords" />` +
      `</span>`;

  customElements.define("song-ch", SongCh);
}

export function createChord(chord) {
  let ch = document.createElement("song-ch");
  ch.setAttribute('a', chord);
  return ch;
}
