import Link from 'next/link';
import type { Transaction, User } from '@/lib/types';
import { date, money } from '@/lib/types';
import { Empty } from './ui';
import { SubscriptionOverview } from './membership';

export function PurchaseHistory({ purchases }: { purchases: Transaction[] }) {
  if (!purchases.length) return <Empty title="Your collection starts here." description="Completed artwork purchases will appear here with the artist, price and purchase date." action={<Link href="/browse" className="button button-outline">Browse artworks</Link>}/>;
  return <div className="table-wrap"><table>
    <thead><tr><th>Artwork</th><th>Artist</th><th>Price</th><th>Purchase date</th></tr></thead>
    <tbody>{purchases.map(purchase => <tr key={purchase._id}>
      <td><div className="table-art">{purchase.image && <img src={purchase.image} alt=""/>}<div><Link href={`/artworks/${purchase.artworkId}`}><strong>{purchase.title}</strong></Link>{purchase.demo && <span className="sample-tag">Sample transaction</span>}</div></div></td>
      <td>{purchase.artistName}</td><td className="nowrap">{money(purchase.amount)}</td><td className="nowrap">{date(purchase.createdAt)}</td>
    </tr>)}</tbody>
  </table></div>;
}

export function PurchasedArtworks({ purchases }: { purchases: Transaction[] }) {
  if (!purchases.length) return <Empty title="A collection waiting to happen." description="The artworks you purchase will have a home here." action={<Link href="/browse" className="button">Explore artworks</Link>}/>;
  return <div className="collection-grid">{purchases.map(purchase => <Link href={`/artworks/${purchase.artworkId}`} className="collection-card" key={purchase._id}>
    <div className="collection-image"><img src={purchase.image} alt={purchase.title}/>{purchase.demo && <span className="art-category">Sample collection</span>}</div>
    <h3>{purchase.title}</h3><p>{purchase.artistName} · {date(purchase.createdAt)}</p>
  </Link>)}</div>;
}

export function BuyerOverview({ purchases, user }: { purchases: Transaction[]; user: User }) {
  return <>
    <section className="dashboard-panel" aria-labelledby="buyer-purchases">
      <div className="panel-heading"><h2 id="buyer-purchases">Purchase history</h2><Link href="/dashboard/user?tab=purchases">View all purchases</Link></div>
      <PurchaseHistory purchases={purchases.slice(0, 5)}/>
    </section>
    <section className="dashboard-panel" aria-labelledby="buyer-collection">
      <div className="panel-heading"><h2 id="buyer-collection">Bought artworks</h2><Link href="/dashboard/user?tab=collection">View collection</Link></div>
      <p className="buyer-section-description">Open an artwork to view its details and add, edit or delete your own comments.</p>
      <PurchasedArtworks purchases={purchases.slice(0, 3)}/>
    </section>
    <SubscriptionOverview/>
    <section className="dashboard-panel" aria-labelledby="buyer-profile">
      <div className="panel-heading"><h2 id="buyer-profile">Profile management</h2></div>
      <div className="buyer-profile-summary"><div><strong>{user.name}</strong><p>{user.email}</p></div><div className="buyer-profile-actions">
        <Link href="/dashboard/user?tab=profile#profile-details" className="button button-outline">Edit profile</Link>
        <Link href="/dashboard/user?tab=profile#change-password" className="button button-outline">Change password</Link>
      </div></div>
    </section>
  </>;
}
