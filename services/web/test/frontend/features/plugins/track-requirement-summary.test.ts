import {expect} from 'chai'
import {trackRequirementSummary} from '../../../../frontend/js/features/plugins/track-requirement-summary'
import type {ConferenceTrack} from '../../../../frontend/js/features/plugins/conference-tracks'
const make=(text:string,anonymity=text)=>({requirements:[{id:'length',excerpts:[{text}]},{id:'format',excerpts:[{text}]},{id:'anonymity',excerpts:[{text:anonymity}]}]} as ConferenceTrack)
describe('Track requirement summaries',()=>{
 it('separates mixed source paragraphs and retains initial rather than revision page limits',()=>{const summary=trackRequirementSummary(make('No more than 18 pages for all text and figures, plus 4 pages for references. Major revisions should have no more than 20 pages. Use ACM acmart with the acmsmall option.','Double-Anonymous Review Process'));expect(summary.pages).to.deep.equal([{label:'Body',value:'18'},{label:'References',value:'4'}]);expect(summary.review).to.equal('Double-blind');expect(summary.format).to.equal('ACM · acmsmall')})
 it('does not invent appendix limits or infer blind review from template options',()=>{const summary=trackRequirementSummary(make('10 pages, excluding references. Use IEEEtran with the anonymous option.'));expect(summary.pages).to.deep.equal([{label:'Body',value:'10'},{label:'References',value:'Excluded from limit'}]);expect(summary.review).to.equal(null);expect(summary.format).to.equal('IEEE')})
 it('extracts explicit appendix limits and single-blind review',()=>{const summary=trackRequirementSummary(make('12 pages for text, 2 pages for references and 3 pages for appendices. Use Springer LNCS.','Single-blind review'));expect(summary.pages[2]).to.deep.equal({label:'Appendix',value:'3'});expect(summary.review).to.equal('Single-blind');expect(summary.format).to.equal('Springer LNCS')})
})

describe('Submission column layout',()=>{
 it('uses explicit submission layout without substituting camera-ready columns',()=>{expect(trackRequirementSummary(make('Use the single-column ACM format. Camera-ready papers use double-column format.')).layout).to.equal('Single-column');expect(trackRequirementSummary(make('Use two-column IEEE format.')).layout).to.equal('Double-column');expect(trackRequirementSummary(make('Use ACM acmsmall.')).layout).to.equal(null)})
})

describe('Journal and conference layout evidence',()=>{
 it('reads explicit layout outside the format category',()=>{const track=make('Use ACM acmart.');track.requirements.push({id:'layout',label:'Layout',excerpts:[{text:'It is a single-column page layout.',source:'https://example.org/call'}]});expect(trackRequirementSummary(track).layout).to.equal('Single-column')})
 it('does not turn uncertainty or article-specific limits into general journal requirements',()=>{expect(trackRequirementSummary(make('No journal-specific single/double-column requirement is established here.')).layout).to.equal(null);expect(trackRequirementSummary(make('Brief Communications have a 4 page total limit.')).pages).to.deep.equal([{label:'Brief communication',value:'4'}])})
})
