import {useEffect,useId,useMemo,useRef,useState} from 'react'
import {geoAzimuthalEquidistantRaw,geoCentroid,geoDistance,geoGraticule10,geoInterpolate,geoOrthographicRaw,geoPath,geoProjection,type GeoPermissibleObjects} from 'd3-geo'
import land from './location-data/land-110m.json'
import type {LocationPoint} from './venue-location-preferences'
import VenueLocalMap from './venue-local-map'
export type Destination=LocationPoint&{label:string;precision:'area';source:string;site?:string}
const size=520; const baseScale=228; const rad=Math.PI/180
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n))
const ease=(t:number)=>t*t*(3-2*t)
const coordinates=(p:LocationPoint):[number,number]=>[p.longitude,p.latitude]
export function useReducedMotion(){const [reduced,setReduced]=useState(()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches);useEffect(()=>{if(typeof matchMedia!=='function')return;const media=matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduced(media.matches);media.addEventListener('change',update);return()=>media.removeEventListener('change',update)},[]);return reduced}
export default function VenueLocationGlobe({destination:primary,destinations,origin}:{destination:Destination;destinations?:Destination[];origin:LocationPoint|null}){
 const targets=useMemo(()=>destinations?.length?destinations:[primary],[destinations,primary]);const [destination,setDestination]=useState(primary)
 useEffect(()=>setDestination(primary),[primary])
 const colors=['#f2c36c','#f29b89','#b9a1ef','#86d4ae','#9dc8f0','#edb0d9']
 const reduced=useReducedMotion();const id=useId().replace(/:/g,'');const stage=useRef<HTMLDivElement>(null);const drag=useRef<{x:number;y:number;center:[number,number]}|null>(null)
 const initial=useMemo(()=>{const midpoint=targets.length>1?geoCentroid({type:'MultiPoint',coordinates:[...targets.map(coordinates),...(origin?[coordinates(origin)]:[])]}):origin?geoInterpolate(coordinates(origin),coordinates(primary))(.5):coordinates(primary);const offset=origin?Math.max(0,Math.min(16,85-geoDistance(coordinates(origin),coordinates(primary))/rad/2)):12;return [midpoint[0],clamp(midpoint[1]+offset,-75,75)] as [number,number]},[origin,primary,targets])
 const [center,setCenter]=useState<[number,number]>(initial);const [paused,setPaused]=useState(false);const [progress,setProgress]=useState(0);const [mode,setMode]=useState<'globe'|'flattening'|'map'>('globe');const [mapReady,setMapReady]=useState(false)
 const [transitionStart,setTransitionStart]=useState<[number,number]>(initial)
 useEffect(()=>{setCenter(initial);setMode('globe');setProgress(0);setMapReady(false)},[initial])
 useEffect(()=>{
  if(reduced||paused||mode!=='globe')return
  let frame=0; let last=0
  function tick(time:number){if(last&&time-last>=33&&document.visibilityState!=='hidden'&&!drag.current){const delta=Math.min(100,time-last);setCenter(([longitude,latitude])=>[longitude+delta*.003,latitude]);last=time}else if(!last||document.visibilityState==='hidden')last=time;frame=requestAnimationFrame(tick)}
  frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame)
 },[mode,paused,reduced])
 useEffect(()=>{
  if(mode!=='flattening')return
  let frame=0;const start=performance.now();const toward=geoInterpolate(transitionStart,coordinates(destination))
  function tick(time:number){const t=clamp((time-start)/1200,0,1);setCenter(toward(ease(clamp(t/.4,0,1))));setProgress(ease(clamp((t-.3)/.7,0,1)));if(t<1)frame=requestAnimationFrame(tick);else setMode('map')}
  frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame)
 },[mode,transitionStart,destination])
 function openMap(target=destination){setDestination(target);stage.current?.scrollIntoView({block:'start',behavior:reduced?'auto':'smooth'});setPaused(true);setTransitionStart(center);setMapReady(false);if(reduced){setCenter(coordinates(target));setProgress(1);setMode('map')}else setMode('flattening')}
 function back(){setPaused(false);setMode('globe');setProgress(0);setMapReady(false);setCenter(initial)}
 const width=stage.current?.clientWidth||size
 const finalScale=(256*2**11)/(2*Math.PI*Math.cos(clamp(destination.latitude,-80,80)*rad))*size/Math.max(1,width)
 const projection=geoProjection((lambda,phi)=>{const globe=geoOrthographicRaw(lambda,phi); const flat=geoAzimuthalEquidistantRaw(lambda,phi);return [globe[0]*(1-progress)+flat[0]*progress,globe[1]*(1-progress)+flat[1]*progress]}).rotate([-center[0],-center[1]]).translate([size/2,size/2]).scale(baseScale*Math.exp(Math.log(finalScale/baseScale)*progress)).clipAngle(90).clipExtent([[0,0],[size,size]])
 const path=geoPath(projection);const originXY=origin&&projection(coordinates(origin));const visible=(point:LocationPoint)=>geoDistance(center,coordinates(point))<Math.PI/2-.01
 return <div className="venue-globe-view"><div className={`venue-globe-stage ${mode==='map'?'is-map':''}`} ref={stage} data-view={mode}>
  <svg className={`venue-globe ${mapReady?'is-covered':''}`} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={targets.length>1?"Rotating globe showing conference destinations":"Rotating globe showing the conference destination"} onPointerDown={event=>{if(mode!=='globe')return;drag.current={x:event.clientX,y:event.clientY,center};event.currentTarget.setPointerCapture(event.pointerId)}} onPointerMove={event=>{if(!drag.current)return;setPaused(true);const d=drag.current;setCenter([d.center[0]-(event.clientX-d.x)*.3,clamp(d.center[1]+(event.clientY-d.y)*.3,-80,80)])}} onPointerUp={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}}>
   <defs><radialGradient id={`${id}-ocean`} cx="35%" cy="28%"><stop offset="0%" stopColor="#39746d"/><stop offset="75%" stopColor="#163e40"/><stop offset="100%" stopColor="#102d35"/></radialGradient><radialGradient id={`${id}-shade`} cx="35%" cy="28%"><stop offset="55%" stopColor="#000" stopOpacity="0"/><stop offset="100%" stopColor="#00151e" stopOpacity=".62"/></radialGradient><clipPath id={`${id}-clip`}><rect x="0" y="0" width={size} height={size} rx={size/2*(1-progress)}/></clipPath>{targets.map((target,i)=><marker key={i} id={`${id}-arrow-${i}`} viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L8 4L0 8Z" fill={colors[i%colors.length]}/></marker>)}</defs>
   <g clipPath={`url(#${id}-clip)`}>
    {progress===0?<circle cx="260" cy="260" r={baseScale+1} fill={`url(#${id}-ocean)`}/>:<rect width={size} height={size} fill="#dce9e3"/>}
    <path d={path(land as unknown as GeoPermissibleObjects)||''} fill={progress>.75?'#e4e9dc':'#82af94'} stroke="#aacbb5" strokeWidth={.45} className="venue-globe-land"/>
    <path d={path(geoGraticule10())||''} fill="none" stroke="#b4d2c6" strokeOpacity={.16*(1-progress)} strokeWidth=".6"/>
    {progress<.1&&<circle cx="260" cy="260" r={baseScale} fill={`url(#${id}-shade)`} pointerEvents="none"/>}
    {origin&&targets.map((target,i)=><path key={i} className="venue-globe-route" aria-label={`Route to ${target.site||target.label}`} d={path({type:'LineString',coordinates:[coordinates(origin),coordinates(target)]})||''} fill="none" stroke={colors[i%colors.length]} strokeWidth="2.5" markerEnd={`url(#${id}-arrow-${i})`} opacity={1-progress}/>)}
    {origin&&originXY&&visible(origin)&&progress<.5&&<g transform={`translate(${originXY[0]},${originXY[1]})`} className="venue-origin-marker"><circle r="7" fill="#80d7ee" stroke="#fff" strokeWidth="2"/><title>Your current location</title></g>}
    {targets.map((target,i)=>{const xy=projection(coordinates(target));return xy&&visible(target)?<g key={i} transform={`translate(${xy[0]},${xy[1]})`} className="venue-destination-marker" role="button" tabIndex={mode==='globe'?0:-1} aria-label={`Open local map at ${target.site||target.label}`} onPointerDown={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();if(mode==='globe')openMap(target)}} onKeyDown={event=>{if(mode==='globe'&&['Enter',' '].includes(event.key)){event.preventDefault();openMap(target)}}}>
     <circle r="18" fill="transparent"/><circle className="venue-destination-ripple" r="10"/><circle className="venue-destination-ripple second" r="10"/><circle r="7" fill={colors[i%colors.length]} stroke="#fff8e6" strokeWidth="2"/>{targets.length>1&&<text y="-13" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="700">{i+1}</text>}<title>{target.site?target.site+' · ':''}{target.label}</title>
    </g>:null})}
   </g>
  </svg>
  {mode==='map'&&<VenueLocalMap destination={destination} onReady={()=>setMapReady(true)}/>}
  {mode!=='globe'&&<button type="button" className="venue-map-back" onClick={back}><span aria-hidden="true">←</span> Back to globe</button>}
 </div>
 {mode==='globe'&&<div className="venue-globe-controls"><><button type="button" onClick={()=>setPaused(!paused)} disabled={reduced}>{reduced?'Reduced motion':paused?'Resume rotation':'Pause rotation'}</button><button type="button" onClick={()=>openMap()}>Open local map</button></></div>}
 <div className="venue-globe-legend">{origin&&<span><i className="origin"/>Your current location</span>}{targets.map((target,i)=><button type="button" key={i} onClick={()=>openMap(target)} className="venue-site-map-link"><i style={{background:colors[i%colors.length]}}/>{targets.length>1?`${i+1}. `:''}{target.site||'Conference destination'}{origin&&` · ${Math.round(geoDistance(coordinates(origin),coordinates(target))*6371).toLocaleString()} km`} ↗</button>)}</div>
 <p className="venue-location-hint">{mode==='globe'?'Drag the globe to rotate. Select the destination to unfold its local map.':mode==='flattening'?'Opening the destination area…':'City / area center. A specific conference venue address has not been supplied.'}</p>
 <small className="venue-location-attribution">Globe: <a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener noreferrer">Natural Earth</a></small></div>
}
