import MetricUpdateButton from './metric-update-button'
import { useEffect, useState } from 'react'
import { getJSON, postJSON, putJSON, deleteJSON } from '@/infrastructure/fetch-json'
import MaterialIcon from '@/shared/components/material-icon'
import RailPanelHeader from '@/features/ide-react/components/rail/rail-panel-header'
import { message } from '@/features/source-editor/extensions/writing-assist/agent-task-result'
import './plugins.css'
export function PluginRailIcon({title='Plugins'}:{title?:string}){return <MaterialIcon type="extension" className="ide-rail-tab-link-icon" accessibilityLabel={title}/>}
export type Plugin = {builtin?:boolean;id:string;command:string;name:string;description:string;enabled:boolean;sourceUrl:string;commit:string;resourceCount:number;resourcePaths?:string[];unsupportedFiles:string[]}
const api='/writing-assist/plugins'
export function usePlugins(){
 const [plugins,setPlugins]=useState<Plugin[]>([])
 const [error,setError]=useState('')
 const [revision,setRevision]=useState(0)
 useEffect(()=>{const controller=new AbortController();getJSON<{plugins:Plugin[]}>(api,{signal:controller.signal}).then(value=>{if(!controller.signal.aborted){setPlugins(Array.isArray(value.plugins)?value.plugins:[]);setError('')}}).catch(e=>{if(!controller.signal.aborted)setError(message(e))});return()=>controller.abort()},[revision])
 useEffect(()=>{const update=()=>setRevision(n=>n+1);window.addEventListener('plugin-library-changed',update);return()=>window.removeEventListener('plugin-library-changed',update)},[])
 return {plugins,error}
}
export default function PluginLibrary(){
 const {plugins,error:loadError}=usePlugins()
 const [url,setUrl]=useState('')
 const [discovery,setDiscovery]=useState<{url:string;commit:string;skills:{name:string;path:string}[]}|null>(null)
 const [path,setPath]=useState('')
 const [command,setCommand]=useState('')
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 async function run(action:()=>Promise<unknown>,success:string){setBusy(true);setError('');setNotice('');try{await action();setNotice(success);window.dispatchEvent(new Event('plugin-library-changed'))}catch(e){setError(message(e))}finally{setBusy(false)}}
 return <div className="skill-plugin-panel"><RailPanelHeader title="Plugins"/><div className="skill-plugin-body">
  <section className="skill-install-section" aria-label="Install Skill"><h3>Install a Skill</h3><label htmlFor="skill-source">GitHub repository or Skill URL</label>
   <div className="skill-source-row"><input id="skill-source" type="url" value={url} onChange={e=>{setUrl(e.target.value);setDiscovery(null)}} placeholder="https://github.com/owner/repository" disabled={busy}/>
   <button type="button" className="skill-primary-button" disabled={busy || !url.trim()} onClick={()=>run(async()=>{const value=await postJSON<{commit:string;skills:{name:string;path:string}[]}>(api+'/discover',{body:{url:url.trim()}});setDiscovery({...value,url:url.trim()});setPath(value.skills[0].path)},'Skills found. Choose one to install.')}>{busy?'Working…':'Find Skills'}</button></div>
   {discovery && <div className="skill-install-choice"><label htmlFor="skill-path">Skill</label><select id="skill-path" value={path} onChange={e=>setPath(e.target.value)} disabled={busy}>{discovery.skills.map(s=><option key={s.path} value={s.path}>{s.path}</option>)}</select>
    <label htmlFor="skill-command">Command name (optional)</label><input id="skill-command" value={command} onChange={e=>setCommand(e.target.value)} placeholder="Use the Skill name" disabled={busy}/>
    <button type="button" disabled={busy} onClick={()=>run(async()=>{await postJSON(api,{body:{url:discovery.url,path,commit:discovery.commit,...(command.trim()?{command:command.trim()}:{})}});setDiscovery(null);setCommand('')},'Skill installed. Type / in Paper Assistant to use it.')}>Install Skill</button>
   </div>}
   <small>Instruction Skills and text resources. Installation scripts and additional tool servers are not installed.</small>
  </section>
  {(error || loadError) && <p role="alert">{error || loadError}</p>}{notice && <p role="status">{notice}</p>}
  <div className="skill-library-heading"><h3>My plugins <span>{plugins.length}</span></h3></div>
  <p className="skill-library-hint">Type <code>/</code> in Paper Assistant to choose a Skill, then describe your task.</p>
  {!plugins.length && !loadError && <div className="skill-empty"><MaterialIcon type="extension"/><p>Your Skill library is empty.</p><small>Add a GitHub URL above to get started.</small></div>}
  {plugins.map(plugin=>plugin.builtin?<article className="skill-plugin-card" key={plugin.id}><header><span className="skill-card-icon"><MaterialIcon type="event_available"/></span><div className="skill-card-title"><h4>{plugin.name}</h4><span>Built-in · Live sources</span></div></header><p className="skill-card-description">{plugin.description}</p><div className="skill-venue-actions"><button type="button" className="skill-planner-link" onClick={()=>window.dispatchEvent(new Event('paper-open-submissions'))}>Open venues</button><MetricUpdateButton/></div><p className="skill-library-hint">Also available as <code>/venues</code> in Paper Assistant.</p></article>:<PluginCard key={plugin.id} plugin={plugin} busy={busy}
   onToggle={enabled=>run(()=>putJSON(`${api}/${plugin.id}`,{body:{enabled}}),'Plugin updated.')}
   onRemove={()=>run(()=>deleteJSON(`${api}/${plugin.id}`),'Plugin removed.')}/>) }
 </div></div>
}
export function PluginCard({plugin,busy,onToggle,onRemove}:{plugin:Plugin;busy:boolean;onToggle:(enabled:boolean)=>void;onRemove:()=>void}){
 const description=plugin.description || 'Instructions for your AI assistant.'
 const sentence=description.match(/^.+?[.!?](?:\s|$)/)?.[0]?.trim() || description
 const summary=sentence.length>220 ? sentence.slice(0,217).replace(/\s+\S*$/, '')+'…' : sentence
 return <article className={`skill-plugin-card${plugin.enabled?'':' is-disabled'}`} aria-label={plugin.name}>
  <header><span className="skill-card-icon"><MaterialIcon type="extension"/></span><div className="skill-card-title"><h4>{plugin.name}</h4><span>{plugin.enabled?'Enabled':'Disabled'}</span></div>
   <label className="skill-toggle" title={plugin.enabled?'Disable Skill':'Enable Skill'}><input type="checkbox" role="switch" aria-label={`Enable ${plugin.command}`} checked={plugin.enabled} disabled={busy} onChange={e=>onToggle(e.target.checked)}/><span aria-hidden="true"/></label>
  </header>
  <p className="skill-card-description">{summary}</p>
  <details className="skill-card-details"><summary>Details &amp; usage</summary><div className="skill-detail-content">
   {summary!==description && <p>{description}</p>}
   <dl><dt>Skill shortcut</dt><dd><code>/{plugin.command}</code></dd></dl>
   <p>Add your request after the shortcut. The Skill can guide multiple workflows; this is not a fixed action.</p>
   <a href={plugin.sourceUrl} target="_blank" rel="noopener noreferrer">View Skill on GitHub <span aria-hidden="true">↗</span></a>
   <p className="skill-revision">Revision <code>{plugin.commit.slice(0,12)}</code> · {plugin.resourceCount} text files</p>
   {!!plugin.resourcePaths?.length && <details><summary>Included guides &amp; resources</summary><ul>{plugin.resourcePaths.map(path=><li key={path}><code>{path}</code></li>)}</ul></details>}
   {!!plugin.unsupportedFiles.length && <p>Not included: {plugin.unsupportedFiles.join(', ')}. This version uses the existing project tools.</p>}
   <button className="skill-remove" type="button" disabled={busy} aria-label={`Remove ${plugin.command}`} onClick={onRemove}>Remove Skill</button>
  </div></details>
 </article>
}
export function PluginCommands({value,onSelect}:{value:string;onSelect:(command:string)=>void}){
 const {plugins}=usePlugins()
 if(!/^\/[a-z0-9-]*$/.test(value))return null
 const matches=plugins.filter(p=>p.enabled && p.command.startsWith(value.slice(1)))
 return <div className="skill-command-list" aria-label="Plugin commands">{matches.length?matches.map(p=><button type="button" key={p.id} aria-label={`Use /${p.command}`} onClick={()=>onSelect(`/${p.command} `)}><MaterialIcon type="extension"/><span><b>/{p.command}</b><small>{p.description}</small></span></button>):<p>No matching enabled Skills. Install one in Plugins.</p>}</div>
}
