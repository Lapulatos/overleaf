import {useSyncExternalStore} from 'react'
import getMeta from '@/utils/meta'
export type LocationPoint={latitude:number;longitude:number;accuracy?:number}
const changed='venue-location-preference-changed'
let volatileEnabled=false
let cached:{owner:string;point:LocationPoint;at:number}|null=null
let generation=0
const key=()=>`venue-location-enabled:${getMeta('ol-user')?.id||'local'}`
export function locationEnabled(){try{return localStorage.getItem(key())==='true'}catch{return volatileEnabled}}
export function setLocationEnabled(enabled:boolean){generation++;volatileEnabled=enabled;if(!enabled)cached=null;try{localStorage.setItem(key(),String(enabled))}catch{/* Keep this session's choice when storage is unavailable. */}window.dispatchEvent(new Event(changed))}
function subscribe(callback:()=>void){const storage=()=>{if(!locationEnabled()){generation++;cached=null}callback()};window.addEventListener(changed,callback);window.addEventListener('storage',storage);return()=>{window.removeEventListener(changed,callback);window.removeEventListener('storage',storage)}}
export const useLocationEnabled=()=>useSyncExternalStore(subscribe,locationEnabled,()=>false)
export function requestCurrentLocation():Promise<LocationPoint>{
 if(!locationEnabled())return Promise.reject(new Error('Current location is disabled in Settings.'))
 if(!navigator.geolocation)return Promise.reject(new Error('This browser does not support current location.'))
 if(cached?.owner===key()&&Date.now()-cached.at<60000)return Promise.resolve(cached.point)
 const requestGeneration=generation;const owner=key()
 return new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(position=>{
  if(requestGeneration!==generation||!locationEnabled()||owner!==key())return reject(new Error('Current location was turned off.'))
  const {latitude,longitude,accuracy}=position.coords
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)return reject(new Error('The browser returned an invalid location.'))
  const point={latitude,longitude,accuracy};cached={owner,point,at:Date.now()};resolve(point)
 },error=>reject(new Error(error.code===1?'Location permission was denied. You can still view the destination.':error.code===3?'Current location timed out. You can retry or view the destination.':'Current location is unavailable. You can still view the destination.')),{enableHighAccuracy:false,timeout:12000,maximumAge:60000}))
}
