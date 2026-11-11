export function sourceFailure(item) {
 if(!['fetch_public_source','Read official source / template'].includes(item.title)&&item.toolName!=='fetch_public_source')return null
 try{const value=JSON.parse(item.output||'null');return value&&typeof value.error==='string'?value:null}catch{return null}
}
export function compilationEvidence(activity=[]) {
 const index=activity.findLastIndex(i=>i.kind==='tool'&&(i.toolName==='compile_project'||i.title==='compile_project'||i.title.startsWith('Compile ')))
 if(index<0)return {compiled:false,inspected:false,state:'unverified'}
 const compile=activity[index]
 const inspected=activity.slice(index+1).some(i=>i.kind==='tool'&&(i.toolName==='inspect_compiled_pdf'||i.title==='inspect_compiled_pdf')&&i.status==='completed'&&i.toolSuccess!==false&&typeof i.output==='string'&&i.output.trim()&&!/^\s*\{\s*"error"/.test(i.output))
 const failed=compile.toolSuccess===false||compile.status==='failed'
 // Legacy generic completion overwrote the outcome. A later real PDF inspection
 // is evidence: the tool can only inspect lastPdf after a successful compile.
 const compiled=!failed&&(compile.toolSuccess===true||(compile.title.startsWith('Compile ')&&compile.status==='completed')||(compile.title==='compile_project'&&inspected))
 return {compiled,inspected:compiled&&inspected,state:failed?'failed':compiled?'passed':'unverified'}
}
