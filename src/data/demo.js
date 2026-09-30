export const demoImage='https://images.unsplash.com/photo-1497435334941-8c899ee9e8e9?auto=format&fit=crop&w=1600&q=85';
export const demoAssets=[
 {id:'asset_00123',name:'shoreline-survey-014.jpg',location:'Kaveri Lake · North shore',date:'14 Jun 2026',image:demoImage,tag:'ILLUSTRATIVE DEMO',elements:['Water','Tree','Person','Waste'],source:'demo/shoreline-survey-014',confidence:94},
 {id:'asset_00124',name:'school-tank-before.jpg',location:'Mysuru · Ward 12',date:'02 Jun 2026',image:'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=900&q=80',tag:'ORIGINAL',elements:['Building','Equipment','Person'],source:'demo/school-tank-before',confidence:91},
 {id:'asset_00125',name:'plantation-day-08.jpg',location:'Kaveri Lake · East bank',date:'18 Jun 2026',image:'https://images.unsplash.com/photo-1497250681960-ef046c08a56e?auto=format&fit=crop&w=900&q=80',tag:'ORIGINAL',elements:['Tree','Person','Equipment'],source:'demo/plantation-day-08',confidence:96}
];
export const elements=[
 {id:'waste',label:'Waste',color:'#e9a85c',confidence:88,category:'Environmental signal',region:{left:18,top:62,width:24,height:18},observation:'Multiple plastic-like objects are visible near the shoreline.',interpretation:'The area may contain accumulated waste.',count:'6 objects'},
 {id:'water',label:'Water',color:'#67c3c8',confidence:99,category:'Natural feature',region:{left:3,top:5,width:94,height:57},observation:'A large continuous reflective water surface is visible.',interpretation:'Likely a lake, reservoir, or river edge.',count:'1 surface'},
 {id:'tree',label:'Tree',color:'#91b86c',confidence:97,category:'Vegetation',region:{left:62,top:17,width:28,height:67},observation:'Dense green canopy and a visible trunk are present.',interpretation:'Mature tree providing shade near the waterline.',count:'3 detected'},
 {id:'person',label:'Person',color:'#cf8aa9',confidence:96,category:'Human presence',region:{left:44,top:39,width:10,height:37},observation:'A person is visible standing on the shoreline.',interpretation:'Field activity is taking place at the site.',count:'2 detected'},
 {id:'building',label:'Building',color:'#b4a1de',confidence:72,category:'Built environment',region:{left:72,top:35,width:22,height:26},observation:'A low built structure is visible beyond the vegetation.',interpretation:'Possible site infrastructure.',count:'1 detected'}
];
