export interface Product {
  id?: string;
  name: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  available: boolean;
  featured?: boolean;
  imageUrl: string;
  rating: number;
  tags?: string[];
  createdAt?: Date | null;
}

export interface CartItem {
  product: Product;
  quantity: number;
}
