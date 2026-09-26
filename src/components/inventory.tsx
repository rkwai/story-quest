import type { PlayerView } from '@/engine/types';

export type CarriedItem = NonNullable<PlayerView['inventory']>[number];
export type InventoryAction = 'use' | 'drop' | 'consume';

export function Inventory({items,legacyPossessions,readOnly,busy,onAction}: {
  items:CarriedItem[]|undefined;
  legacyPossessions:string[];
  readOnly:boolean;
  busy:boolean;
  onAction:(item:CarriedItem,action:InventoryAction)=>void;
}) {
  const count=items?.reduce((total,item)=>total+item.quantity,0)??legacyPossessions.length;
  return <section className="inventory" aria-labelledby="inventory-heading">
    <div className="inventory-heading"><h3 id="inventory-heading">What you carry</h3><span>{count} {count===1?'item':'items'}</span></div>
    {!readOnly&&<p className="muted inventory-help">Your gear shapes what you can do. Choose an item, then describe your action before sending it.</p>}
    {items===undefined?legacyPossessions.map((name,index)=><div className="list-row" key={`${index}:${name}`}>{name}</div>):items.map(item=><article className="inventory-item" key={item.id} aria-label={`${item.name}, quantity ${item.quantity}`}>
      <div className="inventory-item-heading"><h4>{item.name}</h4><span className="item-quantity" aria-label={`Quantity ${item.quantity}`}>×{item.quantity}</span></div>
      <p className="inventory-item-state">{item.usable?'Ready to use':'Cannot be used'}{item.consumable?' · Consumable':''}</p>
      {!readOnly&&<div className="inventory-actions">
        <button type="button" disabled={busy||!item.usable} onClick={()=>onAction(item,'use')}>Use</button>
        {item.consumable&&<button type="button" disabled={busy||!item.usable} onClick={()=>onAction(item,'consume')}>Consume one</button>}
        <button type="button" disabled={busy} onClick={()=>onAction(item,'drop')}>Drop</button>
      </div>}
    </article>)}
    {count===0&&<p className="muted">You are not carrying any items. Look around for things you can acquire, or act without equipment.</p>}
  </section>;
}
