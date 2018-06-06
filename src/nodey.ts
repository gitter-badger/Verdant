import{
  CodeMirrorEditor
} from '@jupyterlab/codemirror';

import {
  Model
} from './model'



export
abstract class Nodey
{
  private node_id: number //id for this node
  private version_id : any //chronological number
  run : string //id marking which run
  timestamp : Date //timestamp when created
  pendingUpdate : string
  parent : string //lookup id for the parent Nodey of this Nodey

  constructor(options: { [id: string] : any })
  {
    this.node_id = options.id
    this.run = options.run
    this.timestamp = options.timestamp
    this.parent = options.parent
  }

  get id() : number
  {
    return this.node_id
  }

  get version() : any
  {
    return this.version_id
  }

  set version(verNum : any)
  {
    this.version_id = verNum
  }

  clone() : Nodey
  {
    return Object.assign({}, this)
  }

  abstract toJSON(): serialized_Nodey
}


export
class NodeyOutput extends Nodey
{
  dependsOn: Nodey[]
  raw: {}

  constructor(options: { [id: string] : any })
  {
    super(options)
    this.raw = options // note for different output types, the data is all named differently
    this.dependsOn = (<any> options)['dependsOn']
  }


  static EMPTY()
  {
    return new NodeyOutput({'raw': {}, 'dependsOn': []})
  }


  toJSON(): serialized_NodeyOutput
  {
    return {'output': this.raw}//TODO
  }

}

export
interface serialized_Nodey {
    run?: number //TODO
}

export
interface serialized_NodeyOutput extends serialized_Nodey{
  output?: {[key: string]: any}
}

export
interface serialized_NodeyCode extends serialized_Nodey{
    type: string,
    output?: serialized_NodeyOutput[],
    literal?: any,
    start?: {'line' : number, 'ch' : number},
    end?: {'line' : number, 'ch' : number}
    content?: string[]
}

export
class NodeyCode extends Nodey
{
  type : string
  output: NodeyOutput[]
  content : string[]
  start: {'line' : number, 'ch' : number}
  end: {'line' : number, 'ch' : number}
  literal: any
  right : string // lookup id for the next Nodey to the right of this one

  constructor(options: { [id: string] : any })
  {
    super(options)
    this.type = options.type
    this.content = options.content
    this.output = (<any> options)['output']
    this.literal = options.literal
    this.start = options.start
    this.end = options.end
    this.right = options.right
  }


  toJSON(): serialized_NodeyCode
  {
    var jsn : serialized_NodeyCode = {'type': this.type}
    if(this.literal)
      jsn.literal = this.literal
    if(this.output)
    {
      var output = this.output.map((output) => output.toJSON())
      if(this.output.length > 0)
        jsn.output = output
    }
    if(this.content && this.content.length > 0)
        jsn.content = this.content

    return jsn
  }


  static EMPTY()
  {
    return new NodeyCode({'type': 'EMPTY', 'content': []})
  }
}


/**
 * A namespace for Nodey statics.
 */
export
namespace Nodey {

  export
  function dictToCodeNodeys(dict: { [id: string] : any }, historyModel: Model, prior: NodeyCode = null) : NodeyCode
  {
    dict.id = historyModel.dispenseNodeyID()
    dict.start.line -=1 // convert the coordinates of the range to code mirror style
    dict.end.line -=1

    // give every node a nextNode so that we can shift/walk for repairs
    var n = new NodeyCode(dict)
    var verNum = historyModel.registerNodey(n)
    n.version = verNum

    if(prior)
      prior.right = n.id+"."+n.version
    prior = null

    n.content = []
    for(var item in dict.content)
    {
      var child = dictToCodeNodeys(dict.content[item], historyModel, prior)
      child.parent = n.id+"."+n.version
      if(prior)
        prior.right = child.id+"."+child.version
      n.content.push(child.id+"."+child.version)
      prior = child
    }

    return n
  }

  export
  function placeMarkers(nodey : NodeyCode, editor : CodeMirrorEditor) : void
  {
    if(nodey.literal) //if this node is has shown concrete text
    {
      var div = document.createElement('div')
      div.classList.add('verd-marker')
      editor.doc.markText(nodey.start, nodey.end, {'css': 'background-color: pink'})
    }
    for(var i in nodey.content)
      this.placeMarkers(nodey.content[i], editor)
  }
}
