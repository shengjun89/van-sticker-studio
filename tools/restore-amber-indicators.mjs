import fs from 'node:fs';import crypto from 'node:crypto';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';import {Vector3} from 'three';
const dir='../work/拉花网页转向灯_20261007',backup=`${dir}/backup`;fs.mkdirSync(backup,{recursive:true});
for(const f of ['mxgarage-rv.glb','motion_metadata.json','wiper_calibration.json'])if(!fs.existsSync(`${backup}/${f}`))fs.copyFileSync(`public/model/${f}`,`${backup}/${f}`);
const b=fs.readFileSync(`${backup}/mxgarage-rv.glb`),jl=b.readUInt32LE(12),g=JSON.parse(b.subarray(20,20+jl));let bin=Buffer.from(b.subarray(28+jl));const {scene}=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');scene.updateMatrixWorld(true);
const selected=JSON.parse(fs.readFileSync(`${dir}/selected.json`));const selectedOffsets=new Map();for(const s of selected){if(!selectedOffsets.has(s.node))selectedOffsets.set(s.node,new Set());selectedOffsets.get(s.node).add(s.offset);}
function append(array,type,componentType,min,max){bin=Buffer.concat([bin,Buffer.alloc((-bin.length)&3)]);const byteOffset=bin.length,data=Buffer.from(array.buffer,array.byteOffset,array.byteLength);bin=Buffer.concat([bin,data]);const view=g.bufferViews.push({buffer:0,byteOffset,byteLength:data.length})-1;const a={bufferView:view,componentType,count:array.length/({SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[type]),type};if(min)a.min=min;if(max)a.max=max;return g.accessors.push(a)-1;}
const material=g.materials.push({name:'Headlamp_Amber_Optics',pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:.32,roughnessFactor:.25},doubleSided:false})-1;
const changes=[];let total=0;
for(const node of [...g.nodes]){
 if(!node.name?.startsWith('RV_Static_')||node.mesh===undefined)continue;
 const obj=scene.getObjectByName(node.name),mesh=g.meshes[node.mesh];if(!obj?.geometry||mesh.primitives.length!==1)continue;const p=mesh.primitives[0],mat=g.materials[p.material]?.name;
 if(!selectedOffsets.has(node.name))continue;
 const geom=obj.geometry,idx=geom.index,pos=geom.attributes.position,black=[],keep=[];
 for(let i=0;i<idx.count;i+=3){const ids=[idx.getX(i),idx.getX(i+1),idx.getX(i+2)],center=new Vector3();for(const j of ids)center.add(new Vector3().fromBufferAttribute(pos,j).applyMatrix4(obj.matrixWorld));center.multiplyScalar(1/3);
 (selectedOffsets.get(node.name).has(i)?black:keep).push(...ids);
 }
 if(!black.length)continue;
 p.indices=append(new Uint32Array(keep),'SCALAR',5125,[Math.min(...keep)],[Math.max(...keep)]);
 const used=[...new Set(black)],map=new Map(used.map((v,i)=>[v,i])),attrs={};
 for(const [semantic,accessorId]of Object.entries(p.attributes)){
  const a=g.accessors[accessorId],v=g.bufferViews[a.bufferView],count={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];if(a.componentType!==5126)throw Error('Unexpected attribute type');const stride=v.byteStride||count*4,off=(v.byteOffset||0)+(a.byteOffset||0),array=new Float32Array(used.length*count),min=Array(count).fill(Infinity),max=Array(count).fill(-Infinity);
  for(let i=0;i<used.length;i++)for(let k=0;k<count;k++){const x=bin.readFloatLE(off+used[i]*stride+k*4);array[i*count+k]=x;min[k]=Math.min(min[k],x);max[k]=Math.max(max[k],x);}
  attrs[semantic]=append(array,a.type,5126,semantic==='POSITION'?min:undefined,semantic==='POSITION'?max:undefined);
 }
 const colors=new Float32Array(used.length*4);
 for(let i=0;i<used.length;i++){
  const point=new Vector3().fromBufferAttribute(pos,used[i]).applyMatrix4(obj.matrixWorld),lateral=Math.abs(-point.z-.0473);
  const t=Math.max(0,Math.min(1,(lateral-.745)/.09)),mix=t*t*(3-2*t);
  const ripple=.92+.08*Math.cos(point.y*1400);
  const silver=[.60,.67,.68],amber=[.95,.34,.018];
  for(let c=0;c<3;c++)colors[i*4+c]=(silver[c]*(1-mix)+amber[c]*mix)*ripple;
  colors[i*4+3]=1;
 }
 attrs.COLOR_0=append(colors,'VEC4',5126);
 const indices=append(new Uint32Array(black.map(i=>map.get(i))),'SCALAR',5125,[0],[used.length-1]);const mi=g.meshes.push({name:`AmberOptics_${node.name}`,primitives:[{attributes:attrs,indices,material,mode:4}]})-1;
 const newNode={...node,name:`RV_AmberOptics_${node.name}`,mesh:mi,extras:{wrapSurface:false,web_vehicle:true,interactive_id:'body',finish:'前灯外缘琥珀色转向灯光学腔'}};delete newNode.children;
 const ni=g.nodes.push(newNode)-1,oldi=g.nodes.indexOf(node),parent=g.nodes.find(n=>n.children?.includes(oldi));if(parent)parent.children.push(ni);else for(const s of g.scenes)if(s.nodes.includes(oldi))s.nodes.push(ni);
 changes.push({source:node.name,node:newNode.name,triangles:black.length/3,vertices:used.length});total+=black.length/3;
}
if(total!==selected.length)throw Error('Indicator selection mismatch');g.buffers[0].byteLength=bin.length;
const raw=Buffer.from(JSON.stringify(g)),json=Buffer.concat([raw,Buffer.alloc((-raw.length)&3,32)]),h=Buffer.alloc(20),bh=Buffer.alloc(8);h.writeUInt32LE(0x46546c67);h.writeUInt32LE(2,4);h.writeUInt32LE(28+json.length+bin.length,8);h.writeUInt32LE(json.length,12);h.writeUInt32LE(0x4e4f534a,16);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);const out=Buffer.concat([h,json,bh,bin]);fs.writeFileSync('public/model/mxgarage-rv.glb',out);const sha=crypto.createHash('sha256').update(out).digest('hex');
const report={revision:'20261007-amber-indicators-r6',sha256:sha,changes,indicatorTriangles:total,geometryMoved:false,outerLensChanged:false,wrapExcluded:true,reference:'用户2026-10-07前灯黄色转向灯参考；恢复原上部与外缘光学腔，保留透明灯罩和分隔条',material:'琥珀色光学面，向内侧银色反光碗过渡'};
const meta=JSON.parse(fs.readFileSync(`${backup}/motion_metadata.json`));meta.glbSha256=sha;meta.bytes=out.length;meta.indicatorCorrection=report;fs.writeFileSync('public/model/motion_metadata.json',JSON.stringify(meta,null,2));const cal=JSON.parse(fs.readFileSync(`${backup}/wiper_calibration.json`));cal.outputSha256=sha;cal.bytes=out.length;fs.writeFileSync('public/model/wiper_calibration.json',JSON.stringify(cal,null,2));fs.writeFileSync(`${dir}/correction.json`,JSON.stringify(report,null,2));console.log(report);
