// import {findAncestor, nbsp} from "./utils.js";
//
// const predefinedChords = ["A", "A2", "A4", "A7", "A7+", "A7/4", "A7/6", "Ais",
//     "B", "C", "C0", "C7", "C7+", "C9", "C9/5", "Cis", "Cis0", "D", "D2", "D4",
//     "D7", "D7+", "Dis", "E", "E0", "E5+", "E7", "E7/4", "F", "F0", "F7", "F7+",
//     "Fis", "Fis0", "Fis7", "G", "G0", "G6", "G7", "GC", "Gis", "H", "H6/7", "H7",
//     "a", "a6", "a7", "a7+", "a7/9", "ais", "b", "c", "cis", "cis7", "d", "d2",
//     "d6", "e", "e7", "e9", "f", "fis", "fis7", "g", "gis", "gis7", "h", "h0",
//     "h7", "h7/5-"];

//const sidechordstemplate = document.createElement('template');

import {getChordsFromRow, getNextRow, getPrevRow, getSideChordsForRow, setSideChordsForRow} from "./verse.js";
import {nbsp} from "./utils.js";
import {makeRowInstrumental, makeRowNotInstrumental, notifyRowParentAboutChange, pushRowChords} from "./songbody.js";

const template = document.createElement('template');

export default class SideChordsRow extends HTMLElement {
    constructor() {
        super();

        const shadow = this.attachShadow({mode: "closed"});
        shadow.appendChild(template.content.cloneNode(true));

        // this.chordsType = shadow.getElementById("chords_type");
        this.selectType = shadow.getElementById("select_type");
        this.chinput = shadow.getElementById("sch");

        this.selectType.addEventListener("change", () => {
            this.pushRowType();
            notifyRowParentAboutChange(this.row);
        });
        this.chinput.addEventListener("change", () => {
            this.pushSideChords();
            notifyRowParentAboutChange(this.row);
        })

        this.chinput.addEventListener("beforeinput", (e) => {
            console.log("SCH::BeforeInput", e)
        })

        this.chinput.addEventListener("keydown", (e) => {
            console.log("SCH::KeyDown", e)
            if (e.key == 'ArrowDown'
                && this.chinput.selectionStart == this.chinput.selectionEnd
                && this.chinput.selectionStart == this.chinput.value.length) {
                const nextRow = getNextRow(this.row);
                if (nextRow) {
                    nextRow.siblingSide.chinput.focus();
                    nextRow.siblingSide.chinput.selectionStart =0;
                    nextRow.siblingSide.chinput.selectionEnd =0;
                    e.preventDefault();
                }
            }
            if (e.key == 'ArrowUp'
                && this.chinput.selectionStart == this.chinput.selectionEnd
                && this.chinput.selectionStart == 0) {
                const prevRow = getPrevRow(this.row);
                if (prevRow) {
                    prevRow.siblingSide.chinput.focus();
                    prevRow.siblingSide.chinput.selectionStart= prevRow.siblingSide.chinput.value.length;
                    prevRow.siblingSide.chinput.selectionEnd = prevRow.siblingSide.chinput.selectionStart;
                    e.preventDefault();
                }
            }
        })

        this.buttonSyncToSide = shadow.getElementById("sync_to_side");
        this.buttonSyncToLyric = shadow.getElementById("sync_to_lyric");

        this.buttonSyncToSide.addEventListener("click", () => {
            this.chinput.value = getChordsFromRow(this.row);
            this.pushSideChords();
            notifyRowParentAboutChange(this.row);
        })

        this.buttonSyncToLyric.addEventListener("click", () => {
            pushRowChords(this.row, this.chinput.value)
            notifyRowParentAboutChange(this.row);
            //this.pushSideChords();
        })

        //sync_to_lyric
    }

    setRow(row) {
        this.row = row;
    }

    connectedCallback() {
        this.loadRow();
    }

    pushRowType() {
        switch (this.selectType.value) {
            case "important":
                this.row.setAttribute('important_over', 'true');
                makeRowNotInstrumental(this.row);
                break;
            case "available":
                this.row.setAttribute('important_over', 'false');
                makeRowNotInstrumental(this.row);
                break;
            case "never":
                this.row.setAttribute('important_over', 'never');
                makeRowNotInstrumental(this.row);
                break;
            case "instr":
                makeRowInstrumental(this.row)
                break
        }
    }

    pushSideChords() {
        setSideChordsForRow(this.row, this.chinput.value.trim())
        this.refreshSync()
    }

    loadRow() {
        this.chinput.value = getSideChordsForRow(this.row);
        let rowType = this.row.getAttribute("type");
        if (rowType == 'instr') {
            this.selectType.value = "instr"
            this.buttonSyncToLyric.style.display='none';
            this.buttonSyncToSide.style.display='none';
            return
        } else {
            this.buttonSyncToLyric.style.display='inline-block';
            this.buttonSyncToSide.style.display='inline-block';
        }
        let impOver = this.row.getAttribute("important_over");
        if (impOver == "true") {
            this.selectType.value = "important"
        } else if (impOver == "false" || !impOver || impOver.trim() == "") {
            this.selectType.value = "available"
        }
        if (impOver == "never") {
            this.selectType.value = "never"
        }

        this.pushSideChords()
    }

    normalizeChords(ch) {
        return ch
            .trim()
            .replaceAll(nbsp, "").replaceAll(" ", "")
            .replaceAll("(", "").replaceAll(")", "")
            .replaceAll("[", "").replaceAll("]", "")
            .replaceAll("<", "").replaceAll(">", "")
            .replaceAll("|", "").replaceAll("!", "")
    }

    refreshSync() {
        if (this.row.getAttribute('type')=='instr') {
            this.chinput.style.backgroundColor = 'white' // light green
            return
        }
        if (this.normalizeChords(this.chinput.value) === this.normalizeChords(getChordsFromRow(this.row))) {
            this.chinput.style.backgroundColor = '#E0FFE0' // light green
        } else {
            this.chinput.style.backgroundColor = '#FFCCCB' // light red
        }
    }
}

export function SideChordsInit() {
    template.innerHTML = `
<link rel="stylesheet" href="./sidechords.css"/>
<link href="https://fonts.googleapis.com/css?family=Material+Icons|Material+Icons+Outlined|Material+Icons+Round"
      rel="stylesheet"/>
<div id="sidechords">
  <div id="type">
<!--      <span id="chords_type"  class="material-icons">auto_awesome</span>-->
      <select id="select_type">
          <option value="important">Kluczowe nad</option><!--First chorus only-->
          <option value="available">Opcjonalnie nad</option><-- Szkoda miejsca-->
          <option value="never">Tylko z boku</option><!-- never - np. nie ustawione prawidłowo-->
          <option value="instr">Wers instrumentalny</option>
      </select>
  </div>
  <input type="text" id="sch"/>
  <button class="material-icons" id="sync_to_side">keyboard_double_arrow_left</button>
  <button class="material-icons" id="sync_to_lyric">keyboard_double_arrow_right</button>
</div>
  `;

    customElements.define("song-side-chords", SideChordsRow);
}
