import fs from 'node:fs';import crypto from 'node:crypto';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Vector3,Mesh,DoubleSide,Raycaster} from 'three';
const dir='../work/拉花网页车标贴合_20261007';
const source=fs.existsSync(`${dir}/backup/mxgarage-rv.glb`)?`${dir}/backup/mxgarage-rv.glb`:'public/model/mxgarage-rv.glb';
const input=fs.readFileSync(source);
const {scene}=await new GLTFLoader().parseAsync(input.buffer.slice(input.byteOffset,input.byteOffset+input.byteLength),'');scene.updateMatrixWorld(true);
const components=JSON.parse(fs.readFileSync(`${dir}/components.json`));const selected=new Map();
for(const c of components){if(!selected.has(c.mesh))selected.set(c.mesh,new Set());for(const i of c.ids)selected.get(c.mesh).add(i);}
const meshes=[];scene.traverse(o=>{if(o instanceof Mesh){for(const m of Array.isArray(o.material)?o.material:[o.material])m.side=DoubleSide;meshes.push(o)}});
const ray=new Raycaster(),hits=[];
for(let i=0;i<=24;i++)for(let k=0;k<=16;k++){
 const z=-.0473+(i/24-.5)*.24,y=.935605+(k/16-.5)*.14;
 if(((z+.0473)/.125)**2+((y-.935605)/.074575)**2>1)continue;
 ray.set(new Vector3(-3.5,y,z),new Vector3(1,0,0));
 const hit=ray.intersectObjects(meshes,false).find(h=>!selected.get(h.object.name)?.has(h.face.a));
 if(hit&&hit.point.x< -2.75)hits.push(hit.point.x);
}
const mountingX=Math.min(...hits)-.001;const reliefScale=.2;
const fixture={mountingX,reliefScale,maximumRelief:.005,parts:[...selected].map(([name,ids])=>({name,vertices:[...ids]}))};
fs.mkdirSync('tests/fixtures',{recursive:true});
if(process.argv.includes('--inspect')){fs.writeFileSync('tests/fixtures/front-badge.json',JSON.stringify(fixture));console.log({mountingX,oldBackX:-2.856,translation:mountingX+2.856,reliefScale,vertices:[...selected.values()].reduce((n,s)=>n+s.size,0)});process.exit(0);}
// Work only on the stored pre-fix export, preserve every other accessor byte.
fs.mkdirSync(`${dir}/backup`,{recursive:true});for(const f of ['mxgarage-rv.glb','motion_metadata.json','wiper_calibration.json']){if(!fs.existsSync(`${dir}/backup/${f}`))fs.copyFileSync(`public/model/${f}`,`${dir}/backup/${f}`);}
const jsonLength=input.readUInt32LE(12),g=JSON.parse(input.subarray(20,20+jsonLength));const binOffset=28+jsonLength;
let changed=0,oldMin=Infinity,oldMax=-Infinity,newMin=Infinity,newMax=-Infinity;
for(const [name,ids] of selected){const node=g.nodes.find(n=>n.name===name),prim=g.meshes[node.mesh].primitives[0],a=g.accessors[prim.attributes.POSITION],v=g.bufferViews[a.bufferView],offset=binOffset+(v.byteOffset||0)+(a.byteOffset||0),stride=v.byteStride||12;const o=scene.getObjectByName(name);o.updateMatrixWorld(true);
 for(const i of ids){const p=new Vector3(input.readFloatLE(offset+i*stride),input.readFloatLE(offset+i*stride+4),input.readFloatLE(offset+i*stride+8)).applyMatrix4(o.matrixWorld);oldMin=Math.min(oldMin,p.x);oldMax=Math.max(oldMax,p.x);p.x=mountingX-(-2.856-p.x)*reliefScale;newMin=Math.min(newMin,p.x);newMax=Math.max(newMax,p.x);o.worldToLocal(p);input.writeFloatLE(p.x,offset+i*stride);input.writeFloatLE(p.y,offset+i*stride+4);input.writeFloatLE(p.z,offset+i*stride+8);changed++;}
 // Inverse-transpose normal correction for depth compression along X.
 if(prim.attributes.NORMAL!==undefined){const na=g.accessors[prim.attributes.NORMAL],nv=g.bufferViews[na.bufferView],no=binOffset+(nv.byteOffset||0)+(na.byteOffset||0),ns=nv.byteStride||12;
 for(const i of ids){const n=new Vector3(input.readFloatLE(no+i*ns)/reliefScale,input.readFloatLE(no+i*ns+4),input.readFloatLE(no+i*ns+8)).normalize();input.writeFloatLE(n.x,no+i*ns);input.writeFloatLE(n.y,no+i*ns+4);input.writeFloatLE(n.z,no+i*ns+8);}}
 // Recalculate bounds after changing positions.
 a.min=[Infinity,Infinity,Infinity];a.max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<a.count;i++)for(let k=0;k<3;k++){const x=input.readFloatLE(offset+i*stride+k*4);a.min[k]=Math.min(a.min[k],x);a.max[k]=Math.max(a.max[k],x);}
}
const raw=Buffer.from(JSON.stringify(g)),json=Buffer.concat([raw,Buffer.alloc((-raw.length)&3,32)]),bin=input.subarray(binOffset),header=Buffer.alloc(20),bh=Buffer.alloc(8);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+bin.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);const result=Buffer.concat([header,json,bh,bin]);fs.writeFileSync('public/model/mxgarage-rv.glb',result);
const sha=crypto.createHash('sha256').update(result).digest('hex'),report={mountingX,oldBoundsX:[oldMin,oldMax],newBoundsX:[newMin,newMax],reliefScale,changedVertices:changed,sha256:sha,method:'仅调整前格栅中央车标沿车长方向的贴合与厚度；正面宽高不变。格栅最前支承面外1mm，原24mm凸起压为4.8mm。'};
for(const f of ['motion_metadata.json','wiper_calibration.json']){const m=JSON.parse(fs.readFileSync(`public/model/${f}`));if(f.startsWith('motion')){m.glbSha256=sha;m.frontBadgeCorrection=report;}else{m.outputSha256=sha;m.bytes=result.length;}fs.writeFileSync(`public/model/${f}`,JSON.stringify(m,null,2));}
fs.writeFileSync(`${dir}/correction.json`,JSON.stringify(report,null,2));console.log(report);
