type Props={hasCheck:boolean;hasResult:boolean;checking:boolean;busy:boolean;restoring:boolean;onOpen:()=>void;onStart:()=>void}
export default function TrackDraftCheckControls({hasCheck,hasResult,checking,busy,restoring,onOpen,onStart}:Props){
 return <div className="track-check-controls" role="group" aria-label="Draft check controls"><button type="button" disabled={!hasCheck&&(busy||restoring)} onClick={hasCheck?onOpen:onStart}>{hasResult?'View check results':checking?'View check progress':hasCheck?'View last check':restoring?'Loading check…':'Check current draft'}</button><button type="button" className="track-recheck-button" disabled={!hasCheck||busy||restoring} onClick={onStart} title="Run a new check against the current draft">Recheck</button></div>
}
