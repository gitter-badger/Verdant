import { Widget } from "@phosphor/widgets";
import { Wishbone } from "./details/wishbone";
import { Summary } from "./summary";
import { History } from "../model/history";
import { Checkpoint } from "../model/checkpoint";
import { Mixin } from "./details/mixin";

import { Nodey, NodeyCode, NodeyMarkdown, NodeyOutput } from "../model/nodey";

const PANEL = "v-VerdantPanel-content";
const INSPECTOR_BUTTON = "v-VerdantPanel-inspectorButton";
const CRUMB_MENU = "v-VerdantPanel-crumbMenu";
const CRUMB_MENU_ITEM = "v-VerdantPanel-crumbMenu-item";
const HEADER = "v-VerdantPanel-tab-header";

export class CrumbBox extends Widget {
  readonly history: History;
  readonly summary: Summary;
  private _target: Nodey;
  private _active: boolean = false;
  private menu: HTMLElement;
  private content: HTMLElement;
  private showingDetail: boolean;

  constructor(history: History) {
    super();
    this.node.classList.add(PANEL);
    this.history = history;
    this.summary = new Summary(this.history);

    let header = document.createElement("div");
    header.classList.add(HEADER);
    this.menu = document.createElement("div");
    this.menu.classList.add(CRUMB_MENU);
    this.buildCrumbMenu();
    header.appendChild(this.menu);
    let inspectorButton = document.createElement("div");
    inspectorButton.classList.add(INSPECTOR_BUTTON);
    inspectorButton.addEventListener("click", this.toggleInspector.bind(this));
    header.appendChild(inspectorButton);
    this.node.appendChild(header);

    this.content = document.createElement("div");
    this.node.appendChild(this.content);
    this.content.appendChild(this.summary.node);
    this.showingDetail = false;

    this.history.inspector.ready.then(async () => {
      this.history.inspector.targetChanged.connect((_: any, nodey: Nodey[]) => {
        this.changeTarget(nodey);
      });
    });
  }

  show() {
    this._active = true;
  }

  hide() {
    this._active = false;
    let inspectorButton = this.node.getElementsByClassName(INSPECTOR_BUTTON)[0];
    if (inspectorButton.classList.contains("active")) {
      inspectorButton.classList.remove("active");
      Wishbone.endWishbone(this.history.notebook);
    }
  }

  changeTarget(node: Nodey[]) {
    console.log("CHANGE TARGET", node);
    if (this._active && this._target !== node[0]) {
      this._target = node[0];
      this.buildCrumbMenu();
      this.buildDetails();
      this.showingDetail = true;
    }
  }

  buildCrumbMenu(): void {
    this.menu.innerHTML = "";

    if (this._target) {
      let notebookItem = document.createElement("div");
      notebookItem.classList.add(CRUMB_MENU_ITEM);
      notebookItem.textContent = "Notebook";
      notebookItem.addEventListener("click", () => {
        this.closeDetails();
      });
      this.menu.appendChild(notebookItem);
      Mixin.addSeperator(this.menu);
      if (this._target instanceof NodeyCode)
        Mixin.labelNodeyCode(this.menu, this._target, this.history);
      else if (this._target instanceof NodeyMarkdown)
        Mixin.addItem(this.menu, "markdown " + this._target.id);
      else if (this._target instanceof NodeyOutput)
        Mixin.addItem(this.menu, "output " + this._target.id);
    }
  }

  buildDetails() {
    this.content.innerHTML = "";
    let mixin = new Mixin(this.history, [this._target], false);
    this.content.appendChild(mixin.node);

    if (this._target instanceof NodeyCode) {
      let output = this.history.store.get(this._target.output);
      let outMix = new Mixin(this.history, [output], true);
      this.content.appendChild(outMix.node);
    }
  }

  closeDetails() {
    this.content.innerHTML = "";
    this.menu.innerHTML = "";
    this.content.appendChild(this.summary.node);
    this.showingDetail = false;
    this.history.inspector.clearTarget();
    this._target = null;
  }

  toggleInspector() {
    let inspectorButton = this.node.getElementsByClassName(INSPECTOR_BUTTON)[0];
    if (inspectorButton.classList.contains("active")) {
      inspectorButton.classList.remove("active");
      Wishbone.endWishbone(this.history.notebook);
    } else {
      inspectorButton.classList.add("active");
      Wishbone.startWishbone(this.history);
    }
  }

  updateNode(
    nodey: Nodey | Nodey[],
    checkpoint: Checkpoint,
    index?: number,
    indexB?: number
  ) {
    let list: Nodey[];
    if (nodey instanceof Nodey) list = [nodey];
    else list = nodey;
    console.log("UPDATE crumbs", nodey, list, checkpoint);

    list.forEach(item => {
      let verCell = this.history.notebook.getCellByNode(item);
      this.summary.updateSummary(verCell, checkpoint, index, indexB);
      //TODO update detail view
      if (this.showingDetail) {
        let targetCell = this.history.store.getCellParent(this._target);
        if (targetCell.id == item.id && targetCell.typeChar === item.typeChar) {
          // then these two nodey are related, assuming the node is cells only
          this.buildDetails(); // TODO OPTIMIZE
        }
      }
    });
  }
}
