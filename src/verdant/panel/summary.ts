import { Widget } from "@phosphor/widgets";
import { CellSampler } from "../sampler/cell-sampler";
import { History } from "../../lilgit/model/history";
import { VerNotebook } from "../../lilgit/components/notebook";
import { VerCell } from "../../lilgit/components/cell";
import { Nodey, NodeyCodeCell } from "../../lilgit/model/nodey";
import { Checkpoint, CheckpointType } from "../../lilgit/model/checkpoint";

const PANEL = "v-VerdantPanel-content";
const SUMMARY = "v-VerdantPanel-Summary";
const COL = "v-VerdantPanel-Summary-column";
const CELL = "v-VerdantPanel-Summary-cell";
const NOTEBOOK_ICON = "v-VerdantPanel-Summary-notebook-icon";
const NOTEBOOK_LABEL = "v-VerdantPanel-Summary-notebook-label";
const NOTEBOOK_TITLE = "v-VerdantPanel-Summary-notebook-title";
const CODE_VLABEL = "v-VerdantPanel-Summary-code-vLabel";
const OUT_VLABEL = "v-VerdantPanel-Summary-out-vLabel";
const CODE_VLABEL_BORDER = "v-VerdantPanel-Summary-code-vLabel-border";
const HEADER = "v-VerdantPanel-Summary-header";
const HEADER_ALABEL = "v-VerdantPanel-Summary-header-aLabel";
const HEADER_VLABEL = "v-VerdantPanel-Summary-header-vLabel";

export class Summary extends Widget {
  readonly history: History;
  readonly artifactCol: HTMLElement;
  readonly verCol: HTMLElement;

  constructor(history: History) {
    super();
    this.node.classList.add(PANEL);
    this.history = history;

    let header = this.buildHeader();
    this.node.appendChild(header);

    let table = document.createElement("div");
    table.classList.add(SUMMARY);
    this.node.appendChild(table);

    this.artifactCol = document.createElement("div");
    this.artifactCol.classList.add(COL);
    this.artifactCol.classList.add("artifactCol");
    table.appendChild(this.artifactCol);

    this.verCol = document.createElement("div");
    this.verCol.classList.add(COL);
    table.appendChild(this.verCol);

    this.history.ready.then(async () => {
      await this.history.notebook.ready;
      this.build(this.history);
    });
  }

  public updateSummary(
    verCell: VerCell,
    checkpoint: Checkpoint,
    index?: number,
    indexB?: number
  ) {
    switch (checkpoint.checkpointType) {
      case CheckpointType.ADD:
        this.addCell(verCell, index);
        break;
      case CheckpointType.DELETE:
        this.removeCell(index);
        break;
      case CheckpointType.MOVED:
        this.moveCell(index, indexB);
        break;
      case CheckpointType.RUN:
        this.updateCell(verCell);
        break;
      case CheckpointType.SAVE:
        this.updateCell(verCell);
        break;
    }
    this.updateNotebook(this.history.notebook);
  }

  private buildHeader() {
    let header = document.createElement("div");
    header.classList.add(HEADER);

    let aLabel = document.createElement("div");
    aLabel.classList.add(HEADER_ALABEL);
    aLabel.textContent = "artifact";
    header.appendChild(aLabel);

    let vLabel = document.createElement("div");
    vLabel.classList.add(HEADER_VLABEL);
    vLabel.textContent = "versions";
    header.appendChild(vLabel);

    return header;
  }

  private buildNotebookTitle(title: string) {
    let name = document.createElement("div");
    name.classList.add(NOTEBOOK_LABEL);
    let icon = document.createElement("div");
    icon.classList.add(NOTEBOOK_ICON);
    icon.classList.add("jp-NotebookIcon");
    let titleDiv = document.createElement("div");
    titleDiv.classList.add(NOTEBOOK_TITLE);
    titleDiv.textContent = title;
    name.appendChild(icon);
    name.appendChild(titleDiv);
    return name;
  }

  private build(history: History) {
    let notebook = history.notebook;
    let title = notebook.name;
    let sample = this.buildNotebookTitle(title);
    let vers = this.getHistorySize(notebook.model.name);
    let [cellA, cellV] = this.buildCell(sample, vers);
    this.artifactCol.appendChild(cellA);
    this.verCol.appendChild(cellV);
    this.addCellEvents(cellA, cellV);

    notebook.cells.forEach((cell, index) => {
      this.addCell(cell, index);
    });
  }

  private updateNotebook(notebook: VerNotebook) {
    let title = notebook.name;
    let vers = this.getHistorySize(notebook.model.name);
    let sample = this.buildNotebookTitle(title);
    let [cellA, cellV] = this.buildCell(sample, vers);
    this.replaceCell(cellA, cellV, 0);
    this.addCellEvents(cellA, cellV);
  }

  private getHistorySize(name: string): number {
    let count = 0;
    let hist = this.history.store.getHistoryOf(name);
    count += hist.length;
    if (hist.originPointer)
      count += this.getHistorySize(hist.originPointer.origin);
    return count;
  }

  private updateCell(cell: VerCell) {
    let index = cell.currentIndex;
    index++; //skip the notebook
    let model = cell.lastSavedModel;
    let sample = CellSampler.sampleCell(this.history, model);
    let vers = this.getHistorySize(model.name);
    let outVers;
    if (model instanceof NodeyCodeCell) {
      outVers = this.getHistorySize(model.output);
    }
    let [cellA, cellV] = this.buildCell(sample, vers, outVers);
    this.replaceCell(cellA, cellV, index);
    this.addCellEvents(cellA, cellV, model);
  }

  public highlightCell(index: number) {
    index++; //skip the notebook
    let children = this.artifactCol.children;
    for (var i = 0; i < children.length; i++) {
      if (i === index) children[i].classList.add("highlight");
      else children[i].classList.remove("highlight");
    }
  }

  private addCell(cell: VerCell, index: number) {
    index++; //skip the notebook
    let model = cell.lastSavedModel;
    let sample = CellSampler.sampleCell(this.history, model);
    let vers = this.getHistorySize(model.name);
    let outVers;
    if (model instanceof NodeyCodeCell) {
      outVers = this.getHistorySize(model.output);
    }
    let [cellA, cellV] = this.buildCell(sample, vers, outVers);
    this.artifactCol.insertBefore(cellA, this.artifactCol.children[index]);
    this.verCol.insertBefore(cellV, this.verCol.children[index + 1]);
    this.addCellEvents(cellA, cellV, model);
  }

  private removeCell(index: number) {
    index++; //skip the notebook
    this.artifactCol.removeChild(this.artifactCol.children[index]);
    this.verCol.removeChild(this.verCol.children[index]);
  }

  private moveCell(oldPos: number, newPos: number) {
    oldPos++; //skip the notebook
    newPos++; //skip the notebook

    let elem = this.artifactCol.removeChild(this.artifactCol.children[oldPos]);
    this.artifactCol.insertBefore(elem, this.artifactCol.children[newPos]);

    let ver = this.verCol.removeChild(this.verCol.children[oldPos]);
    this.verCol.insertBefore(ver, this.verCol.children[newPos]);
  }

  private buildCell(
    title: HTMLElement,
    vers: number,
    outVers: number = undefined
  ) {
    let cellA = document.createElement("div");
    cellA.classList.add(CELL);
    cellA.appendChild(title);

    let cellV = document.createElement("div");
    cellV.classList.add(CELL);
    cellV.classList.add("ver");

    if (outVers) {
      let codeV = document.createElement("div");
      codeV.textContent = vers + "";
      codeV.classList.add(CODE_VLABEL);
      cellV.appendChild(codeV);
      let border = document.createElement("div");
      border.classList.add(CODE_VLABEL_BORDER);
      cellV.appendChild(border);
      let outV = document.createElement("div");
      outV.textContent = outVers + "";
      outV.classList.add(OUT_VLABEL);
      cellV.appendChild(outV);
    } else cellV.textContent = vers + "";

    return [cellA, cellV];
  }

  addCellEvents(cellA: HTMLElement, cellV: HTMLElement, model?: Nodey) {
    cellA.addEventListener("mouseenter", () => {
      cellV.classList.add("selected");
    });
    cellA.addEventListener("mouseleave", () => {
      cellV.classList.remove("selected");
    });
    cellV.addEventListener("mouseenter", () => {
      cellA.classList.add("selected");
    });
    cellV.addEventListener("mouseleave", () => {
      cellA.classList.remove("selected");
    });

    if (model) {
      cellA.addEventListener("click", () => {
        this.history.inspector.target = model;
        cellV.classList.remove("selected");
      });
      cellV.addEventListener("click", () => {
        this.history.inspector.target = model;
        cellA.classList.remove("selected");
      });
    }
  }

  replaceCell(cellA: HTMLElement, cellV: HTMLElement, index: number) {
    let childA = this.artifactCol.children[index];
    this.artifactCol.replaceChild(cellA, childA);
    let childV = this.verCol.children[index];
    this.verCol.replaceChild(cellV, childV);
  }
}
