import {createChord} from './ch.js';
import {findAncestor,nbsp,removeAllChildren} from './utils.js';
import {instrRowPhrase, isRowInstr, makeRowInstrumental} from './songbody.js';

const spaceRegex = / /g;
const nbspsRegexp = /\u00a0+/g;

function  nestToBody(parent) {
  let p = findAncestor(parent, "SONG-BODY");
  if (p) { return p; }
  let body = document.createElement("song-body");
  body.contentEditable='true';
  parent.appendChild(body);
  return body;
}

function setRandomId(node) {
  if (!node.id || node.id.trim()==='') {
    node.id="v"+Math.floor(Math.random() * 100000000);
  }
}

export function createVerse(type="verse", blocknb=null) {
  let verse = document.createElement("song-verse");
  if (!type || (type!='chorus' && type!='other')) {
    type = "verse"
  }
  verse.setAttribute("type", type);
  if (blocknb) {
    verse.setAttribute("blocknb", blocknb);
  }
  setRandomId(verse);
  return verse;
}

function  nestToVerse(parent) {
  let p = findAncestor(parent, "SONG-VERSE");
  if (p) { return p; }

  let newParent = nestToBody(parent);
  let verse = createVerse();
  newParent.appendChild(verse);
  return verse;
}

function  nestToVerseOrBis(parent) {
  let p = findAncestor(parent, "SONG-BIS");
  if (p) { return p; }
  return nestToVerse(parent);
}

function createRow(important_over="false", instrumental=false, sidechords) {
  let row = document.createElement("song-row");
  if (!instrumental) {
    if (!important_over) { important_over="false"; }
    row.setAttribute("important_over", important_over);
    if (sidechords) {
      row.setAttribute("sidechords", sidechords);
    }
  } else {
    row.setAttribute("type", "instr");
  }
  return row;
}

function  nestToRows(parent) {
  let p = findAncestor(parent, "SONG-ROWS");
  if (p) {
    return p;
  } else {
    let newParent = nestToVerseOrBis(parent);
    let rows = document.createElement("song-rows");
    newParent.appendChild(rows);
    return rows;
  }
}

function nestToRow(parent, forceNew=false) {
  if (parent.nodeName === "SONG-ROW" && !forceNew) {
    return parent;
  } else {
    let newParent = nestToRows(parent);
    let row = createRow();
    newParent.appendChild(row);
    return row;
  }
}

function traverseChilds(parent, childNodes) {
  let ns = [];
  childNodes.forEach( (n) => { ns.push(n); } );
  let newparent = parent;
  for (let i=0; i < ns.length; ++i ) {
    newparent = traverse(newparent, ns[i]);
  }
}

// // parent - is sanitized parent of tag (song, song-verse(div), song-bis(div), song-row(div))
// // the call responsibility is to process the node and put it into parent.
function traverse(parent, node) {
  //console.log("Traversing...", node.nodeName, node, node.style);
  if (node instanceof Element) {
    node.removeAttribute("style");
  }
  switch (node.nodeName.toUpperCase()) {

    // BASIC
    case '#TEXT' : {
      if (node.parentNode.nodeName!='SONG-ROW' && node.nodeValue.replace(/[\n\t\r ]/g,"")==='') {
       // console.log("trimmed!!!");
        node.remove();
        return parent;
      }
      textNodeReplaceAll(node, " ", nbsp);
      let newParent = nestToRow(parent);
      newParent.appendChild(node);
      return newParent;
    }
    case 'SONG-CH': {
      removeAllChildren(node);
      let newParent = nestToRow(parent);
      newParent.appendChild(node);
      return newParent;
    }
    case 'SONG-ROW': {
      let newParent = nestToRows(parent);
      newParent.appendChild(node);
      traverseChilds(node, node.childNodes);
      if (isRowInstr(node)) {
        makeRowInstrumental(node);
      }
      return newParent;
    }
    case 'SONG-ROWS': {
      let newParent = nestToVerseOrBis(parent);
      newParent.appendChild(node);
      traverseChilds(node, node.childNodes);
      return newParent;
    }
    case 'SONG-BIS': {
      let newParent = nestToRows(parent);
      newParent.appendChild(node);
      traverseChilds(node, node.childNodes);
      return newParent;
    }
    case 'SONG-VERSE': {
      let newParent = nestToBody(parent);
      newParent.appendChild(node);
      setRandomId(node);
      traverseChilds(node, node.childNodes);
      return newParent;
    }
    case 'SONG-BODY': {
      let newParent = nestToBody(parent);
      traverseChilds(newParent, node.childNodes);
      return newParent;
    }

    case 'CODE': {
      if (node.className=='an') {
        // Wywrota: <code class="an" data-chord="C" data-suffix="" data-local="C">C</code>
        let ch = createChord(node.attributes['data-local'].value);
        node.remove();
        let newParent = nestToRow(parent);
        newParent.appendChild(ch);
        return newParent;
      }
      break;
    }

    case 'SPAN': {
      if (node.className=='annotated-lyrics') {
        // Wywrota: <span class="annotated-lyrics">Kaszubskie noce, <code class="an" data-chord="A" data-suffix="m" data-local="a">a</code>nad nami lśniące</span>
        let newParent = nestToRow(parent, true);
        traverseChilds(newParent, node.childNodes);
        node.remove();
        return newParent;
      }
      if (node.className=='text-nowrap') {
        // <span class="annotated-lyrics">Jak to <span class="text-nowrap">d<code class="an" data-chord="A" data-suffix="m" data-local="a">a</code>obrze</span> być <code class="an" data-chord="D" data-suffix="m" data-local="d">d</code>harcerzem</span>
        let newParent = nestToRow(parent, false);
        traverseChilds(newParent, node.childNodes);
        node.remove();
        return newParent; 
      }
      break;
    }

    case 'BR': {
      let newParent = nestToRow(parent, true);
      node.remove();
      return newParent;
    }

    case 'P': {
      let newParent = nestToRow(parent, true);
      traverseChilds(newParent, node.childNodes);
      node.remove();
      return newParent;
    }

    case 'CH': {
      removeAllChildren(node);
      let newParent = nestToRow(parent);
      newParent.appendChild(createChord(node.getAttribute("a")));
      return newParent;
    }
    case 'BIS': {
      let newParent = nestToRows(parent);
      let newBis = document.createElement("song-bis");
      if (node.hasAttribute("times")) {
        newBis.setAttribute("x", node.getAttribute("times"));
      } else {
        newBis.setAttribute("x", 2);
      }
      newParent.appendChild(newBis);
      let newRows = document.createElement("song-rows");
      newBis.appendChild(newRows);
      traverseChilds(newRows, node.childNodes);
      return newParent;
    }
    case 'BLOCK': {
      let newParent = nestToBody(parent);
      let newVerse = createVerse(node.getAttribute("type"));
      let newRows = document.createElement("song-rows");
      newVerse.appendChild(newRows);
      traverseChilds(newRows, node.childNodes);
      node.remove();
      newParent.appendChild(newVerse);
      return newParent;
    }
    case 'BLOCKLINK': {
      let newParent = nestToBody(parent);
      let newVerse = createVerse(null, node.getAttribute("blocknb"));
      let newRows = document.createElement("song-rows");
      newVerse.appendChild(newRows);
      node.remove();
      newParent.appendChild(newVerse);
      return newParent;
    }
    case 'ROW': {
      let newParent = nestToRows(parent);
      let newRow = createRow(
          node.getAttribute("important_over"),
          node.getAttribute("type")==="instr",
          node.getAttribute("sidechords"));
      newParent.appendChild(newRow);
      traverseChilds(newRow, node.childNodes);
      node.remove();
      if (newRow.getAttribute("type") === "instr") {
        makeRowInstrumental(newRow);
      }
      return newParent;
    }
  }
  traverseChilds(parent, node.childNodes);
  node.remove();
  return parent;
}

function sanitizeRow(row) {
  row.normalize();
  if (!row.textContent.startsWith(nbsp)) {
    if (row.childNodes.length > 0) {
      row.insertBefore(document.createTextNode(nbsp), row.childNodes[0]);
    } else {
      row.appendChild(document.createTextNode(nbsp));
    }
  }
  row.normalize();
}

function isEmptyRow(el) {
  const empty = el != null &&
      el.nodeName==='SONG-ROW' &&
      el.getElementsByTagName("song-ch").length==0 &&
      (el.textContent.trim()==='' || el.textContent.trim()===nbsp);
  console.log("Row", el, "is empty:", empty)
  return empty
}

function normalize(str) {
  return str.trim().replace(nbsp," ");
}

export function SplitVerseFromRow(row) {
  let songVerse = findAncestor(row, "SONG-VERSE");
  if (songVerse) {
    let newVerse = songVerse.cloneNode(false);
    songVerse.id='';
    setRandomId(songVerse);
    songVerse.parentNode.insertBefore(newVerse, songVerse.nextSibling);
    let newRows = document.createElement("SONG-ROWS");
    newVerse.appendChild(newRows);
    console.log(row, row.nextSibling);
    let r=row.nextSibling;
    if (r==null
        && row.parentNode.parentNode.nodeName!='SONG-BIS') {
      if (isEmptyRow(row.previousSibling)) {
        row.previousSibling.remove();
      }
      newRows.append(row);
    } else {
      while(r != null) {
        let nr=r.nextSibling;
        newRows.appendChild(r);
        r=nr;
      }
      // If we are within BIS within middle of the verse,
      // we need to move verse-level rows as well.
      if (row.parentNode.parentNode.nodeName=='SONG-BIS') {
        r = row.parentNode.parentNode.nextSibling;
        while(r != null) {
          let nr=r.nextSibling;
          newRows.appendChild(r);
          r=nr;
        }
      }
      if (isEmptyRow(row.previousSibling)) {
        row.previousSibling.remove();
      }
      if (isEmptyRow(row)) {
        row.remove();
      }
    }
  }
}

export function Sanitize(body) {
  // let r=document.getSelection().rangeCount>0 ? document.getSelection().getRangeAt(0).cloneRange() : null;
  // // As sanitization modifies the text (e.g replace all ' ' -> nbsp), we
  // // need to persist where is the selection, to be able to restore it.
  // let rso=r?r.startOffset:0;
  //console.log("Stored", r);
  if (!lightTraverse(body)) {
    console.log("Full fix...");
    traverse(body, body);
    console.log("after fix: ", body.outerHTML);
  }

  // Let's cleanup rows
  let rows = body.getElementsByTagName("SONG-ROW");
  for (let i=0; i < rows.length; ++i) {
    let row = rows[i];
    sanitizeRow(row);
  }

  // Let's find 2 empty rows side by side... to split the function
  rows = body.getElementsByTagName("SONG-ROW");
  for (let i=0; i < rows.length; ++i) {
    if (isEmptyRow(rows[i]) && isEmptyRow(rows[i].previousSibling)) {
      SplitVerseFromRow(rows[i]);
    }
  }

  // if (r) {
  //   r.setStart(r.startContainer,
  //       Math.min(rso,
  //           r.startContainer.nodeName=='#text'
  //               ? r.startContainer.length
  //               : r.startContainer.childNodes.length));
  //   document.getSelection().removeAllRanges();
  //   document.getSelection().addRange(r);
  // }
}

function textNodeReplaceAll(node, searchValue, replaceValue) {
  let r = document.getSelection().rangeCount > 0 ? document.getSelection().getRangeAt(0) : null;
  if (r && r.intersectsNode(node)) {
    return;
  }
  node.nodeValue=node.nodeValue.replaceAll(searchValue, replaceValue);
}

// Returns whether tree is valid (is. requires deep validation).
function lightTraverse(node) {
  //console.log("lightTraverse", node, node.style);
  if (node instanceof Element) {
    node.removeAttribute("style");
  }
  switch (node.nodeName) {
    case '#text' : {
      //console.log("Light traverse text", node, '>'+node.nodeValue+'<', node.parentNode);
      if (node.parentNode.nodeName!='SONG-ROW') {
        console.log("Misplaced", node);
        return false;
      }
      textNodeReplaceAll(node, " ", nbsp);

      if (node.parentNode.getAttribute('type')==='instr') {
        textNodeReplaceAll(node, nbspsRegexp, nbsp);
      };
      break;
    }
    case 'SONG-CH': {
      removeAllChildren(node);
      if (node.parentNode.nodeName!='SONG-ROW') {
        console.log("Misplaced", node);
        return false;
      }
      if (node.getAttribute("editor") != "true"
          && node.getAttribute("a").trim().length == 0) {
        node.remove();
        return false;
      }

      // if (node.parentNode.getAttribute("type") === 'instr') {
      //   node.parentNode.replaceChild(
      //       document.createTextNode(nbsp + node.getAttribute("a") + nbsp),
      //       node);
      // }
      const chords = node.getAttribute("a").trim().split(' ');
      if (chords.length > 1) {
        const df = document.createDocumentFragment();
        for (const ch of chords) {
          df.appendChild(createChord(ch));
        }
        node.parentNode.replaceChild(df, node);
      } else if (chords.length == 0) {
        node.remove();
      }
      break;
    }
    case 'SONG-ROW': {
      if (node.parentNode.nodeName!='SONG-ROWS') {
        console.log("Misplaced", node);
        return false;
      }
      if (isRowInstr(node) && normalize(node.textContent.trim()) !== normalize(instrRowPhrase)) {
        return false;
      }
      break;
    }
    case 'SONG-ROWS': {
      if (node.parentNode.nodeName!='SONG-BIS'
        && node.parentNode.nodeName!='SONG-VERSE') {
        console.log("Misplaced", node);
        return false;
      }
      if (node.childNodes.length == 0
          && !node.parentNode.getAttribute("blocknb")) {
        node.remove();
      }
      break;
    }
    case 'SONG-BIS': {
      if (node.parentNode.nodeName!='SONG-ROWS') {
        console.log("Misplaced", node);
        return false;
      }
      if (node.childNodes.length == 0
        || node.childNodes[0].nodeName != 'SONG-ROWS') {
        node.remove();
      }
      break;
    }
    case 'SONG-VERSE': {
      if (node.parentNode.nodeName!='SONG-BODY') {
        console.log("Misplaced", node);
        return false;
      }
      setRandomId(node);
      if ((node.childNodes.length == 0
          || node.childNodes[0].nodeName != 'SONG-ROWS')
         && !node.getAttribute("blocknb")) {
        node.remove();
      }
      break;
    }
    case 'SONG-BODY': {
      break;
    }
    case 'BR':
    case 'SPAN': {
      // Editor sometimes put empty spans.
      if (node.innerHTML==='') {
        node.remove();
        return true;
      }
      break;
    }
    default:
      console.log("Misplaced unknown", node);
      return false;
  }
  {
    // We buffer nodes to not miss anything if it gets removed.
    let ns = [];
    node.childNodes.forEach((n) => {
      ns.push(n);
    });
    for (let i=0; i < ns.length; ++i) {
      if (!lightTraverse(ns[i])) return false;
    }
  }
  // Let's avoid having empty tags.
  if (node.childNodes.length == 0
    && (node.nodeName==='SONG-ROWS'
      || node.nodeName==='SONG-BIS'
      || (node.nodeName==='SONG-VERSE' && !node.getAttribute("blocknb")))) {
    node.remove();
  }
  return true;
}