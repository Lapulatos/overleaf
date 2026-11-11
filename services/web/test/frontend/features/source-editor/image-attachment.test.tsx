import { expect } from 'chai'
import sinon from 'sinon'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ImageAttachmentInput } from '@/features/source-editor/extensions/writing-assist/image-attachment'

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aO3sAAAAASUVORK5CYII='
function imageFile() {
  const bytes = Uint8Array.from(Buffer.from(png, 'base64'))
  const file = new window.File([bytes], 'equation.png', { type: 'image/png' })
  Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes.buffer })
  return file
}
function props() {
  return { image: null, disabled: false, onChange: sinon.spy(), onLoading: sinon.spy(), onError: sinon.spy() }
}

describe('Paper Assistant image attachments', function () {
  const originalFileReader = globalThis.FileReader
  before(function () { globalThis.FileReader = window.FileReader })
  after(function () {
    if (originalFileReader) globalThis.FileReader = originalFileReader
    else Reflect.deleteProperty(globalThis, 'FileReader')
  })
  afterEach(cleanup)
  it('validates a PNG, previews it, and allows removal before sending', async function () {
    const input = props()
    const rendered = render(<ImageAttachmentInput {...input} />)
    fireEvent.change(screen.getByLabelText('Equation or image (PNG/JPEG)'), { target: { files: [imageFile()] } })
    await waitFor(() => expect(input.onLoading.lastCall.args[0]).to.equal(false))
    expect(input.onError.lastCall.args[0]).to.equal('')
    expect(input.onChange.lastCall.args[0]?.data).to.equal(png)
    const attachment = input.onChange.lastCall.args[0]
    expect(attachment.width).to.equal(1)
    expect(attachment.height).to.equal(1)
    expect(input.onLoading.lastCall.args[0]).to.equal(false)
    rendered.rerender(<ImageAttachmentInput {...input} image={attachment} />)
    expect(screen.getByAltText('Attached image: equation.png')).to.exist
    fireEvent.click(screen.getByRole('button', { name: 'Remove image' }))
    expect(input.onChange.lastCall.args[0]).to.equal(null)
  })

  it('rejects unsupported files without attaching their content', async function () {
    const input = props()
    render(<ImageAttachmentInput {...input} />)
    fireEvent.change(screen.getByLabelText('Equation or image (PNG/JPEG)'), { target: { files: [new window.File(['<svg/>'], 'formula.svg', { type: 'image/svg+xml' })] } })
    await waitFor(() => expect(input.onError.lastCall.args[0]).to.contain('PNG or JPEG'))
    expect(input.onChange.lastCall.args[0]).to.equal(null)
    expect(input.onLoading.lastCall.args[0]).to.equal(false)
  })

  it('ignores a file read that completes after changing conversations', async function () {
    const input = props()
    let finish!: (value: ArrayBuffer) => void
    const bytes = Uint8Array.from(Buffer.from(png, 'base64'))
    const file = new window.File([bytes], 'equation.png', { type: 'image/png' })
    Object.defineProperty(file, 'arrayBuffer', { value: () => new Promise<ArrayBuffer>(resolve => { finish = resolve }) })
    const rendered = render(<ImageAttachmentInput {...input} />)
    fireEvent.change(screen.getByLabelText('Equation or image (PNG/JPEG)'), { target: { files: [file] } })
    rendered.unmount()
    input.onChange.resetHistory()
    finish(bytes.buffer)
    await new Promise(resolve => setTimeout(resolve, 30))
    expect(input.onChange.called).to.equal(false)
  })
})
