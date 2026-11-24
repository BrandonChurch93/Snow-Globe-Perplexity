import sharp from 'sharp'
const REF='references/approved/winter-rest.png'
const still=process.argv[2]
const xs=process.argv[3].split(',').map(Number)
const [y0,y1,step]=(process.argv[4]??'760,1120,20').split(',').map(Number)
const load=async f=>(await sharp(f).removeAlpha().resize(2816,1584,{fit:'fill'}).raw().toBuffer())
const A=await load(REF), R=await load(still)
const lum=(D,x,y,w=30,h=step)=>{let s=0,n=0;for(let yy=y;yy<y+h;yy++)for(let xx=x-w;xx<x+w;xx++){const i=(yy*2816+xx)*3;s+=0.2126*D[i]+0.7152*D[i+1]+0.0722*D[i+2];n++}return s/n}
console.log('y    '+xs.map(x=>String(x).padStart(11)).join(''))
for(let y=y0;y<y1;y+=step){console.log(String(y).padEnd(5)+xs.map(x=>(lum(A,x,y).toFixed(0)+'/'+lum(R,x,y).toFixed(0)).padStart(11)).join(''))}
