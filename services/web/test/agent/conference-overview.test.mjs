import test from 'node:test'
import assert from 'node:assert/strict'
import {conferenceOverview} from '../../app/src/Features/SubmissionDeadlines/ConferenceOverview.mjs'
const venue={kind:'conference',title:'CAiSE',description:'International Conference on Advanced Information Systems Engineering'}
test('selects an attributed conference introduction instead of page-limit instructions',()=>{
 const text='CAiSE brings together researchers and practitioners to discuss advances in information systems engineering. The conference provides a forum for exchanging research results.'
 assert.deepEqual(conferenceOverview(['CAiSE papers must be submitted with a page limit of 12 pages and an anonymous PDF.',text],venue,'https://example.org/2027'),{text,source:'https://example.org/2027'})
})
test('does not substitute a different conference or invent an introduction',()=>{assert.equal(conferenceOverview(['A different conference brings together researchers and practitioners from many countries to discuss computing.'],venue,'https://example.org'),null);assert.equal(conferenceOverview([],venue,'https://example.org'),null)})
test('bounds introduction length and does not apply conference descriptions to journals',()=>{const text='CAiSE brings together researchers '+('for information systems research '.repeat(40));assert.ok(conferenceOverview([text],venue,'https://example.org').text.length<=560);assert.equal(conferenceOverview([text],{...venue,kind:'journal'},'https://example.org'),null)})

test('accepts a theme description when page headings identify the conference',()=>{const theme='Hybrid Intelligent Information Systems Engineering is considered a multidisciplinary field that combines data-driven and knowledge-driven approaches.';assert.equal(conferenceOverview([theme],venue,'https://example.org','CAiSE 2027').text,theme);assert.equal(conferenceOverview([theme],venue,'https://example.org','Different event'),null)})

test('does not use a long conference title as the introduction',()=>{const theme='Hybrid Intelligent Information Systems Engineering is considered a multidisciplinary field that combines data-driven and knowledge-driven approaches.';assert.equal(conferenceOverview([venue.description+' - 39th edition',theme],venue,'https://example.org','CAiSE 2027').text,theme)})

test('preserves the beginning of introductions containing abbreviations',()=>{const text='CAiSE is a conference about information systems and combines methods (e.g., symbolic reasoning and rules) with research. It provides a forum for discussion.';assert.equal(conferenceOverview([text],venue,'https://example.org').text,text)})
