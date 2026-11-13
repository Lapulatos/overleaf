import { groupPlugins, searchPluginGroups, repositoryOverview, matchScore } from './plugin-groups'
import MetricUpdateButton from './metric-update-button'
import { useEffect, useState } from 'react'
import { getJSON, postJSON, putJSON, deleteJSON } from '@/infrastructure/fetch-json'
import MaterialIcon from '@/shared/components/material-icon'
import RailPanelHeader from '@/features/ide-react/components/rail/rail-panel-header'
import { message } from '@/features/source-editor/extensions/writing-assist/agent-task-result'
import './plugins.css'
export function PluginRailIcon({title='Plugins'}:{title?:string}){return <MaterialIcon type="extension" className="ide-rail-tab-link-icon" accessibilityLabel={title}/>}
export type Plugin = {builtin?:boolean;id:string;command:string;name:string;description:string;enabled:boolean;sourceUrl:string;commit:string;resourceCount:number;resourcePaths?:string[];skillPath?:string;usage?:{input:string;examples:string[];source:string};unsupportedFiles:string[]}
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
 const [query,setQuery]=useState('')
 const [repositoryQueries,setRepositoryQueries]=useState<Record<string,string>>({})
 const groups=groupPlugins(plugins)
 const visibleGroups=searchPluginGroups(groups,query)
 const [url,setUrl]=useState('')
 const [discovery,setDiscovery]=useState<{url:string;commit:string;skills:{name:string;path:string}[]}|null>(null)
 const [selected,setSelected]=useState<string[]>([])
 const [results,setResults]=useState<{path:string;plugin?:Plugin;error?:string}[]>([])
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 async function run(action:()=>Promise<unknown>,success:string){setBusy(true);setError('');setNotice('');try{await action();setNotice(success);window.dispatchEvent(new Event('plugin-library-changed'))}catch(e){setError(message(e))}finally{setBusy(false)}}
 return <div className="skill-plugin-panel"><RailPanelHeader title="Plugins"/><div className="skill-plugin-body">
  <section className="skill-install-section" aria-label="Install Skill"><h3>Install a Skill</h3><label htmlFor="skill-source">GitHub repository or Skill URL</label>
   <div className="skill-source-row"><input id="skill-source" type="url" value={url} onChange={e=>{setUrl(e.target.value);setDiscovery(null)}} placeholder="https://github.com/owner/repository" disabled={busy}/>
   <button type="button" className="skill-primary-button" disabled={busy || !url.trim()} onClick={()=>run(async()=>{const value=await postJSON<{commit:string;skills:{name:string;path:string}[]}>(api+'/discover',{body:{url:url.trim()}});setDiscovery({...value,url:url.trim()});setSelected(value.skills.slice(0,50).map(s=>s.path));setResults([])},'Skills found. Select the Skills you want to install.')}>{busy?'Working…':'Find Skills'}</button></div>
   {discovery && <div className="skill-install-choice">
    <div className="skill-batch-heading"><strong><MaterialIcon type="library_add"/> {discovery.skills.length} Skills found</strong><label><input type="checkbox" disabled={busy} checked={selected.length===Math.min(50,discovery.skills.length)} onChange={e=>setSelected(e.target.checked?discovery.skills.slice(0,50).map(s=>s.path):[])}/> Select all</label></div>
    <div className="skill-batch-list">{discovery.skills.map(skill=>{const result=results.find(r=>r.path===skill.path);return <label key={skill.path} className="skill-batch-item">
      <input type="checkbox" disabled={busy || (!selected.includes(skill.path) && selected.length>=50)} checked={selected.includes(skill.path)} onChange={e=>setSelected(value=>e.target.checked?[...value,skill.path]:value.filter(path=>path!==skill.path))}/>
      <MaterialIcon type={result?.plugin?'check_circle':result?.error?'error_outline':'extension'}/><span><strong>{skill.name}</strong><small>{result?.plugin?`Installed · /${result.plugin.command}`:result?.error || skill.path}</small></span>
    </label>})}</div>
    <small>Names and unique /commands are created automatically. Edit their mappings inside the repository card after installation.</small>
    <button type="button" className="skill-primary-button" disabled={busy || !selected.length} onClick={()=>run(async()=>{
      const value=await postJSON<{results:{path:string;plugin?:Plugin;error?:string}[]}>(api+'/batch',{body:{url:discovery.url,paths:selected,commit:discovery.commit}})
      setResults(previous=>[...previous.filter(r=>!selected.includes(r.path)),...value.results]);setSelected(value.results.filter(r=>r.error).map(r=>r.path))
    },'Installation finished. Results are shown beside each Skill.')}><MaterialIcon type={busy?'hourglass_empty':'download'}/>{busy?`Installing ${selected.length} Skills…`:`Install selected (${selected.length})`}</button>
   </div>}
   <small>Instruction Skills and text resources. Installation scripts and additional tool servers are not installed.</small>
  </section>
  {(error || loadError) && <p role="alert">{error || loadError}</p>}{notice && <p role="status">{notice}</p>}
  <div className="skill-library-heading"><h3>My plugins <span>{groups.length}</span></h3></div>
  <label className="skill-library-search"><MaterialIcon type="search"/><input type="search" aria-label="Search plugins or commands" placeholder="Search plugins, Skills or /commands…" value={query} onChange={event=>setQuery(event.target.value)}/></label>
  {!!query.trim() && <p className="skill-library-hint" role="status">{visibleGroups.length} matching plugins</p>}
  <p className="skill-library-hint">Type <code>/</code> in Paper Assistant to choose a Skill, then describe your task.</p>
  {!plugins.length && !loadError && <div className="skill-empty"><MaterialIcon type="extension"/><p>Your Skill library is empty.</p><small>Add a GitHub URL above to get started.</small></div>}
  {visibleGroups.map(group=>{const plugin=group.plugins[0];const fullGroup=groups.find(item=>item.id===group.id) || group;const localQuery=repositoryQueries[group.id] || '';const childPlugins=group.plugins.map(plugin=>({plugin,score:Math.max(matchScore(plugin.name,localQuery),matchScore(plugin.command,localQuery))})).filter(item=>item.score>0).sort((a,b)=>b.score-a.score).map(item=>item.plugin);return plugin.builtin?<article className="skill-plugin-card" key={plugin.id}><header><span className="skill-card-icon"><MaterialIcon type="event_available"/></span><div className="skill-card-title"><h4>{plugin.name}</h4><span>Built-in · Live sources</span></div></header><p className="skill-card-description">{plugin.description}</p><div className="skill-venue-actions"><button type="button" className="skill-planner-link" onClick={()=>window.dispatchEvent(new Event('paper-open-submissions'))}>Open venues</button><MetricUpdateButton/></div><p className="skill-library-hint">Also available as <code>/venues</code> in Paper Assistant.</p></article>:<article className="skill-plugin-card skill-repository-card" key={group.id} aria-label={group.name}>
    <header><span className="skill-card-icon"><MaterialIcon type="folder"/></span><div className="skill-card-title"><h4>{group.name}</h4><span>{group.owner && `${group.owner} · `}{group.plugins.length}{query.trim() ? ' matching' : ''} Skills</span></div>{group.url && <a href={group.url} target="_blank" rel="noopener noreferrer" title="Open repository on GitHub" aria-label={`Open ${group.name} on GitHub`}><MaterialIcon type="open_in_new"/></a>}</header>
    {group.url && <a className="skill-repository-source" href={group.url} target="_blank" rel="noopener noreferrer"><MaterialIcon type="link"/><span>{group.url.replace('https://', '')}</span></a>}
    <p className="skill-card-description">{repositoryOverview(groups.find(item=>item.id===group.id) || group)}</p>
    <details className="skill-repository-disclosure" key={query.trim() ? 'search' : 'browse'} open={query.trim() ? true : undefined}>
    <summary><MaterialIcon type="extension"/><span>{group.plugins.length} {group.plugins.length===1?'Skill':'Skills'} · Instructions &amp; commands</span><MaterialIcon type="expand_more"/></summary>
    {fullGroup.plugins.length>1 && <label className="skill-library-search skill-repository-search"><MaterialIcon type="search"/><input type="search" aria-label={`Search ${group.name} Skills or commands`} placeholder="Search Skills or /commands…" value={localQuery} onChange={event=>setRepositoryQueries(previous=>({...previous,[group.id]:event.target.value}))}/></label>}
    {!childPlugins.length && <p className="skill-library-hint" role="status">No matching Skills in this repository.</p>}
    <div className="skill-repository-mappings" aria-label={`${group.name} Skill command mappings`}>{childPlugins.map(plugin=><PluginCard key={plugin.id} plugin={plugin} busy={busy}
   onSave={(name,command)=>run(()=>putJSON(`${api}/${plugin.id}`,{body:{name,command}}),'Skill name and command saved.')}
   onToggle={enabled=>run(()=>putJSON(`${api}/${plugin.id}`,{body:{enabled}}),'Plugin updated.')}
   onRemove={()=>run(()=>deleteJSON(`${api}/${plugin.id}`),'Skill removed.')}/>)}</div></details></article>}) }
 </div></div>
}
export function PluginCard({plugin,busy,onToggle,onRemove,onSave}:{plugin:Plugin;busy:boolean;onSave:(name:string,command:string)=>void;onToggle:(enabled:boolean)=>void;onRemove:()=>void}){
 const [editing,setEditing]=useState(false)
 const [expanded,setExpanded]=useState(false)
 const [name,setName]=useState(plugin.name)
 const [command,setCommand]=useState(plugin.command)
 useEffect(()=>{setName(plugin.name);setCommand(plugin.command);setEditing(false)},[plugin.name,plugin.command])
 const validCommand=/^[a-z0-9][a-z0-9-]{0,63}$/.test(command)
 const description=plugin.description || 'Instructions for your AI assistant.'
 const sentence=description.match(/^.+?[.!?](?:\s|$)/)?.[0]?.trim() || description
 const summary=sentence.length>220 ? sentence.slice(0,217).replace(/\s+\S*$/, '')+'…' : sentence
 return <section className={`skill-mapping-row${plugin.enabled?'':' is-disabled'}`} aria-label={plugin.name}>
  <div className="skill-mapping-row-heading"><div className="skill-mapping-identity"><strong>{plugin.name}</strong><code>/{plugin.command}</code></div>
    <button type="button" className="skill-row-icon" disabled={busy} title="Edit name & command" aria-label={`Edit ${plugin.command} name and command`} onClick={()=>setEditing(value=>!value)}><MaterialIcon type="edit"/></button>
    <label className="skill-toggle" title={plugin.enabled?'Disable Skill':'Enable Skill'}><input type="checkbox" role="switch" aria-label={`Enable ${plugin.command}`} checked={plugin.enabled} disabled={busy} onChange={e=>onToggle(e.target.checked)}/><span aria-hidden="true"/></label>
    <button type="button" className="skill-row-icon" title="Skill details" aria-label={`Details for ${plugin.command}`} aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}><MaterialIcon type={expanded?'expand_less':'expand_more'}/></button>
  </div>
  <p className="skill-mapping-description">{summary}</p>
  {editing && <form className="skill-mapping-form" onSubmit={e=>{e.preventDefault();if(validCommand && name.trim())onSave(name.trim(),command)}}>
    <label>Skill name<input value={name} maxLength={100} disabled={busy} onChange={e=>setName(e.target.value)}/></label>
    <label>Command<div className="skill-command-input"><span>/</span><input aria-label="Skill command" value={command} maxLength={64} disabled={busy} onChange={e=>setCommand(e.target.value)}/></div></label>
    <small>Lowercase letters, numbers and hyphens. Use this command in Paper Assistant.</small>
    <div className="skill-mapping-actions"><button type="button" disabled={busy} onClick={()=>{setName(plugin.name);setCommand(plugin.command);setEditing(false)}}><MaterialIcon type="close"/> Cancel</button><button type="submit" className="skill-primary-button" disabled={busy || !name.trim() || !validCommand}><MaterialIcon type="save"/> Save</button></div>
  </form>}
  {expanded && <div className="skill-detail-content">
   {summary!==description && <p>{description}</p>}
   <strong>How to use</strong>
   <p>{plugin.usage?.input || 'Add your task, files or material, and desired output after the command.'}</p>
   <code>/{plugin.command} [task] [material] [requirements]</code>
   {!!plugin.usage?.examples.length && <div className="skill-usage-examples"><strong>Examples</strong>{plugin.usage.examples.map(example=><div key={example}><code>/{plugin.command} {example}</code><button type="button" className="skill-row-icon" aria-label="Copy example" title="Copy example" onClick={()=>navigator.clipboard.writeText('/'+plugin.command+' '+example)}><MaterialIcon type="content_copy"/></button></div>)}<small>{plugin.usage.source}</small></div>}
   <a href={plugin.sourceUrl} target="_blank" rel="noopener noreferrer">View Skill guide on GitHub ↗</a>
   {!!plugin.resourcePaths?.length && <details><summary>Guides &amp; resources ({plugin.resourceCount})</summary><ul>{plugin.resourcePaths.filter(path=>/\.md$/i.test(path)).slice(0,12).map(path=>{const repo=plugin.sourceUrl.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)/)?.[1]?.replace(/\.git$/,'');const url=repo ? `https://github.com/${repo}/blob/${encodeURIComponent(plugin.commit)}/${[plugin.skillPath,path].filter(Boolean).join('/').split('/').map(encodeURIComponent).join('/')}` : plugin.sourceUrl;return <li key={path}><a href={url} target="_blank" rel="noopener noreferrer">{path} ↗</a></li>})}</ul><small>Installed revision {plugin.commit.slice(0,12)}. <a href={plugin.sourceUrl} target="_blank" rel="noopener noreferrer">Browse all files ↗</a></small></details>}
   <button className="skill-remove" type="button" disabled={busy} aria-label={`Remove ${plugin.command}`} onClick={onRemove}>Remove Skill</button>
  </div>}
 </section>
}
export function PluginCommands({value,onSelect}:{value:string;onSelect:(command:string)=>void}){
 const {plugins}=usePlugins()
 if(!/^\/[a-z0-9-]*$/.test(value))return null
 const matches=plugins.filter(p=>p.enabled && p.command.startsWith(value.slice(1)))
 return <div className="skill-command-list" aria-label="Plugin commands">{matches.length?matches.map(p=><button type="button" key={p.id} aria-label={`Use /${p.command}`} onClick={()=>onSelect(`/${p.command} `)}><MaterialIcon type="extension"/><span><b>/{p.command}</b><small>{p.description}</small></span></button>):<p>No matching enabled Skills. Install one in Plugins.</p>}</div>
}
