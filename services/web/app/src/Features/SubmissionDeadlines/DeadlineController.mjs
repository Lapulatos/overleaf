import {venueStore} from './VenueStore.mjs'
import {venueAcceptance} from './VenueAcceptanceService.mjs'
import {withTrackOverviews} from './TrackOverview.mjs'
import {venueLocations} from './VenueLocationService.mjs'
import {metricSnapshots,refreshMetricSnapshots} from './VenueMetricService.mjs'
import { expressify } from '@overleaf/promise-utils'
import { deadlines } from './DeadlineService.mjs'
export default {
 acceptance:expressify(async(req,res)=>{if(typeof req.query.id!=='string'||req.query.id.length>300)return res.status(400).json({error:'Choose a conference.'});try{const venue=await deadlines.resolve(req.query.id);if(!venue||venue.kind!=='conference')return res.status(404).json({error:'Conference not found.'});res.json(await venueAcceptance.history(venue))}catch{res.status(502).json({error:'Historical statistics could not be loaded. Please retry.'})}}),
 location:expressify(async(req,res)=>{if(typeof req.query.id!=='string'||req.query.id.length>300)return res.status(400).json({error:'Choose a conference.'});try{const venue=await deadlines.resolve(req.query.id);if(!venue||venue.kind!=='conference')return res.status(404).json({error:'Conference not found.'});res.json(await venueLocations.lookup(venue.place))}catch(error){res.status([422,429].includes(error.status)?error.status:502).json({error:error.status===422?error.message:'The location could not be loaded. Please retry.'})}}),
 metrics:expressify(async(req,res)=>{res.json(await metricSnapshots())}),
 refreshMetrics:expressify(async(req,res)=>{res.status(202).json(await refreshMetricSnapshots())}),
 tracks:expressify(async(req,res)=>{if(typeof req.query.id!=='string'||req.query.id.length>300)return res.status(400).json({error:'Choose a conference.'});try{res.json(withTrackOverviews(await deadlines.tracks(req.query.id,req.query.refresh==='1')))}catch(e){res.status(e.status||502).json({error:'Track sources could not be loaded. Please retry.'})}}),
 list:expressify(async(req,res)=>{try{const [catalog,tracks]=await Promise.all([deadlines.list(req.query.refresh==='1'),venueStore.tracks.searchIndex().catch(()=>[])]);const byVenue=new Map();for(const {venueId,...track} of tracks)byVenue.set(venueId,[...(byVenue.get(venueId)||[]),track]);res.json({...catalog,venues:catalog.venues.map(v=>({...v,trackSearch:byVenue.get(v.id)||[]}))})}catch{res.status(502).json({error:'CCFDDL could not be reached. Please retry.'})}}),
 detail:expressify(async(req,res)=>{if(typeof req.query.id!=='string'||req.query.id.length>300)return res.status(400).json({error:'Choose a venue from the catalog.'});try{res.json(await deadlines.detail(req.query.id,req.query.refresh==='1'))}catch(e){res.status([404,429].includes(e.status)?e.status:502).json({error:e.status===404?'Venue not found. Refresh the catalog.':'Submission sources could not be loaded. Please retry.'})}}),
}
