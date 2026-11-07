import {
  findAncestor,
  getRangeForCursor,
  nbsp,
  removeAllChildren,
  setCursorBefore,
  setCursorAfter
} from './utils.js';
import {createChord} from './ch.js'
import {
  createVerse,
  isEmptyRow,
  Sanitize,
  sanitizeRow,
  setCursorAtRowEnd,
  setCursorAtRowStart,
  SplitVerseFromRow
} from './sanitize.js'
import {getChordsFromRow, getNextRow, getPrevRow} from "./verse.js";

function acceptsTextAndChords(element) {
  return element != null && element.nodeName == "SONG-ROW" && element.getAttribute("type") !== 'instr';
}

export function isRowInstr(row) {
  return row.getAttribute('type','normal') == 'instr';
}

function canInsertChord() {
  if (window.getSelection().rangeCount < 1) { return false; }
  const r = window.getSelection().getRangeAt(0);
  const row = findAncestor(r.startContainer, 'SONG-ROW');
  return acceptsTextAndChords(row);
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
  let chords = text
      .replaceAll(/[()[\]<>|!]/g, ' ')
      .split(/[\s\u00a0]+/)
      .filter(Boolean);
  let c = row.firstChild;
  while (c != null) {
    let n=c.nextSibling
    if (c.nodeName=='SONG-CH') {
      c.remove()
    }
    c=n
  }
  for (let i=0; i<chords.length; ++i) {
    row.appendChild(createChord(chords[i]));
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
    const sel = window.getSelection();
    const r = sel.getRangeAt(0);
    const row = findAncestor(r.startContainer, 'SONG-ROW');
    if (row) {
      if ((r.startContainer === row || r.startContainer === row.firstChild)
          && r.startOffset === 0
          && row.firstChild?.nodeName === '#text'
          && row.firstChild.nodeValue.startsWith(nbsp)) {
        sel.collapse(row.firstChild, 1);
      }
    }
    const chedit = createChord(ch || "");
    chedit.setAttribute("editing", "true");
    sel.getRangeAt(0).insertNode(chedit);
    chedit.focus();
    return true;
  }
  return false;
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

function stripLeadingNbsp(row) {
  if (row && row.firstChild && row.firstChild.nodeName === '#text' && row.firstChild.nodeValue.startsWith(nbsp)) {
    row.firstChild.nodeValue = row.firstChild.nodeValue.substring(1);
    if (row.firstChild.nodeValue.length === 0) {
      row.firstChild.remove();
    }
  }
}

function cleanupEmptyAncestors(rowsContainer) {
  if (!rowsContainer) return;
  const parent = rowsContainer.parentNode;
  if (rowsContainer.children.length === 0) {
    if (parent && parent.nodeName === 'SONG-BIS') {
      parent.remove();
    } else if (parent && parent.nodeName === 'SONG-VERSE' && !parent.getAttribute('blocknb')) {
      parent.remove();
    }
  }
}

export function mergeRows(targetRow, sourceRow, stripSourceLeadingNbsp = true) {
  if (!targetRow || !sourceRow || targetRow === sourceRow) return;
  if (isRowInstr(targetRow) && !isRowInstr(sourceRow)) {
    makeRowNotInstrumental(targetRow);
  }
  sanitizeRow(targetRow);
  if (stripSourceLeadingNbsp) {
    stripLeadingNbsp(sourceRow);
  }

  const lastTargetNode = targetRow.lastChild;
  const wasText = lastTargetNode && lastTargetNode.nodeName === '#text';
  const prevLen = wasText ? lastTargetNode.nodeValue.length : 0;

  const sourceParent = sourceRow.parentNode;
  while (sourceRow.firstChild) {
    targetRow.appendChild(sourceRow.firstChild);
  }
  sourceRow.remove();
  cleanupEmptyAncestors(sourceParent);

  targetRow.normalize();
  sanitizeRow(targetRow);

  const sel = document.getSelection();
  if (sel) {
    const r = document.createRange();
    if (wasText && lastTargetNode.parentNode === targetRow) {
      const off = Math.min(prevLen, lastTargetNode.nodeValue.length);
      r.setStart(lastTargetNode, off);
      r.setEnd(lastTargetNode, off);
    } else if (lastTargetNode && lastTargetNode.parentNode === targetRow) {
      if (lastTargetNode.nextSibling && lastTargetNode.nextSibling.nodeName === '#text') {
        r.setStart(lastTargetNode.nextSibling, 0);
        r.setEnd(lastTargetNode.nextSibling, 0);
      } else {
        r.setStartAfter(lastTargetNode);
        r.setEndAfter(lastTargetNode);
      }
    } else {
      setCursorAtRowStart(targetRow);
      return;
    }
    sel.removeAllRanges();
    sel.addRange(r);
  }
}

function isCaretAtLogicalRowStart(r, row) {
  if (!r || !r.collapsed || !row) return false;
  if (r.startContainer === row) {
    if (r.startOffset === 0) return true;
    if (r.startOffset === 1 && row.firstChild?.nodeName === '#text' && row.firstChild.nodeValue === nbsp) {
      return true;
    }
    return false;
  }
  if (r.startContainer.nodeName === '#text' && r.startContainer === row.firstChild) {
    if (r.startOffset === 0) return true;
    if (r.startOffset === 1 && r.startContainer.nodeValue.startsWith(nbsp)) return true;
  }
  return false;
}

function isCaretAtLogicalRowEnd(r, row) {
  if (!r || !r.collapsed || !row) return false;
  if (r.startContainer === row) {
    return r.startOffset >= row.childNodes.length;
  }
  if (r.startContainer.nodeName === '#text' && r.startContainer === row.lastChild) {
    return r.startOffset >= r.startContainer.nodeValue.length;
  }
  return false;
}

function getAdjacentChord(r, row, direction) {
  if (!r || !r.collapsed || !row) return null;
  if (direction === 'before') {
    if (r.startContainer.nodeName === '#text') {
      if (r.startContainer === row.firstChild && r.startContainer.nodeValue.startsWith(nbsp) && r.startOffset <= 1) {
        return null;
      }
      if (r.startOffset > 0) return null;
      const prev = r.startContainer.previousSibling;
      return (prev && prev.nodeName === 'SONG-CH') ? prev : null;
    }
    if (r.startContainer === row) {
      if (r.startOffset === 0) return null;
      if (r.startOffset === 1 && row.firstChild?.nodeName === '#text' && row.firstChild.nodeValue === nbsp) {
        return null;
      }
      const prev = row.childNodes[r.startOffset - 1];
      return (prev && prev.nodeName === 'SONG-CH') ? prev : null;
    }
  } else if (direction === 'after') {
    if (r.startContainer.nodeName === '#text') {
      const effOffset = (r.startContainer === row.firstChild && r.startOffset === 0 && r.startContainer.nodeValue.startsWith(nbsp))
          ? 1 : r.startOffset;
      if (effOffset < r.startContainer.nodeValue.length) return null;
      const next = r.startContainer.nextSibling;
      return (next && next.nodeName === 'SONG-CH') ? next : null;
    }
    if (r.startContainer === row) {
      const idx = (r.startOffset === 0 && row.firstChild?.nodeName === '#text' && row.firstChild.nodeValue === nbsp)
          ? 1 : r.startOffset;
      const next = row.childNodes[idx];
      return (next && next.nodeName === 'SONG-CH') ? next : null;
    }
  }
  return null;
}

function deleteSelectedRangeAcrossRows(r, songbody) {
  if (!r || r.collapsed) return false;
  const allRows = [...songbody.getElementsByTagName('SONG-ROW')];
  let startRow = findAncestor(r.startContainer, 'SONG-ROW');
  let endRow = findAncestor(r.endContainer, 'SONG-ROW');
  if (!startRow || !endRow) {
    const intersecting = allRows.filter(row => r.intersectsNode(row));
    if (intersecting.length === 0) return false;
    if (!startRow) startRow = intersecting[0];
    if (!endRow) endRow = intersecting[intersecting.length - 1];
  }

  if (startRow === endRow) {
    return false;
  }

  const startVerse = findAncestor(startRow, 'SONG-VERSE');
  const endVerse = findAncestor(endRow, 'SONG-VERSE');

  if (!startRow.contains(r.startContainer)) {
    r.setStart(startRow, 0);
  }
  if (!endRow.contains(r.endContainer)) {
    r.setEnd(endRow, endRow.childNodes.length);
  }

  const endAtZero = (r.endContainer === endRow && r.endOffset === 0) ||
      (r.endContainer === endRow.firstChild && r.endOffset === 0);

  r.deleteContents();

  if (endRow.parentNode && endRow !== startRow) {
    mergeRows(startRow, endRow, endAtZero);
  } else {
    sanitizeRow(startRow);
    setCursorAtRowEnd(startRow);
  }

  if (startVerse && endVerse && startVerse !== endVerse && endVerse.parentNode) {
    const startVerseRows = startVerse.querySelector('song-rows');
    const endVerseRows = endVerse.querySelector('song-rows');
    if (startVerseRows && endVerseRows) {
      const insertRef = (startRow.parentNode === startVerseRows)
          ? startRow.nextSibling
          : findAncestor(startRow, 'SONG-BIS')?.nextSibling || null;
      while (endVerseRows.firstChild) {
        startVerseRows.insertBefore(endVerseRows.firstChild, insertRef);
      }
    }
    endVerse.remove();
  }

  // Also remove any intermediate empty verses or bis elements left behind
  for (const v of [...songbody.querySelectorAll('song-verse')]) {
    if (!v.getAttribute('blocknb') && v.querySelectorAll('song-row').length === 0) {
      v.remove();
    }
  }
  for (const b of [...songbody.querySelectorAll('song-bis')]) {
    if (b.querySelectorAll('song-row').length === 0) {
      b.remove();
    }
  }

  return true;
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
      
      <button id="buttonUndo"><i class="material-icons">undo</i>Cofij</button>
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
    const selRows = this.selectedRows();
    const hasRows = selRows.length > 0;
    this.importantOver.disabled = !hasRows || this.allSelectedImportant();
    this.notImportantOver.disabled = !hasRows || selRows.every(r => r.getAttribute("important_over") === "false" && !isRowInstr(r));
    this.sideOnly.disabled = !hasRows || selRows.every(r => r.getAttribute("important_over") === "never" && !isRowInstr(r));
    this.buttonChord.disabled = !canInsertChord();
    this.buttonSplit.disabled = !hasRows;
    this.buttonUndo.disabled = this.undo.length <= 1;
    this.buttonRedo.disabled = this.redo.length === 0;

    if (this.allSelectedInstrumental()) {
      this.buttonInstr.innerHTML='<i class="material-icons">lyrics</i>Wers liryczny';
    } else {
      this.buttonInstr.innerHTML='<i class="material-icons">music_note</i>Wers instrumentalny';
    }
    this.buttonBis.disabled = !hasRows;
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

    let rows = this.getElementsByTagName("SONG-ROW");
    for (let i = 0; i < rows.length; ++i) {
      let row = rows[i];
      if (r.intersectsNode(row)) {
        result.push(row);
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
          this.changePostprocess();
          bis.focus();
        }
      }
    }
  }

  toggleImportantOver(important_over) {
    let selRows = this.selectedRows();
    for (let i = 0; i < selRows.length; ++i) {
      if (isRowInstr(selRows[i])) {
        makeRowNotInstrumental(selRows[i]);
      }
      selRows[i].setAttribute("important_over", important_over);
    }
    this.changePostprocess();
  }

  splitVerse() {
    let selRows = this.selectedRows();
    if (selRows.length > 0) {
      SplitVerseFromRow(selRows[0]);
      this.changePostprocess();
    }
  }

  appendVerse() {
    const v = createVerse();
    const rows = document.createElement("song-rows");
    const row = document.createElement("song-row");
    row.setAttribute("important_over", "false");
    row.appendChild(document.createTextNode(nbsp));
    rows.appendChild(row);
    v.appendChild(rows);
    this.insertBefore(v, null);
    this.changePostprocess();
    this.focus();
    setCursorAtRowStart(row);
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
    let r = document.createRange();
    let rows = [...this.getElementsByTagName("SONG-ROW")].filter(
      row => !findAncestor(row, "SONG-VERSE")?.getAttribute("blocknb")
    );
    if (rows.length === 0) return;
    sanitizeRow(rows[0]);
    sanitizeRow(rows[rows.length - 1]);
    r.setStartBefore(rows[0].firstChild);
    r.setEndAfter(rows[rows.length - 1].lastChild);
    document.getSelection().removeAllRanges();
    document.getSelection().addRange(r);
    this.focus();
  }

  allSelectedImportant() {
    let selRows = this.selectedRows();
    if (selRows.length === 0) return false;
    let allImportant=true;
    for (let i=0; i<selRows.length; ++i) {
     // console.log("allSelectedImportant: considering", selRows[i])
      allImportant &&= selRows[i].getAttribute("important_over")==="true";
    }
    return allImportant;
  }

  allSelectedInstrumental() {
    let selRows = this.selectedRows();
    if (selRows.length === 0) return false;
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
    if (e.target != songBook) {
      return;
    }
    if (e.key == '`' && canInsertChord()) {
      if (insertChordHere("")) {
        e.preventDefault();
      }
      return;
    }

    if ((e.metaKey || e.ctrlKey) && !e.altKey) {
      if (e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          songBook.doRedo();
        } else {
          songBook.doUndo();
        }
        e.preventDefault();
        return;
      }
      if (e.key.toLowerCase() === 'y' && !e.shiftKey) {
        songBook.doRedo();
        e.preventDefault();
        return;
      }
      if (e.key.toLowerCase() === 'a' && !e.shiftKey) {
        songBook.selectAll();
        e.preventDefault();
        return;
      }
      if (e.key.toLowerCase() === 'b' && !e.shiftKey) {
        songBook.wrapBis();
        e.preventDefault();
        return;
      }
    }

    if (e.key === 'Home' && !e.shiftKey && !e.metaKey && !e.altKey && !e.ctrlKey) {
      if (document.getSelection().rangeCount > 0) {
        const row = findAncestor(document.getSelection().getRangeAt(0).startContainer, 'SONG-ROW');
        if (row) {
          setCursorAtRowStart(row);
          e.preventDefault();
          return;
        }
      }
    }

    if (e.key === 'End' && !e.shiftKey && !e.metaKey && !e.altKey && !e.ctrlKey) {
      if (document.getSelection().rangeCount > 0) {
        const row = findAncestor(document.getSelection().getRangeAt(0).startContainer, 'SONG-ROW');
        if (row) {
          setCursorAtRowEnd(row);
          e.preventDefault();
          return;
        }
      }
    }

    if (e.key == 'ArrowRight' && !e.shiftKey && !e.metaKey && !e.altKey && !e.ctrlKey) {
      if (document.getSelection().isCollapsed
          && document.getSelection().rangeCount == 1) {
        let r = document.getSelection().getRangeAt(0);
        const row = findAncestor(r.startContainer, 'SONG-ROW');
        if (row) {
          // If cursor is at offset 0 before the artificial leading nbsp and followed by text, step past nbsp + 1st char
          if (r.startContainer.nodeName === '#text'
              && r.startContainer === row.firstChild
              && r.startOffset === 0
              && r.startContainer.nodeValue.startsWith(nbsp)
              && r.startContainer.nodeValue.length > 1) {
            document.getSelection().collapse(r.startContainer, 2);
            e.preventDefault();
            return;
          }

          // If cursor is right before a SONG-CH, jump over contiguous SONG-CH elements
          const nextChord = getAdjacentChord(r, row, 'after');
          if (nextChord) {
            let lastChord = nextChord;
            while (lastChord.nextSibling && lastChord.nextSibling.nodeName === 'SONG-CH') {
              lastChord = lastChord.nextSibling;
            }
            if (lastChord.nextSibling) {
              setCursorAfter(lastChord);
            } else {
              const nextRow = getNextRow(row);
              if (nextRow) {
                setCursorAtRowStart(nextRow);
              } else {
                setCursorAtRowEnd(row);
              }
            }
            e.preventDefault();
            return;
          }

          // If cursor is at the logical end of the row, jump to logical start of next row
          if (isCaretAtLogicalRowEnd(r, row)) {
            const nextRow = getNextRow(row);
            if (nextRow) {
              setCursorAtRowStart(nextRow);
              e.preventDefault();
              return;
            }
          }
        }
      }
    }

    if (e.key == 'ArrowLeft' && !e.shiftKey && !e.metaKey && !e.altKey && !e.ctrlKey) {
      if (document.getSelection().isCollapsed
          && document.getSelection().rangeCount == 1) {
        let r = document.getSelection().getRangeAt(0);
        const row = findAncestor(r.startContainer, 'SONG-ROW');
        if (row) {
          if (isCaretAtLogicalRowStart(r, row)) {
            const prevRow = getPrevRow(row);
            if (prevRow) {
              setCursorAtRowEnd(prevRow);
            } else {
              setCursorAtRowStart(row);
            }
            e.preventDefault();
            return;
          }

          const prevChord = getAdjacentChord(r, row, 'before');
          if (prevChord) {
            let firstChord = prevChord;
            while (firstChord.previousSibling && firstChord.previousSibling.nodeName === 'SONG-CH') {
              firstChord = firstChord.previousSibling;
            }
            setCursorBefore(firstChord);
            e.preventDefault();
            return;
          }
        }
      }
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
      let range = getRangeForCursor(e);
      console.log('RANGE for DROP', range);
      const targetRow = range ? findAncestor(range.commonAncestorContainer, 'SONG-ROW') : null;
      if (acceptsTextAndChords(targetRow)) {
        range.insertNode(createChord(d));
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

  handleBackspaceAtRowStart(row) {
    const rowsContainer = row.parentNode;
    if (!rowsContainer) return;
    const containerParent = rowsContainer.parentNode;

    // 1. First row inside a <song-bis> preceded by another <song-bis>: merge the two <song-bis> blocks
    if (!row.previousElementSibling
        && containerParent?.nodeName === 'SONG-BIS'
        && containerParent.previousElementSibling?.nodeName === 'SONG-BIS') {
      const prevBisRows = containerParent.previousElementSibling.querySelector('song-rows');
      if (prevBisRows) {
        while (rowsContainer.firstChild) {
          prevBisRows.appendChild(rowsContainer.firstChild);
        }
        containerParent.remove();
        setCursorAtRowStart(row);
        return;
      }
    }

    // 2. Any preceding row within the same <song-verse>: merge rows
    const prevRowInVerse = getPrevRow(row, false);
    if (prevRowInVerse) {
      mergeRows(prevRowInVerse, row);
      return;
    }

    // 3. Very first row of a <song-verse>: merge with previous <song-verse>
    const currVerse = findAncestor(row, 'SONG-VERSE');
    const prevVerse = currVerse ? currVerse.previousElementSibling : null;
    if (prevVerse && prevVerse.nodeName === 'SONG-VERSE' && !prevVerse.getAttribute('blocknb')) {
      const prevVerseRows = prevVerse.querySelector('song-rows');
      const currVerseRows = currVerse.querySelector('song-rows');
      if (prevVerseRows && currVerseRows) {
        if (currVerseRows.children.length === 1 && isEmptyRow(row)) {
          currVerse.remove();
          const prevRowsList = prevVerse.querySelectorAll('song-row');
          const lastPrevRow = prevRowsList[prevRowsList.length - 1];
          if (lastPrevRow) {
            setCursorAtRowEnd(lastPrevRow);
          }
          return;
        }
        while (currVerseRows.firstChild) {
          prevVerseRows.appendChild(currVerseRows.firstChild);
        }
        currVerse.remove();
        setCursorAtRowStart(row);
        return;
      }
    }

    // Very first row of the song (or after blocklink): preserve leading nbsp
    setCursorAtRowStart(row);
  }

  handleDeleteAtRowEnd(row) {
    const rowsContainer = row.parentNode;
    if (!rowsContainer) return;
    const containerParent = rowsContainer.parentNode;

    // 1. Last row inside a <song-bis> followed by another <song-bis>: merge the two <song-bis> blocks
    if (!row.nextElementSibling
        && containerParent?.nodeName === 'SONG-BIS'
        && containerParent.nextElementSibling?.nodeName === 'SONG-BIS') {
      const nextBis = containerParent.nextElementSibling;
      const nextBisRows = nextBis.querySelector('song-rows');
      if (nextBisRows) {
        while (nextBisRows.firstChild) {
          rowsContainer.appendChild(nextBisRows.firstChild);
        }
        nextBis.remove();
        setCursorAtRowEnd(row);
        return;
      }
    }

    // 2. Any following row within the same <song-verse>: merge rows
    const nextRowInVerse = getNextRow(row, false);
    if (nextRowInVerse) {
      mergeRows(row, nextRowInVerse);
      return;
    }

    // 3. Last row of a <song-verse>: merge next <song-verse> into current <song-verse>
    const currVerse = findAncestor(row, 'SONG-VERSE');
    const nextVerse = currVerse ? currVerse.nextElementSibling : null;
    if (nextVerse && nextVerse.nodeName === 'SONG-VERSE' && !nextVerse.getAttribute('blocknb')) {
      const currVerseRows = currVerse.querySelector('song-rows');
      const nextVerseRows = nextVerse.querySelector('song-rows');
      if (currVerseRows && nextVerseRows) {
        if (nextVerseRows.children.length === 1 && isEmptyRow(nextVerseRows.firstElementChild)) {
          nextVerse.remove();
          setCursorAtRowEnd(row);
          return;
        }
        while (nextVerseRows.firstChild) {
          currVerseRows.appendChild(nextVerseRows.firstChild);
        }
        nextVerse.remove();
        setCursorAtRowEnd(row);
        return;
      }
    }

    setCursorAtRowEnd(row);
  }

  beforeInput(e, songbody) {
    console.log("beforeInput", e);

    if (e.target != songbody) {
      return;
    }

    if (document.getSelection().rangeCount === 0) {
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

    if (e.inputType == "historyUndo") {
      songbody.doUndo();
      e.preventDefault();
      return;
    }

    if (e.inputType == "historyRedo") {
      songbody.doRedo();
      e.preventDefault();
      return;
    }

    // Handle non-collapsed selections spanning multiple rows or verses
    if (!r.collapsed) {
      if (deleteSelectedRangeAcrossRows(r, songbody)) {
        r = document.getSelection().getRangeAt(0);
        if (e.inputType === "deleteContentBackward"
            || e.inputType === "deleteContentForward"
            || e.inputType === "deleteByCut") {
          e.preventDefault();
          songbody.changePostprocess();
          return;
        }
        if (e.inputType === "insertText" && e.data != null) {
          const textToInsert = e.data.replaceAll(" ", nbsp);
          if (r.startContainer.nodeName === '#text') {
            const tn = r.startContainer;
            const off = r.startOffset;
            tn.insertData(off, textToInsert);
            document.getSelection().collapse(tn, off + textToInsert.length);
          } else {
            const tn = document.createTextNode(textToInsert);
            r.insertNode(tn);
            document.getSelection().collapse(tn, tn.nodeValue.length);
          }
          e.preventDefault();
          songbody.changePostprocess();
          return;
        }
        // If insertParagraph, fall through to insertParagraph below with the now-collapsed range
      }
    }

    // If inserting text at offset 0 before the artificial leading nbsp, nudge cursor to offset 1
    if (e.inputType === "insertText" && r.collapsed && row) {
      if (r.startContainer === row && r.startOffset === 0 && row.firstChild?.nodeName === '#text' && row.firstChild.nodeValue.startsWith(nbsp)) {
        document.getSelection().collapse(row.firstChild, 1);
      } else if (r.startContainer.nodeName === '#text' && r.startContainer === row.firstChild && r.startOffset === 0 && r.startContainer.nodeValue.startsWith(nbsp)) {
        document.getSelection().collapse(r.startContainer, 1);
      }
      return;
    }

    if (e.inputType == "deleteContentBackward") {
      if (r.collapsed) {
        if (!row) {
          e.preventDefault();
          return;
        }

        const precedingChord = getAdjacentChord(r, row, 'before');
        if (precedingChord) {
          let firstChord = precedingChord;
          while (firstChord.previousSibling && firstChord.previousSibling.nodeName === 'SONG-CH') {
            firstChord = firstChord.previousSibling;
          }
          const nodeBeforeChord = firstChord.previousSibling;
          if (nodeBeforeChord && nodeBeforeChord.nodeName === '#text') {
            const minLen = (nodeBeforeChord === row.firstChild && nodeBeforeChord.nodeValue.startsWith(nbsp)) ? 1 : 0;
            if (nodeBeforeChord.nodeValue.length > minLen) {
              nodeBeforeChord.nodeValue = nodeBeforeChord.nodeValue.slice(0, -1);
              document.getSelection().collapse(nodeBeforeChord, nodeBeforeChord.nodeValue.length);
              e.preventDefault();
              songbody.changePostprocess();
              return;
            }
          }
          // Otherwise, the chord is at the logical start of the row -> merge row/verse!
          this.handleBackspaceAtRowStart(row);
          e.preventDefault();
          songbody.changePostprocess();
          return;
        }

        if (isCaretAtLogicalRowStart(r, row)) {
          this.handleBackspaceAtRowStart(row);
          e.preventDefault();
          songbody.changePostprocess();
          return;
        }
      }
      return;
    }

    if (e.inputType == "deleteContentForward") {
      if (r.collapsed) {
        if (!row) {
          e.preventDefault();
          return;
        }

        const followingChord = getAdjacentChord(r, row, 'after');
        if (followingChord) {
          let lastChord = followingChord;
          while (lastChord.nextSibling && lastChord.nextSibling.nodeName === 'SONG-CH') {
            lastChord = lastChord.nextSibling;
          }
          const nodeAfterChord = lastChord.nextSibling;
          if (nodeAfterChord && nodeAfterChord.nodeName === '#text' && nodeAfterChord.nodeValue.length > 0) {
            nodeAfterChord.nodeValue = nodeAfterChord.nodeValue.substring(1);
            document.getSelection().collapse(nodeAfterChord, 0);
            e.preventDefault();
            songbody.changePostprocess();
            return;
          }
          // Otherwise, trailing chord(s) at the end of the row -> merge next row/verse!
          this.handleDeleteAtRowEnd(row);
          e.preventDefault();
          songbody.changePostprocess();
          return;
        }

        if (isCaretAtLogicalRowEnd(r, row)) {
          this.handleDeleteAtRowEnd(row);
          e.preventDefault();
          songbody.changePostprocess();
          return;
        }
      }
      return;
    }

    if (e.inputType == "insertParagraph") {
      r = document.getSelection().getRangeAt(0);
      let parentRow = findAncestor(r.startContainer, 'SONG-ROW');
      if (!parentRow) {
        e.preventDefault();
        return;
      }
      let newNode = parentRow.cloneNode(false);
      parentRow.parentNode.insertBefore(newNode, parentRow.nextSibling);

      if (r.startContainer.nodeName === '#text') {
        const textNode = r.startContainer;
        let offset = r.startOffset;
        if (textNode === parentRow.firstChild && offset === 0 && textNode.nodeValue.startsWith(nbsp)) {
          offset = 1;
        }
        const afterText = textNode.nodeValue.slice(offset);
        textNode.nodeValue = textNode.nodeValue.slice(0, offset);
        if (afterText.length > 0) {
          newNode.appendChild(document.createTextNode(afterText));
        }
        while (textNode.nextSibling !== null) {
          newNode.appendChild(textNode.nextSibling);
        }
      } else if (r.startContainer === parentRow) {
        while (parentRow.childNodes.length > r.startOffset) {
          newNode.appendChild(parentRow.childNodes[r.startOffset]);
        }
      }

      sanitizeRow(parentRow);
      sanitizeRow(newNode);
      setCursorAtRowStart(newNode);

      e.preventDefault();
      this.changePostprocess();
      return;
    }
  }

  doUndo() {
    if (this.undo.length > 1) {
      const current = this.undo.pop();
      this.redo.push(current);
      this.innerHTML = this.undo[this.undo.length - 1];
    } else if (this.undo.length === 1) {
      this.innerHTML = this.undo[0];
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
      if (verse.refresh) {
        verse.refresh();
      }
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
      this.redo = [];
    }
    this.refreshToolbar();
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
      console.log("postprocessing...");
      songbody.changePostprocess();
      // Avoid keeping cursor before the artificial leading space:
      if (document.getSelection().isCollapsed && document.getSelection().rangeCount == 1) {
        let r = document.getSelection().getRangeAt(0);
        if (r.startContainer.nodeName === "#text"
            && r.startOffset == 0
            && r.startContainer.nodeValue.startsWith(nbsp)
            && r.startContainer.previousSibling == null) {
          let newr = document.createRange();
          newr.setStart(r.startContainer, 1);
          newr.setEnd(r.startContainer, 1);
          document.getSelection().removeAllRanges();
          document.getSelection().addRange(newr);
        }
      }
    }
  }

  paste(e, songbody) {
    console.log(e);
    console.log("types", e.clipboardData.types);
    if (e.target.nodeName === 'SONG-ROW' || e.target.nodeName === 'SONG-BODY') {
      const sel = getSelection();
      if (sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed) {
        if (!deleteSelectedRangeAcrossRows(sel.getRangeAt(0), songbody)) {
          sel.getRangeAt(0).deleteContents();
        }
      }
      let data = e.clipboardData.getData("text/html");
      const hasSongMarkup = /<(song-|row\b|ch\b|block\b|bis\b)|annotated-lyrics|data-local/i.test(data);
      if (!hasSongMarkup) {
        data = '';
      }
      if (data === '') {
        const plain = e.clipboardData.getData("text/plain");
        const separateLines = plain.split(/\r?\n|\r|\n/g);
        if (separateLines.length === 1) {
          const r = sel.getRangeAt(0);
          const row = findAncestor(r.startContainer, 'SONG-ROW');
          if (row && (r.startContainer === row || r.startContainer === row.firstChild)
              && r.startOffset === 0
              && row.firstChild?.nodeName === '#text'
              && row.firstChild.nodeValue.startsWith(nbsp)) {
            sel.collapse(row.firstChild, 1);
          }
          const curRange = sel.getRangeAt(0);
          const textToInsert = separateLines[0].replaceAll(" ", nbsp);
          if (curRange.startContainer.nodeName === '#text') {
            const tn = curRange.startContainer;
            const off = curRange.startOffset;
            tn.insertData(off, textToInsert);
            sel.collapse(tn, off + textToInsert.length);
          } else {
            const tn = document.createTextNode(textToInsert);
            curRange.insertNode(tn);
            sel.collapse(tn, tn.nodeValue.length);
          }
          e.preventDefault();
          songbody.changePostprocess();
          return;
        }
        // Trim leading/trailing blank lines and collapse multiple blank lines into verse splits
        while (separateLines.length > 0 && separateLines[0].trim() === '') {
          separateLines.shift();
        }
        while (separateLines.length > 0 && separateLines[separateLines.length - 1].trim() === '') {
          separateLines.pop();
        }
        let newdata = '';
        let prevBlank = false;
        separateLines.forEach(line => {
          if (line.trim() === '') {
            if (!prevBlank) {
              newdata += "<row important_over='false'></row><row important_over='false'></row>";
              prevBlank = true;
            }
          } else {
            prevBlank = false;
            const escaped = line
                .replaceAll('&', '&amp;')
                .replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;');
            newdata += "<row important_over='false'>" + escaped + "</row>";
          }
        });
        data = newdata;
      }
      const r = sel.getRangeAt(0);
      const targetRow = findAncestor(r.startContainer, 'SONG-ROW');
      let p = document.createElement("span");
      p.innerHTML = data;
      if (targetRow && isEmptyRow(targetRow) && /<(song-row|row)\b/i.test(data)) {
        targetRow.replaceWith(p);
      } else {
        r.insertNode(p);
      }
      e.preventDefault();
      songbody.changePostprocess();
      const allRows = [...songbody.querySelectorAll('song-row')].filter(
        row => !findAncestor(row, 'SONG-VERSE')?.getAttribute('blocknb')
      );
      if (allRows.length > 0) {
        setCursorAtRowEnd(allRows[allRows.length - 1]);
      }
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
