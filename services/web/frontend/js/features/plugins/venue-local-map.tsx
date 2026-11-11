import {useEffect,useRef,useState} from 'react'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type {Destination} from './venue-location-globe'
export default function VenueLocalMap({destination,onReady}:{destination:Destination;onReady:()=>void}){
 const root=useRef<HTMLDivElement>(null);const ready=useRef(onReady);ready.current=onReady
 const [failed,setFailed]=useState(false)
 useEffect(()=>{
  if(!root.current)return
  setFailed(false)
  const center:L.LatLngTuple=[destination.latitude,destination.longitude]
  const map=L.map(root.current,{center,zoom:11,minZoom:0,maxZoom:18,worldCopyJump:true,scrollWheelZoom:false,attributionControl:true,zoomControl:true})
  const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',referrerPolicy:'strict-origin-when-cross-origin',keepBuffer:0}).addTo(map)
  tiles.on('tileerror',()=>setFailed(true));tiles.on('load',()=>ready.current())
  const label=document.createElement('span');label.textContent='Conference area · '+destination.label
  for(const className of ['venue-map-ripple','venue-map-ripple second'])L.circleMarker(center,{radius:10,color:'#c08b32',weight:1.4,fill:false,className,interactive:false}).addTo(map)
  L.circleMarker(center,{radius:9,color:'#fff',weight:3,fillColor:'#bb7c24',fillOpacity:1}).addTo(map).bindTooltip(label,{direction:'top'})
  const observer=new ResizeObserver(()=>map.invalidateSize());observer.observe(root.current)
  const frame=requestAnimationFrame(()=>{map.invalidateSize();ready.current()})
  return()=>{cancelAnimationFrame(frame);observer.disconnect();map.remove()}
 },[destination])
 return <div className="venue-local-map-wrap"><div ref={root} className="venue-local-map" role="region" aria-label="Local map centered on the conference destination"/>{failed&&<p className="venue-map-error" role="status">Map tiles could not be loaded. <a href={`https://www.openstreetmap.org/?mlat=${destination.latitude}&mlon=${destination.longitude}#map=11/${destination.latitude}/${destination.longitude}`} target="_blank" rel="noopener noreferrer">Open destination map ↗</a></p>}</div>
}
