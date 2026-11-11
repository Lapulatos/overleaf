// Per-repository bounded native output. Never persist credentials or shell data.
const outputs = new Map()
export function appendGitOutput(directory, value, secrets = []) {
  for (const secret of secrets.filter(Boolean)) value = value.split(secret).join('[redacted]')
  value = value.replace(/(Authorization:\s*(?:Basic|Bearer)\s+)\S+/gi,'$1[redacted]')
  const previous = outputs.get(directory)
  outputs.delete(directory)
  outputs.set(directory, ((previous || '') + value).slice(-200000))
  while (outputs.size > 50) outputs.delete(outputs.keys().next().value)
}
export function gitOutput(directory) { return outputs.get(directory) || 'No native Git output recorded in this server session.' }
export function captureGitOutput(directory, secrets = []) {
  return (command, stdout, stderr, args = []) => {
    appendGitOutput(directory, `\n[${new Date().toISOString()}] $ ${command} ${args.join(' ')}\n`,secrets)
    for (const stream of [stdout,stderr]) {
      let data='',overflow=false
      stream.on('data',chunk=>{ if(overflow)return;data+=chunk.toString();if(data.length>200000){data='';overflow=true} })
      stream.on('end',()=>appendGitOutput(directory,overflow?'[Output omitted: exceeds display limit]\n':data,secrets))
    }
  }
}
