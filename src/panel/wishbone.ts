import { History } from "../model/history";
import { CodeCellListen } from "../jupyter-hooks/cell-listen";
import { Nodey, NodeyCodeCell } from "../model/nodey";
import { Inspect } from "../inspect";
import { VerNotebook } from "../components/notebook";
import { CodeCell } from "@jupyterlab/cells";
import { VerCell } from "../components/cell";

const WISHBONE_HIGHLIGHT = "v-VerdantPanel-wishbone-highlight";
const WISHBONE_HIGHLIGHT_CODE = "v-VerdantPanel-wishbone-code-highlight";
const WISHBONE_CODE = "v-VerdantPanel-wishbone-code";
const WISHBONE_CODE_MASK = "v-VerdantPanel-wishbone-code-mask";

export namespace Wishbone {
  export function startWishbone(historyModel: History) {
    console.log("starting wishbone!", historyModel);
    historyModel.notebook.cells.forEach((verCell: VerCell) => {
      var cell = verCell.view.cell;
      Private.addEvents(
        cell.inputArea.promptNode,
        [verCell.model],
        historyModel.inspector
      );

      if (cell instanceof CodeCell) {
        Private.addLineEvents(cell as CodeCell, verCell, historyModel);
        Private.addOutputEvents(verCell, historyModel);
      }
    });
  }

  export function endWishbone(notebook: VerNotebook, historyModel: History) {
    notebook.cells.forEach((cellListen: VerCell) => {
      var cell = cellListen.view.cell;
      Private.removeEvents(
        cell.inputArea.promptNode,
        [cellListen.model],
        historyModel.inspector
      );

      if (cell instanceof CodeCell) {
        Private.removeLineEvents(cell as CodeCell, cellListen, historyModel);
        Private.removeOutputEvents(cellListen, historyModel);
      }
    });
  }
}

/*
* a place for Wishbone's internal functionality
*/
namespace Private {
  export function highlightSelection(event: Event) {
    // signal known cell node of selection
    (<Element>event.target).classList.add(WISHBONE_HIGHLIGHT);
  }

  export function blurSelection(event: Event) {
    (<Element>event.target).classList.remove(WISHBONE_HIGHLIGHT);
  }

  export function highlightCode(event: MouseEvent, code: Element) {
    event.stopPropagation();
    if (filterSelect(code, event)) {
      var betterMatch = false;
      for (var i = 0; i < code.children.length; i++) {
        if (code.children[i].classList.contains(WISHBONE_CODE)) {
          betterMatch = highlightCode(event, code.children[i]);
          if (betterMatch) break;
        }
      }
      if (!betterMatch) {
        code.classList.add(WISHBONE_HIGHLIGHT_CODE);
      }
      return true;
    }
    return false;
  }

  export function selectTarget(nodey: Nodey[], inspector: Inspect, _: Event) {
    inspector.changeTarget(nodey);
  }

  export function selectCodeTarget(
    nodey: NodeyCodeCell,
    inspector: Inspect,
    cell: CodeCell,
    event: MouseEvent
  ) {
    event.stopPropagation();
    if (filterSelect(event.target as Element, event))
      inspector.changeTarget([
        inspector.figureOutTarget(nodey, cell, event.target as HTMLElement)
      ]);
  }

  export function addEvents(elem: Element, nodey: Nodey[], inspector: Inspect) {
    elem.addEventListener("mouseenter", Private.highlightSelection, false);
    elem.addEventListener("mouseleave", Private.blurSelection);
    elem.addEventListener(
      "mouseup",
      Private.selectTarget.bind(this, nodey, inspector)
    );
  }

  export function removeEvents(
    elem: HTMLElement,
    nodey: Nodey[],
    inspector: Inspect
  ) {
    elem.removeEventListener("mouseenter", Private.highlightSelection);
    elem.removeEventListener("mouseleave", Private.blurSelection);
    elem.removeEventListener(
      "mouseup",
      Private.selectTarget.bind(this, nodey, inspector)
    );
  }

  export function addOutputEvents(cellListen: VerCell, historyModel: History) {
    var outputNodey = cellListen.output;
    console.log("output nodey are", outputNodey);
    if (outputNodey)
      outputNodey.forEach(out =>
        addEvents(
          (cellListen.view as CodeCellListen).outputArea.node,
          [out],
          historyModel.inspector
        )
      );
  }

  export function removeOutputEvents(
    cellListen: VerCell,
    historyModel: History
  ) {
    var outputNodey = cellListen.output;
    if (outputNodey)
      if (outputNodey)
        outputNodey.forEach(out =>
          removeEvents(
            (cellListen.view as CodeCellListen).outputArea.node,
            [out],
            historyModel.inspector
          )
        );
  }

  export function addLineEvents(
    cell: CodeCell,
    cellListen: VerCell,
    historyModel: History
  ) {
    var nodey = cellListen.model as NodeyCodeCell;
    var mask = document.createElement("div");
    mask.classList.add(WISHBONE_CODE_MASK);
    mask.addEventListener("mouseup", filterEvents);
    mask.addEventListener("mouseenter", startCodeSelection.bind(this, mask));
    mask.addEventListener("mouseleave", endCodeSelection.bind(this, mask));
    cell.editorWidget.node.appendChild(mask);
    var code = cell.inputArea.node.getElementsByTagName("span");
    for (var i = 0; i < code.length; i++) {
      code[i].classList.add(WISHBONE_CODE);
      code[i].addEventListener(
        "click",
        Private.selectCodeTarget.bind(this, nodey, historyModel.inspector, cell)
      );
    }
    var lines = cell.inputArea.node.getElementsByClassName("CodeMirror-line");
    for (var i = 0; i < lines.length; i++) {
      lines[i].classList.add(WISHBONE_CODE);
      lines[i].addEventListener(
        "click",
        Private.selectCodeTarget.bind(this, nodey, historyModel.inspector, cell)
      );
    }
  }

  function startCodeSelection(mask: Element, _: MouseEvent) {
    mask.addEventListener("mousemove", codeSelection.bind(this, mask));
  }

  function codeSelection(mask: Element, ev: MouseEvent) {
    var highlighted = document.getElementsByClassName(WISHBONE_HIGHLIGHT_CODE);
    for (var i = 0; i < highlighted.length; i++) {
      highlighted[i].classList.remove(WISHBONE_HIGHLIGHT_CODE);
    }
    var code = mask.parentElement.getElementsByClassName("CodeMirror-line");
    for (var i = 0; i < code.length; i++) {
      highlightCode(ev, code[i]);
    }
  }

  function endCodeSelection(mask: Element, _: MouseEvent) {
    mask.removeEventListener("mousemove", codeSelection.bind(this, mask));
  }

  function filterEvents(ev: MouseEvent) {
    var mask = this;
    console.log("mask " + ev.type, ev.target, ev);
    ev.preventDefault();
    ev.stopPropagation();

    var event = new MouseEvent(ev.type, ev);

    var code = mask.parentElement.getElementsByClassName(
      WISHBONE_HIGHLIGHT_CODE
    );
    for (var i = 0; i < code.length; i++) code[i].dispatchEvent(event);
  }

  function filterSelect(elem: Element, ev: MouseEvent) {
    var x = ev.clientX;
    var y = ev.clientY;
    var rects = elem.getBoundingClientRect();
    return (
      rects.left <= x && rects.right >= x && rects.top <= y && rects.bottom >= y
    );
  }

  export function removeLineEvents(
    cell: CodeCell,
    cellListen: VerCell,
    historyModel: History
  ) {
    var nodey = cellListen.model as NodeyCodeCell;
    var mask = cell.inputArea.node.getElementsByClassName(
      WISHBONE_CODE_MASK
    )[0];
    mask.remove();
    var code = cell.inputArea.node.getElementsByClassName(WISHBONE_CODE);
    for (var i = 0; i < code.length; i++) {
      code[i].removeEventListener(
        "click",
        Private.selectCodeTarget.bind(this, nodey, historyModel.inspector, cell)
      );
      code[i].classList.remove(WISHBONE_CODE);
    }
  }
}
