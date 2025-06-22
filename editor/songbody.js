import {
  findAncestor,
  getRangeForCursor,
  nbsp,
  removeAllChildren,
  mergeNodeAfter,
  setCursorBefore,
  setCursorAfter
} from './utils.js';
import {createChord} from './ch.js'
import {createVerse, Sanitize, SplitVerseFromRow} from './sanitize.js'
import {getChordsFromRow} from "./verse.js";

function acceptsTextAndChords(element) {
  return element.nodeName=="SONG-ROW" && element.getAttribute("type")!=='instr';
}

function getChordSelected() {
  if (window.getSelection().rangeCount < 1) {return false; }
  let r = window.getSelection().getRangeAt(0);
  if (r.collapse
      && (r.startOffset < r.startContainer.childNodes.length)
      && r.startContainer.childNodes[r.startOffset].nodeName === 'SONG-CH') {
    return r.startContainer.childNodes[r.startOffset];
  }
  return null;
}

function isChordSelected() {
  return getChordSelected() != null;
}

export function isRowInstr(row) {
  return row.getAttribute('type','normal') == 'instr';
}

function canInsertChord() {
  if (window.getSelection().rangeCount < 1) {return false; }
  let r = window.getSelection().getRangeAt(0);
  if (r.startContainer.nodeName == '#text'
      && acceptsTextAndChords(r.startContainer.parentNode)) {
    return true;
  }
  if (isChordSelected()) {
    return true;
  }
  let x =
      //acceptsTextAndChords(r.startContainer);
      (r.startContainer.nodeName == '#text'
          && acceptsTextAndChords(r.startContainer.parentNode));
  return x;
}

export function makeRowNotInstrumental(row) {
  // let chords = row.innerText.replaceAll(' ', nbsp).split(nbsp);
  // console.log(chords);
  if (isRowInstr(row)) {
    row.removeAttribute("type");
    removeTextFromRow(row);
    // removeAllChildren(row);
    // for (let i=0; i<chords.length; ++i) {
    //   row.appendChild(createChord(chords[i]));
    //   row.appendChild(document.createTextNode(nbsp + nbsp));
    // }
    // row.normalize();
    if (row.siblingSide) {
      row.siblingSide.loadRow();
    }
    notifyRowParentAboutChange(row);
  }
}

export function pushRowChords(row, text) {
  let chords = text.replaceAll(' ', nbsp).split(nbsp);
  // console.log(chords);
  // if (row.getAttribute('type')=='instr') {
  //   row.removeAttribute("type");
  let c = row.firstChild;
  while (c != null) {
    let n=c.nextSibling
    if (c.nodeName=='SONG-CH') {
      c.remove()
    }
    c=n
  }
  for (let i=0; i<chords.length; ++i) {
    if (chords[i] != '|' && chords[i] != '(' && chords[i] != '!' && chords[i] != ')') {
      row.appendChild(createChord(chords[i]));
    }
  //  row.appendChild(document.createTextNode(nbsp + nbsp));
  }
  row.normalize();
  notifyRowParentAboutChange(row);
}

function removeTextFromRow(row) {
  let it=row.firstChild;
  while (it != null) {
    let n=it.nextSibling;
    if (it.nodeName=='#text') {
      it.remove();
    }
    it = n;
  }
}

export const instrRowPhrase='[wers instrumentalny]';

export function makeRowInstrumental(row) {
  row.setAttribute("type", "instr");
  row.removeAttribute('important_over');
  removeTextFromRow(row);
  row.insertBefore(document.createTextNode(instrRowPhrase), null);
  if (row.siblingSide) {
    row.siblingSide.loadRow();
  }
  notifyRowParentAboutChange(row);
}

export function notifyRowParentAboutChange(row) {
  const songbody = findAncestor(row, 'SONG-BODY');
  if (songbody) {
    songbody.changePostprocess();
  }
}

function insertChordHere(ch) {
  if (canInsertChord()) {
    let chedit = createChord("");
    chedit.setAttribute("editing", "true");
    window.getSelection().getRangeAt(0).insertNode(chedit);
    chedit.focus();
    return true;
  }
  return  false;
}

function flattenBis(node) {
  if (!node) {
    return;
  }
  let rows = node.childNodes[0].childNodes;
  while (rows.length > 0) {
    node.parentNode.insertBefore(rows[0], node);
  }
  node.remove();
}

export default class SongBody extends HTMLElement {
  constructor() {
    super();

    const template = document.createElement('template');
    template.innerHTML = `
<link rel="stylesheet" href="./song.css"/>
<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet"/>
<div class="toolbar">
    <div class="formatting">Formatowanie:
      <button id="buttonChord"><i class="material-icons">format_overline</i>Wstaw akord</button>
      <button id="buttonSplit"><i class="material-icons">insert_page_break</i>Podziel zwrotkę</button>
      <button id="buttonBis"><i class="material-icons">repeat_on</i>BIS</button><i id="help-bis-icon" class="material-icons">help</i>
      <div id="help-bis" class="help">Zaznaczone wiersze będą powtarzane. Ustaw licznik na 1 by wyłączyć.</div>
      
      <div>
        <button id="importantOver"><i class="material-icons">assignment_late</i>Kluczowe akordy</button>
        <button id="notImportantOver"><i class="material-icons">assignment_late</i>Opcjonalnie nad</button>
        <button id="sideOnly"><i class="material-icons">assignment_late</i>Tylko z boku</button>
      </div>
      
      <button id="buttonInstr"><i class="material-icons">music_note</i>Wers instrumentalny</button><i id="help-instr-icon" class="material-icons">help</i>
      <div id="help-instr" class="help">Wers zawierający tylko akordy. Odzielaj je spacjami.</div>
      
      <button id="buttonUndo"><i class="material-icons">undo</i>Confij</button>
      <button id="buttonRedo"><i class="material-icons">redo</i>Ponów</button>
    </div>    
</div>
<div class="songbody" id="songbody"><slot></slot><button id="appendVerse"><i class="material-icons">add</i>Dodaj zwrotkę</button></div>`;

    const shadow = this.attachShadow({ mode: "closed" });
    shadow.appendChild(template.content.cloneNode(true));
    this.body=shadow.getElementById("songbody");

    this.body.addEventListener("mousedown", this.mouseDown);
   // this.body.addEventListener("click", this.click);
    this.body.addEventListener("dragover", (e) => {this.dragOver(e, this); });
    this.body.addEventListener("dragstart", (e) => {this.dragStart(e, this); });
    this.body.addEventListener("dragend", (e) => {this.dragEnd(e, this); });
    this.body.addEventListener("drop", (e) => {this.drop(e, this); });
  //  this.body.addEventListener("keydown", (e) => { this.keyDown(e, this); });
    this.body.addEventListener("focusout", (e) => {this.focusout(e, this); });

    this.buttonAppendVerse=shadow.getElementById("appendVerse");

    this.buttonBis=shadow.getElementById("buttonBis");

    this.importantOver=shadow.getElementById("importantOver");
    this.notImportantOver=shadow.getElementById("notImportantOver");
    this.sideOnly=shadow.getElementById("sideOnly");

    this.buttonInstr=shadow.getElementById("buttonInstr");
    this.buttonChord=shadow.getElementById("buttonChord");
    this.buttonSplit=shadow.getElementById("buttonSplit");

    this.buttonUndo=shadow.getElementById("buttonUndo");
    this.buttonRedo=shadow.getElementById("buttonRedo");
    this.buttonUndo.addEventListener("click", (e) => this.doUndo());
    this.buttonRedo.addEventListener("click", (e) => this.doRedo());

    this.buttonBis.addEventListener("click", (e) => this.wrapBis());

    this.importantOver.addEventListener("click", (e) => { this.toggleImportantOver("true"); this.refresh(); });
    this.notImportantOver.addEventListener("click", (e) => { this.toggleImportantOver("false"); this.refresh(); });
    this.sideOnly.addEventListener("click", (e) => { this.toggleImportantOver("never"); this.refresh(); });

    this.buttonInstr.addEventListener("click", (e) =>  { this.toggleInstrumental(); this.refresh(); });
    this.buttonChord.addEventListener("click", (e) =>  { insertChordHere(""); this.refreshToolbar(); });
    this.buttonSplit.addEventListener("click", (e) =>  { this.splitVerse(); this.refreshToolbar(); });

    this.buttonAppendVerse.addEventListener("click", (e) => {this.appendVerse(); this.refreshToolbar(); });

    document.addEventListener('selectionchange', (event) => { this.refreshToolbar(); });

    this.shadow = shadow;
    this.initHelp("help-bis");
 //   this.initHelp("help-io");
    this.initHelp("help-instr");

    this.reset();
  }

  reset() {
    this.undo=[];
    this.redo=[];
  }

  initHelp(id) {
    const helpDiv = this.shadow.getElementById(id);
    const helpIcon = this.shadow.getElementById(id+"-icon");
    helpDiv.hidden = true;
    helpDiv.addEventListener("click", (e) => {helpDiv.hidden = true;});

    helpIcon.addEventListener("click", (e) => {helpDiv.hidden^=true;} );
  }

  refreshToolbar() {
    this.importantOver.disabled = this.allSelectedImportant();

    if (this.allSelectedInstrumental()) {
      this.buttonInstr.innerHTML='<i class="material-icons">lyrics</i>Wers liryczny';
    } else {
      this.buttonInstr.innerHTML='<i class="material-icons">music_note</i>Wers instrumentalny';
    }
    this.buttonBis.disabled = document.getSelection().rangeCount==0;
  }

  focusout(e, songbody) {
    console.log("focusout", e);
    if (e.target.nodeName==='SONG-BIS'
        && (e.target.getAttribute("x").trim()==="1"
            || e.target.getAttribute("x").trim()===""
            || e.target.getAttribute("x").trim()==="0")) {
      flattenBis(e.target);
    }
    songbody.changePostprocess();
  }

  connectedCallback() {
    this.parentNodeBackup = this.parentNode;
    this.beforeInputHandler = (e) => { this.beforeInput(e, this); };
    this.parentNode.addEventListener("beforeinput", this.beforeInputHandler);
    this.inputHandler = (e) => { this.input(e, this); };
    this.parentNode.addEventListener("input", this.inputHandler);
    this.keyDownHandler = (e) => this.keyDown(e, this);
    this.parentNode.addEventListener("keydown", this.keyDownHandler);
    this.pasteHandler = (e) => { this.paste(e, this); };
    this.parentNode.addEventListener("paste", this.pasteHandler);
  }

  disconnectedCallback() {
    if (this.parentNodeBackup) {
      this.parentNodeBackup.removeEventListener("beforeinput", this.beforeInputHandler);
      this.parentNodeBackup.removeEventListener("input", this.inputHandler);
      this.parentNodeBackup.removeEventListener("keydown", this.keyDownHandler);
      this.parentNodeBackup.removeEventListener("paste", this.pasteHandler);
    }
  }

  selectedRows() {
    if (document.getSelection().rangeCount == 0) {
      return [];
    }
    let r = document.getSelection().getRangeAt(0);
    let result=[];

    let songRowsParent = findAncestor(r.commonAncestorContainer,"SONG-ROWS");
    if (songRowsParent) {
      let rows = songRowsParent.getElementsByTagName("SONG-ROW");
    //  let parentRow = findAncestor(r.commonAncestorContainer, "SONG-ROW");
      for (let i = 0; i < rows.length; ++i) {
        let row = rows[i];
        if (r.intersectsNode(row)) {
          result.push(row);
        }
      }
    }
    return result;
  }


  wrapBis() {
    let selRows = this.selectedRows();
    if (selRows.length>0) {
      let r = document.getSelection().getRangeAt(0);
      let songRowsParent = findAncestor(r.commonAncestorContainer,"SONG-ROWS");
      if (songRowsParent) {
        let selRows = this.selectedRows();

        flattenBis(findAncestor(r.startContainer, "SONG-BIS"));
        flattenBis(findAncestor(r.endContainer, "SONG-BIS"));

        let biss = songRowsParent.getElementsByTagName("SONG-BIS");
        for (let i = 0; i < biss.length; ++i) {
          console.log("Considering", biss[i]);
          if (r.intersectsNode(biss[i])) {
            flattenBis(biss[i]);
          }
        }

        if (selRows.length > 0) {
          songRowsParent = selRows[0].parentNode;
          let bis = document.createElement("song-bis");
          bis.setAttribute("x", "2");
          let bisRows = document.createElement("song-rows");
          bis.appendChild(bisRows);
          songRowsParent.insertBefore(bis, selRows[0]);
          bisRows.append(...selRows);
          bis.focus();
        }
      }
    }
  }

  toggleImportantOver(important_over) {
    let selRows = this.selectedRows();
    for (let i = 0; i < selRows.length; ++i) {
      selRows[i].setAttribute("important_over", important_over);
    }
  }

  splitVerse() {
    let selRows = this.selectedRows();
    if (selRows.length > 0) {
      SplitVerseFromRow(selRows[selRows.length - 1]);
    }
  }

  appendVerse() {
    const v = createVerse();
    const rows = document.createElement("song-rows")
    const row = document.createElement("song-row");
    rows.appendChild(row);
    v.appendChild(rows);
    this.insertBefore(v, null);
    v.focus();
    document.getSelection().collapse(row);
  }

  toggleInstrumental() {
    let allInstrumental = this.allSelectedInstrumental();
    let selRows = this.selectedRows();
    for (let i = 0; i < selRows.length; ++i) {
      if (allInstrumental) {
        makeRowNotInstrumental(selRows[i]);
      } else {
        makeRowInstrumental(selRows[i])
      }
    }
    console.log(this);
    this.changePostprocess();
  }

  selectAll() {
    let r=document.createRange();
    let rows=this.getElementsByTagName("SONG-ROW");
    r.setStartBefore(rows[0].firstChild);
    r.setEndAfter(rows[rows.length-1].lastChild);
    document.getSelection().removeAllRanges();
    document.getSelection().addRange(r);
    //document.getSelection().selectAllChildren(this.body);
    this.body.focus();
  }

  allSelectedImportant() {
    let selRows = this.selectedRows();
    let allImportant=true;
    for (let i=0; i<selRows.length; ++i) {
     // console.log("allSelectedImportant: considering", selRows[i])
      allImportant &&= selRows[i].getAttribute("important_over")==="true";
    }
    return allImportant;
  }

  allSelectedInstrumental() {
    let selRows = this.selectedRows();
    let allInstrumental=true;
    for (let i=0; i<selRows.length; ++i) {
      allInstrumental &&= selRows[i].getAttribute("type")==="instr";
    }
    return allInstrumental;
  }

  dragStart(e, songbook) {
    songbook.toRemoveWhenDropped = getSelection().getRangeAt(0).cloneRange();
    e.dataTransfer.effectAllowed="copyMove";
  }
  dragEnd(e, songbook) {
    songbook.toRemoveWhenDropped = null;
  }

  mouseDown(e) {
    console.log("mouseDown", e);
    if (e.detail > 1 && canInsertChord() && e.target.nodeName==='SONG-ROW') {
      if (insertChordHere("")) {
        e.preventDefault();
      }
    }
  }

  // click(e) {
  //   console.log("click", e);
  //   if (e.target.nodeName==='SONG-ROW' && e.target.getAttribute('type')=='instr') {
  //     makeRowNotInstrumental(e.target);
  //   }
  //   //   if (insertChordHere("")) {
  //   //     e.preventDefault();
  //   //   }
  //   // }
  // }

  keyDown(e,songBook) {
    console.log("keydown...",e, document.getSelection());
    if (e.key == '`' && canInsertChord()) {
      if (insertChordHere("")) {
        e.preventDefault();
      }
    }
    if (e.key == 'Backspace'){
      if (document.getSelection().isCollapsed
          && document.getSelection().rangeCount == 1
          && document.getSelection().type === 'Range') {
        let r = document.getSelection().getRangeAt(0);
        if (r.startOffset < r.startContainer.childNodes.length &&
            r.startContainer.childNodes[r.startOffset].nodeName=='SONG-CH') {
          r.startContainer.childNodes[r.startOffset].remove();
          e.preventDefault();
        }
      }
    }

    if (e.key == 'ArrowRight'){
      if (document.getSelection().isCollapsed
          && document.getSelection().rangeCount == 1
          && document.getSelection().type === 'Caret') {
        let r = document.getSelection().getRangeAt(0);
        if (r.collapsed && r.startContainer.nodeName==='#text' && r.startOffset >= r.startContainer.nodeValue.length
            && r.startContainer.nextSibling
            && r.startContainer.nextSibling.nodeName==='SONG-CH') {
          let ch = r.startContainer.nextSibling;
          while (ch && ch.nodeName==='SONG-CH') {
            ch = ch.nextSibling;
          }
          if (ch) {
            document.getSelection().collapse(ch);
          }
          e.preventDefault();
        }
      }
    }

    if (e.key == 'ArrowLeft'){
      if (document.getSelection().isCollapsed
          && document.getSelection().rangeCount == 1
          && document.getSelection().type === 'Caret') {
        let r = document.getSelection().getRangeAt(0);
        if (r.collapsed && r.startContainer.nodeName==='#text' && r.startOffset == 0
            && r.startContainer.previousSibling
            && r.startContainer.previousSibling.nodeName==='SONG-CH') {
          let ch = r.startContainer.previousSibling;
          while (ch && ch.nodeName==='SONG-CH') {
            ch = ch.previousSibling;
          }
          if (ch) {
            document.getSelection().collapse(ch, ch.nodeValue.length);
          }
          e.preventDefault();
        }
      }
    }

    if (e.key == 'b'  && e.metaKey) {
      songBook.wrapBis();
      e.preventDefault();
    }
  }

  dragOver(e, songbook) {
    if (e.dataTransfer.types.includes("songbook/chord")) {
      if (e.altKey) {
        e.dataTransfer.dropEffect = 'copy';
      } else {
        e.dataTransfer.dropEffect = 'move';
      }
      let range = getRangeForCursor(e);
      document.getSelection().removeAllRanges();
      document.getSelection().addRange(range);
      if (!canInsertChord()) {
        e.dataTransfer.dropEffect = 'none';
      };
      e.preventDefault();
    }
  }

  drop(e, songbody) {
    let d = e.dataTransfer.getData("songbook/chord");
    if (d != null && d != "") {
      let range = getRangeForCursor(e)
      console.log('RANGE for DROP', range);
      if (acceptsTextAndChords(range.commonAncestorContainer.parentNode)) {
        range.insertNode(createChord(d));
        songbody.dropped = true;
      } else if (isChordSelected()) {
        const selectedChord = getChordSelected();
        selectedChord.parentNode.insertBefore(createChord(d), selectedChord.nextSibling);
        songbody.dropped = true;
      } else {
        console.log('Drop refused', e);
      }
      e.preventDefault();
      songbody.changePostprocess();
      return;
    }

    d = e.dataTransfer.getData("text/html");
    if (d != null && d != "") {
      console.log("Special!!!", e.dataTransfer.dropEffect);

      if ((e.dataTransfer.dropEffect === 'move' || !e.altKey) &&
          songbody.toRemoveWhenDropped != null) {
        songbody.toRemoveWhenDropped.deleteContents();
      }

      let range = getRangeForCursor(e)
      let span = document.createElement("span");
      span.innerHTML=d;
      range.insertNode(span);
      songbody.changePostprocess();
      e.preventDefault();

      return;
    }

  }

  beforeInput(e, songbody) {
    console.log("beforeInput", e);

    if (e.target != songbody) {
      return;
    }

    let r = document.getSelection().getRangeAt(0);
    const row = findAncestor(r.startContainer, 'SONG-ROW');
    if (e.inputType=='insertText' && row && isRowInstr(row)) {
      makeRowNotInstrumental(row);
      const pre = document.createTextNode(nbsp);
      row.insertBefore(pre, null);
      setCursorBefore(pre);
      e.preventDefault();
      return;
    }

    if (e.inputType == "deleteContentBackward"
       && e.target == songbody) {
      if (document.getSelection().rangeCount == 1
          && document.getSelection().isCollapsed) {
        let r = document.getSelection().getRangeAt(0);
        console.log(document.getSelection(), r.startContainer.nodeName, r.startContainer, r.startOffset)
        // If the previous element is chord, we want to skip and remove the prev letter.
        if (r.startContainer.nodeName == '#text' && r.startOffset == 0
            && r.startContainer.previousSibling != null
            && r.startContainer.previousSibling.nodeName === 'SONG-CH') {
          setCursorBefore(r.startContainer.previousSibling);
          r = document.getSelection().getRangeAt(0);
          // We want to continue in case we want to merge rows.
        }
        // If we are after the trailing space... we want to remove it as well.
        if (r.startContainer.nodeName == '#text' && r.startOffset == 1
            && r.startContainer.previousSibling == null
            && r.startContainer.nodeValue.startsWith(nbsp)) {
          r.startContainer.nodeValue = r.startContainer.nodeValue.substring(1);
          if (r.startContainer.parentNode.previousSibling != null) {
            mergeNodeAfter(r.startContainer.parentNode.previousSibling,
                r.startContainer.parentNode);
            e.preventDefault();
          }
        }
        // When we are at the beginning of the ROW, we merge the rows.
        if (r.startContainer.nodeName == 'SONG-ROW' && r.startOffset == 0) {
          if (r.startContainer.previousSibling != null
              && r.startContainer.previousSibling.nodeName === 'SONG-ROW') {
            // There is previous line:
            mergeNodeAfter(r.startContainer.previousSibling, r.startContainer);
            e.preventDefault();
          } if (r.startContainer.previousSibling != null
              && r.startContainer.previousSibling.nodeName === 'SONG-BIS') {
            // Previous line is within bis.
            mergeNodeAfter(r.startContainer.previousSibling.childNodes[0].lastChild, r.startContainer);
            e.preventDefault();
          } else if (r.startContainer.previousSibling == null
              && r.startContainer.parentNode.parentNode != null
              && r.startContainer.parentNode.parentNode.nodeName === 'SONG-BIS'
              && r.startContainer.parentNode.parentNode.previousSibling != null
              && r.startContainer.parentNode.parentNode.previousSibling.nodeName == 'SONG-ROW' ) {
            // Previous line is outside of bis.
            mergeNodeAfter(r.startContainer.parentNode.parentNode.previousSibling,
                r.startContainer);
            e.preventDefault();
          } else if (r.startContainer.previousSibling == null
              && r.startContainer.parentNode.parentNode.previousSibling != null
              && r.startContainer.parentNode.parentNode.previousSibling.nodeName === 'SONG-VERSE') {
            // Previous line is in another verse.
            mergeNodeAfter(r.startContainer.parentNode.parentNode.previousSibling.childNodes[0],
                r.startContainer.parentNode);
            r.startContainer.remove();
            e.preventDefault();
          }
        }
        if (r.startContainer.nodeName == 'SONG-ROW' && r.startOffset == 1) {
          if (r.startContainer.previousSibling != null
              && r.startContainer.previousSibling.nodeName === 'SONG-ROW'
              && r.startContainer.childNodes[0].nodeName==='#text'
              && r.startContainer.childNodes[0].nodeValue===nbsp) {
            r.startContainer.childNodes[0].remove();
            mergeNodeAfter(r.startContainer.previousSibling, r.startContainer);
            e.preventDefault();
          }
        }
        // When we are at the beginning of the ROW, we merge the rows.
        if (r.startContainer.nodeName == '#text' && r.startOffset == 0) {
          if (r.startContainer.previousSibling == null
              && r.startContainer.parentNode.nodeName === 'SONG-ROW'
              &&  r.startContainer.parentNode.previousSibling != null
              &&  r.startContainer.parentNode.previousSibling.nodeName === 'SONG-ROW') {
            mergeNodeAfter(r.startContainer.parentNode.previousSibling, r.startContainer.parentNode);
            e.preventDefault();
          }
          if (r.startContainer.previousSibling == null
              && r.startContainer.parentNode.nodeName === 'SONG-ROW'
              &&  r.startContainer.parentNode.previousSibling == null
              &&  r.startContainer.parentNode.parentNode.parentNode.nodeName === 'SONG-VERSE'
              &&  r.startContainer.parentNode.parentNode.parentNode.previousSibling
              &&  r.startContainer.parentNode.parentNode.parentNode.previousSibling.nodeName === 'SONG-VERSE') {
            mergeNodeAfter(r.startContainer.parentNode.parentNode.parentNode.previousSibling.childNodes[0], r.startContainer.parentNode.parentNode);
            e.preventDefault();
          }
          if (r.startContainer.previousSibling == null
              && r.startContainer.parentNode.nodeName === 'SONG-ROW'
              &&  r.startContainer.parentNode.previousSibling == null
              &&  r.startContainer.parentNode.parentNode.parentNode.nodeName === 'SONG-BIS'
              &&  !r.startContainer.parentNode.parentNode.parentNode.previousSibling
              &&  r.startContainer.parentNode.parentNode.parentNode.parentNode.parentNode.nodeName === 'SONG-VERSE'
              &&  r.startContainer.parentNode.parentNode.parentNode.parentNode.parentNode.previousSibling
              &&  r.startContainer.parentNode.parentNode.parentNode.parentNode.parentNode.previousSibling.nodeName === 'SONG-VERSE') {
            mergeNodeAfter(r.startContainer.parentNode.parentNode.parentNode.parentNode.parentNode.previousSibling.childNodes[0], r.startContainer.parentNode.parentNode.parentNode.parentNode);
            e.preventDefault();
          }
        }

        r= document.getSelection().getRangeAt(0);
        if ((r.startContainer.nodeName === 'SONG-ROWS'
            || r.startContainer.nodeName === 'SONG-VERSE'
            || r.startContainer.nodeName === 'SONG-BIS'
            || r.startContainer.nodeName === 'SONG-BODY')
           && r.startContainer.childNodes.length > 0) {
          console.log("Preventing deletion of whole: ", r);
          if (r.startContainer.childNodes[r.startOffset] != null
            && r.startContainer.childNodes[r.startOffset].firstChild != null) {
            setCursorBefore(
                r.startContainer.childNodes[r.startOffset].firstChild);
          }
          e.preventDefault();
        }
      }
      let r= document.getSelection().getRangeAt(0);
      if (r.commonAncestorContainer.nodeName === 'SONG-ROWS') {
        let start=findAncestor(r.startContainer, 'SONG-ROW');
        r.deleteContents();
        if (start.childNodes.length === 0) {
          start.remove();
        }
        e.preventDefault();
        songbody.changePostprocess();
        return;
      }
    }

    if (e.inputType == "insertParagraph"
        && e.target == songbody) {
      let r= document.getSelection().getRangeAt(0);
      // console.log(r);
      // console.log(r.startContainer);

      let parentRow=findAncestor(r.startContainer, 'SONG-ROW');
      let newNode = parentRow.cloneNode(false);
      parentRow.parentNode.insertBefore(newNode, parentRow.nextSibling);
      if (r.startContainer.nodeName=='#text' && r.startOffset<r.startContainer.nodeValue.length) {
        newNode.appendChild(document.createTextNode(r.startContainer.nodeValue.slice(r.startOffset)));
        r.startContainer.nodeValue=r.startContainer.nodeValue.slice(0, r.startOffset);
      }
      let st = r.startContainer.nodeName=='SONG-ROW' ? r.startContainer.childNodes[r.startOffset].previousSibling : r.startContainer ;
      while(st && st.nextSibling != null) {
        console.log("Adding: ", st.nextSibling)
        newNode.appendChild(st.nextSibling)
      }
      console.log("newNode.textContent:" + newNode.textContent)
      const curPos = newNode.firstChild;
      if (!newNode.textContent.startsWith(" ")) {
        console.log("WSTAWIAM PRZED");
        newNode.insertBefore(document.createTextNode(nbsp), newNode.firstChild);
      }
      if (curPos) {
        setCursorBefore(curPos);
      } else {
        setCursorAfter(newNode.firstChild);
      }
      if (parentRow.childNodes.length==0) {
        parentRow.appendChild(document.createTextNode(nbsp));
      }
      e.preventDefault();
      this.changePostprocess()
    }

    // Without this pressing any key when there is selection... removing all content.
    if (document.getSelection().rangeCount>0) {
      let r = document.getSelection().getRangeAt(0);
      if (r.commonAncestorContainer.nodeName === 'SONG-ROWS') {
        r.deleteContents();
        songbody.changePostprocess();
      }
    }

    if (e.inputType == "historyUndo"
        && e.target == songbody) {
      songbody.doUndo();
      e.preventDefault();
    }

    if (e.inputType == "historyRedo"
        && e.target == songbody) {
      songbody.doRedo();
      e.preventDefault();
    }

  }

  doUndo() {
    const last = this.undo.pop();
    if (last) {
      this.redo.push(last);
      this.innerHTML=last;
    }
    this.refresh();
  }

  doRedo() {
    const redo = this.redo.pop();
    if (redo) {
      this.undo.push(redo);

      this.innerHTML=redo;
    }
    this.refresh();
  }

  refresh() {
    for (const verse of this.childNodes) {
      verse.refresh();
    }
    this.refreshToolbar();
  }

  changePostprocess() {
    console.log("postprocessing");
    Sanitize(this);
    this.recomputeChordsOffsets();
    let lastState=this.innerHTML;
    if (this.undo.length==0 || this.undo[this.undo.length-1]!==lastState) {
      this.undo.push(lastState);
    }
    console.log("Postprocessed. Undo len: ", this.undo.length);
  }

  recomputeChordsOffsets() {
    const chords = this.getElementsByTagName("SONG-CH");
    for (let ch of chords) {
      ch.resetOffset();
    }
    for (let ch of chords) {
      ch.recomputeOffset();
    }
  }

  input(e, songbody) {
    console.log("input", e);
     if (e.target == songbody) {
       console.log("postprocessing...")
       songbody.changePostprocess();
//    Avoid keeping cursor before the artifical space:
//        if (document.getSelection().isCollapsed
//            && document.getSelection().rangeCount == 1) {
//          let r = document.getSelection().getRangeAt(0);
//          //console.log("ON INPUT", document.getSelection(), r.startContainer.nodeName, r.startOffset, r.startContainer);
//          if (r.startContainer.nodeName === "#text"
//              && r.startOffset == 0
//              && r.startContainer.nodeValue.startsWith(nbsp)
//              && r.startContainer.previousSibling == null) {
//            let newr = document.createRange();
//            newr.setStart(r.startContainer, 1);
//            document.getSelection().removeAllRanges();
//            document.getSelection().addRange(newr);
//          }
//        }
     }
  }

  paste(e, songbody) {
    console.log(e);
    console.log("types", e.clipboardData.types);
    if (e.target.nodeName === 'SONG-ROW' || e.target.nodeName === 'SONG-BODY') {
      let p = document.createElement("span");
      let data = '';
      if (data==='') { data = e.clipboardData.getData("text/html"); }
      if (data==='') {
        data = e.clipboardData.getData("text/plain");
        var separateLines = data.split(/\r?\n|\r|\n/g);
        let newdata='';
        separateLines.forEach(line => {
          newdata += "<row important_over='never'>" + line + "</row>";
        })
        data = newdata
      }
      console.log(data);
      p.innerHTML  = data;
      getSelection().getRangeAt(0).deleteContents();
      getSelection().getRangeAt(0).insertNode(p);
      e.preventDefault();
      songbody.changePostprocess();
    }
  }

  attributeChangedCallback() {
    console.log("onChange", this);
  }
}

export function SongBodyInit() {
  if (!customElements.get("song-body")) {
    customElements.define("song-body", SongBody);
  }
};

export function createSongBody() {
  return document.createElement("song-body");
}
