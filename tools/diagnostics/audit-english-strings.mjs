import fs from 'node:fs';import path from 'node:path';
const roots=['apps/client/src','apps/server/src','apps/installer/src','tools/canvas-local/seeds/factories'];
const pattern=/[¿¡]|\b(?:Estudiante|Actividad|Curso|Rúbrica|Calificación|retroalimentación|español|española|No se pudo|Por favor|Descargando|La respuesta|Evaluación|instrucciones del|respuestas del|Falta plantilla|se requiere)\b/iu;
let flagged=0;
for(const root of roots){
  const visit=dir=>{for(const item of fs.readdirSync(dir,{withFileTypes:true})){const name=path.join(dir,item.name);if(item.isDirectory())visit(name);else if(/\.(js|mjs|rb)$/.test(name)){fs.readFileSync(name,'utf8').split('\n').forEach((line,i)=>{if(pattern.test(line)){console.log(name+':'+(i+1)+':'+line.slice(0,175));flagged++}})}}};visit(root);
}
console.log('Flagged candidate strings:',flagged);
