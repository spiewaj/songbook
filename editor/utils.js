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
  if (!node) {
    return;
  }
  const sel = document.getSelection();
  if (node.nodeName === '#text') {
    const offset = (node === node.parentNode?.firstChild && node.nodeValue.startsWith(nbsp)) ? 1 : 0;
    sel.collapse(node, offset);
  } else if (node.previousSibling && node.previousSibling.nodeName === '#text') {
    sel.collapse(node.previousSibling, node.previousSibling.nodeValue.length);
  } else if (node.parentNode) {
    const newr = document.createRange();
    newr.setStartBefore(node);
    newr.setEndBefore(node);
    sel.removeAllRanges();
    sel.addRange(newr);
  }
}

export function setCursorAfter(node) {
  if (!node) {
    return;
  }
  const sel = document.getSelection();
  if (node.nodeName === '#text') {
    sel.collapse(node, node.nodeValue.length);
  } else if (node.nextSibling && node.nextSibling.nodeName === '#text') {
    sel.collapse(node.nextSibling, 0);
  } else if (node.parentNode) {
    const newr = document.createRange();
    newr.setStartAfter(node);
    newr.setEndAfter(node);
    sel.removeAllRanges();
    sel.addRange(newr);
  }
}