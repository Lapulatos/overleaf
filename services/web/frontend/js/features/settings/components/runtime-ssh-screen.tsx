import { useEffect, useRef, useState } from 'react'
import MaterialIcon from '@/shared/components/material-icon'
import { postJSON } from '@/infrastructure/fetch-json'
import type { Terminal } from '@/features/source-control/vendor/xterm'
import '@/features/source-control/vendor/xterm.css'
import { message } from '@/features/source-editor/extensions/writing-assist/agent-task-result'
export default function RuntimeSshScreen({api,onEnded}:{api:string;onEnded:()=>void}) {
 const host=useRef<HTMLDivElement>(null),[status,setStatus]=useState('Connecting…'),[error,setError]=useState(''),[retry,setRetry]=useState(0)
 const ended=useRef(onEnded);ended.current=onEnded
 useEffect(()=>{
  let active=true,terminal:Terminal|undefined,client:string|undefined,cursor=0,seq=0,timer:ReturnType<typeof setTimeout>,resizeTimer:ReturnType<typeof setTimeout>,observer:ResizeObserver|undefined,input=Promise.resolve(),reconnecting=false
  const request=<T,>(action:string,body:object={})=>postJSON<T>(`${api}/${action}`,{body:{client,...body}})
  const resize=()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(!terminal||!host.current||!host.current.clientWidth||!host.current.clientHeight||!client||!active)return;const screen=terminal.element?.querySelector<HTMLElement>('.xterm-screen');const cw=screen?.clientWidth?screen.clientWidth/terminal.cols:8,ch=screen?.clientHeight?screen.clientHeight/terminal.rows:17;const cols=Math.max(2,Math.min(500,Math.floor((host.current.clientWidth-20)/cw))),rows=Math.max(2,Math.min(200,Math.floor((host.current.clientHeight-8)/ch)));terminal.resize(cols,rows);void request('resize',{cols,rows}).catch(()=>{})},120)}
  async function attach(){
   const result=await request<{client:string}>('attach')
   if(!active){void request('detach',{client:result.client}).catch(()=>{});return}
   client=result.client;cursor=0;seq=0;terminal?.reset();setStatus('Connected');setError('');resize();terminal?.focus()
  }
  async function poll(){
   if(!active)return
   try{const result=await request<{output:string;cursor:number;disconnected:boolean;truncated:boolean}>('poll',{cursor});if(!active)return;cursor=result.cursor;if(result.truncated)terminal?.writeln('\r\n[Output buffer exceeded; use History]\r\n');if(result.output)terminal?.write(result.output);if(result.disconnected){setStatus('Disconnected');ended.current();throw Error('Connection closed')};timer=setTimeout(poll,200)}catch(e){
    if(!active)return;setError(message(e));setStatus('Reconnecting…');if(reconnecting)return;reconnecting=true
    timer=setTimeout(async()=>{try{if(client)await request('detach').catch(()=>{});await attach();reconnecting=false;if(active)void poll()}catch(err){reconnecting=false;if(active){setStatus('Disconnected');setError(message(err));ended.current()}}},2000)
   }
  }
  void(async()=>{
   terminal=new (await import('@/features/source-control/vendor/xterm.cjs')).Terminal({fontSize:12,lineHeight:1.3,cursorBlink:true,scrollback:5000,theme:{background:'#f7f8fa',foreground:'#202630',cursor:'#202630',selectionBackground:'#b7cfe9'}})
   if(!active){terminal.dispose();return}terminal.open(host.current!)
   terminal.onData(data=>{if(!active||!client||reconnecting)return;const target=client,sequence=++seq;input=input.then(()=>request('input',{client:target,input:data,seq:sequence})).then(()=>{}).catch(e=>{if(active)setError(message(e))})})
   await attach();if(!active)return;observer=new ResizeObserver(resize);observer.observe(host.current!);void poll()
  })().catch(e=>{if(active){setStatus('Disconnected');setError(message(e))}})
  return()=>{active=false;clearTimeout(timer);clearTimeout(resizeTimer);observer?.disconnect();terminal?.dispose();if(client){const target=client;void input.finally(()=>request('detach',{client:target})).catch(()=>{})}}
 },[api,retry])
 return <div className="runtime-ssh-screen"><div className="runtime-ssh-status"><span role="status">{status}</span><button title="Reconnect terminal" aria-label="Reconnect terminal" onClick={()=>setRetry(v=>v+1)}><MaterialIcon type="refresh"/></button></div>{error&&<p role="alert">{error}</p>}<div className="runtime-ssh-host" ref={host} aria-label="Remote terminal"/></div>
}
