import fs from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Vector3,Box3,Mesh,DoubleSide,Raycaster} from 'three';
const b=fs.readFileSync('public/model/mxgarage-rv.glb');const {scene}=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');scene.updateMatrixWorld(true);
const selected=[];
scene.traverse(o=>{if(!(o instanceof Mesh)||!['RV_Static_Body_Paint','RV_Static_Chrome'].includes(o.name))return;
 const p=o.geometry.attributes.position,idx=o.geometry.index; const parent=Array.from({length:p.count},(_,i)=>i);const root=i=>parent[i]===i?i:parent[i]=root(parent[i]);
 const union=(a,b)=>{parent[root(a)]=root(b)};
 for(let i=0;i<idx.count;i+=3){union(idx.getX(i),idx.getX(i+1));union(idx.getX(i),idx.getX(i+2));}
 const groups=new Map();for(let i=0;i<p.count;i++){const k=root(i);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(i);}
 for(const ids of groups.values()){const box=new Box3();for(const i of ids)box.expandByPoint(new Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld));
 if(box.min.x>=-.881 && box.max.x<=2.708 && box.min.y>=2.634 && box.max.y<=2.755 && box.min.z>=-1.181 && box.max.z<=-1.043){selected.push({mesh:o.name,ids,bounds:[box.min.toArray(),box.max.toArray()]});}
 }
});
fs.writeFileSync('../work/拉花网页侧帐定位_20261007/components.json',JSON.stringify(selected));
console.log(JSON.stringify(selected.map(c=>({...c,ids:undefined,count:c.ids.length})).sort((a,b)=>b.count-a.count).slice(0,35),null,2));
console.log('Selected',selected.length,selected.reduce((n,c)=>n+c.ids.length,0));
