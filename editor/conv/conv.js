function createChordElement(doc, chord) {
    let ch = doc.createElementNS(NAMESPACE, 'ch');
    ch.setAttribute('a', chord);
    return ch;
}

function rowIsInstrumental(row) {
    return row.textContent.trim().length === 0;
}

function processRow(doc, span) {
    let row =  doc.createElementNS(NAMESPACE, 'row');
    row.setAttribute('important_over', 'false');
   // var hasChord = false;
    let isChorus = false;
    let bis = 1;
    span.childNodes.forEach(node => {
        //console.log("Processing:", node, node.nodeType, node.tagName)
        if (node.nodeType === node.TEXT_NODE && node.textContent.length > 0) {
            row.appendChild(doc.createTextNode(node.textContent.replaceAll(' ', ' ').replaceAll(/\s\s+/g, ' ').replaceAll("\n","")));
        } else if (node.nodeType === node.ELEMENT_NODE && node.tagName.toLowerCase() === 'code' && node.hasAttribute('data-local')) {
            let chord = node.getAttribute('data-local');
            row.appendChild(createChordElement(doc, chord));
            //hasChord = true;
        } else if (node.nodeType === node.ELEMENT_NODE && node.tagName.toLowerCase() === 'span' && node.classList.contains('text-muted')) {
            if (node.textContent.toLowerCase().includes('ref')) {
                isChorus = true
            }
            let extractBis = /.*x([0-9]+).*/g;
            var res = extractBis.exec(node.textContent);
            if (!res) {
                let extractBis = /.*([0-9]+)x.*/g;
                res = extractBis.exec(node.textContent);
            }

            if (res && res.length>1) {
                bis = parseInt(res[1], 10)
            }
        }
    });
    if (rowIsInstrumental(row)) {
        row.setAttribute("style", "instr")
    }
    if (row.innerHTML.trim() === '') {
        return {row: null, isChorus, bis};
    } else {
        return {row, isChorus, bis}
    }
}

export function interpretationContent2lyric(docHtml, docXml) {
    let lyric = docXml.createElementNS(NAMESPACE, 'lyric');
    let blockElements = docHtml.querySelector('.interpretation-content');
    if (!blockElements) {
        return null
    }
    blockElements.appendChild(docXml.createElementNS(NAMESPACE, "EOF"));

    let implicitRow = docXml.createElementNS(NAMESPACE, 'span');
    let br_cnt=0;
    let currentBlock = docXml.createElementNS(NAMESPACE, "block");
    let currentBlockBis=1;

    currentBlock.setAttribute("type", "verse")
    blockElements.childNodes.forEach(node => {
        //console.debug("processing Node:", node.outerHTML)

        if (node.nodeType === node.ELEMENT_NODE && node.className === 'annotated-lyrics') {
            let {row, isChorus, bis} = processRow(docXml, node)
            if (row) {
                br_cnt = 0;
                if (bis === 1) {
                    currentBlock.appendChild(docXml.createTextNode("\n      "));
                    currentBlock.appendChild(row)
                } else {
                    currentBlock.appendChild(docXml.createTextNode("\n    "));
                    let bisTag = docXml.createElementNS(NAMESPACE, "bis")
                    bisTag.setAttribute("times", bis)
                    bisTag.appendChild(row)
                    currentBlock.appendChild(bisTag)
                }
            }
            if (isChorus) {
                currentBlock.setAttribute("type", "chorus")
            }
        } else if (node.nodeType === node.ELEMENT_NODE && (node.tagName.toLowerCase() === 'br' || node.tagName.toLowerCase() === 'eof')) {
            br_cnt++;
            let {row, isChorus, bis} = processRow(docXml, implicitRow)
            implicitRow=docXml.createElementNS(NAMESPACE, 'span');
            if (row) {
                br_cnt = 1;
                currentBlock.appendChild(docXml.createTextNode("\n      "));
                currentBlock.appendChild(row)
            }
            if (isChorus) {
                currentBlock.setAttribute("type", "chorus")
            }
            if (bis) {
                currentBlockBis=bis
            }

            if ((br_cnt > 1 || node.tagName.toLowerCase() === 'eof') && currentBlock.childNodes.length > 0) {
                //console.log("Flushing...", br_cnt);
                var instrumentalOnly = true
                currentBlock.childNodes.forEach(row => {
                    if (!rowIsInstrumental(row)) {
                        instrumentalOnly = false
                    }
                })
                if (currentBlockBis > 1) {
                    let bisTag = docXml.createElementNS(NAMESPACE, "bis")
                    bisTag.setAttribute("times", currentBlockBis)
                    bisTag.append(...currentBlock.childNodes)
                    currentBlock.appendChild(docXml.createTextNode("\n    "));
                    currentBlock.appendChild(bisTag)
                }
                if (instrumentalOnly && currentBlock.getAttribute('type') !== 'chorus') {
                    currentBlock.setAttribute('type', 'other')
                }
                lyric.appendChild(docXml.createTextNode("\n  "));
                lyric.appendChild(currentBlock);

                currentBlock = docXml.createElementNS(NAMESPACE, "block");
                currentBlock.setAttribute("type", "verse")
                br_cnt = 0;
            }
        } else {
            implicitRow.appendChild(node.cloneNode(true))
        }
    });

    docXml.appendChild(lyric);
    return lyric
}

let NAMESPACE = "http://21wdh.staszic.waw.pl"

export function html2xmlstr(html, window) {
    let parser = new window.DOMParser();
    let docHtml = parser.parseFromString(html, 'text/html');
    let docXml = window.document.implementation.createDocument(NAMESPACE, '', null);
    let song = docXml.createElementNS(NAMESPACE, "song");

    let h1 = docHtml.querySelector('h1');
    let title = h1?.querySelector('strong')?.textContent;
    song.setAttribute("title", title)
    if (!h1 || !title) {
        return null
    }
    let artist = [].reduce.call(h1?.childNodes, function (a, b) {
        return a + (b.nodeType === 3 ? b.textContent.trim() : '');
    }, '');
    if (artist) {
        //<artist type="band">Zespół Reprezentacyjny</artist>
        let artistTag = docXml.createElementNS(NAMESPACE, "artist");
        artistTag.setAttribute("type", "solo")
        artistTag.innerHTML = artist
        song.appendChild(artistTag)
    }

    let metadatas = docHtml.querySelectorAll('div.song-metadata');
    let metadataTxt ='';
    metadatas.forEach(metadata => {
        metadata.textContent.split(/\r?\n|\r|\n/g).forEach(line => {metadataTxt += line.trim() ? line.trim() + '\n' : '';})
    })
    if (metadataTxt) {
        let commentTag=docXml.createElementNS(NAMESPACE, "comment");
        commentTag.innerHTML = metadataTxt
        song.appendChild(commentTag)
    }

    let lyric = interpretationContent2lyric(docHtml, docXml)
    if (!lyric) {
        return null;
    }
    song.appendChild(lyric)
    docXml.appendChild(song);
    return new window.XMLSerializer().serializeToString(docXml).normalize();
}

