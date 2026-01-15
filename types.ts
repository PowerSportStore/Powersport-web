
export type UserRole = 'admin' | 'viewer';

export interface Product {
  id: string;
  brand: string;
  name: string;
  size: string;
  color: string;
  price: number;
  cost: number;
  category: string;
  image: string;
  addedAt: number;
  quantity: number;
}

export interface CartItem {
  productId: string;
  quantity: number;
}

export interface SaleRecord {
  id: string;
  productId: string;
  productName: string;
  size: string;
  price: number;
  buyerName: string;
  soldAt: number;
}

export interface StoreData {
  code: string;
  sheetId?: string; 
  webhookUrl?: string; 
  whatsappNumber?: string; // Número para recibir pedidos
  products: Product[];
  sales: SaleRecord[];
}

export type ViewType = 'inventory' | 'backoffice' | 'add' | 'catalog' | 'settings';
