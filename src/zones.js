import {planPoint} from './house/house-layout.js';

// Where each PennyGame furniture zone lives in the real house. Plan coordinates
// use the same private drawing grid as house-layout.js; a zone is a point the
// navigation graph turns into one or more standing spots beside the furniture.
const zone=(id,label,emoji,plan,room,{radius=1.5,seats=6,hint}={})=>({id,label,emoji,plan,room,radius,seats,hint,position:planPoint(...plan)});
export const ZONES={
 table: zone('table','dining table','🍽️',[416,802],'dining',{radius:1.7,hint:'in the dining room'}),
 toilet:zone('toilet','powder room','🚽',[385,440],'powder',{radius:1.4,seats:2,hint:'off the hallway'}),
 bed:   zone('bed','main bedroom bed','🛏️',[650,331],'bedroom',{radius:1.6,seats:3,hint:'in the main bedroom'}),
 kidbed:zone('kidbed','second bedroom bed','🛏️',[980,400],'guest',{radius:1.8,seats:3,hint:'in the second bedroom'}),
 mat:   zone('mat','meditation alcove','🧘',[563,228],'meditation',{radius:1.5,seats:3,hint:'past the main bedroom'}),
 walk:  zone('walk','living balcony','🌿',[262,620],'balcony',{radius:1.8,seats:4,hint:'through the living room sliders'}),
 tv:    zone('tv','games corner','🎮',[470,445],'passage',{radius:1.6,seats:4,hint:'by the claw machine'}),
 tub:   zone('tub','main bathroom','🛁',[905,215],'bath',{radius:1.6,seats:2,hint:'past the vanity'}),
 desk:  zone('desk','home office desk','💼',[890,585],'study',{radius:1.7,seats:4,hint:'in the home office'}),
 bowls: zone('bowls','kitchen pet bowls','🥣',[592,782],'kitchen',{radius:1.6,seats:3,hint:'in the kitchen'}),
 sofa:  zone('sofa','living room sofa','☕',[430,620],'living',{radius:1.8,seats:6,hint:'in the sunken living room'}),
};

export const NEEDS=[
 {id:'eat',      emoji:'🍔', verb:'fed',                  zone:'table', want:'is hungry'},
 {id:'drink',    emoji:'🥤', verb:'given a drink',        zone:'table', want:'is thirsty'},
 {id:'bathroom', emoji:'🚽', verb:'sent to the bathroom', zone:'toilet',want:'needs the bathroom'},
 {id:'sleep',    emoji:'😴', verb:'tucked in',            zone:'bed',   want:'is sleepy'},
 {id:'exercise', emoji:'🏋️', verb:'exercised',            zone:'mat',   want:'wants to exercise'},
 {id:'play',     emoji:'🎮', verb:'played with',          zone:'tv',    want:'wants to play'},
 {id:'bathe',    emoji:'🛁', verb:'bathed',               zone:'tub',   want:'needs a bath'},
];
export const BREAK_NEED={id:'break', emoji:'☕', verb:'given a break', zone:'sofa', want:'needs a break from work'};
export const PET_NEEDS=[
 {id:'eat',      emoji:'🍖', verb:'fed',       zone:'bowls', want:'is hungry'},
 {id:'exercise', emoji:'🎾', verb:'exercised', zone:'walk',  want:'wants a walk'},
];

// Children under twelve sleep in the second bedroom; everyone else in the main bed.
export function zoneForNeed(c,need){
 if(need.zone==='bed'&&!c.isPet&&c.age<12)return ZONES.kidbed;
 return ZONES[need.zone];
}
