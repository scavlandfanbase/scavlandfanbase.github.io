// Source-controlled rollout gates; an explicit server false remains an emergency stop.
export const releaseFlags={SHARED_ATTACHMENT_ENABLED:false,EVIDENCE_REVIEW_ENABLED:false};
export function releaseEnvironment(read){return key=>Object.hasOwn(releaseFlags,key)?releaseFlags[key]&&read(key)!=='false'?'true':'false':read(key);}
