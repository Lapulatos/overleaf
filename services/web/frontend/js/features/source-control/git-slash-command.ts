import type { GitApi, GitCommand } from './api'

type Definition = { usage: string; description: string; backend: string; names?: string[]; optional?: number; flags?: Record<string,string>; read?: boolean }
export const gitCommands: Definition[] = [
 {usage:'status',description:'Show branch, staged and working changes.',backend:'$status',read:true},
 {usage:'init',description:'Initialize Git for this paper project.',backend:'$init'},
 {usage:'log',description:'Show the latest 50 commits.',backend:'graph',read:true},
 {usage:'diff [--staged]',description:'Show working or staged differences.',backend:'diff',flags:{'--staged':'staged'},read:true},
 {usage:'branches',description:'List local and remote branches.',backend:'branches',read:true},
 {usage:'remotes',description:'List configured remotes.',backend:'remotes',read:true},
 {usage:'tags',description:'List tags.',backend:'tags',read:true},
 {usage:'stashes',description:'List saved stashes.',backend:'stashes',read:true},
 {usage:'worktrees',description:'List managed worktrees.',backend:'worktrees',read:true},
 {usage:'output',description:'Show recorded Git output.',backend:'gitOutput',read:true},
 {usage:'show <commit>',description:'Show commit details.',backend:'commitDetails',names:['ref'],read:true},
 {usage:'history <path>',description:'Show file history; quote paths containing spaces.',backend:'fileHistory',names:['path'],read:true},
 {usage:'blame <path>',description:'Show line authorship.',backend:'blame',names:['path'],read:true},
 {usage:'fetch [remote] [--prune]',description:'Fetch from origin by default; optionally prune stale references.',backend:'fetch',names:['remote'],optional:1,flags:{'--prune':'prune'}},
 {usage:'pull [remote] [branch] [--rebase]',description:'Pull origin/current branch by default; credentials come from Git settings.',backend:'pull',names:['remote','branch'],optional:2,flags:{'--rebase':'rebase'}},
 {usage:'push [remote] [branch]',description:'Push origin/current branch; never force-push.',backend:'push',names:['remote','branch'],optional:2},
 {usage:'publish [remote] [branch]',description:'Push and set the upstream branch.',backend:'push',names:['remote','branch'],optional:2},
 {usage:'sync [remote] [branch]',description:'Pull then push the selected branch.',backend:'sync',names:['remote','branch'],optional:2},
 {usage:'checkout <branch>',description:'Switch to an existing local branch.',backend:'checkout',names:['name']},
 {usage:'detach <commit>',description:'Check out a commit in detached HEAD state.',backend:'checkoutDetached',names:['ref']},
 {usage:'branch-create <name> [from]',description:'Create a branch; use checkout to switch to it.',backend:'createBranch',names:['name','from'],optional:1},
 {usage:'branch-rename <old> <new>',description:'Rename a local branch.',backend:'renameBranch',names:['from','to']},
 {usage:'branch-delete <name>',description:'Delete a merged local branch; protected branches are refused.',backend:'deleteBranch',names:['name']},
 {usage:'stage <path> [--force]',description:'Stage one path; --force includes an ignored file.',backend:'stage',names:['path'],flags:{'--force':'force'}},
 {usage:'unstage <path>',description:'Unstage one path, including both sides of a rename.',backend:'unstage',names:['path']},
 {usage:'commit <message> [--all] [--amend] [--signoff]',description:'Quote the message. Default commits staged files; --all includes unstaged files.',backend:'commit',names:['message'],flags:{'--all':'all','--amend':'amend','--signoff':'signoff'}},
 {usage:'merge <ref>',description:'Merge a branch or commit into the current branch.',backend:'merge',names:['ref']},
 {usage:'rebase <ref>',description:'Rebase the current branch onto a reference.',backend:'rebase',names:['ref']},
 {usage:'cherry-pick <commit>',description:'Apply one commit.',backend:'cherryPick',names:['ref']},
 {usage:'revert <commit>',description:'Create a commit reversing the selected commit.',backend:'revert',names:['ref']},
 {usage:'undo',description:'Undo the last commit while preserving staged and working content.',backend:'undoCommit'},
 {usage:'reset <ref> <soft|mixed|hard>',description:'Reset with a stale-state guard; hard reset discards content shown in preview.',backend:'reset',names:['ref','mode']},
 {usage:'discard <path>',description:'Discard working changes to one path after preview.',backend:'discard',names:['path']},
 {usage:'continue <merge|rebase|cherry-pick|revert>',description:'Continue after resolving conflicts.',backend:'continueOperation',names:['operation']},
 {usage:'abort <merge|rebase|cherry-pick|revert>',description:'Abort the current operation.',backend:'continueOperation',names:['operation']},
 {usage:'skip <rebase|cherry-pick|revert>',description:'Skip the current commit where supported.',backend:'continueOperation',names:['operation']},
 {usage:'stash [message] [--include-untracked] [--staged]',description:'Save changes; choose at most one scope option.',backend:'stash',names:['message'],optional:1,flags:{'--include-untracked':'includeUntracked','--staged':'staged'}},
 {usage:'stash-apply <index>',description:'Apply a stash without removing it.',backend:'applyStash',names:['index']},
 {usage:'stash-pop <index>',description:'Apply then remove the selected stash.',backend:'applyStash',names:['index']},
 {usage:'stash-drop <index>',description:'Remove the selected stash after verifying its hash.',backend:'dropStash',names:['index']},
 {usage:'stash-show <index>',description:'Show stash differences.',backend:'stashDiff',names:['index'],read:true},
 {usage:'tag-create <name> [ref]',description:'Create a local tag at HEAD or ref.',backend:'createTag',names:['name','ref'],optional:1},
 {usage:'tag-delete <name>',description:'Delete a local tag.',backend:'deleteTag',names:['name']},
 {usage:'tags-push [remote]',description:'Push tags to origin or selected remote.',backend:'pushTags',names:['remote'],optional:1},
 {usage:'remote-add <name> <https-url>',description:'Add a remote. Configure private credentials in Git settings.',backend:'addRemote',names:['name','url']},
 {usage:'remote-remove <name>',description:'Remove a remote configuration.',backend:'removeRemote',names:['name']},
 {usage:'worktree-create <name> [from]',description:'Create a branch/worktree in a server-managed location.',backend:'createWorktree',names:['name','from'],optional:1},
 {usage:'clone <https-url> <project-name> [branch]',description:'Clone into a new independent paper project; current project is preserved.',backend:'clone',names:['url','name','branch'],optional:1},
]
export function tokenizeGit(text: string): string[] {
 const tokens:string[]=[];let token='',quote='',started=false
 for (const c of text) {
  if(quote) {if(c===quote)quote='';else token+=c;started=true}
  else if(c==='"'||c==="'"){quote=c;started=true}
  else if(/\s/.test(c)){if(started){tokens.push(token);token='';started=false}}
  else {token+=c;started=true}
 }
 if(quote)throw Error('Unclosed quote. Use /git help for syntax.')
 if(started)tokens.push(token)
 return tokens
}
export function gitHelp(name?:string) {
 const entries=gitCommands.filter(d=>!name||d.usage.split(' ')[0]===name)
 if(!entries.length)throw Error(`Unknown Git operation: ${name}. Use /git help.`)
 return 'Git commands (not a shell). Quote arguments containing spaces. No password/token arguments.\n\n'+entries.map(d=>`/git ${d.usage}\n  ${d.description}`).join('\n\n')
}
export function parseGitCommand(text:string) {
 const [prefix,name,...args]=tokenizeGit(text.trim())
 if(prefix.toLowerCase()!=='/git')throw Error('Use /git <operation> [arguments].')
 if(!name||name==='help'||name==='--help')return {help:gitHelp(args[0]),read:true}
 if(args.includes('--help'))return {help:gitHelp(name),read:true}
 const def=gitCommands.find(d=>d.usage.split(' ')[0]===name)
 if(!def)throw Error(`Unknown Git operation: ${name}. Use /git help.`)
 const body:GitCommand={command:def.backend},positional:string[]=[]
 let literal=false
 for(const value of args){if(!literal&&value==='--'){literal=true;continue}if(!literal&&value.startsWith('--')){const flag=def.flags?.[value];if(!flag)throw Error(`Unknown option ${value}. Usage: /git ${def.usage}`);body[flag]=true}else positional.push(value)}
 const names=def.names||[]
 if(positional.length>names.length||positional.length<names.length-(def.optional||0))throw Error(`Usage: /git ${def.usage}`)
 names.forEach((key,i)=>{if(positional[i]!==undefined)body[key]=positional[i]})
 if(body.path&&['stage','unstage','discard'].includes(name)){body.paths=[body.path];delete body.path}
 if(name==='publish')body.publish=true
 if(['continue','abort','skip'].includes(name))body.action=name
 if(name==='stash'){if(body.staged&&body.includeUntracked)throw Error('Choose only one stash scope.');body.mode=body.staged?'staged':body.includeUntracked?'include-untracked':'tracked';delete body.staged;delete body.includeUntracked}
 if(name.startsWith('stash-')){if(!/^\d+$/.test(String(body.index)))throw Error('Stash index must be a non-negative integer.');body.index=Number(body.index);if(name==='stash-pop')body.pop=true}
 if(name==='reset'&&!['soft','mixed','hard'].includes(String(body.mode)))throw Error('Reset mode must be soft, mixed or hard.')
 return {body,read:!!def.read}
}
export async function prepareGitCommand(api:GitApi,body:GitCommand) {
 const command={...body};let preview:unknown
 const query=async(command:GitCommand)=>(await api.command(command)).result as Record<string,unknown>
 if(['pull','push','sync'].includes(command.command)) {command.remote ||= 'origin';command.branch ||= (await api.status()).status?.branch;if(!command.branch)throw Error('Choose a branch explicitly while HEAD is detached.')}
 if(command.command==='clone')command.operationId=crypto.randomUUID()
 if(command.command==='undoCommit'||command.command==='reset') {preview=await query(command.command==='reset'?{command:'resetDetails',ref:command.ref}:{command:'undoDetails'});command.fingerprint=(preview as Record<string,unknown>).fingerprint}
 if(command.command==='discard'){preview=await query({command:'discardDetails',path:(command.paths as string[])[0]});command.fingerprint=(preview as Record<string,unknown>).fingerprint}
 if(command.command==='commit'&&command.amend){preview=await query({command:'amendDetails'});command.expectedHead=(preview as Record<string,unknown>).head;command.expectedBranch=(preview as Record<string,unknown>).branch}
 if(['applyStash','dropStash','stashDiff'].includes(command.command)){const stashes=(await api.command({command:'stashes'})).result as {hash:string}[];const stash=stashes[Number(command.index)];if(!stash)throw Error('Stash not found.');command.expectedHash=stash.hash}
 return {body:command,preview}
}
