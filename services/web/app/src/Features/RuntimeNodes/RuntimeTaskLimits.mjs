const quote=s=>"'"+String(s).replaceAll("'","'\\''")+"'"
export function limitScript(script,task){
 const l=task.executionSettings?.limits
 if(!l?.enabled)return script
 const name=`overleaf-task-${task._id}`,args=['docker','run','--rm','--init','--pull=never','--name',name,'--label','overleaf.runtime-task='+task._id]
 if(l.cpu!=null)args.push('--cpus',String(l.cpu))
 if(l.memoryGiB!=null){const memory=String(Math.floor(l.memoryGiB*1024))+'m';args.push('--memory',memory,'--memory-swap',memory)}
 if(l.threads!=null)for(const key of ['OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS','NUMEXPR_NUM_THREADS'])args.push('-e',`${key}=${l.threads}`)
 if(l.gpuIds?.length)args.push('--gpus',`"device=${l.gpuIds.join(',')}"`)
 else args.push('-e','NVIDIA_VISIBLE_DEVICES=void')
 args.push('--entrypoint','/bin/sh',l.image,'-ec',script.join('\n'))
 return [`trap ${quote(`docker rm -f ${name} >/dev/null 2>&1 || true`)} EXIT HUP INT TERM`,args.map(quote).join(' ')]
}
