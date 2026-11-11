import {Component,createContext,lazy,Suspense,useContext,useState,type ReactNode} from 'react'
import type {Venue} from './submission-deadlines'
const AcceptanceDialog=lazy(()=>import('./venue-acceptance-dialog'))
const AcceptanceContext=createContext<((venue:Venue)=>void)|null>(null)
export const useOpenVenueAcceptance=()=>useContext(AcceptanceContext)
const Dialog=lazy(()=>import('./venue-location-dialog'))
class LocationBoundary extends Component<{children:ReactNode;onClose:()=>void},{failed:boolean}>{
 state={failed:false}
 static getDerivedStateFromError(){return {failed:true}}
 render(){return this.state.failed?<div role="alert" className="venue-location-loading">The location view could not be loaded. <button type="button" onClick={this.props.onClose}>Close</button></div>:this.props.children}
}
const LocationContext=createContext<((venue:Venue)=>void)|null>(null)
export const useOpenVenueLocation=()=>useContext(LocationContext)
export function VenueLocationProvider({children}:{children:ReactNode}){
 const [acceptance,setAcceptance]=useState<Venue|null>(null)
 const [venue,setVenue]=useState<Venue|null>(null)
 return <AcceptanceContext.Provider value={setAcceptance}><LocationContext.Provider value={setVenue}>{children}{venue&&<LocationBoundary key={venue.id} onClose={()=>setVenue(null)}><Suspense fallback={<div role="status" className="venue-location-loading">Opening conference location…</div>}><Dialog venue={venue} onHide={()=>setVenue(null)}/></Suspense></LocationBoundary>}</LocationContext.Provider>{acceptance&&<Suspense fallback={<div role="status">Loading statistics…</div>}><AcceptanceDialog venue={acceptance} onHide={()=>setAcceptance(null)}/></Suspense>}</AcceptanceContext.Provider>
}
export function isPhysicalLocation(value:string){return !/^(?:online|virtual|remote)(?:\s+(?:only|event|conference))?$/i.test(value.trim())}
