// Display help derived from the installed document, never executable arguments.
export function skillUsage(content = '', description = '', name = '') {
 const examples = []
 // Prefer invocation examples supplied by the author. Keep only this Skill's command.
 const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
 if (escaped) {
  const pattern = new RegExp(`^\\s*(?:[-*>]\\s*)?\u0060?/${escaped}\\s+([^\n\u0060]+)`, 'gm')
  for (const match of content.matchAll(pattern)) {
   const request = match[1].trim()
   if (request.length >= 12 && request.length <= 280 && !examples.includes(request)) examples.push(request)
  }
 }
 let source = examples.length ? 'From the installed Skill guide' : 'Suggested prompts based on the Skill description'
 if (!examples.length && /polish/.test(content) && /compress/.test(content) && /manuscript/.test(content)) {
  examples.push('润色 [文件或段落]，保留技术含义、实验数字和引用，给出修改后的文本。', '根据 [研究材料] 起草 Introduction；缺失的实验结果留空，不编造数据。', '将 [章节] 压缩到 [目标长度]，保留关键论证、数字和引用。')
 } else if (!examples.length) {
  const purpose = description.split(/(?<=[.!。])\s/)[0].slice(0, 180)
  examples.push(`${purpose || name} — use [file or material]; focus on [your goal]; return [desired output].`, '请根据 [文件或材料] 完成 [具体任务]，遵循 [要求或限制]，输出 [期望格式]。')
 }
 return { input: 'Describe the task, files or material, and desired output. Replace [placeholders] with your own details.', examples: examples.slice(0, 3), source }
}
