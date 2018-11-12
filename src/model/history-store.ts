import {
  Nodey,
  NodeyCode,
  NodeyOutput,
  NodeyCodeCell,
  NodeyMarkdown,
  NodeyCell,
  NodeyNotebook
} from "./nodey";

import { NotebookListen } from "../jupyter-hooks/notebook-listen";

import { History } from "./history";

import { FileManager } from "../file-manager";

import { Star } from "./history-stage";

type jsn = { [id: string]: any };

export class HistoryStore {
  readonly fileManager: FileManager;

  private _notebookHistory: NodeHistory<NodeyNotebook>;
  private _codeCellStore: NodeHistory<NodeyCodeCell>[] = [];
  private _markdownStore: NodeHistory<NodeyMarkdown>[] = [];
  private _outputStore: NodeHistory<NodeyOutput>[] = [];
  private _snippetStore: NodeHistory<NodeyCode>[] = [];

  // this is a store for temporary nodes, stored by cell and cleaned out
  // every time a save or run event occurs
  private _starStore: { [id: string]: Star<Nodey>[] } = {};

  constructor(fileManager: FileManager) {
    this.fileManager = fileManager;
    this._notebookHistory = new NodeHistory<NodeyNotebook>();
  }

  get notebookNodey(): NodeyNotebook | Star<NodeyNotebook> {
    return this._notebookHistory.latest;
  }

  get cells(): NodeyCell[] {
    let notebook = this.notebookNodey;
    if (notebook instanceof Star) notebook = notebook.value;
    return notebook.cells.map(name => this.get(name) as NodeyCell);
  }

  public getHistoryOf(name: string | Nodey): NodeHistory<Nodey> {
    let typeChar: string;
    let id: number;
    if (typeof name === "string") {
      var idVal;
      [typeChar, idVal] = name.split(".");
      id = parseInt(idVal);
    } else if (name instanceof Nodey) {
      typeChar = name.typeChar;
      id = name.id;
    }
    switch (typeChar) {
      case "n":
        return this._notebookHistory;
      case "c":
        return this._codeCellStore[id];
      case "o":
        return this._outputStore[id];
      case "s":
        return this._snippetStore[id];
      case "m":
        return this._markdownStore[id];
      default:
        throw new Error("nodey type not found" + name);
    }
  }

  getLatestOf(name: string): Nodey | Star<Nodey> {
    let nodeHist = this.getHistoryOf(name);
    return nodeHist.latest;
  }

  get(name: string): Nodey {
    if (!name) return null;
    //console.log("attempting to find", name);
    let [, , verVal] = name.split(".");
    let ver = parseInt(verVal);
    let nodeHist = this.getHistoryOf(name);
    return nodeHist.versions[ver];
  }

  public store(nodey: Nodey | Star<Nodey>): void {
    if (nodey instanceof Star) {
      // store in temp star store not in permanent storage
      let cell = this.getCellParent(nodey.value);
      if (!this._starStore[cell.id]) this._starStore[cell.id] = [];
      this._starStore[cell.id].push(nodey);
      nodey.cellId = cell.id + "";
    } else {
      let store = this._getStoreFor(nodey);
      let history = this._makeHistoryFor(nodey);
      let id = store.push(history) - 1;
      nodey.id = id;
      let version = store[nodey.id].versions.push(nodey) - 1;
      nodey.version = version;
    }

    return;
  }

  public cleanOutStars(nodey: NodeyCell): void {
    this._starStore[nodey.id] = [];
  }

  private _getStoreFor(nodey: Nodey): NodeHistory<Nodey>[] {
    if (nodey instanceof NodeyCodeCell) return this._codeCellStore;
    else if (nodey instanceof NodeyMarkdown) return this._markdownStore;
    else if (nodey instanceof NodeyOutput) return this._outputStore;
    else if (nodey instanceof NodeyCode) return this._snippetStore;
  }

  private _makeHistoryFor(nodey: Nodey) {
    if (nodey instanceof NodeyCodeCell || nodey instanceof NodeyMarkdown)
      return new NodeHistory<NodeyCell>();
    else if (nodey instanceof NodeyOutput)
      return new NodeHistory<NodeyOutput>();
    else if (nodey instanceof NodeyCode) return new NodeHistory<NodeyCode>();
  }

  public registerTiedNodey(nodey: NodeyCell, forceTie: string): void {
    let oldNodey = this.get(forceTie);
    let history = this.getHistoryOf(oldNodey);
    let version = history.versions.push(nodey) - 1;
    nodey.id = oldNodey.id;
    nodey.version = version;
    return;
  }

  public getCellParent(relativeTo: Nodey): NodeyCodeCell {
    if (relativeTo instanceof NodeyCodeCell) return relativeTo;
    else if (relativeTo.parent)
      return this.getCellParent(this.get(relativeTo.parent));
  }

  public writeToFile(notebook: NodeyNotebook, history: History): void {
    this.fileManager.writeToFile(notebook, history);
  }

  public toJSON(): jsn {
    return {
      notebook: this._notebookHistory.toJSON(),
      codeCells: this._codeCellStore.map(hist => hist.toJSON()),
      markdownCells: this._markdownStore.map(hist => hist.toJSON()),
      snippets: this._snippetStore.map(hist => hist.toJSON()),
      output: this._outputStore.map(hist => hist.toJSON())
    };
  }

  public fromJSON(data: jsn, notebookListen: NotebookListen) {
    this._notebookHistory.fromJSON(
      data.notebook,
      NodeyNotebook.fromJSON.bind(this, notebookListen)
    );
    this._codeCellStore = data.codeCells.map((item: jsn, id: number) => {
      let hist = new NodeHistory<NodeyCodeCell>();
      hist.fromJSON(item, NodeyCodeCell.fromJSON, id);
    });
    this._markdownStore = data.codeCells.map((item: jsn, id: number) => {
      let hist = new NodeHistory<NodeyMarkdown>();
      hist.fromJSON(item, NodeyMarkdown.fromJSON, id);
    });
    this._snippetStore = data.codeCells.map((item: jsn, id: number) => {
      let hist = new NodeHistory<NodeyCode>();
      hist.fromJSON(item, NodeyCode.fromJSON, id);
    });
    this._outputStore = data.codeCells.map((item: jsn, id: number) => {
      let hist = new NodeHistory<NodeyOutput>();
      hist.fromJSON(item, NodeyOutput.fromJSON, id);
    });
  }
}

/*
* Just a container for a list of nodey versions
*/
export class NodeHistory<T extends Nodey> {
  versions: T[] = [];
  private unsavedEdits: Star<T> = null;

  get latest() {
    if (this.unsavedEdits) return this.unsavedEdits;
    return this.versions[this.versions.length - 1];
  }

  setLatestToStar(s: Star<T>): void {
    this.unsavedEdits = s;
  }

  deStar() {
    let newNodey = this.unsavedEdits.value;
    //newNodey.created = runId;
    /*if (newNodey instanceof NodeyCode && output) {
      output.forEach(out => (newNodey as NodeyCode).addOutput(out));
    }*/
    this.unsavedEdits = null;
    this.versions.push(newNodey as T);
    newNodey.version = this.versions.length - 1;
    console.log("de-staring", newNodey, this);
    return newNodey;
  }

  toJSON() {
    return this.versions.map(node => node.toJSON());
  }

  fromJSON(data: jsn, factory: (dat: jsn) => T, id?: number) {
    this.versions = data.map((nodeDat: jsn, version: number) => {
      let nodey = factory(nodeDat);
      if (id) nodey.id = id;
      nodey.version = version;
    });
  }
}