(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ScavVisualCanvasFixtures=api;})(globalThis,()=>{
  // Isolated demonstration fixtures only. Not the live approved-image inventory,
  // not read by any save/history/publication service, and not game data.
  const approvedImages=Object.freeze([
    'images/branding/Scavland_Logo_2025.png',
    'images/scavland-banner.jpg.png',
    'images/scavlandmap_v5.png',
  ]);

  const defaultStyle=Object.freeze({fontSize:'md',textColor:'default',background:'none',border:'none',padding:'md',align:'left',spacing:'normal'});

  const sampleDocument=Object.freeze({
    id:'fixture-landing',
    title:'Fixture layout - demonstration only',
    blocks:[
      {id:'heading-block',type:'text',desktop:{x:0,y:0,w:12,h:4},mobileOrder:0,style:{...defaultStyle,fontSize:'xl',align:'center'},text:'Welcome to the visual canvas fixture.'},
      {id:'image-block',type:'image',desktop:{x:0,y:4,w:6,h:10},mobileOrder:2,style:{...defaultStyle,background:'surface',border:'thin'},image:approvedImages[0],alt:'Scavland logo fixture'},

      {id:'text-block',type:'text',desktop:{x:6,y:4,w:6,h:10},mobileOrder:1,style:{...defaultStyle,background:'subtle',padding:'lg'},text:'This text block sits beside the image on desktop and stacks above it on mobile, demonstrating independent desktop position and mobile order.'},
      {id:'card-block',type:'card',desktop:{x:0,y:14,w:4,h:14},mobileOrder:3,style:{...defaultStyle,background:'subtle',border:'thick',align:'center'},title:'Fixture card',text:'A card block with an approved image, title, text and safe link.',image:approvedImages[1],alt:'Scavland banner fixture',href:'items.html'},
    ],
  });

  return Object.freeze({approvedImages,defaultStyle,sampleDocument});
});
