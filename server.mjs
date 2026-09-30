import http from 'node:http';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { v2 as cloudinary } from 'cloudinary';

if (existsSync(new URL('./.env', import.meta.url))) {
  const env = await readFile(new URL('./.env', import.meta.url), 'utf8');
  for (const line of env.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*["']?([^"']*)["']?\s*$/i);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

try { process.loadEnvFile?.(); } catch {}
const PORT=Number(process.env.PORT||8787); const DB=new URL('./.data/impactlens.json',import.meta.url);
const configured=Boolean(process.env.CLOUDINARY_CLOUD_NAME&&process.env.CLOUDINARY_API_KEY&&process.env.CLOUDINARY_API_SECRET);
if(configured) cloudinary.config({cloud_name:process.env.CLOUDINARY_CLOUD_NAME,api_key:process.env.CLOUDINARY_API_KEY,api_secret:process.env.CLOUDINARY_API_SECRET,secure:true});
async function load(){if(!existsSync(DB)){await mkdir(new URL('./.data/',import.meta.url),{recursive:true});await writeFile(DB,JSON.stringify({assets:[],ledger:[]},null,2))}return JSON.parse(await readFile(DB,'utf8'))}
async function save(db){await mkdir(new URL('./.data/',import.meta.url),{recursive:true});await writeFile(DB,JSON.stringify(db,null,2))}
function json(res,status,payload){res.writeHead(status,{'content-type':'application/json','access-control-allow-origin':'*'});res.end(JSON.stringify(payload))}
async function body(req){let raw='';for await(const chunk of req)raw+=chunk;return raw?JSON.parse(raw):{}}
function hash(value){return createHash('sha256').update(value).digest('hex')}
function append(db,event){const previousHash=db.ledger.at(-1)?.hash||'GENESIS';const entry={...event,previousHash};entry.hash=hash(JSON.stringify(entry));db.ledger.push(entry);return entry}
function verify(ledger){let previousHash='GENESIS';for(let i=0;i<ledger.length;i++){const {hash:actual,...event}=ledger[i];if(hash(JSON.stringify({...event,previousHash}))!==actual)return {valid:false,index:i+1};previousHash=actual}return {valid:true}}
const demoAnalysis=asset=>({model:'impactlens-demo-v1',status:'DEMO_ANALYSIS',observations:[{label:'water',confidence:.99,category:'Natural feature',region:{left:.03,top:.05,width:.94,height:.57},observation:'A large continuous reflective water surface is visible.',interpretation:'Likely a lake, reservoir, or river edge.'},{label:'tree',confidence:.97,category:'Vegetation',region:{left:.62,top:.17,width:.28,height:.67},observation:'Dense green canopy and a visible trunk are present.',interpretation:'Mature tree providing shade near the waterline.'},{label:'waste',confidence:.88,category:'Environmental signal',region:{left:.18,top:.62,width:.24,height:.18},observation:'Multiple plastic-like objects are visible near the shoreline.',interpretation:'The area may contain accumulated waste.'}],assetId:asset.id,createdAt:new Date().toISOString()});
async function handler(req,res){try{if(req.method==='OPTIONS')return json(res,204,{});const url=new URL(req.url,`http://${req.headers.host}`);const db=await load();
 if(req.method==='GET'&&url.pathname==='/api/status')return json(res,200,{mode:configured?'connected':'demo',cloudinary:configured,capabilities:{upload:configured,deliveryTransformations:true,assetAnalysis:false,visualSearch:false,generativeRemove:false,videoTranscription:false}});
 if(req.method==='GET'&&url.pathname==='/api/cloudinary/signature'){if(!configured)return json(res,503,{error:'Cloudinary credentials unavailable',mode:'demo'});const timestamp=Math.round(Date.now()/1000);return json(res,200,{timestamp,signature:cloudinary.utils.api_sign_request({timestamp,folder:'impactlens/originals'},process.env.CLOUDINARY_API_SECRET),cloudName:process.env.CLOUDINARY_CLOUD_NAME,apiKey:process.env.CLOUDINARY_API_KEY,folder:'impactlens/originals'});}
 if(req.method==='POST'&&url.pathname==='/api/assets'){const input=await body(req);if(!input.publicId||!input.secureUrl)return json(res,400,{error:'publicId and secureUrl are required'});const asset={id:input.assetId||`asset_${randomUUID().slice(0,8)}`,publicId:input.publicId,secureUrl:input.secureUrl,resourceType:input.resourceType||'image',originalSha256:input.originalSha256||null,createdAt:new Date().toISOString(),status:'ORIGINAL'};db.assets.push(asset);append(db,{type:'ORIGINAL',assetId:asset.id,publicId:asset.publicId,actor:input.actor||'user'});await save(db);return json(res,201,{asset,analysis:demoAnalysis(asset),mode:configured?'connected':'demo'});}
 if(req.method==='GET'&&url.pathname==='/api/assets')return json(res,200,{assets:db.assets});
 if(req.method==='POST'&&url.pathname==='/api/analysis'){const input=await body(req);const asset=db.assets.find(a=>a.id===input.assetId);if(!asset)return json(res,404,{error:'asset not found'});const analysis=demoAnalysis(asset);append(db,{type:'ANALYSIS',assetId:asset.id,model:analysis.model,elementCount:analysis.observations.length});await save(db);return json(res,200,analysis);}
 if(req.method==='POST'&&url.pathname==='/api/derivatives'){const input=await body(req);const parent=db.assets.find(a=>a.id===input.parentAssetId);if(!parent)return json(res,404,{error:'parent asset not found'});if(!configured)return json(res,200,{mode:'demo',status:'PREVIEW_ONLY',parentAssetId:parent.id,transformation:input.transformation||'c_fill,w_1200,h_800',label:'AI / TRANSFORMED DERIVATIVE'});const publicId=`${parent.publicId}-derivative-${Date.now()}`;const secureUrl=cloudinary.url(parent.publicId,{secure:true,transformation:[input.transformation||{width:1200,height:800,crop:'fill'}]});const derivative={id:`derivative_${randomUUID().slice(0,8)}`,parentAssetId:parent.id,publicId,secureUrl,status:'DERIVATIVE',transformation:input.transformation||'c_fill,w_1200,h_800',createdAt:new Date().toISOString()};db.assets.push(derivative);append(db,{type:'DERIVATIVE',assetId:derivative.id,parentAssetId:parent.id,transformation:derivative.transformation,actor:input.actor||'user'});await save(db);return json(res,201,derivative);}
 if(req.method==='GET'&&url.pathname==='/api/provenance/verify')return json(res,200,verify(db.ledger));
 if(req.method==='GET'&&url.pathname==='/api/provenance')return json(res,200,{ledger:db.ledger,verification:verify(db.ledger)});
 if(req.method==='POST'&&url.pathname==='/api/reports/export'){const input=await body(req);const relevant=db.assets.filter(a=>!input.assetIds||input.assetIds.includes(a.id));return json(res,200,{filename:'impactlens-evidence-manifest.json',manifest:{title:input.title||'ImpactLens Evidence Report',generatedAt:new Date().toISOString(),mode:configured?'connected':'demo',claims:input.claims||[],assets:relevant,provenance:verify(db.ledger)}})}
 return json(res,404,{error:'not found'});
}catch(error){return json(res,500,{error:error.message})}}
http.createServer(handler).listen(PORT,()=>console.log(`ImpactLens API listening on http://127.0.0.1:${PORT} (${configured?'Cloudinary connected':'demo mode'})`));
