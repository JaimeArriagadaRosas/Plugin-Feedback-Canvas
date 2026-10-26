import dotenv from 'dotenv';
import {CanvasBringup} from '../../apps/installer/src/installation/CanvasBringup.js';
import {getCanvasDirectory} from '../../apps/installer/src/installation/utils/LocalWorkspacePaths.js';
dotenv.config({quiet:true});
const boot={info:console.log,success:console.log,error:console.error,debug:console.log};
const inst=new CanvasBringup(boot,getCanvasDirectory());
const result=await inst.waitForReady(12,1);
console.log(JSON.stringify({stage:'CANVAS_READONLY_HEALTH',result}));
process.exitCode=result?0:1;
