import './venue-location-settings.css'
import {useState} from 'react'
import {requestCurrentLocation,setLocationEnabled,useLocationEnabled} from '@/features/plugins/venue-location-preferences'
export default function VenueLocationSettings(){
 const enabled=useLocationEnabled();const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('')
 async function toggle(value:boolean){setNotice('');setLocationEnabled(value);if(!value)return;setBusy(true);try{await requestCurrentLocation();setNotice('Location enabled for this browser.')}catch(error){setLocationEnabled(false);setNotice(error instanceof Error?error.message:'Location could not be enabled.')}finally{setBusy(false)}}
 return <section className="venue-location-settings" aria-label="Venue location settings"><h3>Conference locations</h3><label htmlFor="venue-current-location"><input id="venue-current-location" type="checkbox" checked={enabled} disabled={busy} onChange={event=>toggle(event.target.checked)}/> Use my current location</label><p>Show your position and a curved connection to the conference on the globe.</p><p>Your browser asks for permission when enabled. Coordinates stay in this browser and are not saved to your account or sent to Paper Assistant.</p><p>When off, conference destinations and local maps are still available.</p>{(busy||notice)&&<p role="status">{busy?'Waiting for location permission…':notice}</p>}</section>
}
