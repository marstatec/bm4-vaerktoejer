const $ = (id) => document.getElementById(id);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const num = (id, fallback = 0) => Number($(id)?.value) || fallback;
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const rad = d => d * Math.PI / 180;
const deg = r => r * 180 / Math.PI;
const VOLTAGE_COLOR = '#48dff0';
const CURRENT_COLOR = '#ff5f6d';
const da = (value, digits = 1) => Number.isFinite(value) ? value.toLocaleString('da-DK', {maximumFractionDigits: digits, minimumFractionDigits: digits}) : '—';
const unit = (value, suffix, digits = 1) => `${da(value, digits)} ${suffix}`;
const power = (watts, reactive = false) => {
  const suffix = reactive ? 'var' : 'W';
  return Math.abs(watts) >= 1000 ? unit(watts / 1000, reactive ? 'kvar' : 'kW', 2) : unit(watts, suffix, 1);
};
const svg = (tag, attrs = {}, text = '') => {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([k,v]) => e.setAttribute(k,v));
  if (text) e.textContent = text;
  return e;
};
const clear = el => { while(el.firstChild) el.removeChild(el.firstChild); };
const line = (root, x1,y1,x2,y2, cls='grid-line', color) => root.append(svg('line',{x1,y1,x2,y2,class:cls, ...(color?{stroke:color}:{})}));
const text = (root, x,y,value, cls='vector-label', color='#aab6be', anchor='start') => root.append(svg('text',{x,y,class:cls,fill:color,'text-anchor':anchor},value));
function arrow(root, cx, cy, length, angle, color, label, scale=1){
  const a=rad(angle), ex=cx+length*Math.cos(a), ey=cy-length*Math.sin(a);
  const g=svg('g'); g.append(svg('line',{x1:cx,y1:cy,x2:ex,y2:ey,class:'vector',stroke:color}));
  const back=10*scale, wing=5*scale;
  const p1=[ex,ey],p2=[ex-back*Math.cos(a)+wing*Math.sin(a),ey+back*Math.sin(a)+wing*Math.cos(a)],p3=[ex-back*Math.cos(a)-wing*Math.sin(a),ey+back*Math.sin(a)-wing*Math.cos(a)];
  g.append(svg('polygon',{points:`${p1.join(',')} ${p2.join(',')} ${p3.join(',')}`,fill:color}));
  g.append(svg('text',{x:ex+12*Math.cos(a),y:ey-12*Math.sin(a),fill:color,class:'vector-label','text-anchor':Math.cos(a)<-.2?'end':'start'},label)); root.append(g); return {x:ex,y:ey};
}
function baseGrid(root,cx,cy,w=480,h=250){
  for(let x=40;x<=w;x+=40) line(root,x,25,x,h+25);
  for(let y=25;y<=h+25;y+=40) line(root,40,y,w,y);
  line(root,35,cy,w+5,cy,'axis'); line(root,cx,20,cx,h+30,'axis');
  root.append(svg('circle',{cx,cy,r:3,fill:'#5f707b'}));
}

const circuitWire=(root,x1,y1,x2,y2,color)=>root.append(svg('line',{x1,y1,x2,y2,class:'circuit-wire',...(color?{stroke:color}:{})}));
const circuitText=(root,x,y,value,cls='circuit-label',anchor='start',color)=>root.append(svg('text',{x,y,class:cls,'text-anchor':anchor,...(color?{fill:color}:{})},value));
const circuitNode=(root,x,y)=>root.append(svg('circle',{cx:x,cy:y,r:2.8,class:'circuit-node'}));
function circuitArrow(root,x,y,length,angle,label='',color=CURRENT_COLOR){
  const a=rad(angle),ex=x+length*Math.cos(a),ey=y-length*Math.sin(a),back=8,wing=4;circuitWire(root,x,y,ex,ey,color);root.append(svg('polygon',{points:`${ex},${ey} ${ex-back*Math.cos(a)+wing*Math.sin(a)},${ey+back*Math.sin(a)+wing*Math.cos(a)} ${ex-back*Math.cos(a)-wing*Math.sin(a)},${ey+back*Math.sin(a)-wing*Math.cos(a)}`,fill:color}));if(label)circuitText(root,(x+ex)/2,(y+ey)/2-7,label,'circuit-current','middle',color);
}
function circuitResistor(root,cx,cy,angle=0){const g=svg('g',{transform:`translate(${cx} ${cy}) rotate(${angle})`});g.append(svg('line',{x1:-32,y1:0,x2:-15,y2:0,class:'circuit-wire'}));g.append(svg('rect',{x:-15,y:-8,width:30,height:16,class:'circuit-component'}));g.append(svg('line',{x1:15,y1:0,x2:32,y2:0,class:'circuit-wire'}));root.append(g);}
function circuitInductor(root,cx,cy,angle=0){const g=svg('g',{transform:`translate(${cx} ${cy}) rotate(${angle})`});g.append(svg('path',{d:'M -34 0 L -24 0 Q -16 -14 -8 0 Q 0 14 8 0 Q 16 -14 24 0 L 34 0',class:'circuit-coil'}));root.append(g);}
function circuitCapacitor(root,cx,cy,angle=0){const g=svg('g',{transform:`translate(${cx} ${cy}) rotate(${angle})`});g.append(svg('line',{x1:-32,y1:0,x2:-5,y2:0,class:'circuit-wire'}));g.append(svg('line',{x1:-5,y1:-12,x2:-5,y2:12,class:'circuit-component'}));g.append(svg('line',{x1:5,y1:-12,x2:5,y2:12,class:'circuit-component'}));g.append(svg('line',{x1:5,y1:0,x2:32,y2:0,class:'circuit-wire'}));root.append(g);}
function builderComponents(prefix,count){return Array.from({length:count},(_,i)=>({index:i+1,type:$(`${prefix}CompType${i+1}`).value,value:Math.max(0,num(`${prefix}CompValue${i+1}`))}));}
function componentSymbol(type,index){const sub=['₁','₂','₃'][index-1];return type==='R'?`R${sub}`:type==='L'?`L${sub}`:`C${sub}`;}
function currentSymbol(type,index){const sub=['₁','₂','₃'][index-1];return type==='R'?`Iᴿ${sub}`:type==='L'?`Iᴸ${sub}`:`Iᶜ${sub}`;}
function drawCircuitComponent(root,type,x,y,angle=0){if(type==='R')circuitResistor(root,x,y,angle);if(type==='L')circuitInductor(root,x,y,angle);if(type==='C')circuitCapacitor(root,x,y,angle);}
function drawSeriesCircuit(components){
  const root=$('seriesCircuit');clear(root);const centers=components.length===1?[255]:components.length===2?[185,335]:[140,260,380];let previous=28;circuitNode(root,28,48);circuitNode(root,28,118);circuitArrow(root,45,48,31,0,'I');components.forEach((component,i)=>{const x=centers[i];circuitWire(root,previous,48,x-32,48);drawCircuitComponent(root,component.type,x,48);circuitText(root,x,23,componentSymbol(component.type,component.index),'circuit-label','middle');previous=x+32;});circuitWire(root,previous,48,475,48);circuitWire(root,475,48,475,118);circuitWire(root,475,118,28,118);circuitText(root,12,87,'U','circuit-label','middle');
}
function drawParallelCircuit(components){
  $('parallelCircuitTitle').textContent=`${components.length} parallel${components.length===1?'gren':'grene'}`;
  const root=$('parallelCircuit');clear(root);circuitWire(root,30,38,482,38);circuitWire(root,30,125,482,125);circuitNode(root,30,38);circuitNode(root,30,125);circuitArrow(root,48,38,38,0,'I');circuitText(root,13,85,'U','circuit-label','middle');const xs=components.length===1?[280]:components.length===2?[210,370]:[170,290,410];components.forEach((component,i)=>{const x=xs[i];circuitNode(root,x,38);circuitNode(root,x,125);circuitArrow(root,x,45,20,-90,currentSymbol(component.type,component.index));drawCircuitComponent(root,component.type,x,82,90);circuitText(root,x+17,86,componentSymbol(component.type,component.index));});
}

const defaults = {};
$$('input').forEach(input => defaults[input.id] = input.value);
const selectDefaults={};$$('select').forEach(select=>selectDefaults[select.id]=select.value);
let powerMode=1, threeConnection='Y', threeVoltageType='line', threeCurrentView='line', ohmTarget='U', seriesInputMode='components', parallelInputMode='components',seriesComponentCount=3,parallelComponentCount=3,transformDirection='delta-star';

function drawAc(){
  const U=num('acU'), I=num('acI'), f=Math.max(.1,num('acF')), phi=clamp(Number($('acPhi').value)||0,-90,90);
  $('acPhiRange').value=phi; $('acPhiLabel').textContent=`${phi>0?'+':phi<0?'−':''}${da(Math.abs(phi),0)}° · ${phi>0?'kapacitiv':phi<0?'induktiv':'resistiv'}`;
  const loadType=phi<0?'inductive':phi>0?'capacitive':'resistive',loadChip=document.querySelector('.load-chip');loadChip.dataset.load=loadType;
  if(loadType==='inductive'){$('acLoadTitle').textContent='Induktiv last';$('acLoadExplanation').textContent='Strøm bagefter spænding';$('acSignNote').innerHTML='<strong>Induktiv:</strong> Strømmen er bagefter spændingen.';}
  if(loadType==='capacitive'){$('acLoadTitle').textContent='Kapacitiv last';$('acLoadExplanation').textContent='Strøm foran spænding';$('acSignNote').innerHTML='<strong>Kapacitiv:</strong> Strømmen er foran spændingen.';}
  if(loadType==='resistive'){$('acLoadTitle').textContent='Resistiv last';$('acLoadExplanation').textContent='Strøm og spænding er i fase';$('acSignNote').innerHTML='<strong>Resistiv:</strong> Strøm og spænding følges ad.';}
  const S=U*I, P=S*Math.cos(rad(phi)), Q=-S*Math.sin(rad(phi));
  $('acP').textContent=power(P); $('acQ').textContent=power(Q,true); $('acS').textContent=Math.abs(S)>=1000?unit(S/1000,'kVA',2):unit(S,'VA'); $('acCos').textContent=da(Math.cos(rad(phi)),3);
  $('acVectorText').textContent=`I∠${phi===0?'0':phi>0?'+'+da(phi,0):'−'+da(Math.abs(phi),0)}°`;
  $('acUhatFormula').textContent=da(U*Math.SQRT2,1); $('acFFormula').textContent=da(f,0);
  const root=$('acPhasor'),cx=260,cy=190,uAngle=90,iAngle=90+phi;clear(root);baseGrid(root,cx,cy,480,240);root.append(svg('circle',{cx,cy,r:110,class:'guide'}));
  arrow(root,cx,cy,145,uAngle,VOLTAGE_COLOR,`U = ${da(U,0)} V`);arrow(root,cx,cy,125,iAngle,CURRENT_COLOR,`I = ${da(I,1)} A`);
  if(phi!==0){const r=42,sweep=phi>0?0:1,endX=cx+r*Math.cos(rad(iAngle)),endY=cy-r*Math.sin(rad(iAngle)),midAngle=90+phi/2;root.append(svg('path',{d:`M ${cx} ${cy-r} A ${r} ${r} 0 0 ${sweep} ${endX} ${endY}`,class:'arc'}));text(root,cx+58*Math.cos(rad(midAngle)),cy-58*Math.sin(rad(midAngle))+4,`φI ${phi>0?'+':'−'}${da(Math.abs(phi),0)}°`,'vector-label','#778791','middle');}
  drawWaves(U,I,f,phi);
}
function drawWaves(U,I,f,phi){
  const root=$('waveDiagram'); clear(root); const W=850,H=180,mid=90; line(root,20,mid,830,mid,'axis');
  for(let x=20;x<=830;x+=81) line(root,x,15,x,165);
  const path=(phase,amp)=>{let d='';for(let x=20;x<=830;x+=3){const t=(x-20)/810*4*Math.PI;const y=mid-amp*Math.sin(t+rad(phase));d+=(x===20?'M':'L')+` ${x} ${y}`;}return d;};
  root.append(svg('path',{d:path(0,60),fill:'none',stroke:VOLTAGE_COLOR,'stroke-width':2.2}));root.append(svg('path',{d:path(phi,42),fill:'none',stroke:CURRENT_COLOR,'stroke-width':2}));
  text(root,28,27,`û = ${da(U*Math.SQRT2,1)} V`,'vector-label',VOLTAGE_COLOR); text(root,28,44,`î = ${da(I*Math.SQRT2,1)} A`,'vector-label',CURRENT_COLOR); text(root,824,107,`${da(2/f*1000,1)} ms`,'vector-label','#596873','end');
}

function seriesValues(){
  const U=Math.max(0,num('rlcU')),f=Math.max(.1,num('rlcF')),omega=2*Math.PI*f,components=builderComponents('series',seriesComponentCount);let R=0,XL=0,XC=0;
  components.forEach(component=>{const value=Math.max(component.value,.000000001);if(component.type==='R')R+=component.value;if(component.type==='L')XL+=seriesInputMode==='components'?omega*value/1000:value;if(component.type==='C')XC+=seriesInputMode==='components'?1/(omega*value*1e-6):value;});
  return {U,f,R,XL,XC,L:XL/omega,C:XC>0?1/(omega*XC):Infinity,components};
}

function drawRlc(){
  const {U,f,R,L,C,XL,XC,components}=seriesValues(),X=XL-XC,Z=Math.hypot(R,X),I=Z?U/Z:0,zAngle=deg(Math.atan2(X,R)),currentAngle=-zAngle,P=I*I*R,hasL=XL>.00001,hasC=XC>.00001,isResonant=hasL&&hasC&&Math.abs(X)<.05;drawSeriesCircuit(components);
  $('seriesInputTitle').textContent=`${seriesComponentCount} komponent${seriesComponentCount===1?'':'er'} i serie`;$('seriesCircuitTitle').textContent=`${seriesComponentCount} komponent${seriesComponentCount===1?'':'er'} i vandret serie`;
  let seriesFlow='';components.forEach((component,index)=>{const term=component.type==='R'?`R<sub>${component.index}</sub>`:component.type==='L'?`jX<sub>L${component.index}</sub>`:`${index===0?'−':''}jX<sub>C${component.index}</sub>`,operator=index===0?'':component.type==='C'?'<i>−</i>':'<i>+</i>';seriesFlow+=`${operator}<span>${term}</span>`;});$('seriesEquationFlow').innerHTML=`${seriesFlow}<i>→</i><span>Z</span>`;
  const signedCurrentAngle=Math.abs(currentAngle)<.05?'0,0':`${currentAngle>0?'+':'−'}${da(Math.abs(currentAngle),1)}`;$('rlcXL').textContent=unit(XL,'Ω');$('rlcXC').textContent=unit(XC,'Ω');$('rlcZ').textContent=unit(Z,'Ω');$('rlcI').textContent=unit(I,'A',2);$('rlcPhi').textContent=`${signedCurrentAngle} °`;$('rlcP').textContent=power(P);$('rlcPhiText').textContent=`φI = ${signedCurrentAngle}°`;$('rlcNature').textContent=isResonant?'Resonans · spænding og strøm i fase':Math.abs(X)<.05?'Resistiv · spænding og strøm i fase':X>0?'Induktiv · strømmen halter efter':'Kapacitiv · strømmen er foran';
  const root=$('rlcPhasor');clear(root);const x0=120,y0=150;baseGrid(root,x0,y0,480,240);arrow(root,x0,y0,365,0,CURRENT_COLOR,'',.75);text(root,478,132,'I · reference','vector-label',CURRENT_COLOR,'end');const UR=I*R,UX=I*X,scale=Math.min(Math.abs(UR)>0?240/Math.abs(UR):Infinity,Math.abs(UX)>0?105/Math.abs(UX):Infinity,U>0?210/U:Infinity),s=Number.isFinite(scale)?scale:1,ex=x0+UR*s,ey=y0-UX*s;
  arrow(root,x0,y0,Math.abs(UR)*s,UR>=0?0:180,'#9b87f5','',.85);text(root,(x0+ex)/2,y0+22,`Uᴿ = ${da(UR,1)} V`,'vector-label','#9b87f5','middle');line(root,ex,y0,ex,ey,'vector','#ff9f43');text(root,ex+13,(y0+ey)/2+4,`Uˣ = ${da(UX,1)} V`,'vector-label','#ff9f43');const uEnd=arrow(root,x0,y0,U*s,zAngle,'#35d3e3','',.85);text(root,uEnd.x+(zAngle>=0?12:10),uEnd.y+(zAngle>=0?-12:19),`U = ${da(U,0)} V`,'vector-label','#35d3e3');line(root,x0,ey,ex,ey,'guide');
  drawSeriesUIPhasor(U,I,zAngle);drawImpedanceTriangle(R,XL,XC,X,Z,zAngle);
  const ratio=clamp(X/(Math.abs(XL)+Math.abs(XC)+.001),-.5,.5);$('resonanceNeedle').style.left=`${50+ratio*92}%`;const f0=Number.isFinite(C)&&L>0&&C>0?1/(2*Math.PI*Math.sqrt(L*C)):0;$('resonanceTitle').textContent=!f0?'Serieresonans kræver både L og C':isResonant?'Kredsen er i resonans':'Afstand til resonans';$('resonanceText').textContent=f0?`Resonansfrekvens f₀ = ${da(f0,1)} Hz. Ved resonans er Xᴸ = Xᶜ, Z = R og strømmen størst.`:'Vælg mindst én induktiv og én kapacitiv komponent for at beregne resonans.';
}

function drawSeriesUIPhasor(U,I,phi){
  const root=$('seriesUIPhasor'),cx=260,cy=190,currentAngle=-phi,iAngle=90+currentAngle;clear(root);baseGrid(root,cx,cy,480,240);root.append(svg('circle',{cx,cy,r:110,class:'guide'}));
  arrow(root,cx,cy,145,90,VOLTAGE_COLOR,`U = ${da(U,0)} V`,.85);arrow(root,cx,cy,125,iAngle,CURRENT_COLOR,`I = ${da(I,2)} A`,.85);
  if(Math.abs(currentAngle)>.05){const r=42,sweep=currentAngle<0?1:0,endX=cx+r*Math.cos(rad(iAngle)),endY=cy-r*Math.sin(rad(iAngle)),midAngle=90+currentAngle/2;root.append(svg('path',{d:`M ${cx} ${cy-r} A ${r} ${r} 0 0 ${sweep} ${endX} ${endY}`,class:'arc'}));text(root,cx+58*Math.cos(rad(midAngle)),cy-58*Math.sin(rad(midAngle))+4,`φI ${currentAngle>0?'+':'−'}${da(Math.abs(currentAngle),1)}°`,'vector-label','#778791','middle');}
  $('seriesUIAngle').textContent=`I∠${Math.abs(currentAngle)<.05?'0':currentAngle>0?'+'+da(Math.abs(currentAngle),1):'−'+da(Math.abs(currentAngle),1)}°`;
}

function drawImpedanceTriangle(R,XL,XC,X,Z,phi){
  $('impedanceR').textContent=unit(R,'Ω');$('impedanceX').textContent=unit(X,'Ω');$('impedanceZ').textContent=unit(Z,'Ω');
  const isResonant=XL>.00001&&XC>.00001&&Math.abs(X)<.05;$('impedanceType').textContent=isResonant?'Resonans':Math.abs(X)<.05?'Resistiv':X>0?'Induktiv':'Kapacitiv';
  $('impedanceXFormula').textContent=`X = ${da(XL,1)} − ${da(XC,1)} = ${da(X,1)} Ω`;
  $('impedanceZFormula').textContent=`Z = √(${da(R,1)}² + (${da(X,1)})²) = ${da(Z,1)} Ω`;
  $('impedancePhiFormula').textContent=R>0?`∠Z = tan⁻¹(${da(X,1)} / ${da(R,1)}) = ${phi>0?'+':''}${da(phi,1)}°`:`∠Z = ${phi>0?'+':''}${da(phi,1)}°`;
  $('impedanceCosFormula').textContent=Z>0?`cos(∠Z) = ${da(R,1)} / ${da(Z,1)} = ${da(R/Z,3)}`:'cos(∠Z) = —';
  const root=$('impedanceTriangle');clear(root);baseGrid(root,80,150,480,250);arrow(root,80,150,400,0,CURRENT_COLOR,'',.75);text(root,474,133,'I · reference','vector-label',CURRENT_COLOR,'end');
  const scale=Math.min(R>0?260/R:Infinity,Math.abs(X)>0?105/Math.abs(X):Infinity,10);
  const safeScale=Number.isFinite(scale)?scale:1,x0=80,y0=150,rx=x0+R*safeScale,xy=y0-X*safeScale;
  line(root,x0,y0,rx,y0,'vector','#9b87f5');
  line(root,rx,y0,rx,xy,'vector','#ff9f43');
  const zEnd=arrow(root,x0,y0,Z*safeScale,phi,'#35d3e3','',.85);text(root,zEnd.x+12,zEnd.y+(phi>=0?-11:20),`Z = ${da(Z,1)} Ω`,'vector-label','#35d3e3');
  text(root,(x0+rx)/2,y0+(X<0?-12:22),`R = ${da(R,1)} Ω`,'vector-label','#9b87f5','middle');
  text(root,rx+10,(y0+xy)/2+4,`X = ${da(X,1)} Ω`,'vector-label','#ff9f43');
  line(root,x0,xy,rx,xy,'guide');
  if(Math.abs(phi)>1){const radius=38,sweep=phi>0?0:1,endX=x0+radius*Math.cos(rad(phi)),endY=y0-radius*Math.sin(rad(phi));root.append(svg('path',{d:`M ${x0+radius} ${y0} A ${radius} ${radius} 0 0 ${sweep} ${endX} ${endY}`,class:'arc'}));text(root,x0+50,y0+(phi>0?-9:31),`∠Z ${phi>0?'+':''}${da(phi,1)}°`,'vector-label','#83919a');}
  if(Math.abs(X)<.05)text(root,rx+18,y0-10,isResonant?'X = 0 · resonans':'X = 0 · resistiv','impedance-zero','#55d6a1');
}

function drawParallel(){
  const U=Math.max(0,num('parU')),f=Math.max(.1,num('parF')),omega=2*Math.PI*f,directCurrents=parallelInputMode==='currents',components=builderComponents('parallel',parallelComponentCount),colors=['#9b87f5','#ff9f43','#55d6a1'],currentInputs=['parIRInput','parILInput','parICInput'],angleInputs=['parIRAngle','parILAngle','parICAngle'];let branches=[],inductiveSusceptance=0,capacitiveSusceptance=0;
  if(directCurrents){branches=components.map((component,i)=>({type:component.type,index:component.index,name:currentSymbol(component.type,component.index),value:Math.max(0,num(currentInputs[i])),angle:clamp(Number($(angleInputs[i]).value)||0,-180,180),color:colors[i]}));}
  else{branches=components.map((component,i)=>{const value=Math.max(component.value,.000000001);let impedance=value,angle=0;if(component.type==='L'){impedance=parallelInputMode==='components'?omega*value/1000:value;angle=-90;inductiveSusceptance+=1/impedance;}if(component.type==='C'){impedance=parallelInputMode==='components'?1/(omega*value*1e-6):value;angle=90;capacitiveSusceptance+=1/impedance;}return {type:component.type,index:component.index,name:currentSymbol(component.type,component.index),value:U/impedance,angle,color:colors[i],impedance};});}
  drawParallelCircuit(components);const XL=inductiveSusceptance>0?1/inductiveSusceptance:NaN,XC=capacitiveSusceptance>0?1/capacitiveSusceptance:NaN,L=Number.isFinite(XL)?XL/omega:NaN,C=Number.isFinite(XC)?1/(omega*XC):NaN,IRsum=branches.filter(b=>b.type==='R').reduce((sum,b)=>sum+b.value,0),ILsum=branches.filter(b=>b.type==='L').reduce((sum,b)=>sum+b.value,0),ICsum=branches.filter(b=>b.type==='C').reduce((sum,b)=>sum+b.value,0),referenceCurrent=branches.reduce((sum,b)=>sum+b.value*Math.cos(rad(b.angle)),0),leadingCurrent=branches.reduce((sum,b)=>sum+b.value*Math.sin(rad(b.angle)),0),I=Math.hypot(referenceCurrent,leadingCurrent),currentAngle=I?deg(Math.atan2(leadingCurrent,referenceCurrent)):0,phi=Math.abs(currentAngle)<.05?0:-currentAngle,Z=I?U/I:0,cos=I?referenceCurrent/I:1,P=U*referenceCurrent,Q=-U*leadingCurrent,tolerance=Math.max(I*.005,.002),state=Math.abs(Q/U||0)<=tolerance?'resistive':Q>0?'inductive':'capacitive',f0=Number.isFinite(L)&&Number.isFinite(C)&&L>0&&C>0?1/(2*Math.PI*Math.sqrt(L*C)):0,isResonant=!directCurrents&&f0>0&&state==='resistive';
  $('parallelInputTitle').textContent=directCurrents?`${parallelComponentCount} grenstrøm${parallelComponentCount===1?'':'me'} med valgfri vinkel`:`${parallelComponentCount} parallel${parallelComponentCount===1?'gren':'grene'}`;$('parallelDiagramTitle').textContent='U som reference · grenstrømme';$('parallelReferenceText').innerHTML=directCurrents?'Reference: U∠0° · alle vinkler måles fra U':'Reference: U∠0° · R: 0°, L: −90°, C: +90°';$('parallelMainFormula').innerHTML='I = |Σ I̲<sub>gren</sub>|';
  $('parallelBranchEquations').innerHTML=branches.map(b=>directCurrents?`<span>${b.name} = I<sub>${b.index}</sub>∠θ<sub>${b.index}</sub></span>`:b.type==='R'?`<span>${b.name} = U/R<sub>${b.index}</sub></span>`:b.type==='L'?`<span>${b.name} = U/X<sub>L${b.index}</sub></span>`:`<span>${b.name} = U/X<sub>C${b.index}</sub></span>`).join('');
  $('parXL').textContent=Number.isFinite(XL)?unit(XL,'Ω'):'—';$('parXC').textContent=Number.isFinite(XC)?unit(XC,'Ω'):'—';$('parXLNote').textContent=directCurrents?'Ikke anvendt':Number.isFinite(XL)?'Ækvivalent induktiv reaktans':'Ingen L-gren';$('parXCNote').textContent=directCurrents?'Ikke anvendt':Number.isFinite(XC)?'Ækvivalent kapacitiv reaktans':'Ingen C-gren';const valueIds=['parIR','parIL','parIC'],noteIds=['parIRNote','parILNote','parICNote'],nameIds=['parBranchName1','parBranchName2','parBranchName3'];for(let i=0;i<3;i++){const branch=branches[i];$(nameIds[i]).textContent=branch?branch.name:`I${i+1}`;$(valueIds[i]).textContent=branch?unit(branch.value,'A',2):'—';$(noteIds[i]).textContent=branch?(directCurrents?`∠${da(branch.angle,1)}°`:branch.type==='R'?'0° · resistiv':branch.type==='L'?'−90° · induktiv':'+90° · kapacitiv'):'Ikke aktiv';}$('parI').textContent=unit(I,'A',2);
  $('parZ').textContent=unit(Z,'Ω');$('parPhi').textContent=unit(phi,'°');$('parCos').textContent=da(cos,3);$('parP').textContent=power(P);$('parQ').textContent=power(state==='resistive'?0:Q,true);$('parallelPhiText').textContent=`I∠${Math.abs(currentAngle)<.05?'0':currentAngle>0?'+'+da(currentAngle,1):da(currentAngle,1)}°`;$('parIFormulaTitle').innerHTML='I = |Σ I̲<sub>gren</sub>|';$('parIFormula').textContent=directCurrents?`I = |Σ I̲_gren| = ${da(I,2)} A`:`I = √(${da(IRsum,2)}² + (${da(ILsum,2)} − ${da(ICsum,2)})²) = ${da(I,2)} A`;
  $('parPhiNote').innerHTML='φ = −arg(ΣI̲<sub>gren</sub>)';$('parCosNote').innerHTML='cos φ = P/(U · I)';$('parPNote').innerHTML=directCurrents?'P = U · Σ(I<sub>k</sub> cos θ<sub>k</sub>)':'P = U · ΣI<sub>R</sub>';$('parQNote').innerHTML=directCurrents?'Q = −U · Σ(I<sub>k</sub> sin θ<sub>k</sub>)':'Q = U · (ΣI<sub>L</sub>−ΣI<sub>C</sub>)';$('parResFormula').textContent=f0?`f₀ = ${da(f0,2)} Hz`:'Kræver både L- og C-gren';$('parZFormula').textContent=`Z = ${da(U,1)} / ${da(I,2)} = ${da(Z,2)} Ω`;$('parallelType').textContent=state==='inductive'?'Induktiv':state==='capacitive'?'Kapacitiv':isResonant?'Parallelresonans':'Resistiv';
  const angleHelp=directCurrents?' Positiv grenvinkel er foran U; negativ er bagefter U.':'';if(state==='inductive')$('parallelNatureText').innerHTML=`<strong>Induktiv:</strong> Resultatstrømmen er ${da(Math.abs(currentAngle),1)}° bagefter spændingen.${angleHelp}`;if(state==='capacitive')$('parallelNatureText').innerHTML=`<strong>Kapacitiv:</strong> Resultatstrømmen er ${da(Math.abs(currentAngle),1)}° foran spændingen.${angleHelp}`;if(state==='resistive')$('parallelNatureText').innerHTML=isResonant?'<strong>Parallelresonans:</strong> De induktive og kapacitive grenstrømme ophæver hinanden.':`<strong>Resistiv:</strong> Resultatstrømmen er i fase med spændingen.${angleHelp}`;
  const root=$('parallelPhasor'),cx=260,cy=150,maxVector=Math.max(I,...branches.map(b=>b.value),.001),s=Math.min(115/maxVector,18),iAngle=90+currentAngle;clear(root);baseGrid(root,cx,cy,480,250);root.append(svg('circle',{cx,cy,r:112,class:'guide'}));const uEnd=arrow(root,cx,cy,130,90,VOLTAGE_COLOR,'',.75);text(root,uEnd.x-12,uEnd.y-8,'U · reference','vector-label',VOLTAGE_COLOR,'end');const labelOffsets=[{x:-14,y:-12,anchor:'end'},{x:14,y:-5,anchor:'start'},{x:-14,y:17,anchor:'end'}];branches.forEach((b,index)=>{const end=arrow(root,cx,cy,b.value*s,90+b.angle,b.color,'',.72),offset=labelOffsets[index];text(root,end.x+offset.x,end.y+offset.y,`${b.name} ${da(b.value,2)} A`,'vector-label',b.color,offset.anchor);});const totalEnd=arrow(root,cx,cy,I*s,iAngle,CURRENT_COLOR,'',.85);text(root,totalEnd.x+20,totalEnd.y-20,`I ${da(I,2)} A`,'vector-label',CURRENT_COLOR,'start');if(Math.abs(phi)>1){const r=38,sweep=phi>0?1:0,endX=cx+r*Math.cos(rad(iAngle)),endY=cy-r*Math.sin(rad(iAngle)),midAngle=90-phi/2;root.append(svg('path',{d:`M ${cx} ${cy-r} A ${r} ${r} 0 0 ${sweep} ${endX} ${endY}`,class:'arc'}));text(root,cx+50*Math.cos(rad(midAngle)),cy-50*Math.sin(rad(midAngle))+4,`φ ${da(Math.abs(phi),1)}°`,'vector-label','#82909a','middle');}text(root,448,288,state==='inductive'?'I bagefter U':state==='capacitive'?'I foran U':'I i fase med U','parallel-state','#8f9da6','end');
  if(directCurrents){$('parResonanceNeedle').style.left='50%';$('parResonanceTitle').textContent='Grenstrømme indtastet direkte';$('parResonanceText').textContent='Vektorsummen, fasevinklen, P, Q og Z beregnes direkte ud fra de aktive grenstrømme.';}else if(!f0){$('parResonanceNeedle').style.left='50%';$('parResonanceTitle').textContent='Parallelresonans kræver både L og C';$('parResonanceText').textContent='Vælg mindst én induktiv og én kapacitiv gren for at beregne resonans.';}else{const resRatio=clamp((f/f0-1)*.5,-.5,.5);$('parResonanceNeedle').style.left=`${50+resRatio*92}%`;$('parResonanceTitle').textContent=isResonant?'Kredsen er i parallelresonans':'Afstand til parallelresonans';$('parResonanceText').textContent=`Resonansfrekvens f₀ = ${da(f0,2)} Hz. Ved resonans ophæver de samlede L- og C-strømme hinanden.`;}
}

function drawPower(){
  const U=num('powerU'),I=num('powerI'),signed=clamp(Number($('powerCos').value)||0,-1,1),cosMagnitude=Math.sqrt(Math.max(0,1-signed*signed)),k=powerMode===3?Math.sqrt(3):1,S=k*U*I,P=S*cosMagnitude,phi=deg(Math.asin(signed)),Q=S*signed;$('powerCosRange').value=signed;$('powerCosLabel').textContent=`${da(signed,2)} · ${signed<0?'kapacitiv':signed>0?'induktiv':'resistiv'} · cos φ = ${da(cosMagnitude,2)}`;$('powerP').textContent=power(P);$('powerQ').textContent=power(Q,true);$('powerS').textContent=S>=1000?unit(S/1000,'kVA',2):unit(S,'VA');$('powerAngle').textContent=unit(phi,'°');$('powerPhi').textContent=`φ = ${phi>0?'+':''}${da(phi,1)}°`;
  const prefix=powerMode===3?'√3 · ':'';$('powerPFormula').textContent=`P = ${prefix}U · I · cos φ`;$('powerQFormula').textContent=`Q = ${prefix}U · I · sin φ`;$('powerSFormula').textContent=`S = ${prefix}U · I`;
  const root=$('powerTriangle');clear(root);baseGrid(root,85,150,480,240);const scale=Math.min(P>0?330/P:Infinity,Math.abs(Q)>0?110/Math.abs(Q):Infinity),s=Number.isFinite(scale)?scale:1,px=85+P*s,qy=150-Q*s;line(root,85,150,px,150,'vector','#9b87f5');line(root,px,150,px,qy,'vector',Q<0?'#9b87f5':'#ff9f43');line(root,85,150,px,qy,'vector','#35d3e3');text(root,(85+px)/2,170,`P ${power(P)}`,'vector-label','#9b87f5','middle');text(root,px+10,(150+qy)/2+4,`Q ${power(Q,true)}`,'vector-label',Q<0?'#9b87f5':'#ff9f43');text(root,(85+px)/2,(150+qy)/2+(Q>=0?-10:18),`S ${S>=1000?da(S/1000,2)+' kVA':da(S,0)+' VA'}`,'vector-label','#35d3e3','middle');text(root,455,282,Q<0?'Kapacitiv · Q < 0':Q>0?'Induktiv · Q > 0':'Resistiv · Q = 0','vector-label',Q<0?'#9b87f5':Q>0?'#ff9f43':'#55d6a1','end');drawPowerWave(phi,cosMagnitude,powerMode);
}

function drawPowerWave(phi,cosMagnitude,mode){
  const root=$('powerWave');clear(root);const left=35,right=870,mid=154,width=right-left,ampU=58,ampI=48,ampP=88;line(root,left,mid,right,mid,'axis');for(let x=left;x<=right;x+=84)line(root,x,35,x,270);
  const points=[],uPoints=[],iPoints=[];for(let x=left;x<=right;x+=2){const t=(x-left)/width*4*Math.PI,u=Math.sin(t),i=Math.sin(t-rad(phi)),p=u*i;points.push({x,y:mid-ampP*p,p});uPoints.push([x,mid-ampU*u]);iPoints.push([x,mid-ampI*i]);}
  let area='',inside=false;points.forEach((pt,index)=>{if(pt.p<0&&!inside){area+=`M ${pt.x} ${mid} L ${pt.x} ${pt.y}`;inside=true;}else if(pt.p<0){area+=` L ${pt.x} ${pt.y}`;}else if(inside){area+=` L ${pt.x} ${mid} Z `;inside=false;}if(index===points.length-1&&inside)area+=` L ${pt.x} ${mid} Z`;});
  root.append(svg('path',{d:area,fill:phi<0?'rgba(155,135,245,.28)':'rgba(255,159,67,.25)',stroke:'none'}));const pathOf=arr=>arr.map((p,i)=>`${i?'L':'M'} ${p[0]} ${p[1]}`).join(' ');root.append(svg('path',{d:pathOf(uPoints),fill:'none',stroke:'#35d3e3','stroke-width':1.8}));root.append(svg('path',{d:pathOf(iPoints),fill:'none',stroke:phi<0?'#9b87f5':'#ff9f43','stroke-width':1.8}));root.append(svg('path',{d:points.map((p,i)=>`${i?'L':'M'} ${p.x} ${p.y}`).join(' '),fill:'none',stroke:'#d4dde1','stroke-width':2.2,'stroke-dasharray':'6 5'}));const avgY=mid-ampP*.5*cosMagnitude;line(root,left,avgY,right,avgY,'guide');text(root,left+8,avgY-7,`Pₘᵢd = ${da(cosMagnitude,2)} · S`,'vector-label','#91a0aa');text(root,left+10,48,'u(t)','vector-label','#35d3e3');text(root,left+10,66,'i(t)','vector-label',phi<0?'#9b87f5':'#ff9f43');if(Math.abs(phi)>.2)text(root,left+190,mid+82,phi<0?'Kapacitiv reaktiv energi · Q < 0':'Induktiv reaktiv energi · Q > 0','vector-label',phi<0?'#9b87f5':'#ff9f43','middle');text(root,right-8,286,'2 perioder','vector-label','#63727d','end');$('powerWaveState').textContent=phi<0?'Kapacitiv reaktiv effekt':phi>0?'Induktiv reaktiv effekt':'Rent resistiv effekt';$('powerWaveCaption').textContent=mode===3?'Kurverne viser én fase. Den samlede effekt i et symmetrisk 3-faset system er konstant.':'Farven under x-aksen viser energi, der kortvarigt sendes tilbage mod forsyningen.';
}

function drawThree(){
  const inputU=num('threeU'),R=Math.max(0,num('threeR')),X=Number($('threeX').value)||0,Z=Math.hypot(R,X),cosMagnitude=Z?R/Z:0,phi=deg(Math.atan2(X,R)),signedCos=X<0?-cosMagnitude:cosMagnitude,Uf=threeVoltageType==='phase'?inputU:threeConnection==='Y'?inputU/Math.sqrt(3):inputU,Un=threeVoltageType==='line'?inputU:threeConnection==='Y'?inputU*Math.sqrt(3):inputU,If=Z?Uf/Z:0,In=threeConnection==='Y'?If:If*Math.sqrt(3),P=Math.sqrt(3)*Un*In*cosMagnitude,Q=Math.sqrt(3)*Un*In*Math.sin(rad(phi));
  $('threeVoltageLabel').innerHTML=threeVoltageType==='line'?'<b>Netspænding U<sub>n</sub></b><em>V</em>':'<b>Fasespænding U<sub>f</sub></b><em>V</em>';$('threeUn').textContent=unit(Un,'V');$('threeUf').textContent=unit(Uf,'V');$('threeZ').textContent=unit(Z,'Ω');$('threeIf').textContent=unit(If,'A',2);$('threeI').textContent=unit(In,'A',2);$('threeLineCurrentButton').textContent=unit(In,'A',2);$('threePhaseCurrentButton').textContent=unit(If,'A',2);$('threeP').textContent=power(P);$('threeQ').textContent=power(Q,true);$('threeCos').textContent=da(signedCos,3);$('threeUnFormula').textContent=threeVoltageType==='line'?'Indtastet':threeConnection==='Y'?'√3 · Uᶠ':'Uⁿ = Uᶠ';$('threeUfFormula').textContent=threeVoltageType==='phase'?'Indtastet':threeConnection==='Y'?'Uⁿ / √3':'Uⁿ = Uᶠ';$('threeIFormula').textContent=threeConnection==='Y'?`Iⁿ = Iᶠ = ${da(If,2)} A`:`Iⁿ = √3 · Iᶠ (${da(If,2)} A)`;$('threePFormula').textContent=threeVoltageType==='line'?'√3 · Uⁿ · Iⁿ · |cosφ|':'3 · Uᶠ · Iᶠ · |cosφ|';$('threeQFormula').textContent=threeVoltageType==='line'?'√3 · Uⁿ · Iⁿ · sinφ':'3 · Uᶠ · Iᶠ · sinφ';
  const selectedPowerFormula=threeVoltageType==='line'?'P = √3 · Uₙ · Iₙ · |cosφ|':'P = 3 · U_f · I_f · |cosφ|';
  $('connectionExplainer').innerHTML=threeConnection==='Y'?`<strong>Y</strong><p>U<sub>f</sub> = U<sub>n</sub>/√3<br>I<sub>n</sub> = I<sub>f</sub><br>${selectedPowerFormula}<br>cos φ = ${da(signedCos,3)}</p>`:`<strong>Δ</strong><p>U<sub>f</sub> = U<sub>n</sub><br>I<sub>n</sub> = √3 · I<sub>f</sub><br>I̲<sub>n1</sub> = I̲<sub>12</sub> − I̲<sub>31</sub><br>${selectedPowerFormula}<br>cos φ = ${da(signedCos,3)}</p>`;
  $('threeDiagramTitle').textContent=threeConnection==='Y'?'Stjerne · fase- og netstrøm er ens':'Trekant · fase- og netstrømme';$('threeDiagramNote').textContent=threeConnection==='Y'?'Y: Iₙ = I_f; vektorerne falder sammen.':threeCurrentView==='line'?'Δ: Iₙ = √3 · I_f og er 30° forskudt fra fasestrømmen.':'Δ: Grenstrømmene I₁₂, I₂₃ og I₃₁ danner netstrømmene ved vektorforskel.';$('threeLoadType').textContent=X<0?'Kapacitiv · strømmen er foran':X>0?'Induktiv · strømmen er bagefter':'Resistiv · strøm og spænding i fase';drawThreeDiagram($('threePhasor'),threeConnection,phi,threeCurrentView);drawThreeCircuit(threeConnection);
}

function drawThreeDiagram(root,connection,phi,currentView){
  clear(root);baseGrid(root,260,160,480,270);const cx=260,cy=160,radius=78,angles=[90,-30,210],colors=['#35d3e3','#ff9f43','#9b87f5'],points=angles.map(a=>[cx+radius*Math.cos(rad(a)),cy-radius*Math.sin(rad(a))]);root.append(svg('polygon',{points:points.map(p=>p.join(',')).join(' '),fill:'none',stroke:'#657680','stroke-width':1.5}));
  angles.forEach((a,i)=>{const p=points[i];if(connection==='Y'){arrow(root,cx,cy,radius,a,colors[i],'',.65);text(root,cx+radius*.55*Math.cos(rad(a))+8,cy-radius*.55*Math.sin(rad(a))-5,`Uᶠ${i+1}`,'vector-label',colors[i]);}else{line(root,cx,cy,p[0],p[1],'guide');}});
  const sideNames=connection==='Y'?['Uⁿ¹²','Uⁿ²³','Uⁿ³¹']:['U¹²','U²³','U³¹'];points.forEach((p,i)=>{const q=points[(i+1)%3],mx=(p[0]+q[0])/2,my=(p[1]+q[1])/2;text(root,mx+(mx<cx?-12:12),my+(my>cy?15:-8),sideNames[i],'vector-label','#8c9aa3','middle');});
  const phaseNames=connection==='Y'?['Iᶠ1','Iᶠ2','Iᶠ3']:['I¹²','I²³','I³¹'],lineNames=['Iⁿ1','Iⁿ2','Iⁿ3'];points.forEach((p,i)=>{const refAngle=angles[i],phaseAngle=refAngle-phi;line(root,p[0],p[1],p[0]+62*Math.cos(rad(refAngle)),p[1]-62*Math.sin(rad(refAngle)),'guide');if(connection==='Y'){arrow(root,p[0],p[1],54,phaseAngle,colors[i],lineNames[i],.58);}else{const phaseColor=currentView==='phase'?colors[i]:'#53646f',lineColor=currentView==='line'?colors[i]:'#53646f';arrow(root,p[0],p[1],42,phaseAngle,phaseColor,phaseNames[i],.52);arrow(root,p[0],p[1],65,phaseAngle-30,lineColor,lineNames[i],.62);}});
  if(Math.abs(phi)>.2){const p=points[0],rr=18,startAngle=angles[0],endAngle=startAngle-phi,sweep=phi>0?1:0;root.append(svg('path',{d:`M ${p[0]+rr*Math.cos(rad(startAngle))} ${p[1]-rr*Math.sin(rad(startAngle))} A ${rr} ${rr} 0 0 ${sweep} ${p[0]+rr*Math.cos(rad(endAngle))} ${p[1]-rr*Math.sin(rad(endAngle))}`,class:'arc'}));text(root,p[0]+29,p[1]-25,'φ','vector-label','#8c9aa3');}
  text(root,260,304,connection==='Y'?'Stjerne: Uⁿ = √3 · Uᶠ og Iⁿ = Iᶠ':currentView==='line'?'Trekant: Iⁿ er vektorforskellen mellem to fasestrømme':'Trekant: Iⁿ = √3 · Iᶠ og er 30° forskudt','vector-label','#6f7e89','middle');
}

function drawThreeCircuit(connection){
  const root=$('threeCircuit');clear(root);const colors=['#35d3e3','#ff9f43','#9b87f5'],ys=[30,60,90];ys.forEach((y,i)=>{circuitText(root,20,y+4,`L${i+1}`,'circuit-label','middle',colors[i]);circuitWire(root,45,y,485,y,colors[i]);circuitArrow(root,62,y,34,0,`Iₗ${i+1}`);});
  if(connection==='Y'){
    $('threeCircuitTitle').textContent='Stjernekobling (Y)';$('threeCircuitNote').textContent='Tre ens faseimpedanser er forbundet mellem L1, L2, L3 og et fælles nulpunkt N.';circuitText(root,20,154,'N','circuit-label','middle');circuitWire(root,45,150,485,150,'#8b98a1');const xs=[180,300,420];xs.forEach((x,i)=>{circuitNode(root,x,ys[i]);circuitWire(root,x,ys[i],x,90,colors[i]);circuitResistor(root,x,120,90);circuitNode(root,x,150);circuitText(root,x+17,124,`Z${i+1}`,'circuit-label');circuitArrow(root,x,92,18,-90,`I${i+1}0`);});
  }else{
    $('threeCircuitTitle').textContent='Trekantkobling (Δ)';$('threeCircuitNote').textContent='De tre ens faseimpedanser er forbundet direkte mellem netlederne L1–L2, L2–L3 og L3–L1.';const branches=[{a:[170,30],b:[240,60],y:120,label:'Z₁₂',current:'I₁₂'},{a:[280,60],b:[350,90],y:145,label:'Z₂₃',current:'I₂₃'},{a:[390,90],b:[470,30],y:165,label:'Z₃₁',current:'I₃₁'}];branches.forEach((branch,index)=>{const [ax,ay]=branch.a,[bx,by]=branch.b;circuitNode(root,ax,ay);circuitNode(root,bx,by);circuitWire(root,ax,ay,ax,branch.y,colors[index]);circuitResistor(root,(ax+bx)/2,branch.y,0);circuitWire(root,bx,branch.y,bx,by,colors[index]);circuitArrow(root,ax,Math.min(ay+12,branch.y-28),18,-90,branch.current);circuitText(root,(ax+bx)/2,branch.y-13,branch.label,'circuit-label','middle');});
  }
}

function drawComp(){
  const P=Math.max(0,num('compP'))*1000,U=Math.max(.1,num('compU')),f=Math.max(.1,num('compF')),c1=clamp(num('compCos1'),.05,1),c2=clamp(num('compCos2'),.05,1),p1=Math.acos(c1),p2=Math.acos(c2),valid=c2>=c1,Q1=P*Math.tan(p1),Q2=P*Math.tan(p2),Qc=Math.max(0,Q1-Q2),C=Qc/(3*2*Math.PI*f*U*U),I1=P/(Math.sqrt(3)*U*c1),I2=P/(Math.sqrt(3)*U*c2),Ic=Qc/(Math.sqrt(3)*U),S1=P/c1,S2=P/c2,Ip=P/(Math.sqrt(3)*U),Iq1=Q1/(Math.sqrt(3)*U),Iq2=Q2/(Math.sqrt(3)*U);
  $('compQc').textContent=valid?power(Qc,true):'Kontrollér cos φ';$('compCdelta').textContent=valid?unit(C*1e6,'µF',1):'—';$('compBankI').textContent=valid?unit(Ic,'A',2):'—';$('compI1').textContent=unit(I1,'A',2);$('compI2').textContent=unit(I2,'A',2);$('compSaving').textContent=valid?`${da((1-I2/I1)*100,1)} % lavere netstrøm`:'Målet skal være højere';$('compQ1').textContent=power(Q1,true);$('compQ2').textContent=power(Q2,true);$('compS1').textContent=S1>=1000?unit(S1/1000,'kVA',2):unit(S1,'VA');$('compS2').textContent=S2>=1000?unit(S2/1000,'kVA',2):unit(S2,'VA');$('compPhi1').textContent=`φ₁ = ${da(deg(p1),1)}°`;$('compPhi2').textContent=`φ₂ = ${da(deg(p2),1)}°`;$('compFlowPill').textContent=valid?`Iᴄ ${da(Ic,2)} A`:'Kontrollér cos φ';$('compWarning').innerHTML=!valid?'<strong>Bemærk:</strong> Ønsket cos φ₂ skal være større end cos φ₁.':`<strong>Resultat:</strong> Kondensatorstrømmen ${da(Ic,2)} A reducerer netstrømmen fra ${da(I1,2)} A til ${da(I2,2)} A.`;
  const root=$('compDiagram');clear(root);baseGrid(root,70,250,480,220);const scale=Math.min(P>0?330/P:Infinity,Q1>0?180/Q1:Infinity),s=Number.isFinite(scale)?scale:1,px=70+P*s,q1y=250-Q1*s,q2y=250-Q2*s;line(root,70,250,px,250,'vector','#596873');line(root,px,250,px,q1y,'vector','#667581');line(root,70,250,px,q1y,'vector','#667581');line(root,px,250,px,q2y,'vector','#35d3e3');line(root,70,250,px,q2y,'vector','#35d3e3');text(root,(70+px)/2,270,`P ${power(P)}`,'vector-label','#8b98a2','middle');text(root,px+8,(250+q1y)/2,`Q₁`,'vector-label','#667581');text(root,px+8,(250+q2y)/2+5,`Q₂`,'vector-label','#35d3e3');text(root,(70+px)/2-12,(250+q1y)/2-9,'S₁','vector-label','#667581','middle');text(root,(70+px)/2+8,(250+q2y)/2+15,'S₂','vector-label','#35d3e3','middle');
  drawCompCurrentPhasor(Ip,Iq1,valid?Iq2:Iq1,I1,valid?I2:I1,Ic);drawCompCurrentFlow(I1,I2,Ic,U,valid);
}

function drawCompCurrentPhasor(Ip,Iq1,Iq2,I1,I2,Ic){
  const root=$('compCurrentPhasor'),cx=120,cy=235,maxQ=Math.max(Iq1,Iq2,Ic,.001),scale=Math.min(Ip>0?145/Ip:Infinity,245/maxQ),s=Number.isFinite(scale)?scale:1,tip1={x:cx+Iq1*s,y:cy-Ip*s},tip2={x:cx+Iq2*s,y:cy-Ip*s};clear(root);baseGrid(root,cx,cy,480,240);arrow(root,cx,cy,165,90,VOLTAGE_COLOR,'U · reference',.72);const a1=deg(Math.atan2(Ip,Iq1||.000001)),a2=deg(Math.atan2(Ip,Iq2||.000001));arrow(root,cx,cy,I1*s,a1,'#8a5a62','',.75);text(root,tip1.x+14,tip1.y-12,'I₁','vector-label','#b37a83');arrow(root,cx,cy,I2*s,a2,CURRENT_COLOR,'',.8);text(root,tip2.x-10,tip2.y+22,'I₂','vector-label',CURRENT_COLOR,'end');if(Ic>.001){arrow(root,tip1.x,tip1.y,Ic*s,180,'#55d6a1','',.7);text(root,(tip1.x+tip2.x)/2,tip1.y-14,'Iᴄ','vector-label','#55d6a1','middle');}line(root,cx,tip1.y,tip1.x,tip1.y,'guide');text(root,465,283,'I₂ = I₁ + Iᴄ','vector-label','#778690','end');
}

function drawCompCurrentFlow(Ibefore,Iafter,Ic,U,valid){
  const root=$('compCurrentFlow');clear(root);root.append(svg('rect',{x:45,y:76,width:100,height:62,rx:9,class:'circuit-component'}));text(root,95,101,'FORSYNING','vector-label','#8c9aa3','middle');text(root,95,121,'Uₙ','vector-label',VOLTAGE_COLOR,'middle');circuitWire(root,145,107,755,107,'#71808a');root.append(svg('rect',{x:755,y:65,width:110,height:84,rx:9,class:'circuit-component'}));text(root,810,91,'BELASTNING','vector-label','#d3dde1','middle');text(root,810,116,'før komp.','vector-label','#70808b','middle');circuitArrow(root,195,107,130,0,'Iₙ efter',CURRENT_COLOR);circuitArrow(root,575,107,130,0,'I belastning','#b37a83');circuitNode(root,505,107);circuitWire(root,505,107,505,214,'#55d6a1');circuitArrow(root,505,122,38,-90,'Iᴄ','#55d6a1');circuitCapacitor(root,505,196,90);text(root,548,193,'KONDENSATORBATTERI','vector-label','#55d6a1');text(root,548,213,valid?'Kapacitiv grenstrøm':'Kontrollér inddata','vector-label','#81909a');text(root,450,244,'Værdierne vises i resultatfelterne ovenfor','vector-label','#667681','middle');
}

function drawConnections(){
  const U=Math.max(0,num('connU2')),Z=Math.max(.0001,num('connZ2')),c=clamp(num('connCos2'),0,1),sinPhi=Math.sqrt(Math.max(0,1-c*c));
  const UfY=U/Math.sqrt(3),UfD=U,IfY=UfY/Z,IfD=UfD/Z,InY=IfY,InD=Math.sqrt(3)*IfD;
  const SY=Math.sqrt(3)*U*InY,SD=Math.sqrt(3)*U*InD,PY=SY*c,PD=SD*c,QY=SY*sinPhi,QD=SD*sinPhi;
  const values={starPhaseU2:unit(UfY,'V'),deltaPhaseU2:unit(UfD,'V'),connUnY:unit(U,'V'),connUnD:unit(U,'V'),connUfY:unit(UfY,'V'),connUfD:unit(UfD,'V'),connIfY:unit(IfY,'A',2),connIfD:unit(IfD,'A',2),connInY:unit(InY,'A',2),connInD:unit(InD,'A',2),connPY:power(PY),connPD:power(PD),connQY:power(QY,true),connQD:power(QD,true),connSY:unit(SY>=1000?SY/1000:SY,SY>=1000?'kVA':'VA',2),connSD:unit(SD>=1000?SD/1000:SD,SD>=1000?'kVA':'VA',2)};
  Object.entries(values).forEach(([id,value])=>{if($(id))$(id).textContent=value;});
  drawConnectionSvg($('starDiagram2'),'Y');drawConnectionSvg($('deltaDiagram2'),'D');
}
function drawConnectionSvg(root,type){clear(root);const colors=[VOLTAGE_COLOR,'#8fb7ff','#9b87f5'];if(type==='Y'){const pts=[[110,28],[35,172],[185,172]],center=[110,120];pts.forEach((p,i)=>{line(root,p[0],p[1],center[0],center[1],'vector',colors[i]);root.append(svg('circle',{cx:p[0],cy:p[1],r:5,fill:colors[i]}));text(root,p[0],p[1]+(i?22:-12),`L${i+1}`,'vector-label',colors[i],'middle');});root.append(svg('circle',{cx:center[0],cy:center[1],r:6,fill:'#cbd7dc'}));text(root,center[0]+12,center[1]+4,'N','vector-label','#8b99a3');}else{const pts=[[110,28],[35,172],[185,172]];pts.forEach((p,i)=>{const q=pts[(i+1)%3];line(root,p[0],p[1],q[0],q[1],'vector',colors[i]);root.append(svg('circle',{cx:p[0],cy:p[1],r:5,fill:colors[i]}));text(root,p[0],p[1]+(i?22:-12),`L${i+1}`,'vector-label',colors[i],'middle');});}}

function parallelBetween(a,b){return a+b? a*b/(a+b):0;}
function drawTransformation(){
  const input=[Math.max(.000001,num('trR1')),Math.max(.000001,num('trR2')),Math.max(.000001,num('trR3'))];let output,sourceLabels,targetLabels,sourceType,targetType;
  if(transformDirection==='delta-star'){
    const [r12,r23,r31]=input,sum=r12+r23+r31;output=[r12*r31/sum,r23*r12/sum,r31*r23/sum];sourceLabels=['R₁₂','R₂₃','R₃₁'];targetLabels=['R₁₀','R₂₀','R₃₀'];sourceType='D';targetType='Y';
  }else{
    const [r10,r20,r30]=input,n=r10*r20+r20*r30+r30*r10;output=[n/r30,n/r10,n/r20];sourceLabels=['R₁₀','R₂₀','R₃₀'];targetLabels=['R₁₂','R₂₃','R₃₁'];sourceType='Y';targetType='D';
  }
  const inputEq=transformDirection==='delta-star'?parallelBetween(input[0],input[1]+input[2]):input[0]+input[1];
  const outputEq=transformDirection==='delta-star'?output[0]+output[1]:parallelBetween(output[0],output[1]+output[2]);
  const difference=Math.abs(inputEq-outputEq),ok=difference<Math.max(.0001,inputEq*.000001);
  ['trOut1','trOut2','trOut3'].forEach((id,i)=>$(id).textContent=unit(output[i],'Ω',3));
  ['trOutLabel1','trOutLabel2','trOutLabel3'].forEach((id,i)=>$(id).textContent=targetLabels[i]);
  ['trLabel1','trLabel2','trLabel3'].forEach((id,i)=>$(id).innerHTML=`${sourceLabels[i]} <em>Ω</em>`);
  $('trEquivalent').textContent=unit(outputEq,'Ω',3);$('transformCheck').textContent=`${unit(inputEq,'Ω',3)} = ${unit(outputEq,'Ω',3)}`;
  $('transformCheckPill').textContent=ok?'ÆKVIVALENT':'KONTROLLÉR';$('transformCheckPill').classList.toggle('transform-check-ok',ok);$('transformCheckPill').classList.toggle('transform-check-bad',!ok);
  $('transformDiagramTitle').textContent=transformDirection==='delta-star'?'Trekant til stjerne':'Stjerne til trekant';
  $('transformHint').innerHTML=transformDirection==='delta-star'?'Hver Y-modstand er produktet af de to Δ-modstande, der mødes ved klemmen, divideret med summen af alle tre.':'Hver Δ-modstand er summen af de tre parvise produkter divideret med den modstående Y-modstand.';
  $('trSymDelta').textContent=unit(Math.max(0,num('trSymY'))*3,'Ω',2);
  drawTransformationDiagram(sourceType,targetType,input,output,sourceLabels,targetLabels);
}
function drawTransformationDiagram(rootType,targetType,sourceValues,targetValues,sourceLabels,targetLabels){
  const root=$('transformationDiagram');clear(root);
  root.append(svg('rect',{x:22,y:18,width:856,height:292,rx:14,fill:'#0f1820',stroke:'#263743'}));
  drawTransformNetwork(root,235,165,rootType,sourceValues,sourceLabels);drawTransformNetwork(root,665,165,targetType,targetValues,targetLabels);
  arrow(root,402,166,96,0,'#55d6a1',transformDirection==='delta-star'?'Δ → Y':'Y → Δ',.72);
  text(root,235,42,transformDirection==='delta-star'?'INDDATA · TREKANT':'INDDATA · STJERNE','vector-label','#8fa0aa','middle');text(root,665,42,transformDirection==='delta-star'?'RESULTAT · STJERNE':'RESULTAT · TREKANT','vector-label',VOLTAGE_COLOR,'middle');
}
function drawTransformNetwork(root,cx,cy,type,values,labels){
  const wire='#c7d2d8',box='#edf4f7',labelColor='#dbe5e9',muted='#8fa0aa';
  const resistor=(a,b,label,value,normal=1)=>{const mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2,angle=deg(Math.atan2(b[1]-a[1],b[0]-a[0])),length=Math.hypot(b[0]-a[0],b[1]-a[1]),nx=-(b[1]-a[1])/length,ny=(b[0]-a[0])/length;line(root,a[0],a[1],b[0],b[1],'vector',wire);const g=svg('g',{transform:`translate(${mx} ${my}) rotate(${angle})`});g.append(svg('rect',{x:-22,y:-9,width:44,height:18,rx:2,fill:'#0f1820',stroke:box,'stroke-width':2}));root.append(g);text(root,mx+nx*25*normal,my+ny*25*normal+4,label,'vector-label',labelColor,'middle');};
  const top=[cx,76],left=[cx-92,232],right=[cx+92,232],center=[cx,166];
  if(type==='D'){
    resistor(top,right,labels[0],values[0],-1);resistor(right,left,labels[1],values[1],-1);resistor(left,top,labels[2],values[2],-1);
    line(root,top[0],top[1],top[0],52,'vector',wire);line(root,left[0],left[1],left[0]-34,left[1]+24,'vector',wire);line(root,right[0],right[1],right[0]+34,right[1]+24,'vector',wire);
  }else{
    resistor(center,top,labels[0],values[0],-1);resistor(center,right,labels[1],values[1],-1);resistor(center,left,labels[2],values[2],-1);
    line(root,top[0],top[1],top[0],52,'vector',wire);line(root,left[0],left[1],left[0]-34,left[1]+24,'vector',wire);line(root,right[0],right[1],right[0]+34,right[1]+24,'vector',wire);root.append(svg('circle',{cx:center[0],cy:center[1],r:5,fill:box}));text(root,center[0]+11,center[1]+5,'0','vector-label',muted);
  }
  [[top[0],48,'1'],[left[0]-40,left[1]+30,'3'],[right[0]+40,right[1]+30,'2']].forEach(([x,y,n])=>text(root,x,y,n,'vector-label',VOLTAGE_COLOR,'middle'));
}

const targetConfigs={U:[['I','Strøm I','A',10],['R','Resistans R','Ω',23]],I:[['U','Spænding U','V',230],['R','Resistans R','Ω',23]],R:[['U','Spænding U','V',230],['I','Strøm I','A',10]],P:[['U','Spænding U','V',230],['I','Strøm I','A',10]]};
function renderOhmInputs(){const root=$('ohmInputs');root.innerHTML='';targetConfigs[ohmTarget].forEach(([key,label,u,v])=>{const l=document.createElement('label');l.innerHTML=`<span>${label} <em>${u}</em></span><input id="ohm${key}" type="number" value="${v}" min="0" step="0.1">`;root.append(l);});$$('input',root).forEach(i=>i.addEventListener('input',drawOhm));drawOhm();}
function drawOhm(){const a=targetConfigs[ohmTarget][0][0],b=targetConfigs[ohmTarget][1][0],av=num('ohm'+a),bv=num('ohm'+b);let r=0,formula='',u='';if(ohmTarget==='U'){r=av*bv;u='V';formula='U = I · R';}if(ohmTarget==='I'){r=bv?av/bv:0;u='A';formula='I = U / R';}if(ohmTarget==='R'){r=bv?av/bv:0;u='Ω';formula='R = U / I';}if(ohmTarget==='P'){r=av*bv;u='W';formula='P = U · I';}$('ohmResult').textContent=unit(r,u,2);$('ohmUsedFormula').textContent=formula;const root=$('ohmWheel');clear(root);const items=[['U',260,55],['I',130,220],['R',390,220],['P',260,245]];line(root,260,70,145,205,'guide');line(root,260,70,375,205,'guide');line(root,145,220,375,220,'guide');items.forEach(([k,x,y])=>{const active=k===ohmTarget;root.append(svg('circle',{cx:x,cy:y,r:active?40:32,fill:active?'#17333b':'#121d25',stroke:active?'#35d3e3':'#344550','stroke-width':active?2:1}));text(root,x,y+6,k,'vector-label',active?'#35d3e3':'#94a2ac','middle');});text(root,260,135,formula,'vector-label','#c5d2d8','middle');text(root,260,155,'Klik på U, I, R eller P i vælgeren','vector-label','#596873','middle');}

function recolorArrowGroup(group,color){if(!group)return;const vector=group.querySelector('line.vector');const head=group.querySelector('polygon');const label=group.querySelector('text');if(vector)vector.setAttribute('stroke',color);if(head)head.setAttribute('fill',color);if(label)label.setAttribute('fill',color);}
function applyElectricalColorConvention(){
  const parallelGroups=$$('#parallelPhasor > g');recolorArrowGroup(parallelGroups[0],VOLTAGE_COLOR);recolorArrowGroup(parallelGroups.at(-1),CURRENT_COLOR);
  const compGroups=$$('#compCurrentPhasor > g');recolorArrowGroup(compGroups[0],VOLTAGE_COLOR);recolorArrowGroup(compGroups[1],'#a84f59');recolorArrowGroup(compGroups[2],CURRENT_COLOR);
  const powerPaths=$$('#powerWave path');if(powerPaths[1])powerPaths[1].setAttribute('stroke',VOLTAGE_COLOR);if(powerPaths[2])powerPaths[2].setAttribute('stroke',CURRENT_COLOR);$$('#powerWave text').forEach(label=>{if(label.textContent==='u(t)')label.setAttribute('fill',VOLTAGE_COLOR);if(label.textContent==='i(t)')label.setAttribute('fill',CURRENT_COLOR);});
  $$('#threePhasor > g').forEach((group,index)=>{const label=group.querySelector('text')?.textContent||'';if(label.startsWith('U'))recolorArrowGroup(group,index%3===0?VOLTAGE_COLOR:index%3===1?'#8fb7ff':'#9b87f5');if(label.startsWith('I'))recolorArrowGroup(group,label.includes('ⁿ')?CURRENT_COLOR:index%3===0?CURRENT_COLOR:index%3===1?'#ff8a70':'#d94f8a');});
  $$('.circuit-current').forEach(label=>{label.setAttribute('fill',CURRENT_COLOR);const head=label.previousElementSibling,shaft=head?.previousElementSibling;if(head?.tagName==='polygon')head.setAttribute('fill',CURRENT_COLOR);if(shaft?.tagName==='line')shaft.setAttribute('stroke',CURRENT_COLOR);});
}

let activeDiagram=null,lastExpandButton=null;
function installDiagramExpanders(){
  $$('svg.diagram').forEach(diagram=>{const card=diagram.closest('.card');if(!card||card.querySelector('.diagram-expand'))return;card.classList.add('diagram-host');const button=document.createElement('button');button.className='diagram-expand';button.type='button';button.textContent='⛶';button.title='Forstør diagram';button.setAttribute('aria-label','Forstør diagram');button.addEventListener('click',()=>openDiagramModal(diagram,button));card.append(button);});
}
function openDiagramModal(diagram,button){
  activeDiagram=diagram;lastExpandButton=button;const clone=diagram.cloneNode(true);clone.removeAttribute('id');$('diagramModalCanvas').replaceChildren(clone);const page=diagram.closest('.page'),card=diagram.closest('.card'),heading=card?.querySelector('h3')?.textContent||'Diagram';$('diagramModalTitle').textContent=`${page?.dataset.title||'VektorLab'} · ${heading}`;$('diagramModal').hidden=false;document.body.classList.add('modal-open');$('closeDiagram').focus();
}
function closeDiagramModal(){if($('diagramModal').hidden)return;$('diagramModal').hidden=true;$('diagramModalCanvas').replaceChildren();document.body.classList.remove('modal-open');activeDiagram=null;lastExpandButton?.focus();}
function exportableSvg(source){
  const copy=source.cloneNode(true),sourceNodes=[source,...source.querySelectorAll('*')],copyNodes=[copy,...copy.querySelectorAll('*')],properties=['fill','stroke','stroke-width','stroke-dasharray','stroke-linecap','stroke-linejoin','opacity','font-family','font-size','font-weight'];sourceNodes.forEach((node,i)=>{const styles=getComputedStyle(node);properties.forEach(prop=>copyNodes[i].style.setProperty(prop,styles.getPropertyValue(prop)));});const viewBox=source.viewBox.baseVal,w=1600,h=Math.round(w*(viewBox.height/viewBox.width));copy.setAttribute('xmlns','http://www.w3.org/2000/svg');copy.setAttribute('width',w);copy.setAttribute('height',h);const background=svg('rect',{x:viewBox.x,y:viewBox.y,width:viewBox.width,height:viewBox.height,fill:'#111b24'});copy.insertBefore(background,copy.firstChild);return {copy,w,h};
}
function downloadActiveDiagram(){
  if(!activeDiagram)return;const {copy,w,h}=exportableSvg(activeDiagram),data=new XMLSerializer().serializeToString(copy),blob=new Blob([data],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob),img=new Image();img.onload=()=>{const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const context=canvas.getContext('2d');context.fillStyle='#111b24';context.fillRect(0,0,w,h);context.drawImage(img,0,0,w,h);URL.revokeObjectURL(url);canvas.toBlob(png=>{const link=document.createElement('a'),page=activeDiagram.closest('.page')?.dataset.title||'diagram';link.href=URL.createObjectURL(png);link.download=`VektorLab-${page.toLowerCase().replace(/[^a-z0-9æøå]+/gi,'-')}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);},'image/png');};img.src=url;
}
$('closeDiagram').addEventListener('click',closeDiagramModal);$('downloadDiagram').addEventListener('click',downloadActiveDiagram);$('diagramModal').addEventListener('click',e=>{if(e.target===$('diagramModal'))closeDiagramModal();});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('diagramModal').hidden)closeDiagramModal();});

function syncInputModeUI(){
  $$('#seriesInputMode button').forEach(b=>b.classList.toggle('active',b.dataset.seriesMode===seriesInputMode));const directCurrents=parallelInputMode==='currents';$('parFrequencyField').hidden=directCurrents;$('parVoltageField').classList.toggle('field-wide',directCurrents);$('parallelCurrentFields').hidden=!directCurrents;$$('#parallelInputMode button').forEach(b=>b.classList.toggle('active',b.dataset.parallelMode===parallelInputMode));syncComponentBuilders();
}
function componentUnit(type,mode){if(type==='R')return 'Ω';if(mode==='reactance')return type==='L'?'Xₗ · Ω':'X꜀ · Ω';return type==='L'?'mH':'µF';}
function syncComponentBuilders(){
  $('seriesComponentBuilder').classList.remove('current-entry-mode');for(let i=1;i<=3;i++){const active=i<=seriesComponentCount,type=$(`seriesCompType${i}`).value;$(`seriesComponentRow${i}`).hidden=!active;$(`seriesCompUnit${i}`).textContent=componentUnit(type,seriesInputMode);}$$('#seriesComponentCount button').forEach(b=>b.classList.toggle('active',Number(b.dataset.count)===seriesComponentCount));
  const direct=parallelInputMode==='currents';$('parallelComponentBuilder').classList.toggle('current-entry-mode',direct);const currentLabels=['parCurrentLabel1','parCurrentLabel2','parCurrentLabel3'],angleLabels=['parAngleLabel1','parAngleLabel2','parAngleLabel3'];for(let i=1;i<=3;i++){const active=i<=parallelComponentCount,type=$(`parallelCompType${i}`).value,name=currentSymbol(type,i);$(`parallelComponentRow${i}`).hidden=!active;$(`parallelCompUnit${i}`).textContent=componentUnit(type,parallelInputMode);$(currentLabels[i-1]).innerHTML=`Strøm ${name} <em>A</em>`;$(angleLabels[i-1]).innerHTML=`Vinkel ${name} <em>°</em>`;$(`parCurrentRow${i}a`).hidden=!active;$(`parCurrentRow${i}b`).hidden=!active;}$$('#parallelComponentCount button').forEach(b=>b.classList.toggle('active',Number(b.dataset.count)===parallelComponentCount));
}
function convertComponentValue(type,value,fromMode,toMode,omega){if(type==='R'||fromMode===toMode)return value;if(fromMode==='components'&&toMode==='reactance')return type==='L'?omega*value/1000:1/(omega*Math.max(value,.000000001)*1e-6);if(fromMode==='reactance'&&toMode==='components')return type==='L'?value/omega*1000:1/(omega*Math.max(value,.000000001))*1e6;return value;}
function switchSeriesInputMode(next){
  if(next===seriesInputMode)return;const omega=2*Math.PI*Math.max(.1,num('rlcF'));for(let i=1;i<=3;i++){const type=$(`seriesCompType${i}`).value,value=num(`seriesCompValue${i}`);$(`seriesCompValue${i}`).value=convertComponentValue(type,value,seriesInputMode,next,omega).toFixed(3);}
  seriesInputMode=next;syncInputModeUI();drawRlc();
}
function switchParallelInputMode(next){
  if(next===parallelInputMode)return;const U=Math.max(0,num('parU')),omega=2*Math.PI*Math.max(.1,num('parF')),currentIds=['parIRInput','parILInput','parICInput'],angleIds=['parIRAngle','parILAngle','parICAngle'];for(let i=1;i<=3;i++){const type=$(`parallelCompType${i}`).value,value=Math.max(num(`parallelCompValue${i}`),.000000001);if(next==='currents'){let impedance=value;if(type!=='R'&&parallelInputMode==='components')impedance=type==='L'?omega*value/1000:1/(omega*value*1e-6);$(currentIds[i-1]).value=(U/impedance).toFixed(3);$(angleIds[i-1]).value=type==='R'?'0':type==='L'?'-90':'90';}else if(parallelInputMode==='currents'){const impedance=Math.max(U/Math.max(num(currentIds[i-1]),.000000001),.000000001);$(`parallelCompValue${i}`).value=(type==='R'?impedance:next==='reactance'?impedance:type==='L'?impedance/omega*1000:1/(omega*impedance)*1e6).toFixed(3);}else{$(`parallelCompValue${i}`).value=convertComponentValue(type,value,parallelInputMode,next,omega).toFixed(3);}}
  parallelInputMode=next;syncInputModeUI();drawParallel();
}
function updateAll(){drawAc();drawRlc();drawParallel();drawPower();drawThree();drawComp();drawConnections();drawTransformation();drawOhm();applyElectricalColorConvention();}
$$('input').forEach(input=>input.addEventListener('input',()=>{ if(input.id==='acPhi') $('acPhiRange').value=input.value; if(input.id==='powerCos') $('powerCosRange').value=input.value; updateAll(); }));
$('acPhiRange').addEventListener('input',e=>{$('acPhi').value=e.target.value;drawAc();});$('powerCosRange').addEventListener('input',e=>{$('powerCos').value=e.target.value;drawPower();});
$$('#seriesInputMode button').forEach(b=>b.addEventListener('click',()=>switchSeriesInputMode(b.dataset.seriesMode)));
$$('#parallelInputMode button').forEach(b=>b.addEventListener('click',()=>switchParallelInputMode(b.dataset.parallelMode)));
$$('#seriesComponentCount button').forEach(b=>b.addEventListener('click',()=>{seriesComponentCount=Number(b.dataset.count);syncComponentBuilders();drawRlc();}));
$$('#parallelComponentCount button').forEach(b=>b.addEventListener('click',()=>{parallelComponentCount=Number(b.dataset.count);syncComponentBuilders();drawParallel();}));
$$('#seriesComponentBuilder select').forEach(select=>select.addEventListener('change',()=>{syncComponentBuilders();drawRlc();}));
$$('#parallelComponentBuilder select').forEach(select=>select.addEventListener('change',()=>{const index=Number(select.id.slice(-1)),type=select.value;if(parallelInputMode==='currents')$(['parIRAngle','parILAngle','parICAngle'][index-1]).value=type==='R'?'0':type==='L'?'-90':'90';syncComponentBuilders();drawParallel();}));
$$('#powerMode button').forEach(b=>b.addEventListener('click',()=>{$$('#powerMode button').forEach(x=>x.classList.remove('active'));b.classList.add('active');powerMode=Number(b.dataset.mode);drawPower();}));
$$('#threeConnection button').forEach(b=>b.addEventListener('click',()=>{$$('#threeConnection button').forEach(x=>x.classList.remove('active'));b.classList.add('active');threeConnection=b.dataset.connection;drawThree();}));
$$('#threeVoltageType button').forEach(b=>b.addEventListener('click',()=>{const next=b.dataset.voltage;if(next===threeVoltageType)return;const current=num('threeU'),converted=threeVoltageType==='line'?(threeConnection==='Y'?current/Math.sqrt(3):current):(threeConnection==='Y'?current*Math.sqrt(3):current);$('threeU').value=converted.toFixed(2);$$('#threeVoltageType button').forEach(x=>x.classList.remove('active'));b.classList.add('active');threeVoltageType=next;drawThree();}));
$$('#threeCurrentType button').forEach(b=>b.addEventListener('click',()=>{$$('#threeCurrentType button').forEach(x=>x.classList.remove('active'));b.classList.add('active');threeCurrentView=b.dataset.current;drawThree();}));
$$('#ohmTarget button').forEach(b=>b.addEventListener('click',()=>{$$('#ohmTarget button').forEach(x=>x.classList.remove('active'));b.classList.add('active');ohmTarget=b.dataset.target;renderOhmInputs();}));
$$('#transformDirection button').forEach(b=>b.addEventListener('click',()=>{$$('#transformDirection button').forEach(x=>x.classList.remove('active'));b.classList.add('active');transformDirection=b.dataset.transform;drawTransformation();}));
function activatePage(id,push=true){const page=$(id)||$('vekselstroem');$$('.page').forEach(p=>p.classList.toggle('active',p===page));$$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.page===page.id));$('pageTitle').textContent=page.dataset.title;if(push)history.replaceState(null,'',`#${page.id}`);document.body.classList.remove('menu-open');$('menuButton').setAttribute('aria-expanded','false');window.scrollTo({top:0,behavior:'auto'});}
$$('.nav-item').forEach(b=>b.addEventListener('click',()=>activatePage(b.dataset.page)));$('menuButton').addEventListener('click',()=>{const open=document.body.classList.toggle('menu-open');$('menuButton').setAttribute('aria-expanded',String(open));});
$('resetButton').addEventListener('click',()=>{const active=document.querySelector('.page.active');if(!active)return;$$('input',active).forEach(i=>{if(defaults[i.id]!==undefined)i.value=defaults[i.id];});$$('select',active).forEach(s=>{if(selectDefaults[s.id]!==undefined)s.value=selectDefaults[s.id];});if(active.id==='serie'){seriesInputMode='components';seriesComponentCount=3;}if(active.id==='parallel'){parallelInputMode='components';parallelComponentCount=3;}if(active.id==='effekt'){powerMode=1;$$('#powerMode button').forEach((b,i)=>b.classList.toggle('active',i===0));}if(active.id==='trefaset'){threeConnection='Y';threeVoltageType='line';threeCurrentView='line';$$('#threeConnection button').forEach((b,i)=>b.classList.toggle('active',i===0));$$('#threeVoltageType button').forEach((b,i)=>b.classList.toggle('active',i===0));$$('#threeCurrentType button').forEach((b,i)=>b.classList.toggle('active',i===0));}if(active.id==='transformation'){transformDirection='delta-star';$$('#transformDirection button').forEach((b,i)=>b.classList.toggle('active',i===0));}if(active.id==='ellove'){ohmTarget='U';$$('#ohmTarget button').forEach((b,i)=>b.classList.toggle('active',i===0));renderOhmInputs();}syncInputModeUI();updateAll();});
document.addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;const i=Number(e.key)-1;if(i>=0&&i<9)activatePage($$('.nav-item')[i].dataset.page);});
window.addEventListener('hashchange',()=>activatePage(location.hash.slice(1),false));
let scaleMode='auto',manualScale=1;
try{const saved=localStorage.getItem('vektorlab-scale');if(saved&&saved!=='auto'){scaleMode='manual';manualScale=clamp(Number(saved)||1,.85,1.35);}}catch(e){}
function automaticScale(){const width=window.innerWidth;return width>=2200?1.22:width>=1800?1.15:width>=1500?1.07:1;}
function applyDisplayScale(){const effective=window.innerWidth<=760?1:scaleMode==='auto'?automaticScale():manualScale;document.documentElement.style.setProperty('--ui-zoom',effective);$('scaleAuto').textContent=`${scaleMode==='auto'?'Auto · ':''}${Math.round(effective*100)}%`;}
function saveScale(value){try{localStorage.setItem('vektorlab-scale',value);}catch(e){}}
$('scaleDown').addEventListener('click',()=>{const current=scaleMode==='auto'?automaticScale():manualScale;scaleMode='manual';manualScale=clamp(Math.round((current-.1)*100)/100,.85,1.35);saveScale(String(manualScale));applyDisplayScale();});
$('scaleUp').addEventListener('click',()=>{const current=scaleMode==='auto'?automaticScale():manualScale;scaleMode='manual';manualScale=clamp(Math.round((current+.1)*100)/100,.85,1.35);saveScale(String(manualScale));applyDisplayScale();});
$('scaleAuto').addEventListener('click',()=>{scaleMode='auto';saveScale('auto');applyDisplayScale();});
window.addEventListener('resize',()=>{if(scaleMode==='auto')applyDisplayScale();});
applyDisplayScale();renderOhmInputs();syncInputModeUI();activatePage(location.hash.slice(1)||'vekselstroem',false);updateAll();installDiagramExpanders();window.addEventListener('load',()=>window.scrollTo({top:0,behavior:'auto'}),{once:true});setTimeout(()=>window.scrollTo(0,0),350);
