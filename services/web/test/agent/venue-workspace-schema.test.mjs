import test from 'node:test'
import assert from 'node:assert/strict'
import {venueWorkspaceBody} from '../../app/src/Features/SubmissionDeadlines/VenueWorkspaceSchema.mjs'
test('accepts populated planner dictionaries without changing the plan',()=>{
 const body={plan:{mode:'mixed',reviews:{'tosem::plan:1':91},windows:{'tosem::plan:1':{start:1794000000000,end:1801862400000}}},favorites:['tosem']}
 assert.deepEqual(venueWorkspaceBody.parse(body),body)
})
test('continues rejecting invalid review durations and windows',()=>{
 assert.equal(venueWorkspaceBody.safeParse({plan:{reviews:{tse:'ninety'}}}).success,false)
 assert.equal(venueWorkspaceBody.safeParse({plan:{windows:{tse:{start:0,end:'invalid'}}}}).success,false)
})
