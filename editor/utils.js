export const nbsp = "\u00a0";

export function getRangeForCursor(e) {
  let range=null;
  if (document.caretRangeFromPoint) {
    // edge, chrome, android
    range = document.caretRangeFromPoint(e.clientX, e.clientY)
  } else {
    // firefox
    var pos = [e.rangeParent, e.rangeOffset]
    range = document.createRange()
    range.setStart(...pos);
    range.setEnd(...pos);
  }
  return range;
}

export function mergeNodeAfter(target, source) {
  let first = source.childNodes[0];
  let documentFragment = document.createDocumentFragment();
  while (source.childNodes.length > 0) {
    documentFragment.appendChild(source.childNodes[0]);
  }
  target.append(documentFragment);
  if (first != null) {
    console.log("Setting cursor before:", first);
    setCursorBefore(first);
  }
  source.remove();
}

export function findAncestor(p, nodeName) {
  while (p != null) {
    if (p.nodeName === nodeName) {
      return p;
    }
    p = p.parentNode;
  }
}

export function removeAllChildren(node) {
  // while(node.childNodes.length > 0) {
  //   node.removeChild(node.childNodes[0]);
  // }
  node.replaceChildren();
}

export function loadXMLDoc(filename)
{
  let xhttp = window.ActiveXObject ?
      new ActiveXObject("Msxml2.XMLHTTP")
      : new XMLHttpRequest();
  xhttp.open("GET", filename, false);
  try {xhttp.responseType = "msxml-document"} catch(err) {} // Helping IE11
  xhttp.send("");
  return xhttp.responseXML;
}

export function setCursorBefore(node) {
  // Why not: document.getSelection().collapse(node); ?

  let newr=document.createRange();
  newr.setStartBefore(node);
  newr.setEndBefore(node);
  document.getSelection().removeAllRanges();
  document.getSelection().addRange(newr);
  console.log("New selection:", document.getSelection(), newr);
}

export function setCursorAfter(node) {
  if (node.nextSibling) {
    setCursorBefore(node.nextSibling)
  } else {
    let newr=document.createRange();
    if (node.nodeName=='#text') {
      newr.setStart(node, node.nodeValue.length - 1)
      newr.setEnd(node, node.nodeValue.length - 1)
    }
    // newr.setStartBefore(node);
    // newr.setEndBefore(node);
    document.getSelection().removeAllRanges();
    document.getSelection().addRange(newr);
    console.log("New selection:", document.getSelection(), newr);
  }
  // Why not: document.getSelection().collapse(node); ?
  //
  // let newr=document.createRange();
  // newr.setStartBefore(node);
  // newr.setEndBefore(node);
  // document.getSelection().removeAllRanges();
  // document.getSelection().addRange(newr);
  // console.log("New selection:", document.getSelection(), newr);
}