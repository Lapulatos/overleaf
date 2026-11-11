import type {Venue} from './submission-deadlines'
type TypedVenue=Pick<Venue,'kind'|'manuscriptVariant'>&{track?:{title:string}}
const paths:Record<string,string>={
 paper:'M14 3H5v18h14V8l-5-5Zm0 0v5h5M8 12h8M8 16h6',
 tool:'M14 6a5 5 0 0 0-6 6l-5 5a2 2 0 0 0 3 3l5-5a5 5 0 0 0 7-6l-3 3-3-3 3-3Z',
 database:'M4 6c0-4 16-4 16 0s-16 4-16 0Zm0 0v12c0 4 16 4 16 0V6M4 12c0 4 16 4 16 0',
 package:'m3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v10M7 5l9 4',
 robot:'M5 8h14v12H5V8Zm7 0V4M10 4h4M8 12v2M16 12v2M9 17h6M2 11v6M22 11v6',
 book:'M12 6C9 3 5 3 2 4v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-3-1-7-1-10 2Zm0 0v15',
 graduation:'m2 8 10-5 10 5-10 5L2 8Zm4 3v6c4 3 8 3 12 0v-6M22 8v9',
 factory:'M3 21V9l6 4V8l6 4V3h5v18H3Zm4-5v2M12 16v2M17 16v2',
 repeat:'M4 8h15l-4-4M20 16H5l4 4M4 8v5M20 16v-5',
 image:'M3 3h18v18H3V3Zm0 14 6-6 4 4 3-3 5 5M15 7h1',
 edit:'M12 4H4v16h16v-8M10 14l1-4L19 2l3 3-8 8-4 1Z',
 users:'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21v-3c0-6 14-6 14 0v3M17 3a4 4 0 0 1 0 8M19 14c3 1 3 3 3 7',
 presentation:'M3 3h18v13H3V3Zm9 13v5M7 21l5-5 5 5M7 11l3-3 3 2 4-4',
 books:'M3 3h5v18H3V3Zm5 0h5v18H8M15 4l4-1 4 17-4 1-4-17Z',
 trophy:'M7 3h10v7a5 5 0 0 1-10 0V3Zm0 2H3v3c0 3 2 4 4 4M17 5h4v3c0 3-2 4-4 4M12 15v6M8 21h8',
 bulb:'M9 18h6M9 21h6M8 15a7 7 0 1 1 8 0l-1 3H9l-1-3Z',
 education:'M3 9l9-6 9 6v12H3V9Zm6 12v-7h6v7M6 11h1M17 11h1M11 8h2'
}
const categories:[RegExp,string,string][]=[
 [/artifact/i,'Artifact evaluation','package'],[/tool|demonstration|software showcase/i,'Tool','tool'],[/data(?:set|base)?|benchmark/i,'Dataset','database'],[/AI models?|model track/i,'AI models','robot'],
 [/journal.?first/i,'Journal first','book'],[/doctoral|ph\.?d|dissertation/i,'Doctoral symposium','graduation'],[/industry|industrial|experience|case stud/i,'Industry / experience','factory'],
 [/replicat|reproducib|negative result/i,'Replication / negative results','repeat'],[/poster/i,'Poster','image'],[/short|early research|emerging result|\bERA\b|\bNIER\b/i,'Short paper','edit'],
 [/workshop/i,'Workshop','users'],[/tutorial/i,'Tutorial','presentation'],[/survey|review article/i,'Survey / review','books'],[/award|most influential/i,'Awards','trophy'],[/idea|vision|reflection/i,'Ideas / vision','bulb'],[/education/i,'Education','education'],
 [/regular|technical|full paper|main track|(?<!early )research papers?/i,'Research paper','paper']
]
export function paperTypes(venue:TypedVenue){
 const type=venue.track?.title||venue.manuscriptVariant?.key||''
 const found=categories.filter(([pattern])=>pattern.test(type)).map(([,label,icon])=>({label,icon}))
 return found.length?found:[venue.kind==='journal'?{label:'Journal article',icon:'paper'}:{label:'Paper',icon:'paper'}]
}

export function PaperTypeIcons({venue}:{venue:TypedVenue}){
 const variant=venue.manuscriptVariant
 return <span className="sequence-paper-types">{variant?.kind==='adapted'&&<span className="sequence-new-manuscript" role="img" aria-label="New manuscript" title={`New manuscript (${variant.key}). Dates may overlap the original manuscript; submissions of this same new manuscript still conflict with each other.`}><span className="sequence-new-icon">NEW</span></span>}{paperTypes(venue).map(({label,icon})=><span key={label} className="sequence-paper-type" role="img" aria-label={label} title={label}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" data-paper-icon={icon}><path d={paths[icon]}/></svg></span>)}</span>
}
