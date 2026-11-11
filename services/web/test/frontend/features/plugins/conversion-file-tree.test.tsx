import {expect} from 'chai'
import {render,screen,fireEvent,waitFor} from '@testing-library/react'
import ConversionFileTree from '@/features/plugins/conversion-file-tree'
describe('Conversion file tree',function(){
 it('keeps files and diffs unloaded until the user opens their folder and file',async function(){
 const proposals:any=[{id:'a',path:'main.tex',before:'old root',after:'new root'},{id:'b',path:'tex/01-intro.tex',before:'old section',after:'new section'}]
 const {container}=render(<ConversionFileTree proposals={proposals}/>);expect(screen.queryByText('main.tex')).to.equal(null);const root=container.querySelector('details')!;root.open=true;fireEvent(root,new Event('toggle'));await screen.findByText('main.tex');expect(screen.queryByText('01-intro.tex')).to.equal(null)
 const folder=screen.getByText('tex/',{exact:false}).closest('details')!;folder.open=true;fireEvent(folder,new Event('toggle'));const file=(await screen.findByText('01-intro.tex')).closest('details')!;expect(container.querySelector('.conversion-file-diff')).to.equal(null);file.open=true;fireEvent(file,new Event('toggle'));await waitFor(()=>expect(container.querySelectorAll('.conversion-file-diff').length).to.equal(1));expect(screen.getByText('tex/01-intro.tex')).to.exist
 })
})
