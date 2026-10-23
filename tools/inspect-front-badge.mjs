import fs from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Vector3,Box3,Mesh,DoubleSide,Raycaster} from 'three';
const b=fs.readFileSync('public/model/mxgarage-rv.glb');const {scene}=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');scene.updateMatrixWorld(true);
const selected=[];
scene.traverse(o=>{if(!(o instanceof Mesh)||!o.name.startsWith('RV_Static_'))return;
 const p=o.geometry.attributes.position,idx=o.geometry.index; const parent=Array.from({length:p.count},(_,i)=>i);const root=i=>parent[i]===i?i:parent[i]=root(parent[i]);
 const union=(a,b)=>{parent[root(a)]=root(b)};
 for(let i=0;i<idx.count;i+=3){union(idx.getX(i),idx.getX(i+1));union(idx.getX(i),idx.getX(i+2));}
 const groups=new Map();for(let i=0;i<p.count;i++){const k=root(i);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(i);}
 for(const ids of groups.values()){const box=new Box3();for(const i of ids)box.expandByPoint(new Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld));
 if(box.max.x< -2.85 && box.min.y>.84 && box.max.y<1.04 && box.min.z>-.19 && box.max.z<.1){selected.push({mesh:o.name,ids,bounds:[box.min.toArray(),box.max.toArray()]});}
 }
});
const exclude=new Map();for(const c of selected){if(!exclude.has(c.mesh))exclude.set(c.mesh,new Set());for(const i of c.ids)exclude.get(c.mesh).add(i);}
const meshes=[];scene.traverse(o=>{if(o instanceof Mesh){for(const m of Array.isArray(o.material)?o.material:[o.material])m.side=DoubleSide;meshes.push(o)}});
const ray=new Raycaster();const samples=[];
for(const y of [.87,.90,.94,.98,1.00])for(const z of [-.15,-.05,.05]){ray.set(new Vector3(-3.5,y,z),new Vector3(1,0,0));const hits=ray.intersectObjects(meshes,false).filter(h=>!exclude.get(h.object.name)?.has(h.face.a));samples.push({y,z,hits:hits.slice(0,2).map(h=>({x:h.point.x,mesh:h.object.name}))})}
console.log(JSON.stringify({components:selected.map(c=>({...c,ids:undefined,count:c.ids.length})),samples},null,2));
fs.writeFileSync('../work/拉花网页车标贴合_20261007/components.json',JSON.stringify(selected));
