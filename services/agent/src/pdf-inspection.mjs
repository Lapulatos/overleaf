import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const execute = promisify(execFile)

// Input is the last successful compiler output, not an arbitrary model path.
export async function inspectCompiledPdf(pdf, page = 1, signal) {
  if (!Buffer.isBuffer(pdf) || pdf.length > 20000000 || pdf.subarray(0,5).toString() !== '%PDF-') throw new Error('Invalid PDF output')
  if (!Number.isSafeInteger(page) || page < 1 || page > 100) throw new Error('Invalid PDF page')
  const directory = await mkdtemp(join(tmpdir(), 'overleaf-pdf-'))
  try {
    const input = join(directory, 'compiled.pdf')
    await writeFile(input, pdf, {mode:0o600})
    const options = {timeout:15000,maxBuffer:512000,signal}
    const text = await execute('pdftotext', ['-f',String(page),'-l',String(page),'-layout',input,'-'], options)
    await execute('pdftoppm', ['-f',String(page),'-l',String(page),'-singlefile','-scale-to','1400','-png',input,join(directory,'page')], options)
    const image = await readFile(join(directory,'page.png'))
    if(image.length > 4000000) throw new Error('Rendered PDF page exceeds limit')
    return {text:text.stdout,imageUrl:`data:image/png;base64,${image.toString('base64')}`}
  } finally { await rm(directory,{recursive:true,force:true}) }
}
