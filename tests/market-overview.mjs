import assert from 'node:assert/strict';
import {buildMarketOverview} from '../src/lib/marketOverview.ts';
const row=(id,price,listings,changePct,extra={})=>({
  id:String(id),price,listings,changePct,
  region:'NA East',server:'Siel (Elyos)',observedAt:'2026-10-26T22:00:00Z',
  history:[],...extra
});
{
  const view=buildMarketOverview([
    row(101,500,4,4),row(102,200,120,-10),
    row(103,900,1,500),row(104,300,9,30)
  ]);
  assert.equal(view.expensive.title,'Most expensive listings');
  assert.equal(view.expensive.items[0].id,'103');
  assert.equal(view.volume.title,'Most listed items');
  assert.equal(view.volume.items[0].id,'102');
  assert.equal(view.hot.title,'Hot items');
  assert.equal(view.hot.items[0].id,'104','illiquid 500% mover must be filtered out');
  assert.equal(view.listedItems,4);
  assert.equal(view.totalListings,134);
  assert.equal(view.soldCoverage,0,'offers must not be labeled sales');
}
{
  const view=buildMarketOverview([
    row(101,500,4,4,{unitsSold:3,soldMaxPrice:1000}),
    row(102,200,120,-10,{unitsSold:80,soldMaxPrice:600}),
    row(103,900,1,500)
  ]);
  assert.equal(view.expensive.title,'Highest sale prices');
  assert.equal(view.expensive.items[0].id,'101');
  assert.equal(view.volume.title,'Most sold items');
  assert.equal(view.volume.items[0].id,'102');
}
{
  const old=row(101,999,11,3,{observedAt:'2026-10-25T22:00:00Z'});
  const fresh=row(101,2,6,4);
  const view=buildMarketOverview([old,fresh]);
  assert.equal(view.listedItems,1);
  assert.equal(view.expensive.items[0].price,2);
}
{
  const view=buildMarketOverview([]);
  assert.equal(view.listedItems,0);
  assert.equal(view.expensive.items.length,0);
  assert.equal(view.volume.items.length,0);
}
console.log('Market ranking checks passed');
