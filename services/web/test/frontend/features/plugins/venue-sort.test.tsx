import {expect} from 'chai'
import {sortVenues} from '../../../../frontend/js/features/plugins/venue-sort'
import {venueMetricKey,type MetricSnapshot} from '../../../../frontend/js/features/plugins/venue-metrics'
import type {Venue} from '../../../../frontend/js/features/plugins/submission-deadlines'
const venue=(id:string,kind='journal')=>({id,title:id,description:id,kind,area:'SE',events:[],year:null,rank:null,round:'',website:null,sourceUrl:''} satisfies Venue)
const snapshot=(value:number|null,quartiles:string[]=[]):MetricSnapshot=>({name:'test',jif:value===null?null:{value,edition:'2025'},jcr:quartiles.map(quartile=>({category:'Verified category',quartile,rank:null}))})
describe('Venue metric sorting',()=>{
 it('sorts numeric impact factors descending, retaining zero ahead of unknown values',()=>{
  const rows=['unknown','two','ten','zero'].map(id=>venue(id));const metrics={[venueMetricKey(rows[1])]:snapshot(2),[venueMetricKey(rows[2])]:snapshot(10),[venueMetricKey(rows[3])]:snapshot(0)}
  expect(sortVenues(rows,'jif',{},0,metrics).map(v=>v.id)).to.deep.equal(['ten','two','zero','unknown'])
 })
 it('does not treat invalid factors or conference metrics as verified journal factors',()=>{
  const rows=[venue('negative'),venue('infinite'),venue('conference','conference'),venue('known')];const metrics=Object.fromEntries(rows.map((v,i)=>[venueMetricKey(v),snapshot([-1,Infinity,99,1][i])]))
  expect(sortVenues(rows,'jif',{},0,metrics)[0].id).to.equal('known')
 })
 it('orders Q1 through Q4, then unknown, using the best verified category',()=>{
  const rows=['q4','unknown','q2','q3','multiple','mixed'].map(id=>venue(id));const qs=[['Q4'],[],['Q2'],['Q3'],['Q3','Q1'],['Q1','unknown']];const metrics=Object.fromEntries(rows.map((v,i)=>[venueMetricKey(v),snapshot(null,qs[i])]))
  expect(sortVenues(rows,'jcr',{},0,metrics).map(v=>v.id)).to.deep.equal(['multiple','q2','q3','q4','mixed','unknown'])
 })
 it('uses the existing displayed publisher fallback and reacts to newly supplied snapshots',()=>{
  const rows=[venue('journal-csur'),venue('updated')];expect(sortVenues(rows,'jif',{},0)[0].id).to.equal('journal-csur');expect(sortVenues(rows,'jif',{},0,{[venueMetricKey(rows[1])]:snapshot(40)})[0].id).to.equal('updated')
 })
 it('keeps deterministic title ordering for equal and missing metrics without mutating input',()=>{
  const rows=[venue('B'),venue('A')];expect(sortVenues(rows,'jcr',{},0).map(v=>v.id)).to.deep.equal(['A','B']);expect(rows.map(v=>v.id)).to.deep.equal(['B','A'])
 })
})
