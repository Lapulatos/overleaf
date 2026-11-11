import {expect} from 'chai'
import {render,screen} from '@testing-library/react'
import ConversionReport from '@/features/plugins/conversion-report'
describe('Conversion result severity and actions',function(){
 it('separates changed files, urgent failures and previous-year warnings without hiding next steps',function(){
 const task:any={status:'completed',proposals:[{id:'p',path:'main.tex',before:'old',after:'new'}],activity:[{kind:'tool',title:'compile_project',status:'completed'},{kind:'tool',title:'inspect_compiled_pdf',status:'completed',output:'PDF page text'}]}
 const audit:any={ready:false,issues:[],checks:[{id:'anonymity',status:'provisional',severity:'warning',requirement:'Use last year double-blind rules',before:'Named authors',after:'Anonymous draft',files:['main.tex','tex/acks.tex'],action:'Confirm current year policy when published',basis:{kind:'previous-edition',year:2026}},{id:'layout',status:'failed',severity:'error',requirement:'Two columns required',before:'One column',after:'Still one column',files:['main.tex'],action:'Switch verified class option and recompile'}]}
 const {container}=render(<ConversionReport task={task} audit={audit}/>);expect(screen.getByText('Compilation succeeded')).to.exist;expect(screen.getByText(/Using 2026 requirements provisionally/)).to.exist;expect(screen.getByText('R01').closest('li')?.className).to.include('is-error');expect(screen.getByText('Switch verified class option and recompile')).to.exist;expect(screen.getByText('tex/acks.tex')).to.exist;expect(container.querySelectorAll('.is-success').length).to.be.greaterThan(0);expect(screen.queryByText('Compilation not verified')).to.equal(null)
 })
})
