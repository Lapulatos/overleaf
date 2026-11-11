import {expect} from 'chai'
import {automaticPlanningTargets} from '@/features/plugins/planner-venues'
import type {Venue} from '@/features/plugins/submission-deadlines'
const now=Date.parse('2026-11-06T12:00:00Z')
const venue=(events:unknown[])=>({kind:'conference',track:{title:'Regular Papers'},events} as Venue)
it('requires Track-specific assessment for companion tracks instead of inheriting venue fit',()=>{
 const main={...venue([]),id:'main',track:{title:'Research Papers',isMain:true}} as Venue
 const workshop={...venue([]),id:'workshop',track:{title:'Workshops',isMain:false}} as Venue
 expect(automaticPlanningTargets([main,workshop],[]).map(v=>v.id)).to.deep.equal(['main'])
 expect(automaticPlanningTargets([main,workshop],[workshop]).map(v=>v.id)).to.deep.equal(['main','workshop'])
})
