import fs from 'node:fs';import crypto from 'node:crypto';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Mesh,Vector3} from 'three';
const dir='../work/拉花网页侧帐定位_20261007',backup=`${dir}/backup`;
fs.mkdirSync(backup,{recursive:true});for(const f of ['mxgarage-rv.glb','motion_metadata.json','wiper_calibration.json'])if(!fs.existsSync(`${backup}/${f}`))fs.copyFileSync(`public/model/${f}`,`${backup}/${f}`);
const b=fs.readFileSync(`${backup}/mxgarage-rv.glb`),jl=b.readUInt32LE(12),g=JSON.parse(b.subarray(20,20+jl)),bo=28+jl;
const {scene}=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');scene.updateMatrixWorld(true);
const fixture=JSON.parse(fs.readFileSync('tests/fixtures/awning-placement.json'));const parts=fixture.parts.map(p=>({...p,dynamic:false}));
scene.getObjectByName('WebRig_Awning').traverse(o=>{if(o instanceof Mesh)parts.push({name:o.name,vertices:Array.from({length:o.geometry.attributes.position.count},(_,i)=>i),dynamic:true});});
// Keep both end-cap shapes and tube sections intact; shorten only the span between them.
const mapX=x=>x<=-.68?x+.98:x>=2.507?x:x+.98*(2.507-x)/(2.507+.68);
let changed=0;
for(const part of parts){const o=scene.getObjectByName(part.name);const n=g.nodes.find(n=>n.name===part.name),p=g.meshes[n.mesh].primitives[0],a=g.accessors[p.attributes.POSITION],v=g.bufferViews[a.bufferView],off=bo+(v.byteOffset||0)+(a.byteOffset||0),stride=v.byteStride||12;
 for(const i of part.vertices){const localX=b.readFloatLE(off+i*stride),world=new Vector3().fromBufferAttribute(o.geometry.attributes.position,i).applyMatrix4(o.matrixWorld);world.x=mapX(world.x)-(part.dynamic?.49:0);o.worldToLocal(world);b.writeFloatLE(world.x,off+i*stride);b.writeFloatLE(world.y,off+i*stride+4);b.writeFloatLE(world.z,off+i*stride+8);changed++;}
 a.min=[Infinity,Infinity,Infinity];a.max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<a.count;i++)for(let k=0;k<3;k++){const x=b.readFloatLE(off+i*stride+4*k);a.min[k]=Math.min(a.min[k],x);a.max[k]=Math.max(a.max[k],x);}
}
const rig=g.nodes.find(n=>n.name==='WebRig_Awning');rig.translation[0]+=.49;
const raw=Buffer.from(JSON.stringify(g)),json=Buffer.concat([raw,Buffer.alloc((-raw.length)&3,32)]),bin=b.subarray(bo),h=Buffer.alloc(20),bh=Buffer.alloc(8);h.writeUInt32LE(0x46546c67);h.writeUInt32LE(2,4);h.writeUInt32LE(28+json.length+bin.length,8);h.writeUInt32LE(json.length,12);h.writeUInt32LE(0x4e4f534a,16);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);const out=Buffer.concat([h,json,bh,bin]),sha=crypto.createHash('sha256').update(out).digest('hex');fs.writeFileSync('public/model/mxgarage-rv.glb',out);
const report={revision:'20261007-awning-r4',frontX:.1,rearX:2.7069957,lengthMeters:2.6069957,frontRetractionMeters:.98,centerShiftMeters:.49,changedVertices:changed,source:'V02/source_photos/article_image_03.png',basis:'按现场照片中棚盒前端止于门前沿附近、后端靠车尾的关系定位；2.607m为模型候选，非实测/采购尺寸。保留高度、外伸深度、端盖和杆件截面。',sha256:sha};
const meta=JSON.parse(fs.readFileSync(`${backup}/motion_metadata.json`));meta.motions.find(m=>m.id==='awning').nodes[0].closedPosition=rig.translation;const region=meta.hitRegions.find(r=>r.id==='awning');region.bounds.min[0]=.09;region.bounds.max[0]=2.72;meta.awningCorrection=report;meta.glbSha256=sha;
fs.writeFileSync('public/model/motion_metadata.json',JSON.stringify(meta,null,2));
const cal=JSON.parse(fs.readFileSync(`${backup}/wiper_calibration.json`));cal.outputSha256=sha;cal.bytes=out.length;fs.writeFileSync('public/model/wiper_calibration.json',JSON.stringify(cal,null,2));fs.writeFileSync(`${dir}/correction.json`,JSON.stringify(report,null,2));fs.writeFileSync(`${dir}/changed-parts.json`,JSON.stringify(parts));console.log(report);
