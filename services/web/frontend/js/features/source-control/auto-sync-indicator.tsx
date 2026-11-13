import MaterialIcon from '@/shared/components/material-icon'
export default function AutoSyncIndicator({policy}:{policy?:{enabled:boolean;state:string}}) {
 if(!policy?.enabled)return null
 const label=policy.state==='paused' ? 'Automatic sync · Paused' : 'Automatic sync'
 return <span className="native-git-auto-commit-indicator" title={label} aria-label={label}><MaterialIcon type="sync"/></span>
}
