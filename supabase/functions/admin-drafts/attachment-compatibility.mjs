// Compatibility is an explicit recorded reference, never inferred from a name or effect.
import {fail} from './core.mjs';
export function validateAttachmentCompatibility(value,weapons){
 if(value===null)return null; // Unknown differs from an explicitly empty recorded list.
 if(!Array.isArray(value)||value.length>200||value.some(id=>typeof id!=='string'||!id||id.length>200)||new Set(value).size!==value.length)fail('Choose distinct recorded Weapon IDs or Unknown.');
 if(!Array.isArray(weapons))fail('Load the current Weapon catalogue before recording compatibility.',503);
 for(const id of value){const matches=weapons.filter(record=>record.id===id);if(matches.length!==1||matches[0].hidden||matches[0].archived)fail('A selected Weapon is unavailable or ambiguous. Review compatibility.',409);}
 return [...value].sort();
}
