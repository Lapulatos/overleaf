import {useId,useState,type CSSProperties,type ReactNode} from 'react'
import {createPortal} from 'react-dom'
export default function TimelinePoint({label,children,className='',style,onClick}:{label:string;children:ReactNode;className?:string;style?:CSSProperties;onClick?:()=>void}){
 const id=useId();const [position,setPosition]=useState<{left:number;top:number;below:boolean}|null>(null)
 function show(element:HTMLButtonElement){const r=element.getBoundingClientRect();setPosition({left:Math.max(148,Math.min(window.innerWidth-148,r.left+r.width/2)),top:r.top<125?r.bottom+8:r.top-8,below:r.top<125})}
 return <><button type="button" className={className} style={style} aria-label={label} aria-describedby={position?id:undefined} onMouseEnter={e=>show(e.currentTarget)} onMouseLeave={()=>setPosition(null)} onFocus={e=>show(e.currentTarget)} onBlur={()=>setPosition(null)} onKeyDown={e=>{if(e.key==='Escape')setPosition(null)}} onClick={onClick||(()=>setPosition(null))}/>{position&&createPortal(<div role="tooltip" id={id} className="deadline-instant-tooltip" style={{left:position.left,top:position.top,transform:`translate(-50%,${position.below?'0':'-100%'})`}}>{children}</div>,document.body)}</>
}
