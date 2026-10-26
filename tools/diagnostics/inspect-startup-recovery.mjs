import dotenv from 'dotenv';
import { SharedDependencyRecovery } from '../../apps/installer/src/recovery/SharedDependencyRecovery.js';
dotenv.config({quiet:true});
const plan=await new SharedDependencyRecovery().plan(process.cwd());
console.log(JSON.stringify({kind:plan.kind,reason:plan.reason??null,services:plan.services.map(s=>({service:s.service,state:s.state,owner:s.owner}))},null,2));
process.exitCode=plan.kind==='block'?2:0;
