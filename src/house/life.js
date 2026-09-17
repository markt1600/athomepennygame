// Minimal stand-in for At Home's life state: the house modules only need the
// clock helper and the pet roster (positions and sprite heights).
export const timeOfDay=hours=>((hours%24)+24)%24;
export const PETS=[
 {id:'sunny',name:'Leo',kind:'dog',emoji:'🐶',height:.40,plan:[472,681],carePlan:[570,800]},
 {id:'miso',name:'Cyrus',kind:'cat',emoji:'🐱',height:.40,plan:[429,678],carePlan:[570,764]},
 {id:'pebble',name:'Pebble',kind:'tortoise',emoji:'🐢',height:.20,plan:[350,851],carePlan:[570,836]}
];
