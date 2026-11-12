import type { Store, Review } from './domain.ts';

export type ItemReview = {id:string;review:Review;authorId?:string};
export function itemReviews(store:Store,itemId:string,viewerOwnsItem:boolean):ItemReview[]{
  // Owners can attribute reviews using their private loan history. Other readers
  // use the public review projection, never participant-restricted loans.
  const entries:ItemReview[]=viewerOwnsItem
    ? store.loans.filter(l=>l.itemId===itemId&&l.review).map(l=>({id:l.id,review:l.review!,authorId:l.borrowerId}))
    : (store.receivedReviews??[]).filter(r=>r.itemId===itemId).map(r=>({id:r.id,review:r.review}));
  return entries.sort((a,b)=>b.review.at.localeCompare(a.review.at));
}
