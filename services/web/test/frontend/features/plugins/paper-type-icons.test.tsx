import {expect} from 'chai'
import {render} from '@testing-library/react'
import {paperTypes,PaperTypeIcons} from '@/features/plugins/paper-type-icons'
import {plannerOptionName} from '@/features/plugins/planner-venues'
import type {Venue} from '@/features/plugins/submission-deadlines'
describe('Shared Track icons',()=>{
 for(const title of ['Research Papers','Tool Papers','AI Models / Data','Most Influential Paper Awards','Posters and Vision','Reproducibility and Negative Results','Short Papers and Emerging Results','Tutorials','Workshops','Ideas, Visions and Reflections','Software Engineering Education','Tool Demonstration and Data Showcase Track'])it('uses shared SVG icons for '+title,()=>{
  const venue={title:'Venue',kind:'conference',description:'Conference',track:{title}} as Venue
  const {container}=render(<PaperTypeIcons venue={venue}/>);const icons=Array.from(container.querySelectorAll('.sequence-paper-type svg')).map(e=>e.getAttribute('data-paper-icon'))
  expect(icons).to.deep.equal(paperTypes(venue).map(t=>t.icon));expect(plannerOptionName(venue)).to.include(title)
 })
})
