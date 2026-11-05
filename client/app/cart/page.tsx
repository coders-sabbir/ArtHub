import { Cart } from '@/components/cart';
import { Protected } from '@/components/protected';

export default function CartPage() {
  return <Protected role="user"><Cart/></Protected>;
}
