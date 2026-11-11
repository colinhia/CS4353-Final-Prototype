import { ItemImage } from '../components/ui/ItemImage';
import { useState } from 'react';
import { useApp } from '../app/context';
import { COMPLIMENTS } from '../app/domain';
import { ErrorText, Modal } from '../components/ui/shared';
import { PhotoField } from '../components/ui/PhotoField';
import { ComplimentTile, StarSticker } from '../components/ui/ReviewCard';

export function ReviewSheet({loanId,onClose}:{loanId:string;onClose:()=>void}) {
    const {store,perform,toast,busy:saving}=useApp();
    const existing=store.loans.find(l=>l.id===loanId&&l.borrowerId===store.activeUserId)?.review;
    const [rating,setRating]=useState(existing?.rating??0);
    const [text,setText]=useState(existing?.text??'');
    const [compliments,setCompliments]=useState<string[]>(existing?.compliments??[]);
    const [photo,setPhoto]=useState(existing?.photo??'');
    const [busy,setBusy]=useState(false);const [error,setError]=useState('');
    const loan=store.loans.find(l=>l.id===loanId&&l.borrowerId===store.activeUserId);

    if(!loan)
        return (
            <Modal title="Review unavailable" onClose={onClose}>
                <p>Only the borrower can review this loan.</p>
            </Modal>
        );

    const item=store.items.find(i=>i.id===loan.itemId)!;
    return (
        <Modal title="Review your loan" onClose={onClose} className="review-sheet">
            <div className="review-item">
                <ItemImage src={item.image} alt="" width={64} height={64}/>
                <strong>{item.title??item.name}</strong>
            </div>

            <form onSubmit={async e=>{
                e.preventDefault();
                const result=await perform({type:existing?'edit-review':'submit-review',loanId,rating,text,compliments,...(photo?{photo}:{})});
                if (!result.ok) {
                    setError(result.error);
                    return;
                }
                toast('Thank you! Your review has been saved.');
                onClose();
            }}>

                <fieldset className="rating-group">
                    <legend>How was your experience?</legend>
                    <div className="rating-stickers">
                        {[1,2,3,4,5].map(value=>
                        <label key={value}>
                            <input className="sr-only" type="radio" name="rating" value={value} checked={rating===value} onChange={()=>setRating(value)}/>
                            <StarSticker on={value<=rating} size={50}/>
                            <span className="sr-only">{value} {value===1?'star':'stars'}</span>
                        </label>)
                        }
                    </div>
                </fieldset>
                <label>Your review
                    <textarea value={text} onChange={e=>setText(e.target.value)} maxLength={2000} required placeholder="What went well?"/>
                </label>
                <fieldset className="rating-group">
                    <legend>Give a compliment</legend>
                    <ul className="compliment-tiles">{COMPLIMENTS.map(c=>
                        <li key={c}>
                            <button disabled={saving} type="button" aria-pressed={compliments.includes(c)}
                                    onClick={()=>setCompliments(values=>values.includes(c)?values.filter(v=>v!==c):[...values,c])}>
                                <ComplimentTile name={c} selected={compliments.includes(c)}/>
                            </button>
                        </li>)}
                    </ul>
                </fieldset>

                <PhotoField label="Review photo (optional)" value={photo} onChange={setPhoto} onBusyChange={setBusy}/>
                <p className="review-privacy">Your review will be added to this item's journey. Your name won't be shown with it, except to the owner.</p>
                <ErrorText text={error}/>
                <div className="form-actions">
                    <button disabled={saving} className="button" type="button" onClick={onClose}>Cancel</button>
                    <button className="button primary" type="submit" disabled={saving||busy||!rating||!text.trim()}>Submit review</button>
                </div>
            </form>
        </Modal>
    );
}
