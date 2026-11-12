import test from 'node:test';
import assert from 'node:assert/strict';
import {itemReviews} from './item-reviews.ts';
import {createSeed} from './seed.ts';
test('all readers see the same item reviews regardless of private loan visibility',()=>{
 const base=createSeed('2026-11-13');
 const review={rating:5,text:'Great tent',compliments:[],at:'2026-11-13T00:00:00Z'};
 base.receivedReviews=[{id:'one',ownerId:'maya',itemId:'tent',review},{id:'two',ownerId:'maya',itemId:'tent',review:{...review,text:'Second review',at:'2026-11-12T00:00:00Z'}},{id:'other',ownerId:'maya',itemId:'other-item',review}];
 for(const user of ['eric','ben','sarah']){
  const state={...base,activeUserId:user,loans:user==='eric'?base.loans:[]};
  assert.deepEqual(itemReviews(state,'tent',false).map(r=>r.id),['one','two']);
  assert.ok(itemReviews(state,'tent',false).every(r=>!r.authorId));
 }
});
test('owner can still see authors from private loans',()=>{
 const state=createSeed('2026-11-13');const loan=state.loans[0];loan.review={rating:5,text:'Great tent',compliments:[],at:'2026-11-13T00:00:00Z'};
 assert.equal(itemReviews(state,loan.itemId,true)[0].authorId,loan.borrowerId);
});
