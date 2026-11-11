import {expect} from 'chai'
import {trackFitSummary} from '@/features/plugins/track-fit-summary'
describe('Concise Track fit summaries',()=>{
 it('uses concise AI reasons and preserves unmet versus unconfirmed issues',()=>{const s=trackFitSummary({score:90,sources:[],reason:'Long evidence',briefReasons:['Relevant method','Strong evaluation'],prerequisiteIssues:['Wrong template','Artifact not verified'],eligibility:{status:'unmet',reason:'Long details'}});expect(s.reasons).to.deep.equal(['Relevant method','Strong evaluation']);expect(s.issues).to.deep.equal(['Wrong template','Artifact not verified'])})
 it('shortens saved legacy reports without labeling already-met conditions as failures',()=>{const s=trackFitSummary({score:90,sources:[],reason:'Relevant contribution. '+('Evidence from the manuscript ').repeat(20),eligibility:{status:'unmet',reason:'Topic: met; Format: unmet because class differs; Artifact: unconfirmed; Prior acceptance is not a prerequisite.'}});expect(s.reasons.every(x=>x.length<=160)).to.equal(true);expect(s.issues).to.deep.equal(['Format: unmet because class differs','Artifact: unconfirmed'])})
})
