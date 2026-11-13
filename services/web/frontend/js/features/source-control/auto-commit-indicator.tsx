import MaterialIcon from '@/shared/components/material-icon'
export default function AutoCommitIndicator({policy}:{policy?:{enabled:boolean;state:string}}) {
 if(!policy?.enabled)return null
 const label=policy.state==='paused' ? 'Automatic commits · Paused' : 'Automatic commits'
 return <span className="native-git-auto-commit-indicator" title={label} aria-label={label}><MaterialIcon type="schedule"/></span>
}
