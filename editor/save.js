import {loadXMLDoc, nbsp} from './utils.js';

function escapeText(unsafe) {
  return unsafe
      .replaceAll('\u{0435}',"e") // e in Cyrylic
      .replaceAll(',,','\u{201E}')
      .replaceAll('\'\'','\u{201D}')
      .replaceAll(/&/g, '&amp;')
      .replaceAll(/</g, '&lt;')
      .replaceAll(/>/g, '&gt;')
      .replaceAll(/"/g, "&quot;")
      .replaceAll(/'/g, "&#039;");
}

function escapeAttrib(unsafe) {
  return escapeText(unsafe)
}

function serializeElement(indent, elem, sep) { // returns { out: '   ', breakClosing: true/false}
  if (elem.nodeName=='#text'){
    return  { out: escapeText(elem.parentNode.nodeName != 'row' ? elem.nodeValue.trim() : elem.nodeValue), breakClosing: false};
  } else {
    let attrs=''
    for (const a of elem.attributes) {
      if (a.nodeName != 'xmlns:xhtml') {
        attrs = `${attrs} ${a.nodeName}="${escapeAttrib(a.nodeValue)}"`
      }
    }
    if (elem.nodeName=='song' && !attrs.includes('xmlns:xsi=')) {
      attrs=` xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"` + attrs
    }
    if (elem.nodeName=='song' && !attrs.includes('xmlns=\"'+elem.namespaceURI)) {
      attrs=` xmlns="${elem.namespaceURI}"` + attrs
    }
    if (elem.nodeName==='ch') {
      return { out: `<${elem.nodeName}${attrs}/>`, breakClosing: false }
    } else {
      const {out, breakClosing} = serializeElements(indent + sep, elem.childNodes, sep)
      if (out!="") {
        return { out: `\n${indent}<${elem.nodeName}${attrs}>${out}${breakClosing ? "\n"+indent : ""}</${elem.nodeName}>`, breakClosing: true }
      } else {
        return { out: `\n${indent}<${elem.nodeName}${attrs}/>`, breakClosing: true }
      }
    }
  }
}

function serializeElements(indent, children, sep) {
   let o="";
   let br = false;
   for (let child of children) {
     const {out, breakClosing} = serializeElement(indent, child, sep)
     o += out;
     br |= breakClosing
   }
   return {out: o, breakClosing: br};
}

function serializeDocument(doc, sep) {
  return `<?xml version="1.0" encoding="utf-8"?>${serializeElements("", doc.childNodes, sep).out}`
}

export function Serialize(songeditor) {
  let xsltProcessor = new XSLTProcessor()
  let xslt = loadXMLDoc('./save.xslt');
  console.log(xslt);
  xsltProcessor.importStylesheet(xslt);

  const src = document.implementation.createDocument("", "", null);
  const clonedNode = src.importNode(songeditor, true);
  src.appendChild(clonedNode);

  let resultDocument = xsltProcessor.transformToDocument(src);
  if (!resultDocument) {
    alert("XSLT transformation failed")
  }

  // Does not work well on Mozilla:
  // https://stackoverflow.com/questions/51989864/undefined-undefined-error-when-calling-xsltprocessor-prototype-importstylesheet
  //new XMLSerializer().serializeToString(resultDocument);;

  let txt=serializeDocument(resultDocument, songeditor.tabs ? "\t" : "  ")
  txt = txt.replaceAll(nbsp," ") + "\n";

  if (songeditor.shadow.getElementById("lastSerialized")) {
    songeditor.shadow.getElementById("lastSerialized").innerText=txt;
  }
  return txt;
}

export function Save(songeditor) {
  let txt = Serialize(songeditor);

  let download = window.document.createElement('a');
  download.id="download";
  download.text="[download]";

  let title = songeditor.getAttribute("title");
  if (!title || title.trim()==='') {
    title='song';
  }

  let url=window.URL.createObjectURL(new Blob([txt]), {type: 'text/xml'});
  download.href=url;
  download.download=title+".xml";
  download.click();
}