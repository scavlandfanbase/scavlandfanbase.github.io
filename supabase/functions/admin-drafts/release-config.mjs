// Source-controlled rollout gates; an explicit server false remains an emergency stop.
export const releaseFlags={SHARED_ATTACHMENT_ENABLED:true,EVIDENCE_REVIEW_ENABLED:true,PAGE_BUILDER_ENABLED:true,PAGE_CANVAS_ENABLED:false};
export function releaseEnvironment(read){return key=>Object.hasOwn(releaseFlags,key)?releaseFlags[key]&&read(key)!=='false'?'true':'false':read(key);}
