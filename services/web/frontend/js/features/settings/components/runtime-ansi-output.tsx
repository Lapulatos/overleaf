import { forwardRef, useMemo } from 'react'
import Anser from '@/features/source-control/vendor/anser.cjs'
const palette:Record<string,string>={'0, 187, 187':'#006a7c','0, 187, 0':'#16703b','187, 187, 0':'#886000','187, 0, 0':'#b22a2a','0, 205, 205':'#006a7c','0, 205, 0':'#16703b','205, 205, 0':'#886000','205, 0, 0':'#b22a2a','255, 0, 0':'#b22a2a','0, 255, 0':'#16703b','255, 255, 0':'#886000'}
export default forwardRef<HTMLPreElement,{value:string;label?:string;runner?:boolean}>(function RuntimeAnsiOutput({value,label='Task output',runner=true},ref){
 const lines=useMemo(()=>value.split('\n').flatMap((raw,index)=>{
  const meta=runner?/^\d{4}-\d\d-\d\dT(\d\d:\d\d:\d\d)\.\d+Z \d\d([OE])\+?\s?/.exec(raw):null
  let text=meta?raw.slice(meta[0].length):raw
  text=text.replace(/\x1b\][^\x07]*(?:\x07)/g,'').replace(/(?:\x1b\[0K)?section_(?:start|end):\d+:[^\r\n]*\r(?:\x1b\[0K)?/g,'').replace(/\r/g,'')
  const pieces=Anser.ansiToJson(text,{remove_empty:true}),plain=pieces.map(p=>p.content).join('')
  if(!plain.trim())return []
  const kind=meta?.[2]==='E'||/^ERROR:/.test(plain)?'error':/^\$ /.test(plain)?'command':/^(Preparing|Getting source|Executing|Cleaning up)/.test(plain)?'phase':/^Job succeeded/.test(plain)?'success':'normal'
  return [{index,time:meta?.[1],pieces,kind}]
 }),[value,runner])
 return <pre className="runtime-ansi-output" aria-label={label} ref={ref} tabIndex={0}>{lines.length?lines.map(line=><span className={`runtime-log-line is-${line.kind}`} key={line.index}>{line.time&&<span className="runtime-log-time" title="UTC">{line.time} </span>}<span className="runtime-log-content">{line.pieces.map((p,i)=><span key={i} style={{color:p.fg?(palette[p.fg]||`rgb(${p.fg})`):undefined,backgroundColor:p.bg?`rgb(${p.bg})`:undefined,fontWeight:p.decoration==='bold'?600:undefined,fontStyle:p.decoration==='italic'?'italic':undefined}}>{p.content.split(/(\b(?:system ID|Working directory|exit code|duration|runner|project):)/gi).map((text,j)=>/^(system ID|Working directory|exit code|duration|runner|project):$/i.test(text)?<strong className="runtime-log-field" key={j}>{text}</strong>:text)}</span>)}</span>{'\n'}</span>):'Waiting for output…'}</pre>
})
