import { jsn } from "../components/notebook";
import { History } from "../model/history";
import { CodeCell, MarkdownCell, Cell } from "@jupyterlab/cells";
import { ASTUtils } from "./ast-utils";
import { Checkpoint } from "../model/checkpoint";
import {
  SyntaxToken,
  NodeyCell,
  NodeyCode,
  NodeyCodeCell,
  NodeyMarkdown,
  NodeyNotebook,
  NodeyOutput
} from "../model/nodey";

export class ASTCreate {
  history: History;

  constructor(history: History) {
    this.history = history;
  }

  public createNotebook(options: jsn) {
    let notebook = new NodeyNotebook(options);
    this.history.store.store(notebook);
    return notebook;
  }

  public createMarkdown(options: jsn) {
    let nodey = new NodeyMarkdown(options);
    this.history.store.store(nodey);
    return nodey;
  }

  public createCode(options: jsn) {
    let n = new NodeyCode(options);
    this.history.store.store(n);
    if ("content" in options) this.unpackContent(options, n);
    return n;
  }

  public createCodeCell(options: jsn) {
    let n = new NodeyCodeCell(options);
    this.history.store.store(n);
    if ("content" in options) this.unpackContent(options, n);
    return n;
  }

  public createSyntaxToken(tok: string) {
    return new SyntaxToken(tok);
  }

  public createOutput(options: jsn, parent: NodeyCodeCell) {
    let output = new NodeyOutput(options);
    this.history.store.store(output);
    parent.output = output.name;
    return output;
  }

  public async fromCell(cell: Cell, checkpoint: Checkpoint) {
    let nodey: NodeyCell;
    if (cell instanceof CodeCell) {
      // First, create code cell from text
      let text: string = cell.editor.model.value.text;
      if (text.length > 0)
        nodey = await this.generateCodeNodey(text, checkpoint.id);
      else {
        nodey = this.createCodeCell({
          start: { line: 1, ch: 0 },
          end: { line: 1, ch: 0 },
          type: "Module",
          created: checkpoint.id
        });
      }
      // Next, create output
      let output_raw = cell.outputArea.model.toJSON();
      this.createOutput(
        {
          raw: output_raw,
          created: checkpoint.id,
          parent: nodey.name
        },
        nodey as NodeyCodeCell
      );
    } else if (cell instanceof MarkdownCell) {
      // create markdown cell from text
      let text = cell.model.value.text;
      nodey = this.createMarkdown({ markdown: text, created: checkpoint.id });
    }
    return nodey;
  }

  public async generateCodeNodey(
    code: string,
    checkpoint: number
  ): Promise<NodeyCode> {
    let dict = await ASTUtils.parseRequest(code);
    dict["created"] = checkpoint;
    let nodey = this.createCodeCell(dict);
    return nodey;
  }

  private unpackContent(dict: { [id: string]: any }, parent: NodeyCode) {
    let prior = null;
    parent.content = [];
    for (let item in dict.content) {
      let raw = dict.content[item];
      raw["created"] = dict["created"];
      raw["prior"] = prior;
      raw["parent"] = parent.name;
      let child;
      if (SyntaxToken.KEY in raw)
        parent.content.push(this.createSyntaxToken(raw[SyntaxToken.KEY]));
      else {
        child = this.createCode(raw);
        if (prior) prior.right = child.name;
        prior = child;
        parent.content.push(child.name);
      }
    }
    return parent;
  }
}
